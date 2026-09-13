import { describe, it, expect, beforeEach } from 'vitest';
import { MemorySQLiteAdapter } from '../database/sqlite/DatabaseConnection';
import { DatabaseManager } from '../database/sqlite/DatabaseManager';
import { SQLiteCategoryRepository } from '../database/repositories/SQLiteCategoryRepository';
import { SQLiteExpenseRepository } from '../database/repositories/SQLiteExpenseRepository';
import { SQLiteIncomeRepository } from '../database/repositories/SQLiteIncomeRepository';
import { SQLiteBudgetRepository } from '../database/repositories/SQLiteBudgetRepository';
import { SQLiteRecurringExpenseRepository } from '../database/repositories/SQLiteRecurringExpenseRepository';
import { SQLiteSyncOutboxRepository } from '../database/repositories/SQLiteSyncOutboxRepository';

describe('Local-First SQLite Database & Repository Foundation', () => {
  let memoryDb: MemorySQLiteAdapter;

  beforeEach(async () => {
    await DatabaseManager.getInstance().close();
    memoryDb = new MemorySQLiteAdapter();
    await DatabaseManager.getInstance().initialize(memoryDb);
  });

  it('runs initial migrations cleanly', async () => {
    // Check that schema migrations table was recorded
    const res = await memoryDb.executeSql<{ version: number }>(
      'SELECT version FROM schema_migrations'
    );
    expect(res.rows.length).toBeGreaterThan(0);
    expect(res.rows[0].version).toBe(1);
  });

  it('seeds default categories if empty', async () => {
    const catRepo = new SQLiteCategoryRepository();
    await catRepo.seedDefaults();

    const cats = await catRepo.list('EXPENSE');
    expect(cats.length).toBeGreaterThan(0);
    expect(cats.some((c) => c.name === 'Food & Dining')).toBe(true);
  });

  it('creates an expense and atomically writes to sync_outbox', async () => {
    const userId = 'user_12345';
    DatabaseManager.getInstance().setCurrentUser(userId);

    const expenseRepo = new SQLiteExpenseRepository();
    const outboxRepo = new SQLiteSyncOutboxRepository();

    const expense = await expenseRepo.create({
      categoryId: 'cat_food',
      amountCents: 1550, // $15.50
      transactionDate: '2026-09-13',
      paymentMethod: 'CREDIT_CARD',
      payee: 'Starbucks Coffee',
      note: 'Morning latte',
    });

    expect(expense.id).toBeDefined();
    expect(expense.amountCents).toBe(1550);
    expect(expense.payee).toBe('Starbucks Coffee');

    // Verify item in outbox
    const pendingOutbox = await outboxRepo.getPending();
    expect(pendingOutbox.length).toBe(1);
    expect(pendingOutbox[0].entityId).toBe(expense.id);
    expect(pendingOutbox[0].entityType).toBe('EXPENSE');
    expect(pendingOutbox[0].operation).toBe('CREATE');
    expect(pendingOutbox[0].payload.amount).toBe('15.50');
  });

  it('enforces user data isolation in local SQLite', async () => {
    const userA = 'user_alice';
    const userB = 'user_bob';

    const expenseRepo = new SQLiteExpenseRepository();

    // Alice adds expense
    DatabaseManager.getInstance().setCurrentUser(userA);
    const expA = await expenseRepo.create({
      categoryId: 'cat_groceries',
      amountCents: 5000,
      transactionDate: '2026-09-13',
      payee: 'Supermarket',
    });

    // Bob inspects his expenses: MUST be empty
    DatabaseManager.getInstance().setCurrentUser(userB);
    const bobExpenses = await expenseRepo.list();
    expect(bobExpenses.length).toBe(0);

    // Bob cannot query Alice's expense
    const bobFetch = await expenseRepo.getById(expA.id);
    expect(bobFetch).toBeNull();
  });

  it('creates income and soft deletes with sync_outbox tracking', async () => {
    const userId = 'user_charlie';
    DatabaseManager.getInstance().setCurrentUser(userId);

    const incomeRepo = new SQLiteIncomeRepository();
    const outboxRepo = new SQLiteSyncOutboxRepository();

    const income = await incomeRepo.create({
      categoryId: 'cat_salary',
      amountCents: 350000, // $3,500.00
      transactionDate: '2026-09-13',
      source: 'Acme Corp',
    });

    expect(income.amountCents).toBe(350000);

    // Soft delete income
    await incomeRepo.softDelete(income.id);

    const pending = await outboxRepo.getPending();
    expect(pending.some((p) => p.operation === 'DELETE' && p.entityId === income.id)).toBe(true);
  });

  it('creates and manages monthly budgets with atomic outbox tracking', async () => {
    const userId = 'user_budgeter';
    DatabaseManager.getInstance().setCurrentUser(userId);

    const budgetRepo = new SQLiteBudgetRepository();
    const outboxRepo = new SQLiteSyncOutboxRepository();

    const budget = await budgetRepo.create({
      periodStart: '2026-09-01',
      limitAmountCents: 50000, // $500.00
      currency: 'USD',
    });

    expect(budget.id).toBeDefined();
    expect(budget.limitAmountCents).toBe(50000);

    // Update limit
    const updated = await budgetRepo.updateLimit(budget.id, 65000); // $650.00
    expect(updated.limitAmountCents).toBe(65000);
    expect(updated.version).toBe(2);

    // Delete budget
    await budgetRepo.delete(budget.id);

    const pending = await outboxRepo.getPending();
    expect(pending.some((p) => p.entityType === 'BUDGET' && p.operation === 'DELETE')).toBe(true);
  });

  it('creates, lists, and toggles recurring expenses', async () => {
    const userId = 'user_recurring';
    DatabaseManager.getInstance().setCurrentUser(userId);

    const recurringRepo = new SQLiteRecurringExpenseRepository();

    const rec = await recurringRepo.create({
      categoryId: 'cat_entertainment',
      title: 'Netflix Subscription',
      amountCents: 1599,
      frequency: 'MONTHLY',
      startDate: '2026-09-01',
      nextDueDate: '2026-10-01',
    });

    expect(rec.title).toBe('Netflix Subscription');
    expect(rec.isActive).toBe(true);

    const list = await recurringRepo.list();
    expect(list.length).toBe(1);
    expect(list[0].amountCents).toBe(1599);

    // Toggle active state
    const toggled = await recurringRepo.toggleActive(rec.id, false);
    expect(toggled.isActive).toBe(false);
  });

  it('manages outbox status transitions and batch purge', async () => {
    const userId = 'user_sync_worker';
    DatabaseManager.getInstance().setCurrentUser(userId);

    const expenseRepo = new SQLiteExpenseRepository();
    const outboxRepo = new SQLiteSyncOutboxRepository();

    // Create an expense that creates an outbox item
    const exp = await expenseRepo.create({
      categoryId: 'cat_coffee',
      amountCents: 450,
      transactionDate: '2026-09-13',
    });

    const pendingBefore = await outboxRepo.getPending();
    const outboxItem = pendingBefore.find((p) => p.entityId === exp.id);
    expect(outboxItem).toBeDefined();

    // Mark completed
    await outboxRepo.markCompleted(outboxItem!.operationId);

    // Pending should now exclude the completed item
    const pendingAfter = await outboxRepo.getPending();
    expect(pendingAfter.some((p) => p.operationId === outboxItem!.operationId)).toBe(false);

    // Purge completed
    await outboxRepo.clearCompleted();
    const count = await outboxRepo.countPending();
    expect(count).toBe(0);
  });

  it('calculates total expense cents accurately across date ranges', async () => {
    const userId = 'user_math';
    DatabaseManager.getInstance().setCurrentUser(userId);

    const expenseRepo = new SQLiteExpenseRepository();

    await expenseRepo.create({
      categoryId: 'c1',
      amountCents: 1025, // $10.25
      transactionDate: '2026-09-10',
    });

    await expenseRepo.create({
      categoryId: 'c2',
      amountCents: 2050, // $20.50
      transactionDate: '2026-09-12',
    });

    const total = await expenseRepo.getTotalCents('2026-09-01', '2026-09-30');
    expect(total).toBe(3075); // $30.75
  });
});
