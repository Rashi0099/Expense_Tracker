import { describe, it, expect, beforeEach } from 'vitest';
import { MemorySQLiteAdapter } from '../database/sqlite/DatabaseConnection';
import { DatabaseManager } from '../database/sqlite/DatabaseManager';
import {
  createExpenseUseCase,
  updateExpenseUseCase,
  deleteExpenseUseCase,
} from '../domain/usecases/expenseUseCases';
import { createIncomeUseCase } from '../domain/usecases/incomeUseCases';
import { getDashboardSummaryUseCase } from '../domain/usecases/dashboardUseCases';
import { SQLiteCategoryRepository } from '../database/repositories/SQLiteCategoryRepository';

describe('Financial Consistency Across Mutations (Section 64)', () => {
  let memoryDb: MemorySQLiteAdapter;
  const userId = 'math_user_99';

  beforeEach(async () => {
    await DatabaseManager.getInstance().close();
    memoryDb = new MemorySQLiteAdapter();
    await DatabaseManager.getInstance().initialize(memoryDb);
    DatabaseManager.getInstance().setCurrentUser(userId);

    const catRepo = new SQLiteCategoryRepository();
    await catRepo.seedDefaults();
  });

  it('maintains exact Net Balance = Income - Expenses with zero float drift across mutations', async () => {
    // Step 1: Initial State
    // Record Income: ₹50,000 (5,000,000 cents)
    await createIncomeUseCase({
      categoryId: 'c0000000-0000-0000-0000-000000000007',
      amountCents: 5000000, // ₹50,000.00
      source: 'Tech Consultancy',
      transactionDate: '2026-09-01',
    });

    // Record Base Expense: ₹10,000 (1,000,000 cents)
    await createExpenseUseCase({
      categoryId: 'c0000000-0000-0000-0000-000000000005',
      amountCents: 1000000, // ₹10,000.00
      transactionDate: '2026-09-02',
      payee: 'Apartment Rent',
    });

    // Verify Balance: ₹40,000 (4,000,000 cents)
    let summary = await getDashboardSummaryUseCase();
    expect(summary.totalIncomeCents).toBe(5000000);
    expect(summary.totalExpensesCents).toBe(1000000);
    expect(summary.netBalanceCents).toBe(4000000); // Exactly ₹40,000.00

    // Step 2: Add expense of ₹5,000 (500,000 cents)
    const testExp = await createExpenseUseCase({
      categoryId: 'c0000000-0000-0000-0000-000000000004',
      amountCents: 500000, // ₹5,000.00
      transactionDate: '2026-09-03',
      payee: 'Electronics Store',
    });

    // Expected Balance: ₹35,000 (3,500,000 cents)
    summary = await getDashboardSummaryUseCase();
    expect(summary.totalExpensesCents).toBe(1500000);
    expect(summary.netBalanceCents).toBe(3500000);

    // Step 3: Edit expense from ₹5,000 to ₹3,000 (300,000 cents)
    await updateExpenseUseCase(testExp.id, {
      amountCents: 300000, // ₹3,000.00
      note: 'Returned accessory, discount applied',
    });

    // Expected Balance: ₹37,000 (3,700,000 cents)
    summary = await getDashboardSummaryUseCase();
    expect(summary.totalExpensesCents).toBe(1300000);
    expect(summary.netBalanceCents).toBe(3700000);

    // Step 4: Delete the ₹3,000 expense
    await deleteExpenseUseCase(testExp.id);

    // Expected Balance reverts back to ₹40,000 (4,000,000 cents)
    summary = await getDashboardSummaryUseCase();
    expect(summary.totalExpensesCents).toBe(1000000);
    expect(summary.netBalanceCents).toBe(4000000);
  });
});
