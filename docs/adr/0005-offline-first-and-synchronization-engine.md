# ADR 0005: Offline-First SQLite Architecture and Bidirectional Synchronization Engine

## Status
Accepted and Frozen

## Context
A production-grade mobile personal expense tracker requires:
1. Instant, sub-100ms expense capture regardless of network state.
2. Uninterrupted offline usage (read, create, edit, delete, dashboard calculation).
3. Resilient multi-device synchronization over flaky mobile connections.
4. Protection against duplicate transactions caused by dropped network responses.
5. Absolute financial precision without floating-point errors.

## Decisions

1. **Local-First Storage:** React Native relies on SQLite as its primary working store. All reads and writes commit to SQLite before touching any network socket.
2. **Monetary Storage Standard:** SQLite stores currency amounts strictly as **Integer Minor Units (Cents)**, preventing JavaScript IEEE-754 floating-point errors.
3. **UUIDv7 Identity Standard:** Primary keys are generated natively on client devices using UUIDv7, ensuring chronological index locality and zero ID collisions.
4. **Unified Sync Gateway:** Adopt a single atomic bi-directional sync endpoint (`POST /api/v1/sync/`) combining push mutation ingestion and pull delta extraction.
5. **Monotonic Sequence Cursor:** Delta synchronization relies strictly on PostgreSQL-generated 64-bit integer `server_sequence` numbers, eliminating clock-drift bugs.
6. **Idempotency Guarantee:** Client mutations carry an immutable `operationId` logged in `sync_operation_logs` on the server. Duplicate submissions are absorbed as safe no-ops.
7. **Conflict Resolution Policy:** Optimistic versioning with Field-Level Consolidation and Last-Arriving Write Wins (LWW) server fallback.
8. **Tombstone Deletion Propagation:** Deleted records emit tombstones tracked by sequence numbers, ensuring reliable propagation across all user devices.
