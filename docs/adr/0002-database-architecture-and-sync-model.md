# ADR 0002: Database Architecture, Financial Precision, and Offline-First Sync

## Status
Accepted and Frozen

## Context
A production-grade expense tracker requires:
1. Multi-device support with reliable offline-first mobile usage.
2. High-speed local expense capture on mobile (< 100ms response).
3. Resilient synchronization across flaky networks without duplicate mutations.
4. Strict financial precision avoiding floating-point rounding errors.
5. Preserving historical financial reports even if categories are removed.

## Decisions

1. **Server Source of Truth:** PostgreSQL 16 is the authoritative database.
2. **Primary Key Standard:** UUIDv7 across all domain models. Client-generated to enable autonomous offline creation without ID collisions or B-tree index fragmentation.
3. **Financial Precision:** 
   - Server stores money as `NUMERIC(12, 2)`.
   - SQLite on mobile stores money as **Minor Units (Integer Cents)** to eliminate JavaScript IEEE-754 precision errors.
4. **Calendar Date Invariant:** `transaction_date` is stored strictly as `DATE` (`YYYY-MM-DD`), preventing timezone shifts across international borders.
5. **Synchronization Protocol:** Monotonic `server_sequence` (64-bit integer per user) drives delta synchronization instead of wall-clock timestamps.
6. **Idempotency Guarantee:** `sync_operation_logs` enforces uniqueness on client `operation_id` to absorb network retries safely.
7. **Deletion Safety:** Categories enforce `ON DELETE RESTRICT` to preserve relational integrity with historical expenses. Soft-deletes (`deleted_at`) and `tombstones` propagate deletions to offline clients.
