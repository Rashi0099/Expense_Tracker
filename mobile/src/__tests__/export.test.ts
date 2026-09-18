import { describe, it, expect } from 'vitest';
import {
  generateCSV,
  generateFinancialStatement,
  normalizeTransactionsForExport,
  UnifiedTransactionExportItem,
} from '../utils/exportUtils';
import { ExpenseModel, IncomeModel } from '../domain/models';

describe('Financial Export Utils (Feature #2)', () => {
  const mockExpenses: ExpenseModel[] = [
    {
      id: 'exp_1',
      userId: 'usr_1',
      categoryId: 'cat_food',
      categoryName: 'Food & Dining',
      walletId: 'w_1',
      walletName: 'Wallet 1',
      amountCents: 2550,
      currency: 'INR',
      transactionDate: '2026-09-18',
      paymentMethod: 'UPI',
      payee: 'Café Coffee Day, Downtown',
      note: 'Coffee & croissant "special"',
      createdAt: '2026-09-18T10:00:00Z',
      updatedAt: '2026-09-18T10:00:00Z',
      version: 1,
      syncStatus: 'SYNCED',
    },
  ];

  const mockIncomes: IncomeModel[] = [
    {
      id: 'inc_1',
      userId: 'usr_1',
      categoryId: 'cat_salary',
      categoryName: 'Salary',
      walletId: 'w_1',
      walletName: 'Wallet 1',
      amountCents: 100000,
      currency: 'INR',
      transactionDate: '2026-09-01',
      paymentMethod: 'BANK_TRANSFER',
      source: 'Acme Corp',
      note: 'September monthly salary',
      createdAt: '2026-09-01T09:00:00Z',
      updatedAt: '2026-09-01T09:00:00Z',
      version: 1,
      syncStatus: 'SYNCED',
    },
  ];

  it('normalizes transactions into sorted export items', () => {
    const items = normalizeTransactionsForExport(mockExpenses, mockIncomes);
    expect(items.length).toBe(2);
    expect(items[0].date).toBe('2026-09-18');
    expect(items[1].date).toBe('2026-09-01');
  });

  it('generates RFC 4180 compliant CSV with proper escaping for commas and quotes', () => {
    const items = normalizeTransactionsForExport(mockExpenses, mockIncomes);
    const csv = generateCSV(items);

    expect(csv).toContain('Date,Type,Wallet,Category,Payee / Source,Payment Method,Amount,Currency,Note');
    // Check comma escaping: "Café Coffee Day, Downtown"
    expect(csv).toContain('"Café Coffee Day, Downtown"');
    // Check double quotes escaping: "Coffee & croissant ""special"""
    expect(csv).toContain('"Coffee & croissant ""special"""');
    // Check amounts
    expect(csv).toContain(',-25.50,');
    expect(csv).toContain(',1000.00,');
  });

  it('generates human-readable financial statement with correct totals', () => {
    const items = normalizeTransactionsForExport(mockExpenses, mockIncomes);
    const statement = generateFinancialStatement(items, 'INR', 'Monthly Statement');

    expect(statement).toContain('MONTHLY STATEMENT');
    expect(statement).toContain('Total Income:   +INR 1000.00');
    expect(statement).toContain('Total Expenses: -INR 25.50');
    expect(statement).toContain('Net Cashflow:   +INR 974.50');
    expect(statement).toContain('Café Coffee Day, Downtown');
  });
});
