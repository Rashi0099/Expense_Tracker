import { ISyncOutboxRepository } from './interfaces/ISyncOutboxRepository';
import { SyncOutboxItem } from '../../domain/models';
import { SyncOutboxMapper } from '../../domain/mappers';
import { SQLiteSyncOutboxRow } from '../schema/types';
import { DatabaseManager } from '../sqlite/DatabaseManager';
import { getUTCTimestamp } from '../../utils/date';

/**
 * Retry Configuration Constants
 *
 * Exponential backoff formula:
 *   delay = min(BASE_DELAY_MS * 2^retryCount + jitter, MAX_DELAY_MS)
 *
 * Retry schedule (approximate):
 *   Retry 1: ~5s     Retry 5: ~80s     Retry 8:  ~640s (~10min)
 *   Retry 2: ~10s    Retry 6: ~160s    Retry 9:  ~1280s (~21min)
 *   Retry 3: ~20s    Retry 7: ~320s    Retry 10: ~1800s (30min cap)
 *   Retry 4: ~40s
 */
const MAX_RETRY_COUNT = 10;
const BASE_DELAY_MS = 5000;      // 5 seconds base
const MAX_DELAY_MS = 1800000;    // 30 minutes maximum

function computeNextRetryAt(retryCount: number): string {
  const exponentialDelay = BASE_DELAY_MS * Math.pow(2, retryCount);
  const jitter = Math.floor(Math.random() * BASE_DELAY_MS);
  const delay = Math.min(exponentialDelay + jitter, MAX_DELAY_MS);
  const nextRetry = new Date(Date.now() + delay);
  return nextRetry.toISOString();
}

export class SQLiteSyncOutboxRepository implements ISyncOutboxRepository {
  private getDb() {
    return DatabaseManager.getInstance().getDatabase();
  }

  private getUserId(): string {
    const userId = DatabaseManager.getInstance().getCurrentUser();
    if (!userId) {
      throw new Error('Database session must be scoped to an authenticated user ID.');
    }
    return userId;
  }

  /**
   * Returns items eligible for sync:
   * 1. PENDING items (fresh mutations)
   * 2. FAILED items where next_retry_at has elapsed and retry_count < MAX_RETRY_COUNT
   *
   * Ordered by created_at ASC to preserve causal ordering.
   */
  async getPending(limit = 50): Promise<SyncOutboxItem[]> {
    const db = this.getDb();
    const userId = this.getUserId();
    const now = getUTCTimestamp();

    const res = await db.executeSql<SQLiteSyncOutboxRow>(
      `SELECT * FROM sync_outbox
       WHERE user_id = ? AND (
         status = 'PENDING'
         OR (status = 'FAILED' AND retry_count < ? AND (next_retry_at IS NULL OR next_retry_at <= ?))
       )
       ORDER BY created_at ASC
       LIMIT ?`,
      [userId, MAX_RETRY_COUNT, now, limit]
    );

    return res.rows.map(SyncOutboxMapper.toDomain);
  }

  async markCompleted(operationId: string): Promise<void> {
    const db = this.getDb();
    const userId = this.getUserId();

    await db.executeSql(
      `UPDATE sync_outbox SET status = 'COMPLETED' WHERE operation_id = ? AND user_id = ?`,
      [operationId, userId]
    );
  }

  /**
   * Marks an operation as FAILED with exponential backoff scheduling.
   * After MAX_RETRY_COUNT attempts, the operation is permanently failed
   * and will not be retried.
   */
  async markFailed(operationId: string, error: string): Promise<void> {
    const db = this.getDb();
    const userId = this.getUserId();

    // Read current retry count to compute next delay
    const current = await db.executeSql<{ retry_count: number }>(
      `SELECT retry_count FROM sync_outbox WHERE operation_id = ? AND user_id = ?`,
      [operationId, userId]
    );

    const currentRetryCount = current.rows[0]?.retry_count ?? 0;
    const newRetryCount = currentRetryCount + 1;

    if (newRetryCount >= MAX_RETRY_COUNT) {
      // Permanently failed — no more retries
      await db.executeSql(
        `UPDATE sync_outbox
         SET status = 'FAILED', retry_count = ?, last_error = ?, next_retry_at = NULL
         WHERE operation_id = ? AND user_id = ?`,
        [newRetryCount, `[PERMANENT] ${error}`, operationId, userId]
      );
    } else {
      const nextRetryAt = computeNextRetryAt(newRetryCount);
      await db.executeSql(
        `UPDATE sync_outbox
         SET status = 'FAILED', retry_count = ?, last_error = ?, next_retry_at = ?
         WHERE operation_id = ? AND user_id = ?`,
        [newRetryCount, error, nextRetryAt, operationId, userId]
      );
    }
  }

  /**
   * Counts all items that will eventually sync:
   * PENDING + retryable FAILED (retry_count < MAX and next_retry_at elapsed or null)
   */
  async countPending(): Promise<number> {
    const db = this.getDb();
    const userId = this.getUserId();
    const now = getUTCTimestamp();

    const res = await db.executeSql<{ count: number }>(
      `SELECT COUNT(*) as count FROM sync_outbox
       WHERE user_id = ? AND (
         status = 'PENDING'
         OR (status = 'FAILED' AND retry_count < ? AND (next_retry_at IS NULL OR next_retry_at <= ?))
       )`,
      [userId, MAX_RETRY_COUNT, now]
    );

    return res.rows[0]?.count || 0;
  }

  /**
   * Counts permanently failed operations (exceeded MAX_RETRY_COUNT).
   */
  async countPermanentlyFailed(): Promise<number> {
    const db = this.getDb();
    const userId = this.getUserId();

    const res = await db.executeSql<{ count: number }>(
      `SELECT COUNT(*) as count FROM sync_outbox
       WHERE user_id = ? AND status = 'FAILED' AND retry_count >= ?`,
      [userId, MAX_RETRY_COUNT]
    );

    return res.rows[0]?.count || 0;
  }

  /**
   * Returns the nearest next_retry_at timestamp for scheduling wake-up.
   */
  async getNextRetryAt(): Promise<string | null> {
    const db = this.getDb();
    const userId = this.getUserId();

    const res = await db.executeSql<{ next_retry: string | null }>(
      `SELECT MIN(next_retry_at) as next_retry FROM sync_outbox
       WHERE user_id = ? AND status = 'FAILED' AND retry_count < ? AND next_retry_at IS NOT NULL`,
      [userId, MAX_RETRY_COUNT]
    );

    return res.rows[0]?.next_retry || null;
  }

  /**
   * Resets a permanently failed operation back to PENDING for manual retry.
   */
  async resetFailed(operationId: string): Promise<void> {
    const db = this.getDb();
    const userId = this.getUserId();

    await db.executeSql(
      `UPDATE sync_outbox
       SET status = 'PENDING', retry_count = 0, next_retry_at = NULL, last_error = NULL
       WHERE operation_id = ? AND user_id = ?`,
      [operationId, userId]
    );
  }

  async clearCompleted(): Promise<void> {
    const db = this.getDb();
    const userId = this.getUserId();

    await db.executeSql(
      `DELETE FROM sync_outbox WHERE user_id = ? AND status = 'COMPLETED'`,
      [userId]
    );
  }
}

// Export constants for testing
export { MAX_RETRY_COUNT, BASE_DELAY_MS, MAX_DELAY_MS };

