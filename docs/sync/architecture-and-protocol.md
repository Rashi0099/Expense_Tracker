# Offline-First & Synchronization Architecture Specification

## 1. Architectural Foundation
- **Local Database:** SQLite via `react-native-quick-sqlite` storing financial data in **Minor Units (Integer Cents)**.
- **Identity Strategy:** Client-generated **UUIDv7** across all entities.
- **Authoritative Truth:** PostgreSQL 16 with monotonic per-user **`server_sequence`** counters.
- **Sync Gateway:** Single atomic round-trip endpoint: `POST /api/v1/sync/`.

---

## 2. Sync Outbox Architecture (`sync_outbox`)
All offline creates, updates, and deletes are committed atomically into `sync_outbox` inside local SQLite transactions.

```sql
CREATE TABLE sync_outbox (
    operation_id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    operation TEXT NOT NULL,
    payload TEXT NOT NULL,
    base_version INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    retry_count INTEGER NOT NULL DEFAULT 0,
    next_retry_at TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING',
    last_error TEXT
);
```

---

## 3. Idempotency & Conflict Resolution
1. **Idempotency:** Server evaluates `sync_operation_logs` by client `operation_id`. Duplicated requests return cached `ACCEPTED` without duplicate row insertion.
2. **Conflict Detection:** Evaluated via optimistic locking `base_version < server.current_version`.
3. **Resolution Policy:**
   - Non-overlapping field updates ➔ **Field-Level Merge**.
   - Overlapping field updates ➔ **Last-Arriving Write Wins (LWW)** with version increment.
   - Authoritative consolidated state returned to client in `serverChanges`.

---

## 4. Deletion & Tombstone Semantics
- Deletions are recorded in PostgreSQL `tombstones` with sequence tags.
- Client pulls tombstones and purges local SQLite rows: `DELETE FROM expenses WHERE id = :id`.
- 90-day tombstone retention period.

---

## 5. Offline Dashboard
Calculated dynamically in SQLite in real time (< 15ms) without network calls:
- Total income & expenses
- Net savings rate
- Category breakdown
- Budget progress
