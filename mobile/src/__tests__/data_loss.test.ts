import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseManager } from '../database/sqlite/DatabaseManager';
import { MemorySQLiteAdapter } from '../database/sqlite/DatabaseConnection';
import { SQLiteExpenseRepository } from '../database/repositories/SQLiteExpenseRepository';
import { SQLiteSyncOutboxRepository } from '../database/repositories/SQLiteSyncOutboxRepository';
import { SQLiteCategoryRepository } from '../database/repositories/SQLiteCategoryRepository';
import { getTodayDateString } from '../utils/date';

describe('Data Loss Prevention & Crash Resilience (Section 42)', () => {
  let db: MemorySQLiteAdapter;
  let expenseRepo: SQLiteExpenseRepository;
  let outboxRepo: SQLiteSyncOutboxRepository;
  let categoryRepo: SQLiteCategoryRepository;

  const TEST_USER_ID = 'usr_crash_test_user_001';
  let defaultCategoryId: string;

  beforeEach(async () => {
    db = new MemorySQLiteAdapter();
    await DatabaseManager.getInstance().initialize(db);
    DatabaseManager.getInstance().setCurrentUser(TEST_USER_ID);

    expenseRepo = new SQLiteExpenseRepository();
    outboxRepo = new SQLiteSyncOutboxRepository();
    categoryRepo = new SQLiteCategoryRepository();

    await categoryRepo.seedDefaults();
    const cats = await categoryRepo.list('EXPENSE');
    defaultCategoryId = cats[0].id;
  });

  it('preserves locally committed expenses across simulated app restart and crash', async () => {
    // 1. User records an expense
    const expense = await expenseRepo.create({
      amountCents: 5250, // $52.50
      categoryId: defaultCategoryId,
      transactionDate: getTodayDateString(),
      payee: 'Critical Flight Booking',
      note: 'Must not be lost under any crash scenario',
    });

    expect(expense.id).toBeDefined();

    // 2. Simulate abrupt app crash & process kill
    // Database connection is abruptly closed without syncing
    await DatabaseManager.getInstance().close();

    // 3. Simulate app restart: re-initialize connection to the persistent store
    await DatabaseManager.getInstance().initialize(db);
    DatabaseManager.getInstance().setCurrentUser(TEST_USER_ID);

    const restartedExpenseRepo = new SQLiteExpenseRepository();
    const restartedOutboxRepo = new SQLiteSyncOutboxRepository();

    // 4. Verify the expense and its pending outbox mutation are completely intact
    const found = await restartedExpenseRepo.getById(expense.id);
    expect(found).not.toBeNull();
    expect(found?.payee).toBe('Critical Flight Booking');
    expect(found?.amountCents).toBe(5250);

    const pending = await restartedOutboxRepo.getPending();
    expect(pending).toHaveLength(1);
    expect(pending[0].entityId).toBe(expense.id);
  });

  it('guarantees atomic rollback if transaction is interrupted mid-execution', async () => {
    // If an error occurs inside a repository transaction,
    // neither the expense row nor the outbox row should remain partially saved.
    const initialExpenses = await expenseRepo.list();
    const initialOutbox = await outboxRepo.getPending();

    await expect(
      db.transaction(async (tx) => {
        await tx.executeSql(
          `INSERT INTO expenses (
            id, user_id, category_id, amount_cents, currency, transaction_date,
            payment_method, payee, note, created_at, updated_at, deleted_at, version, sync_status
          ) VALUES (?, ?, ?, ?, 'USD', ?, 'CASH', 'Orphan Payee', NULL, '2026-09-13', '2026-09-13', NULL, 1, 'PENDING')`,
          ['interrupted_id_1', TEST_USER_ID, defaultCategoryId, 9900, getTodayDateString()]
        );

        // Crash/exception before outbox insert
        throw new Error('Simulated power loss or transaction abort');
      })
    ).rejects.toThrow('Simulated power loss or transaction abort');

    const expensesAfterAbort = await expenseRepo.list();
    const outboxAfterAbort = await outboxRepo.getPending();

    expect(expensesAfterAbort).toHaveLength(initialExpenses.length);
    expect(outboxAfterAbort).toHaveLength(initialOutbox.length);
  });

  it('retains local records and marks failures gracefully when sync network encounters 500 errors', async () => {
    const expense = await expenseRepo.create({
      amountCents: 1500,
      categoryId: defaultCategoryId,
      transactionDate: getTodayDateString(),
      payee: 'Offline Dinner',
    });

    const pendingList = await outboxRepo.getPending();
    expect(pendingList).toHaveLength(1);
    const op = pendingList[0];

    // Simulate repeated sync network failure
    await outboxRepo.markFailed(op.operationId, 'HTTP 503 Service Unavailable');

    // Verify local expense is untouched
    const verifiedExpense = await expenseRepo.getById(expense.id);
    expect(verifiedExpense).not.toBeNull();
    expect(verifiedExpense?.amountCents).toBe(1500);

    // Verify outbox record retains retry tracking
    const outboxRow = (
      await db.executeSql<any>('SELECT * FROM sync_outbox WHERE operation_id = ?', [
        op.operationId,
      ])
    ).rows[0];

    expect(outboxRow.status).toBe('FAILED');
    expect(outboxRow.retry_count).toBe(1);
    expect(outboxRow.last_error).toBe('HTTP 503 Service Unavailable');
  });
});
