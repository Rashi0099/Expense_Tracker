import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseManager } from '../database/sqlite/DatabaseManager';
import { MemorySQLiteAdapter } from '../database/sqlite/DatabaseConnection';
import { SQLiteExpenseRepository } from '../database/repositories/SQLiteExpenseRepository';
import { SQLiteIncomeRepository } from '../database/repositories/SQLiteIncomeRepository';
import { SQLiteBudgetRepository } from '../database/repositories/SQLiteBudgetRepository';
import { SQLiteSyncOutboxRepository } from '../database/repositories/SQLiteSyncOutboxRepository';
import { SQLiteCategoryRepository } from '../database/repositories/SQLiteCategoryRepository';
import { getTodayDateString, getCurrentMonthString } from '../utils/date';

describe('Offline Long-Duration Operations & Reconnection (Section 48)', () => {
  const TEST_USER = 'usr_offline_long_user_001';
  let db: MemorySQLiteAdapter;
  let expenseRepo: SQLiteExpenseRepository;
  let incomeRepo: SQLiteIncomeRepository;
  let budgetRepo: SQLiteBudgetRepository;
  let outboxRepo: SQLiteSyncOutboxRepository;
  let categoryRepo: SQLiteCategoryRepository;
  let defaultCategoryId: string;

  beforeEach(async () => {
    db = new MemorySQLiteAdapter();
    await DatabaseManager.getInstance().initialize(db);
    DatabaseManager.getInstance().setCurrentUser(TEST_USER);

    expenseRepo = new SQLiteExpenseRepository();
    incomeRepo = new SQLiteIncomeRepository();
    budgetRepo = new SQLiteBudgetRepository();
    outboxRepo = new SQLiteSyncOutboxRepository();
    categoryRepo = new SQLiteCategoryRepository();

    await categoryRepo.seedDefaults();
    const cats = await categoryRepo.list('EXPENSE');
    defaultCategoryId = cats[0].id;
  });

  it('handles extended offline sessions with mixed CRUD and synchronizes completely upon reconnect', async () => {
    const today = getTodayDateString();
    const currentMonth = getCurrentMonthString();

    // 1. Create 10 expenses while offline
    const createdExpenses = [];
    for (let i = 1; i <= 10; i++) {
      const exp = await expenseRepo.create({
        amountCents: i * 500, // $5.00, $10.00, etc.
        categoryId: defaultCategoryId,
        transactionDate: today,
        payee: `Offline Merchant ${i}`,
        note: `Batch offline expense ${i}`,
      });
      createdExpenses.push(exp);
    }

    // 2. Edit 3 expenses while offline
    await expenseRepo.update(createdExpenses[0].id, { amountCents: 9999, payee: 'Updated Merchant 1' });
    await expenseRepo.update(createdExpenses[1].id, { payee: 'Updated Merchant 2' });
    await expenseRepo.update(createdExpenses[2].id, { note: 'Updated note 3' });

    // 3. Soft-delete 2 expenses while offline
    await expenseRepo.softDelete(createdExpenses[8].id);
    await expenseRepo.softDelete(createdExpenses[9].id);

    // 4. Add 2 income entries while offline
    const incomeCats = await categoryRepo.list('INCOME');
    const incomeCatId = incomeCats[0].id;
    await incomeRepo.create({
      amountCents: 50000, // $500.00
      categoryId: incomeCatId,
      transactionDate: today,
      source: 'Freelance Design',
    });
    await incomeRepo.create({
      amountCents: 25000, // $250.00
      categoryId: incomeCatId,
      transactionDate: today,
      source: 'Dividends',
    });

    // 5. Create & update a budget while offline
    const budget = await budgetRepo.create({
      periodStart: `${currentMonth}-01`,
      limitAmountCents: 150000, // $1500.00
    });
    await budgetRepo.updateLimit(budget.id, 180000); // Updated to $1800.00

    // --- Verify Local State Prior to Reconnection ---
    const activeExpenses = await expenseRepo.list();
    expect(activeExpenses).toHaveLength(8); // 10 created minus 2 deleted

    const activeIncome = await incomeRepo.list();
    expect(activeIncome).toHaveLength(2);

    const overview = await budgetRepo.getMonthlyOverview(currentMonth);
    expect(overview.overallBudget?.budget.limitAmountCents).toBe(180000);

    // Verify outbox collected all mutations
    const pendingOps = await outboxRepo.getPending(100);
    // 10 expense creates + 3 expense updates + 2 expense deletes + 2 income creates + 1 budget create + 1 budget update = 19
    expect(pendingOps.length).toBeGreaterThanOrEqual(18);

    // --- Reconnection & Simulated Server Drain ---
    const serverState = {
      expenses: new Map<string, any>(),
      income: new Map<string, any>(),
      budgets: new Map<string, any>(),
    };

    for (const op of pendingOps) {
      if (op.entityType === 'EXPENSE') {
        if (op.operation === 'CREATE' || op.operation === 'UPDATE') {
          serverState.expenses.set(op.entityId, op.payload);
        } else if (op.operation === 'DELETE') {
          serverState.expenses.delete(op.entityId);
        }
      } else if (op.entityType === 'INCOME') {
        serverState.income.set(op.entityId, op.payload);
      } else if (op.entityType === 'BUDGET') {
        serverState.budgets.set(op.entityId, op.payload);
      }
      // Mark outbox operation completed
      await outboxRepo.markCompleted(op.operationId);
    }

    // Verify outbox is fully drained
    const remainingPending = await outboxRepo.getPending();
    expect(remainingPending).toHaveLength(0);

    // Verify server received exact net data
    expect(serverState.expenses.size).toBe(8);
    expect(serverState.income.size).toBe(2);
    expect(serverState.budgets.size).toBe(1);
  });
});
