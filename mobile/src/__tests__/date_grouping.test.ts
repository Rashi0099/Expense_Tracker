import { describe, it, expect } from 'vitest';
import { groupExpensesByDate } from '../utils/dateGrouping';
import { ExpenseModel } from '../domain/models';

describe('Expense Date Grouping Tests', () => {
  const mockExpenses: ExpenseModel[] = [
    {
      id: 'e1',
      userId: 'u1',
      categoryId: 'c1',
      amountCents: 1500,
      currency: 'USD',
      transactionDate: '2026-09-13',
      paymentMethod: 'CREDIT_CARD',
      payee: 'Starbucks',
      note: undefined,
      createdAt: '2026-09-13T10:00:00Z',
      updatedAt: '2026-09-13T10:00:00Z',
      deletedAt: null,
      version: 1,
      syncStatus: 'SYNCED',
    },
    {
      id: 'e2',
      userId: 'u1',
      categoryId: 'c1',
      amountCents: 3200,
      currency: 'USD',
      transactionDate: '2026-09-13',
      paymentMethod: 'DEBIT_CARD',
      payee: 'Chipotle',
      note: undefined,
      createdAt: '2026-09-13T12:00:00Z',
      updatedAt: '2026-09-13T12:00:00Z',
      deletedAt: null,
      version: 1,
      syncStatus: 'SYNCED',
    },
    {
      id: 'e3',
      userId: 'u1',
      categoryId: 'c2',
      amountCents: 4500,
      currency: 'USD',
      transactionDate: '2026-09-12',
      paymentMethod: 'CREDIT_CARD',
      payee: 'Target',
      note: undefined,
      createdAt: '2026-09-12T15:00:00Z',
      updatedAt: '2026-09-12T15:00:00Z',
      deletedAt: null,
      version: 1,
      syncStatus: 'SYNCED',
    },
    {
      id: 'e4',
      userId: 'u1',
      categoryId: 'c3',
      amountCents: 1200,
      currency: 'USD',
      transactionDate: '2026-09-10',
      paymentMethod: 'CASH',
      payee: 'Subway Ticket',
      note: undefined,
      createdAt: '2026-09-10T08:00:00Z',
      updatedAt: '2026-09-10T08:00:00Z',
      deletedAt: null,
      version: 1,
      syncStatus: 'SYNCED',
    },
  ];

  it('groups transactions into Today, Yesterday, and formatted earlier dates', () => {
    const today = '2026-09-13';
    const groups = groupExpensesByDate(mockExpenses, today);

    expect(groups).toHaveLength(3);

    // Today group
    expect(groups[0].title).toBe('Today');
    expect(groups[0].dateKey).toBe('2026-09-13');
    expect(groups[0].data).toHaveLength(2);
    expect(groups[0].data[0].id).toBe('e1');
    expect(groups[0].data[1].id).toBe('e2');

    // Yesterday group
    expect(groups[1].title).toBe('Yesterday');
    expect(groups[1].dateKey).toBe('2026-09-12');
    expect(groups[1].data).toHaveLength(1);
    expect(groups[1].data[0].id).toBe('e3');

    // Earlier group
    expect(groups[2].title).toBe('Sep 10, 2026');
    expect(groups[2].dateKey).toBe('2026-09-10');
    expect(groups[2].data).toHaveLength(1);
    expect(groups[2].data[0].id).toBe('e4');
  });

  it('returns empty array when no expenses are provided', () => {
    expect(groupExpensesByDate([])).toEqual([]);
  });
});
