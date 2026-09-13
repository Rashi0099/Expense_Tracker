import { syncApiClient, SyncOperationDTO } from '../client/syncApiClient';
import { SQLiteSyncOutboxRepository } from '../../database/repositories/SQLiteSyncOutboxRepository';
import { SQLiteSyncMetadataRepository } from '../../database/repositories/SQLiteSyncMetadataRepository';
import { DatabaseManager } from '../../database/sqlite/DatabaseManager';
import { NetworkStateManager } from '../network/NetworkState';
import { SecureStorage } from '../../api/client/secureStorage';
import { DataEvents } from '../../database/sqlite/DataEvents';
import { dollarsToCents } from '../../utils/money';
import { getUTCTimestamp } from '../../utils/date';
import { generateUUID } from '../../utils/uuid';
import { SyncGlobalState, SyncStatusInfo } from '../types';

type SyncListener = (status: SyncStatusInfo) => void;

export class SyncEngine {
  private static instance: SyncEngine | null = null;

  private outboxRepo = new SQLiteSyncOutboxRepository();
  private metadataRepo = new SQLiteSyncMetadataRepository();
  private networkManager = NetworkStateManager.getInstance();

  private isSyncing = false;
  private pendingSyncRequested = false;
  private activeSyncPromise: Promise<void> | null = null;
  private listeners: Set<SyncListener> = new Set();
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private initialized = false;

  private currentStatus: SyncStatusInfo = {
    state: 'SYNCED',
    pendingCount: 0,
    lastSyncedAt: null,
    lastError: null,
  };

  private constructor() {
    this.init();
  }

  static getInstance(): SyncEngine {
    if (!SyncEngine.instance) {
      SyncEngine.instance = new SyncEngine();
    }
    return SyncEngine.instance;
  }

  /**
   * Initializes listeners for network reconnects and local outbox mutations.
   */
  init(): void {
    if (this.initialized) return;
    this.initialized = true;

    // 1. Reconnect trigger: when device comes back online, sync automatically
    let wasOnline = this.networkManager.isOnline();
    this.networkManager.subscribe((netStatus) => {
      const isOnline = netStatus.isConnected && netStatus.isInternetReachable !== false;
      if (isOnline && !wasOnline) {
        if (this.retryTimer) {
          clearTimeout(this.retryTimer);
          this.retryTimer = null;
        }
        this.sync().catch(() => {});
      }
      wasOnline = isOnline;
      if (!isOnline && this.currentStatus.state !== 'SYNCING') {
        this.updateStatus({ state: 'OFFLINE' });
      }
    });

    // 2. Mutation trigger: when local actions queue items in outbox, trigger debounced sync
    DataEvents.subscribe('SYNC_OUTBOX_CHANGED', () => {
      this.refreshPendingCount();
      if (this.networkManager.isOnline()) {
        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
          this.sync().catch(() => {});
        }, 1200);
      }
    });

    // Load initial metadata
    this.refreshMetadata();
  }

  async refreshMetadata(): Promise<void> {
    try {
      const lastSyncedAt = await this.metadataRepo.getLastSyncedAt();
      const lastError = await this.metadataRepo.getLastSyncError();
      const pendingCount = await this.outboxRepo.countPending();
      const isOnline = this.networkManager.isOnline();

      let state: SyncGlobalState = 'SYNCED';
      if (!isOnline) {
        state = 'OFFLINE';
      } else if (lastError) {
        state = 'ERROR';
      } else if (pendingCount > 0) {
        state = 'PENDING_CHANGES';
      }

      this.updateStatus({
        state,
        pendingCount,
        lastSyncedAt,
        lastError,
      });
    } catch {
      // Ignored
    }
  }

  async refreshPendingCount(): Promise<number> {
    try {
      const count = await this.outboxRepo.countPending();
      this.updateStatus({
        pendingCount: count,
        state:
          count > 0 && this.currentStatus.state === 'SYNCED'
            ? 'PENDING_CHANGES'
            : this.currentStatus.state,
      });
      return count;
    } catch {
      return 0;
    }
  }

  getStatus(): SyncStatusInfo {
    return { ...this.currentStatus };
  }

  subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private updateStatus(partial: Partial<SyncStatusInfo>): void {
    this.currentStatus = { ...this.currentStatus, ...partial };
    for (const listener of this.listeners) {
      listener(this.currentStatus);
    }
  }

  /**
   * Resets the sync engine state on logout.
   */
  reset(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    this.isSyncing = false;
    this.pendingSyncRequested = false;
    this.activeSyncPromise = null;
    this.updateStatus({
      state: 'SYNCED',
      pendingCount: 0,
      lastSyncedAt: null,
      lastError: null,
    });
  }

  private scheduleNextRetry(nextRetryAt: string | null): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    if (!nextRetryAt || !this.networkManager.isOnline()) return;

    const delay = Math.max(1000, new Date(nextRetryAt).getTime() - Date.now());
    const safeDelay = Math.min(delay, 1800000); // 30 min maximum
    this.retryTimer = setTimeout(() => {
      if (this.networkManager.isOnline()) {
        this.sync().catch(() => {});
      }
    }, safeDelay);
  }

  /**
   * Main synchronization routine executing push, pull, and reconciliation.
   */
  async sync(): Promise<void> {
    const userId = DatabaseManager.getInstance().getCurrentUser();
    if (!userId) {
      return;
    }

    if (!this.networkManager.isOnline()) {
      const pendingCount = await this.outboxRepo.countPending();
      this.updateStatus({ state: 'OFFLINE', pendingCount });
      return;
    }

    // Mutex Lock: If already syncing, queue follow-up and return active promise
    if (this.isSyncing && this.activeSyncPromise) {
      this.pendingSyncRequested = true;
      return this.activeSyncPromise;
    }

    this.isSyncing = true;
    this.activeSyncPromise = this._runSyncLoop(userId);

    try {
      await this.activeSyncPromise;
    } finally {
      this.isSyncing = false;
      this.activeSyncPromise = null;
    }
  }

  private async _runSyncLoop(userId: string): Promise<void> {
    this.updateStatus({ state: 'SYNCING', lastError: null });

    try {
      let hasMoreToSync = true;
      while (hasMoreToSync) {
        this.pendingSyncRequested = false;
        const hasMore = await this._executeSingleBatch(userId);
        hasMoreToSync = hasMore || this.pendingSyncRequested;
      }

      const remainingPending = await this.outboxRepo.countPending();
      const lastSyncedAt = await this.metadataRepo.getLastSyncedAt();
      this.updateStatus({
        state: remainingPending > 0 ? 'PENDING_CHANGES' : 'SYNCED',
        pendingCount: remainingPending,
        lastSyncedAt: lastSyncedAt || getUTCTimestamp(),
        lastError: null,
      });

      await this.metadataRepo.setLastSyncError(null);
      const nextRetry = await this.outboxRepo.getNextRetryAt?.();
      this.scheduleNextRetry(nextRetry || null);
    } catch (err: any) {
      const errorMsg = err?.message || 'Sync failed';
      await this.metadataRepo.setLastSyncError(errorMsg);

      const pendingCount = await this.outboxRepo.countPending();
      const isOnline = this.networkManager.isOnline();
      this.updateStatus({
        state: !isOnline ? 'OFFLINE' : 'ERROR',
        pendingCount,
        lastError: errorMsg,
      });
      const nextRetry = await this.outboxRepo.getNextRetryAt?.();
      this.scheduleNextRetry(nextRetry || null);
    }
  }

  private async _executeSingleBatch(userId: string): Promise<boolean> {
    let deviceId = await SecureStorage.getDeviceId();
    if (!deviceId) {
      deviceId = generateUUID();
      await SecureStorage.setDeviceId(deviceId);
    }

    // 1. Drain pending operations from sync_outbox
    const pendingItems = await this.outboxRepo.getPending(50);
    const operations: SyncOperationDTO[] = pendingItems.map((item) => ({
      operationId: item.operationId,
      entityType: item.entityType,
      entityId: item.entityId,
      operation: item.operation,
      baseVersion: item.baseVersion,
      payload: item.payload,
    }));

    // 2. Fetch monotonic sequence cursor
    const sinceSequence = await this.metadataRepo.getLastSyncedSequence();

    // 3. Round-trip API synchronization request
    const response = await syncApiClient.postSyncBatch({
      deviceId,
      sinceSequence,
      operations,
    });

      // 4. Atomic Reconciliation Transaction in SQLite
      const db = DatabaseManager.getInstance().getDatabase();
      const now = getUTCTimestamp();

      await db.transaction(async (tx) => {
        // A. Process operation confirmations
        for (const proc of response.processedOperations) {
          if (proc.status === 'ACCEPTED' || proc.status === 'CONFLICT') {
            await tx.executeSql(
              `UPDATE sync_outbox SET status = 'COMPLETED' WHERE operation_id = ? AND user_id = ?`,
              [proc.operationId, userId]
            );

            // Update local entity status to SYNCED
            if (proc.entityId) {
              const item = pendingItems.find((o) => o.operationId === proc.operationId);
              const entityType = item?.entityType;

              if (entityType === 'EXPENSE') {
                await tx.executeSql(
                  `UPDATE expenses SET sync_status = 'SYNCED', version = ? WHERE id = ? AND user_id = ?`,
                  [proc.serverVersion, proc.entityId, userId]
                );
              } else if (entityType === 'INCOME') {
                await tx.executeSql(
                  `UPDATE income SET sync_status = 'SYNCED', version = ? WHERE id = ? AND user_id = ?`,
                  [proc.serverVersion, proc.entityId, userId]
                );
              } else if (entityType === 'CATEGORY') {
                await tx.executeSql(
                  `UPDATE categories SET version = ? WHERE id = ? AND (user_id = ? OR is_system = 1)`,
                  [proc.serverVersion, proc.entityId, userId]
                );
              } else if (entityType === 'BUDGET') {
                await tx.executeSql(
                  `UPDATE budgets SET version = ? WHERE id = ? AND user_id = ?`,
                  [proc.serverVersion, proc.entityId, userId]
                );
              } else if (entityType === 'RECURRING') {
                await tx.executeSql(
                  `UPDATE recurring_expenses SET version = ? WHERE id = ? AND user_id = ?`,
                  [proc.serverVersion, proc.entityId, userId]
                );
              } else {
                // Fallback for expenses or income if entityType was unspecified
                await tx.executeSql(
                  `UPDATE expenses SET sync_status = 'SYNCED', version = ? WHERE id = ? AND user_id = ?`,
                  [proc.serverVersion, proc.entityId, userId]
                );
                await tx.executeSql(
                  `UPDATE income SET sync_status = 'SYNCED', version = ? WHERE id = ? AND user_id = ?`,
                  [proc.serverVersion, proc.entityId, userId]
                );
              }
            }
          } else if (proc.status === 'REJECTED') {
            const current = await tx.executeSql<{ retry_count: number }>(
              `SELECT retry_count FROM sync_outbox WHERE operation_id = ? AND user_id = ?`,
              [proc.operationId, userId]
            );
            const currentRetryCount = current.rows[0]?.retry_count ?? 0;
            const newRetryCount = currentRetryCount + 1;
            const baseDelay = 5000;
            const delay = Math.min(baseDelay * Math.pow(2, newRetryCount) + Math.floor(Math.random() * baseDelay), 1800000);
            const nextRetryAt = new Date(Date.now() + delay).toISOString();

            await tx.executeSql(
              `UPDATE sync_outbox
               SET status = 'FAILED', retry_count = ?, last_error = ?, next_retry_at = ?
               WHERE operation_id = ? AND user_id = ?`,
              [newRetryCount, proc.reason || 'Server rejected operation', nextRetryAt, proc.operationId, userId]
            );
          }
        }

        // B. Reconcile server changes — Expenses
        for (const e of response.serverChanges.expenses) {
          const amountCents = dollarsToCents(e.amount);
          await tx.executeSql(
            `INSERT INTO expenses (
              id, user_id, category_id, amount_cents, currency, transaction_date,
              payment_method, payee, note, created_at, updated_at, deleted_at, version, sync_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, 'SYNCED')
            ON CONFLICT(id) DO UPDATE SET
              category_id = excluded.category_id,
              amount_cents = excluded.amount_cents,
              currency = excluded.currency,
              transaction_date = excluded.transaction_date,
              payment_method = excluded.payment_method,
              payee = excluded.payee,
              note = excluded.note,
              updated_at = excluded.updated_at,
              version = excluded.version,
              sync_status = 'SYNCED'
            WHERE expenses.sync_status != 'PENDING' OR excluded.version >= expenses.version`,
            [
              e.id,
              userId,
              e.categoryId,
              amountCents,
              e.currency,
              e.transactionDate,
              e.paymentMethod,
              e.payee || null,
              e.note || null,
              e.createdAt || now,
              e.updatedAt || now,
              e.version,
            ]
          );
        }

        // C. Reconcile server changes — Income
        for (const i of response.serverChanges.income) {
          const amountCents = dollarsToCents(i.amount);
          await tx.executeSql(
            `INSERT INTO income (
              id, user_id, category_id, amount_cents, currency, transaction_date,
              payment_method, source, note, created_at, updated_at, deleted_at, version, sync_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, 'SYNCED')
            ON CONFLICT(id) DO UPDATE SET
              category_id = excluded.category_id,
              amount_cents = excluded.amount_cents,
              currency = excluded.currency,
              transaction_date = excluded.transaction_date,
              payment_method = excluded.payment_method,
              source = excluded.source,
              note = excluded.note,
              updated_at = excluded.updated_at,
              version = excluded.version,
              sync_status = 'SYNCED'
            WHERE income.sync_status != 'PENDING' OR excluded.version >= income.version`,
            [
              i.id,
              userId,
              i.categoryId,
              amountCents,
              i.currency,
              i.transactionDate,
              i.paymentMethod,
              i.source || null,
              i.note || null,
              i.createdAt || now,
              i.updatedAt || now,
              i.version,
            ]
          );
        }

        // D. Reconcile server changes — Categories
        for (const c of response.serverChanges.categories) {
          await tx.executeSql(
            `INSERT INTO categories (
              id, user_id, name, type, icon, color, is_system, is_archived, created_at, updated_at, version
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              name = excluded.name,
              type = excluded.type,
              icon = excluded.icon,
              color = excluded.color,
              is_archived = excluded.is_archived,
              version = excluded.version`,
            [
              c.id,
              c.isSystem ? null : userId,
              c.name,
              c.type,
              c.icon,
              c.color,
              c.isSystem ? 1 : 0,
              c.isArchived ? 1 : 0,
              now,
              now,
              c.version,
            ]
          );
        }

        // E. Reconcile server changes — Budgets
        for (const b of response.serverChanges.budgets) {
          const limitCents = dollarsToCents(b.limitAmount);
          await tx.executeSql(
            `INSERT INTO budgets (
              id, user_id, category_id, period_start, limit_amount_cents, currency, created_at, updated_at, version
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              category_id = excluded.category_id,
              period_start = excluded.period_start,
              limit_amount_cents = excluded.limit_amount_cents,
              currency = excluded.currency,
              updated_at = excluded.updated_at,
              version = excluded.version`,
            [
              b.id,
              userId,
              b.categoryId || null,
              b.periodStart,
              limitCents,
              b.currency,
              b.createdAt || now,
              b.updatedAt || now,
              b.version,
            ]
          );
        }

        // F. Reconcile server changes — Recurring Expenses
        for (const r of response.serverChanges.recurring) {
          const amountCents = dollarsToCents(r.amount);
          await tx.executeSql(
            `INSERT INTO recurring_expenses (
              id, user_id, category_id, title, amount_cents, currency,
              frequency, start_date, next_due_date, end_date, is_active,
              created_at, updated_at, version
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              category_id = excluded.category_id,
              title = excluded.title,
              amount_cents = excluded.amount_cents,
              currency = excluded.currency,
              frequency = excluded.frequency,
              start_date = excluded.start_date,
              next_due_date = excluded.next_due_date,
              end_date = excluded.end_date,
              is_active = excluded.is_active,
              updated_at = excluded.updated_at,
              version = excluded.version`,
            [
              r.id,
              userId,
              r.categoryId,
              r.title,
              amountCents,
              r.currency,
              r.frequency,
              r.startDate,
              r.nextDueDate,
              r.endDate || null,
              r.isActive ? 1 : 0,
              r.createdAt || now,
              r.updatedAt || now,
              r.version,
            ]
          );
        }

        // G. Process tombstones (purge deleted rows from SQLite)
        for (const tomb of response.serverChanges.tombstones) {
          switch (tomb.entityType) {
            case 'EXPENSE':
              await tx.executeSql('DELETE FROM expenses WHERE id = ? AND user_id = ?', [
                tomb.entityId,
                userId,
              ]);
              break;
            case 'INCOME':
              await tx.executeSql('DELETE FROM income WHERE id = ? AND user_id = ?', [
                tomb.entityId,
                userId,
              ]);
              break;
            case 'CATEGORY':
              await tx.executeSql('DELETE FROM categories WHERE id = ? AND user_id = ?', [
                tomb.entityId,
                userId,
              ]);
              break;
            case 'BUDGET':
              await tx.executeSql('DELETE FROM budgets WHERE id = ? AND user_id = ?', [
                tomb.entityId,
                userId,
              ]);
              break;
            case 'RECURRING':
              await tx.executeSql(
                'DELETE FROM recurring_expenses WHERE id = ? AND user_id = ?',
                [tomb.entityId, userId]
              );
              break;
          }
        }

        // H. Purge completed outbox records
        await tx.executeSql(
          `DELETE FROM sync_outbox WHERE status = 'COMPLETED' AND user_id = ?`,
          [userId]
        );

        // I. Update sync metadata cursor
        await tx.executeSql(
          `INSERT INTO sync_metadata (key, value, updated_at) VALUES ('last_synced_sequence', ?, ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
          [response.latestServerSequence.toString(), now]
        );
        await tx.executeSql(
          `INSERT INTO sync_metadata (key, value, updated_at) VALUES ('last_synced_at', ?, ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
          [now, now]
        );
      });

      // 5. Notify reactive UI event listeners
      DataEvents.notify('EXPENSES_CHANGED');
      DataEvents.notify('INCOME_CHANGED');
      DataEvents.notify('CATEGORIES_CHANGED');
      DataEvents.notify('BUDGETS_CHANGED');
      DataEvents.notify('RECURRING_CHANGED');
      DataEvents.notify('SYNC_OUTBOX_CHANGED');

      return response.hasMore;
  }

  /**
   * Manual trigger action for buttons and user-initiated sync.
   */
  async syncNow(): Promise<void> {
    await this.sync();
  }
}
