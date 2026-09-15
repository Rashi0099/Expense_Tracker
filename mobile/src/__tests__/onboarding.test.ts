import { describe, it, expect } from 'vitest';
import {
  PROFILE_OPTIONS,
  EXPENSE_CATEGORY_POOL,
  INCOME_CATEGORY_POOL,
  getExpenseSuggestions,
  getIncomeSuggestions,
} from '../screens/onboarding/data/onboardingData';

describe('Onboarding Data and Intelligence Rules', () => {
  it('contains expected primary profile options including Student, Working Professional, Business Owner', () => {
    const profileIds = PROFILE_OPTIONS.map((p) => p.id);
    expect(profileIds).toContain('student');
    expect(profileIds).toContain('working_professional');
    expect(profileIds).toContain('business_owner');
    expect(profileIds).toContain('freelancer');
    expect(profileIds).toContain('homemaker');
    expect(profileIds).toContain('self_employed');
    expect(profileIds).toContain('retired');
    expect(profileIds).toContain('other');
  });

  it('re-uses existing 6 system expense category IDs without duplication', () => {
    const existingIds = [
      'c0000000-0000-0000-0000-000000000001', // Food & Dining
      'c0000000-0000-0000-0000-000000000002', // Groceries
      'c0000000-0000-0000-0000-000000000003', // Transport
      'c0000000-0000-0000-0000-000000000004', // Shopping
      'c0000000-0000-0000-0000-000000000005', // Bills & Utilities
      'c0000000-0000-0000-0000-000000000006', // Entertainment
    ];
    for (const id of existingIds) {
      const match = EXPENSE_CATEGORY_POOL.find((c) => c.id === id);
      expect(match).toBeDefined();
      expect(match?.type).toBe('EXPENSE');
    }
  });

  it('re-uses existing 3 system income category IDs without duplication', () => {
    const existingIncomeIds = [
      'c0000000-0000-0000-0000-000000000007', // Salary
      'c0000000-0000-0000-0000-000000000008', // Investments
      'c0000000-0000-0000-0000-000000000009', // Freelance
    ];
    for (const id of existingIncomeIds) {
      const match = INCOME_CATEGORY_POOL.find((c) => c.id === id);
      expect(match).toBeDefined();
      expect(match?.type).toBe('INCOME');
    }
  });

  it('intelligently suggests relevant expense categories based on profile selection', () => {
    // Student should have Education and Entertainment
    const studentExpenses = getExpenseSuggestions('student');
    const educationId = 'c0000000-0000-0000-0000-000000000012';
    const entertainmentId = 'c0000000-0000-0000-0000-000000000006';
    expect(studentExpenses).toContain(educationId);
    expect(studentExpenses).toContain(entertainmentId);

    // Business Owner should have Business Expenses and EMI / Loans
    const businessExpenses = getExpenseSuggestions('business_owner');
    const bizExpenseId = 'c0000000-0000-0000-0000-000000000023';
    expect(businessExpenses).toContain(bizExpenseId);

    // Working Professional should have Rent / Housing and Bills
    const proExpenses = getExpenseSuggestions('working_professional');
    const rentId = 'c0000000-0000-0000-0000-000000000010';
    expect(proExpenses).toContain(rentId);
  });

  it('intelligently suggests relevant income categories based on profile selection', () => {
    // Student should get Pocket Money and Scholarship
    const studentIncome = getIncomeSuggestions('student');
    const pocketMoneyId = 'c0000000-0000-0000-0000-000000000038';
    const scholarshipId = 'c0000000-0000-0000-0000-000000000039';
    expect(studentIncome).toContain(pocketMoneyId);
    expect(studentIncome).toContain(scholarshipId);

    // Working Professional should get Salary and Bonuses
    const proIncome = getIncomeSuggestions('working_professional');
    const salaryId = 'c0000000-0000-0000-0000-000000000007';
    const bonusesId = 'c0000000-0000-0000-0000-000000000030';
    expect(proIncome).toContain(salaryId);
    expect(proIncome).toContain(bonusesId);

    // Business Owner should get Business Income
    const bizIncome = getIncomeSuggestions('business_owner');
    const bizIncomeId = 'c0000000-0000-0000-0000-000000000026';
    expect(bizIncome).toContain(bizIncomeId);
  });

  it('provides safe fallback suggestions for unknown or other profiles', () => {
    const unknownExpenses = getExpenseSuggestions('other');
    expect(unknownExpenses.length).toBeGreaterThan(0);
    const unknownIncome = getIncomeSuggestions('other');
    expect(unknownIncome.length).toBeGreaterThan(0);
  });
});
