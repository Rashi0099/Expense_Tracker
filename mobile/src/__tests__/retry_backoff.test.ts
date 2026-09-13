import { describe, it, expect, beforeEach } from 'vitest';
import { MemorySQLiteAdapter } from '../database/sqlite/DatabaseConnection';
import { DatabaseManager } from '../database/sqlite/DatabaseManager';
import { SQLiteSyncOutboxRepository, MAX_RETRY_COUNT, BASE_DELAY_MS } from '../database/repositories/SQLiteSyncOutboxRepository';

describe('Professional Offline Sync Retry & Exponential Backoff', () => {
  let memoryDb: MemorySQLiteAdapter;
  let outboxRepo: SQLiteSyncOutboxRepository;
  const userId = 'retry_test_user_001';

  beforeEach(async () => {
    await DatabaseManager.getInstance().close();
    memoryDb = new MemorySQLiteAdapter();
    await DatabaseManager.getInstance().initialize(memoryDb);
    DatabaseManager.getInstance().setCurrentUser(userId);
    outboxRepo = new SQLiteSyncOutboxRepository();
  });

  it('marks failed operations with exponential backoff and jitter', async () => {
    const opId = 'op_fail_001';
    await memoryDb.executeSql(
      `INSERT INTO sync_outbox (
        operation_id, user_id, entity_type, entity_id, operation, payload, base_version, created_at, retry_count, status
      ) VALUES (?, ?, 'EXPENSE', 'exp_001', 'CREATE', '{}', 0, ?, 0, 'PENDING')`,
      [opId, userId, new Date().toISOString()]
    );

    expect(await outboxRepo.countPending()).toBe(1);

    const beforeFail = Date.now();
    await outboxRepo.markFailed(opId, 'Network timeout 504');

    const rowRes = await memoryDb.executeSql<{ retry_count: number; next_retry_at: string; last_error: string; status: string }>(
      `SELECT retry_count, next_retry_at, last_error, status FROM sync_outbox WHERE operation_id = ?`,
      [opId]
    );
    const row = rowRes.rows[0];
    expect(row.retry_count).toBe(1);
    expect(row.status).toBe('FAILED');
    expect(row.last_error).toBe('Network timeout 504');
    expect(row.next_retry_at).toBeDefined();

    const nextRetryTime = new Date(row.next_retry_at).getTime();
    expect(nextRetryTime).toBeGreaterThanOrEqual(beforeFail + BASE_DELAY_MS);

    const nearestRetry = await outboxRepo.getNextRetryAt?.();
    expect(nearestRetry).toBe(row.next_retry_at);
  });

  it('permanently fails operations that exceed MAX_RETRY_COUNT', async () => {
    const opId = 'op_permanent_fail';
    await memoryDb.executeSql(
      `INSERT INTO sync_outbox (
        operation_id, user_id, entity_type, entity_id, operation, payload, base_version, created_at, retry_count, status
      ) VALUES (?, ?, 'EXPENSE', 'exp_002', 'CREATE', '{}', 0, ?, ?, 'FAILED')`,
      [opId, userId, new Date().toISOString(), MAX_RETRY_COUNT - 1]
    );

    await outboxRepo.markFailed(opId, 'Corrupt entity schema');

    const checkRes = await memoryDb.executeSql<{ retry_count: number; next_retry_at: string | null; last_error: string }>(
      `SELECT retry_count, next_retry_at, last_error FROM sync_outbox WHERE operation_id = ?`,
      [opId]
    );
    const row = checkRes.rows[0];
    expect(row.retry_count).toBe(MAX_RETRY_COUNT);
    expect(row.next_retry_at).toBeNull();
    expect(row.last_error).toContain('[PERMANENT]');

    const permFailed = await outboxRepo.countPermanentlyFailed?.();
    expect(permFailed).toBe(1);

    await outboxRepo.resetFailed?.(opId);
    const resetRes = await memoryDb.executeSql<{ status: string; retry_count: number; next_retry_at: string | null }>(
      `SELECT status, retry_count, next_retry_at FROM sync_outbox WHERE operation_id = ?`,
      [opId]
    );
    expect(resetRes.rows[0].status).toBe('PENDING');
    expect(resetRes.rows[0].retry_count).toBe(0);
    expect(resetRes.rows[0].next_retry_at).toBeNull();
  });
});
