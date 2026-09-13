import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseManager } from '../database/sqlite/DatabaseManager';
import { MemorySQLiteAdapter } from '../database/sqlite/DatabaseConnection';
import { SQLiteExpenseRepository } from '../database/repositories/SQLiteExpenseRepository';
import { SQLiteSyncOutboxRepository } from '../database/repositories/SQLiteSyncOutboxRepository';
import { SQLiteCategoryRepository } from '../database/repositories/SQLiteCategoryRepository';
import { getTodayDateString } from '../utils/date';

describe('Account Switching & User Data Isolation (Section 41)', () => {
  let db: MemorySQLiteAdapter;
  let expenseRepo: SQLiteExpenseRepository;
  let outboxRepo: SQLiteSyncOutboxRepository;
  let categoryRepo: SQLiteCategoryRepository;

  const USER_A_ID = 'usr_alice_1111-1111';
  const USER_B_ID = 'usr_bob_2222-2222';
  let defaultCategoryId: string;

  beforeEach(async () => {
    db = new MemorySQLiteAdapter();
    await DatabaseManager.getInstance().initialize(db);
    expenseRepo = new SQLiteExpenseRepository();
    outboxRepo = new SQLiteSyncOutboxRepository();
    categoryRepo = new SQLiteCategoryRepository();

    // Seed categories
    await categoryRepo.seedDefaults();
    const cats = await categoryRepo.list('EXPENSE');
    defaultCategoryId = cats[0].id;
  });

  it('guarantees complete data isolation between User A and User B', async () => {
    const dbManager = DatabaseManager.getInstance();

    // 1. User A logs in and records expenses
    dbManager.setCurrentUser(USER_A_ID);

    await expenseRepo.create({
      amountCents: 4500, // $45.00
      categoryId: defaultCategoryId,
      transactionDate: getTodayDateString(),
      payee: 'Alice Grocery',
    });

    await expenseRepo.create({
      amountCents: 1250, // $12.50
      categoryId: defaultCategoryId,
      transactionDate: getTodayDateString(),
      payee: 'Alice Coffee',
    });

    const userAExpenses = await expenseRepo.list();
    const userAOutbox = await outboxRepo.getPending();

    expect(userAExpenses).toHaveLength(2);
    expect(userAOutbox).toHaveLength(2);
    expect(userAExpenses.every((e) => e.userId === USER_A_ID)).toBe(true);

    // 2. User A logs out
    dbManager.setCurrentUser(null);

    // Any attempt to query without a user must throw
    await expect(expenseRepo.list()).rejects.toThrow(
      'Database session must be scoped to an authenticated user ID.'
    );
    await expect(outboxRepo.getPending()).rejects.toThrow(
      'Database session must be scoped to an authenticated user ID.'
    );

    // 3. User B logs in
    dbManager.setCurrentUser(USER_B_ID);

    // User B must NOT see User A's expenses or pending outbox items
    const userBExpensesInitial = await expenseRepo.list();
    const userBOutboxInitial = await outboxRepo.getPending();

    expect(userBExpensesInitial).toHaveLength(0);
    expect(userBOutboxInitial).toHaveLength(0);

    // 4. User B records their own expense
    await expenseRepo.create({
      amountCents: 9900, // $99.00
      categoryId: defaultCategoryId,
      transactionDate: getTodayDateString(),
      payee: 'Bob Utilities',
    });

    const userBExpenses = await expenseRepo.list();
    const userBOutbox = await outboxRepo.getPending();

    expect(userBExpenses).toHaveLength(1);
    expect(userBExpenses[0].payee).toBe('Bob Utilities');
    expect(userBExpenses[0].userId).toBe(USER_B_ID);
    expect(userBOutbox).toHaveLength(1);

    // 5. User B logs out, User A logs back in
    dbManager.setCurrentUser(null);
    dbManager.setCurrentUser(USER_A_ID);

    const userARestoredExpenses = await expenseRepo.list();
    const userARestoredOutbox = await outboxRepo.getPending();

    expect(userARestoredExpenses).toHaveLength(2);
    expect(userARestoredExpenses.map((e) => e.payee)).toEqual(
      expect.arrayContaining(['Alice Grocery', 'Alice Coffee'])
    );
    expect(userARestoredOutbox).toHaveLength(2);
  });
});
