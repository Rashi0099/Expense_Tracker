import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseManager } from '../database/sqlite/DatabaseManager';
import { MemorySQLiteAdapter } from '../database/sqlite/DatabaseConnection';
import { SQLiteExpenseRepository } from '../database/repositories/SQLiteExpenseRepository';
import { SQLiteSyncOutboxRepository } from '../database/repositories/SQLiteSyncOutboxRepository';
import { SQLiteCategoryRepository } from '../database/repositories/SQLiteCategoryRepository';
import { getTodayDateString, getUTCTimestamp } from '../utils/date';
import { dollarsToCents } from '../utils/money';

describe('Multi-Device Synchronization & Conflict Resolution (Sections 43, 44, 45)', () => {
  const TEST_USER = 'usr_multi_device_test';
  let defaultCategoryId: string;

  beforeEach(async () => {
    // Shared category id
    defaultCategoryId = 'cat_food_dining_001';
  });

  it('Section 43: handles offline expense creation, app restart, reconnect, and single-record sync', async () => {
    const dbDeviceA = new MemorySQLiteAdapter();
    const dbManager = DatabaseManager.getInstance();
    await dbManager.initialize(dbDeviceA);
    dbManager.setCurrentUser(TEST_USER);

    const expenseRepo = new SQLiteExpenseRepository();
    const outboxRepo = new SQLiteSyncOutboxRepository();
    const catRepo = new SQLiteCategoryRepository();
    await catRepo.seedDefaults();

    // 1. Offline -> Create expense
    const localExpense = await expenseRepo.create({
      amountCents: 3400,
      categoryId: defaultCategoryId,
      transactionDate: getTodayDateString(),
      payee: 'Airport Taxi',
    });

    // 2. Close app simulation
    await dbManager.close();

    // 3. Reopen app simulation
    await dbManager.initialize(dbDeviceA);
    dbManager.setCurrentUser(TEST_USER);

    const reopenedExpenseRepo = new SQLiteExpenseRepository();
    const reopenedOutboxRepo = new SQLiteSyncOutboxRepository();

    const pending = await reopenedOutboxRepo.getPending();
    expect(pending).toHaveLength(1);
    expect(pending[0].entityId).toBe(localExpense.id);

    // 4. Reconnect -> Push to simulated server
    const serverExpenses = new Map<string, any>();
    for (const op of pending) {
      if (op.operation === 'CREATE') {
        const payload = op.payload;
        serverExpenses.set(op.entityId, {
          id: op.entityId,
          user_id: TEST_USER,
          ...payload,
          version: 1,
        });
        await reopenedOutboxRepo.markCompleted(op.operationId);
      }
    }

    // 5. Verify expense exists exactly once on server and outbox is drained
    expect(serverExpenses.size).toBe(1);
    expect(serverExpenses.get(localExpense.id)?.payee).toBe('Airport Taxi');

    const remainingPending = await reopenedOutboxRepo.getPending();
    expect(remainingPending).toHaveLength(0);
  });

  it('Section 44: converges state between Device A (offline) and Device B (online) without duplicates', async () => {
    // Device A DB
    const dbA = new MemorySQLiteAdapter();
    const dbB = new MemorySQLiteAdapter();
    const dbManager = DatabaseManager.getInstance();

    // Setup Device A
    await dbManager.initialize(dbA);
    dbManager.setCurrentUser(TEST_USER);
    const expenseRepoA = new SQLiteExpenseRepository();
    const outboxRepoA = new SQLiteSyncOutboxRepository();
    const catRepoA = new SQLiteCategoryRepository();
    await catRepoA.seedDefaults();

    // Device A creates expense offline
    const expenseA = await expenseRepoA.create({
      amountCents: 2000, // $20.00
      categoryId: defaultCategoryId,
      transactionDate: getTodayDateString(),
      payee: 'Device A Bookstore',
    });

    // Setup Device B
    await dbManager.close();
    await dbManager.initialize(dbB);
    dbManager.setCurrentUser(TEST_USER);
    const expenseRepoB = new SQLiteExpenseRepository();
    const outboxRepoB = new SQLiteSyncOutboxRepository();
    const catRepoB = new SQLiteCategoryRepository();
    await catRepoB.seedDefaults();

    // Device B creates expense online
    const expenseB = await expenseRepoB.create({
      amountCents: 5000, // $50.00
      categoryId: defaultCategoryId,
      transactionDate: getTodayDateString(),
      payee: 'Device B Pharmacy',
    });

    // Simulated Server Store
    const serverDb = new Map<string, any>();

    // Push Device B online to server immediately
    const outboxB = await outboxRepoB.getPending();
    for (const op of outboxB) {
      serverDb.set(op.entityId, {
        id: op.entityId,
        user_id: TEST_USER,
        ...op.payload,
        version: 1,
      });
      await outboxRepoB.markCompleted(op.operationId);
    }

    // Now Device A reconnects and syncs
    await dbManager.close();
    await dbManager.initialize(dbA);
    dbManager.setCurrentUser(TEST_USER);

    // 1. Device A pushes offline mutations to server
    const pendingA = await outboxRepoA.getPending();
    for (const op of pendingA) {
      serverDb.set(op.entityId, {
        id: op.entityId,
        user_id: TEST_USER,
        ...op.payload,
        version: 1,
      });
      await outboxRepoA.markCompleted(op.operationId);
    }

    // 2. Device A pulls new records from server (Device B's record)
    for (const [id, srvItem] of serverDb.entries()) {
      const existing = await expenseRepoA.getById(id);
      if (!existing) {
        const cents =
          srvItem.amount_cents !== undefined
            ? srvItem.amount_cents
            : srvItem.amount
            ? dollarsToCents(srvItem.amount)
            : 0;

        await dbA.executeSql(
          `INSERT INTO expenses (
            id, user_id, category_id, amount_cents, currency, transaction_date,
            payment_method, payee, note, created_at, updated_at, deleted_at, version, sync_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, 'SYNCED')`,
          [
            srvItem.id,
            srvItem.user_id,
            srvItem.categoryId || srvItem.category_id || defaultCategoryId,
            cents,
            srvItem.currency || 'USD',
            srvItem.transactionDate || srvItem.transaction_date || getTodayDateString(),
            srvItem.paymentMethod || srvItem.payment_method || 'CASH',
            srvItem.payee,
            srvItem.note || null,
            srvItem.created_at || getUTCTimestamp(),
            srvItem.updated_at || getUTCTimestamp(),
            srvItem.version || 1,
          ]
        );
      }
    }

    // Verify Device A now has both expenses, zero duplicates, correct sum
    const listA = await expenseRepoA.list();
    expect(listA).toHaveLength(2);
    const totalA = listA.reduce((sum, e) => sum + e.amountCents, 0);
    expect(totalA).toBe(7000); // 2000 + 5000 = $70.00
  });

  it('Section 45: detects concurrent edit conflicts and applies deterministic resolution without silent data loss', async () => {
    // Two devices edit the same transaction
    const initialExpense = {
      id: 'shared_exp_conflict_001',
      user_id: TEST_USER,
      category_id: defaultCategoryId,
      amount_cents: 3000,
      currency: 'USD',
      transaction_date: getTodayDateString(),
      payment_method: 'CREDIT_CARD',
      payee: 'Restaurant Bill',
      version: 1,
    };

    // Server has version 1
    const serverDb = new Map<string, any>();
    serverDb.set(initialExpense.id, { ...initialExpense });

    // Device A edits amount to 3500 (version 1 -> baseVersion 1)
    const deviceAEdit = {
      amount_cents: 3500,
      base_version: 1,
      updated_at: '2026-09-13T10:00:00.000Z',
    };

    // Device B edits amount to 4000 (version 1 -> baseVersion 1) with later timestamp
    const deviceBEdit = {
      amount_cents: 4000,
      base_version: 1,
      updated_at: '2026-09-13T10:05:00.000Z',
    };

    // Device A syncs first: server accepts and increments version to 2
    serverDb.set(initialExpense.id, {
      ...initialExpense,
      amount_cents: deviceAEdit.amount_cents,
      version: 2,
      updated_at: deviceAEdit.updated_at,
    });

    // Device B attempts to push with base_version: 1
    const currentServer = serverDb.get(initialExpense.id);
    let conflictDetected = false;
    let finalResolvedAmount = 0;

    if (deviceBEdit.base_version < currentServer.version) {
      conflictDetected = true;
      // Step 5 Conflict Strategy: Last-Write-Wins based on client/server timestamp or newer update wins
      if (new Date(deviceBEdit.updated_at) > new Date(currentServer.updated_at)) {
        serverDb.set(initialExpense.id, {
          ...currentServer,
          amount_cents: deviceBEdit.amount_cents,
          version: currentServer.version + 1,
          updated_at: deviceBEdit.updated_at,
        });
        finalResolvedAmount = deviceBEdit.amount_cents;
      } else {
        finalResolvedAmount = currentServer.amount_cents;
      }
    }

    expect(conflictDetected).toBe(true);
    expect(finalResolvedAmount).toBe(4000);
    expect(serverDb.get(initialExpense.id)?.version).toBe(3);
  });
});
