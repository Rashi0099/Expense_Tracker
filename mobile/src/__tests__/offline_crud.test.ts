import { describe, it, expect, beforeEach } from 'vitest';
import { MemorySQLiteAdapter } from '../database/sqlite/DatabaseConnection';
import { DatabaseManager } from '../database/sqlite/DatabaseManager';
import {
  createExpenseUseCase,
  updateExpenseUseCase,
  deleteExpenseUseCase,
  listExpensesUseCase,
  getExpenseByIdUseCase,
  getTotalExpensesCentsUseCase,
} from '../domain/usecases/expenseUseCases';
import {
  createIncomeUseCase,
  updateIncomeUseCase,
  deleteIncomeUseCase,
  listIncomeUseCase,
  getTotalIncomeCentsUseCase,
} from '../domain/usecases/incomeUseCases';
import {
  createCategoryUseCase,
  listCategoriesUseCase,
} from '../domain/usecases/categoryUseCases';
import {
  createBudgetUseCase,
  updateBudgetLimitUseCase,
  deleteBudgetUseCase,
  getMonthlyBudgetOverviewUseCase,
} from '../domain/usecases/budgetUseCases';
import {
  createRecurringUseCase,
  toggleRecurringActiveUseCase,
  deleteRecurringUseCase,
  listRecurringUseCase,
} from '../domain/usecases/recurringUseCases';
import { SQLiteCategoryRepository } from '../database/repositories/SQLiteCategoryRepository';

describe('Offline-First Core Mobile CRUD & Local Data Layer', () => {
  let memoryDb: MemorySQLiteAdapter;
  const userId = 'offline_user_001';

  beforeEach(async () => {
    await DatabaseManager.getInstance().close();
    memoryDb = new MemorySQLiteAdapter();
    await DatabaseManager.getInstance().initialize(memoryDb);
    DatabaseManager.getInstance().setCurrentUser(userId);

    // Seed default categories
    const catRepo = new SQLiteCategoryRepository();
    await catRepo.seedDefaults();
  });

  describe('Expenses Local CRUD & Search/Filters', () => {
    it('creates, reads, searches, filters, updates, and soft-deletes expenses', async () => {
      // 1. Create expenses
      const exp1 = await createExpenseUseCase({
        categoryId: 'c0000000-0000-0000-0000-000000000001', // Food & Dining
        amountCents: 1250, // $12.50
        transactionDate: '2026-09-13',
        payee: 'Chipotle Mexican Grill',
        note: 'Burrito bowl lunch',
      });

      const exp2 = await createExpenseUseCase({
        categoryId: 'c0000000-0000-0000-0000-000000000003', // Transport & Fuel
        amountCents: 2400, // $24.00
        transactionDate: '2026-09-13',
        payee: 'Uber Trip',
        note: 'Ride to downtown office',
      });

      expect(exp1.id).toBeDefined();
      expect(exp2.id).toBeDefined();

      // 2. Read all expenses
      const all = await listExpensesUseCase();
      expect(all.length).toBe(2);

      // 3. Search local expenses by payee
      const searchResult = await listExpensesUseCase({ search: 'chipotle' });
      expect(searchResult.length).toBe(1);
      expect(searchResult[0].payee).toBe('Chipotle Mexican Grill');

      // 4. Search local expenses by note
      const noteResult = await listExpensesUseCase({ search: 'downtown' });
      expect(noteResult.length).toBe(1);
      expect(noteResult[0].payee).toBe('Uber Trip');

      // 5. Filter by category
      const foodOnly = await listExpensesUseCase({
        categoryId: 'c0000000-0000-0000-0000-000000000001',
      });
      expect(foodOnly.length).toBe(1);
      expect(foodOnly[0].amountCents).toBe(1250);

      // 6. Update expense
      const updated = await updateExpenseUseCase(exp1.id, {
        amountCents: 1475, // $14.75
        note: 'Burrito bowl lunch + guac',
      });
      expect(updated.amountCents).toBe(1475);
      expect(updated.note).toBe('Burrito bowl lunch + guac');
      expect(updated.version).toBe(2);

      // 7. Verify updated total
      const total = await getTotalExpensesCentsUseCase();
      expect(total).toBe(1475 + 2400); // 3875 cents

      // 8. Soft-delete expense
      await deleteExpenseUseCase(exp2.id);

      const remaining = await listExpensesUseCase();
      expect(remaining.length).toBe(1);
      expect(remaining[0].id).toBe(exp1.id);

      // Verify getById returns null for soft-deleted record
      const fetchedDeleted = await getExpenseByIdUseCase(exp2.id);
      expect(fetchedDeleted).toBeNull();
    });
  });

  describe('Income Local CRUD', () => {
    it('creates, lists, updates, and soft-deletes income streams', async () => {
      const inc1 = await createIncomeUseCase({
        categoryId: 'c0000000-0000-0000-0000-000000000007', // Salary
        amountCents: 450000, // $4,500.00
        source: 'Acme Technologies',
        transactionDate: '2026-09-01',
        note: 'September base salary',
      });

      expect(inc1.amountCents).toBe(450000);

      const list = await listIncomeUseCase();
      expect(list.length).toBe(1);
      expect(list[0].source).toBe('Acme Technologies');

      // Update income
      const updated = await updateIncomeUseCase(inc1.id, {
        amountCents: 480000, // $4,800.00
      });
      expect(updated.amountCents).toBe(480000);

      const total = await getTotalIncomeCentsUseCase();
      expect(total).toBe(480000);

      // Soft delete
      await deleteIncomeUseCase(inc1.id);
      const remaining = await listIncomeUseCase();
      expect(remaining.length).toBe(0);
    });
  });

  describe('Category Local Management', () => {
    it('supports custom category creation and category filtering', async () => {
      const customCat = await createCategoryUseCase({
        name: 'Pet Expenses',
        type: 'EXPENSE',
        icon: '🐾',
        color: '#10B981',
      });

      expect(customCat.id).toBeDefined();
      expect(customCat.name).toBe('Pet Expenses');

      const expenseCats = await listCategoriesUseCase('EXPENSE');
      expect(expenseCats.some((c) => c.name === 'Pet Expenses')).toBe(true);
      expect(expenseCats.some((c) => c.name === 'Food & Dining')).toBe(true);

      const incomeCats = await listCategoriesUseCase('INCOME');
      expect(incomeCats.some((c) => c.name === 'Salary')).toBe(true);
      expect(incomeCats.some((c) => c.name === 'Pet Expenses')).toBe(false);
    });
  });

  describe('Budget Local Calculations & Reconciliations', () => {
    it('accurately derives spent amount and percentages from local matching expenses', async () => {
      const foodCatId = 'c0000000-0000-0000-0000-000000000001';

      // 1. Create a category budget for September: $100.00 limit (10,000 cents)
      const foodBudget = await createBudgetUseCase({
        categoryId: foodCatId,
        limitAmountCents: 10000,
        periodStart: '2026-09-01',
      });

      // 2. Add local matching expenses in September
      await createExpenseUseCase({
        categoryId: foodCatId,
        amountCents: 2500, // $25.00
        transactionDate: '2026-09-05',
      });

      await createExpenseUseCase({
        categoryId: foodCatId,
        amountCents: 4500, // $45.00
        transactionDate: '2026-09-10',
      });

      // 3. Get monthly overview
      const overview = await getMonthlyBudgetOverviewUseCase('2026-09');
      expect(overview.categoryBudgets.length).toBe(1);

      const consumption = overview.categoryBudgets[0];
      expect(consumption.budget.id).toBe(foodBudget.id);
      expect(consumption.spentCents).toBe(7000); // $70.00
      expect(consumption.remainingCents).toBe(3000); // $30.00
      expect(consumption.percentageUsed).toBe(70); // 70%

      // 4. Update limit to $80.00 (8,000 cents) -> percentage used should become 88%
      await updateBudgetLimitUseCase(foodBudget.id, 8000);
      const updatedOverview = await getMonthlyBudgetOverviewUseCase('2026-09');
      expect(updatedOverview.categoryBudgets[0].percentageUsed).toBe(88); // 7000 / 8000 * 100

      // 5. Delete budget
      await deleteBudgetUseCase(foodBudget.id);
      const clearedOverview = await getMonthlyBudgetOverviewUseCase('2026-09');
      expect(clearedOverview.categoryBudgets.length).toBe(0);
    });
  });

  describe('Recurring Bills Management', () => {
    it('creates, lists, toggles active state, and deletes recurring bills', async () => {
      const rec = await createRecurringUseCase({
        categoryId: 'c0000000-0000-0000-0000-000000000006', // Entertainment
        title: 'Spotify Family Plan',
        amountCents: 1699,
        frequency: 'MONTHLY',
        startDate: '2026-09-01',
        nextDueDate: '2026-10-01',
      });

      expect(rec.isActive).toBe(true);

      const list = await listRecurringUseCase();
      expect(list.length).toBe(1);

      // Toggle active to false
      const toggled = await toggleRecurringActiveUseCase(rec.id, false);
      expect(toggled.isActive).toBe(false);

      // Delete
      await deleteRecurringUseCase(rec.id);
      const empty = await listRecurringUseCase();
      expect(empty.length).toBe(0);
    });
  });
});
