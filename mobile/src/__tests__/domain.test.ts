import { describe, it, expect } from 'vitest';
import { calculateBudgetStatus } from '../domain/usecases/budgetUseCases';
import { suggestCategoryFromMerchant } from '../domain/rules/smartCategorySuggestion';
import { ExpenseValidator, IncomeValidator, BudgetValidator } from '../domain/validation';
import { CategoryModel } from '../domain/models';

describe('Domain Rules & Business Logic Tests', () => {
  const dummyCategories: CategoryModel[] = [
    {
      id: 'c1',
      userId: null,
      name: 'Food & Dining',
      type: 'EXPENSE',
      icon: '🍔',
      color: '#F97316',
      isSystem: true,
      isArchived: false,
      createdAt: '2026-09-13T00:00:00Z',
      updatedAt: '2026-09-13T00:00:00Z',
      version: 1,
    },
    {
      id: 'c2',
      userId: null,
      name: 'Groceries',
      type: 'EXPENSE',
      icon: '🛒',
      color: '#10B981',
      isSystem: true,
      isArchived: false,
      createdAt: '2026-09-13T00:00:00Z',
      updatedAt: '2026-09-13T00:00:00Z',
      version: 1,
    },
    {
      id: 'c3',
      userId: null,
      name: 'Transport & Fuel',
      type: 'EXPENSE',
      icon: '🚗',
      color: '#3B82F6',
      isSystem: true,
      isArchived: false,
      createdAt: '2026-09-13T00:00:00Z',
      updatedAt: '2026-09-13T00:00:00Z',
      version: 1,
    },
    {
      id: 'c4',
      userId: null,
      name: 'Entertainment',
      type: 'EXPENSE',
      icon: '🎬',
      color: '#8B5CF6',
      isSystem: true,
      isArchived: false,
      createdAt: '2026-09-13T00:00:00Z',
      updatedAt: '2026-09-13T00:00:00Z',
      version: 1,
    },
  ];

  describe('Budget Status Thresholds', () => {
    it('categorizes spending under 80% as ON_TRACK', () => {
      expect(calculateBudgetStatus(0)).toBe('ON_TRACK');
      expect(calculateBudgetStatus(50)).toBe('ON_TRACK');
      expect(calculateBudgetStatus(79)).toBe('ON_TRACK');
    });

    it('categorizes spending between 80% and 100% as NEAR_LIMIT', () => {
      expect(calculateBudgetStatus(80)).toBe('NEAR_LIMIT');
      expect(calculateBudgetStatus(95)).toBe('NEAR_LIMIT');
      expect(calculateBudgetStatus(100)).toBe('NEAR_LIMIT');
    });

    it('categorizes spending above 100% as OVER_BUDGET', () => {
      expect(calculateBudgetStatus(101)).toBe('OVER_BUDGET');
      expect(calculateBudgetStatus(150)).toBe('OVER_BUDGET');
    });
  });

  describe('Deterministic Smart Category Suggestion Engine', () => {
    it('suggests Food & Dining for restaurant and cafe merchants', () => {
      const match1 = suggestCategoryFromMerchant('Starbucks Coffee #4312', dummyCategories);
      expect(match1?.name).toBe('Food & Dining');

      const match2 = suggestCategoryFromMerchant('Swiggy Order #882', dummyCategories);
      expect(match2?.name).toBe('Food & Dining');

      const match3 = suggestCategoryFromMerchant('Domino Pizza', dummyCategories);
      expect(match3?.name).toBe('Food & Dining');
    });

    it('suggests Transport & Fuel for transit and ride share merchants', () => {
      const match1 = suggestCategoryFromMerchant('Uber Trip Help', dummyCategories);
      expect(match1?.name).toBe('Transport & Fuel');

      const match2 = suggestCategoryFromMerchant('Shell Gas Station', dummyCategories);
      expect(match2?.name).toBe('Transport & Fuel');
    });

    it('suggests Groceries for supermarket merchants', () => {
      const match = suggestCategoryFromMerchant('Walmart Supercenter', dummyCategories);
      expect(match?.name).toBe('Groceries');
    });

    it('returns null when no confident rule matches', () => {
      const match = suggestCategoryFromMerchant('Unknown Random Vendor XYZ', dummyCategories);
      expect(match).toBeNull();
    });
  });

  describe('Domain Validators', () => {
    it('validates expense fields correctly', () => {
      const invalid = ExpenseValidator.validate({
        amountCents: 0,
        categoryId: '',
        transactionDate: 'invalid-date',
      });
      expect(invalid.isValid).toBe(false);
      expect(invalid.errors.amount).toBeDefined();
      expect(invalid.errors.categoryId).toBeDefined();
      expect(invalid.errors.transactionDate).toBeDefined();

      const valid = ExpenseValidator.validate({
        amountCents: 1550,
        categoryId: 'c1',
        transactionDate: '2026-09-13',
      });
      expect(valid.isValid).toBe(true);
      expect(Object.keys(valid.errors).length).toBe(0);
    });

    it('validates income fields correctly', () => {
      const invalid = IncomeValidator.validate({
        amountCents: -50,
        categoryId: '',
        source: '',
        transactionDate: '',
      });
      expect(invalid.isValid).toBe(false);

      const valid = IncomeValidator.validate({
        amountCents: 50000,
        categoryId: 'c_inc',
        source: 'Acme Corp',
        transactionDate: '2026-09-13',
      });
      expect(valid.isValid).toBe(true);
    });

    it('validates budget fields correctly', () => {
      const invalid = BudgetValidator.validate({
        limitAmountCents: 0,
        periodStart: '2026-09-15', // must be first of month
      });
      expect(invalid.isValid).toBe(false);

      const valid = BudgetValidator.validate({
        limitAmountCents: 100000,
        periodStart: '2026-09-01',
      });
      expect(valid.isValid).toBe(true);
    });
  });
});
