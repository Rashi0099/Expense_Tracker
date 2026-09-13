# Offline-First Synchronization & Conflict Model

## 1. Synchronization Sequence Architecture

```text
       MOBILE CLIENT (SQLite)                  SERVER (PostgreSQL 16)
┌───────────────────────────────────┐    ┌───────────────────────────────────┐
│ 1. Fast Local Mutation            │    │                                   │
│    - Generate UUIDv7              │    │                                   │
│    - Commit to SQLite (Atomic)    │    │                                   │
│    - Record in `sync_outbox`      │    │                                   │
└─────────────────┬─────────────────┘    │                                   │
                  │                      │                                   │
                  │ 2. Push Batch        │                                   │
                  │    POST /api/v1/sync │                                   │
                  ├─────────────────────►│ 3. Check `sync_operation_logs`    │
                  │                      │    - If exists: Idempotent return │
                  │                      │    - If new: Apply mutation       │
                  │                      │    - Increment `server_sequence`  │
                  │                      │    - Record in operation log      │
                  │                      │                                   │
                  │ 4. Delta Pull        │                                   │
                  │    since_sequence=N  │                                   │
                  ├─────────────────────►│ 5. Query:                         │
                  │                      │    SELECT * WHERE                 │
                  │                      │    server_sequence > :N           │
                  │◄─────────────────────┤    (includes tombstones)          │
                  │                      │                                   │
                  │ 6. Apply Ingestion   │                                   │
                  │    - Update SQLite   │                                   │
                  │    - Set last_seq    │                                   │
                  │    - Clear outbox    │                                   │
                  └──────────────────────┘                                   │
```

## 2. PostgreSQL ↔ SQLite Type & Entity Mapping

| Data Field | PostgreSQL (Server) | SQLite (Mobile Local) | Precision Rule / Transformation |
|---|---|---|---|
| `id` | `UUID` | `TEXT` | 36-character hyphenated UUIDv7 string. |
| `amount` | `NUMERIC(12,2)` | `INTEGER` | **Stored in Minor Units (Cents)**: $10.50 ➔ `1050`. Prevents floating point errors. |
| `transaction_date` | `DATE` | `TEXT` | ISO-8601 calendar date `'YYYY-MM-DD'`. |
| Timestamps | `TIMESTAMPTZ` | `TEXT` | ISO-8601 UTC `'YYYY-MM-DDTHH:mm:ss.sssZ'`. |
| Booleans | `BOOLEAN` | `INTEGER` | `1` (True) or `0` (False). |
| Sequence | `BIGINT` | `INTEGER` | 64-bit integer cursor. |

## 3. SQLite Outbox Table Schema
```sql
CREATE TABLE sync_outbox (
    operation_id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    operation TEXT NOT NULL,
    payload TEXT NOT NULL,
    base_version INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    retry_count INTEGER DEFAULT 0,
    last_error TEXT
);
```

## 4. Conflict Resolution Strategy

### Optimistic Locking with Monotonic Versioning
* Each syncable entity has an integer `version` field.
* Clients submit mutations specifying the `base_version` their edit originated from.
* If `base_version == current_server_version`: Update applies cleanly; `version = version + 1`.
* If `base_version < current_server_version`: Conflict detected.
  * **Field-Level Consolidation**: If modifications touch non-overlapping fields (e.g. Note vs Amount), changes are merged.
  * **Last-Write-Wins (LWW)**: For overlapping attributes, the server commit order takes precedence.
  * Server increments `version` and updates `server_sequence`. Client receives the consolidated record on subsequent delta pull.
