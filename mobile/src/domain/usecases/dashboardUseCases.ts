/**
 * Dashboard & Balance Domain Use Cases (Section 41, 42, 43)
 *
 * Reconciles financial metrics directly from local SQLite with zero float drift.
 */

import { SQLiteExpenseRepository } from '../../database/repositories/SQLiteExpenseRepository';
import { SQLiteIncomeRepository } from '../../database/repositories/SQLiteIncomeRepository';
import { SQLiteSyncOutboxRepository } from '../../database/repositories/SQLiteSyncOutboxRepository';
import { ExpenseModel, IncomeModel } from '../models';

export interface CategorySpending {
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  totalCents: number;
  percentage: number;
}

export interface CashflowMetrics {
  netBalanceCents: number;
  totalIncomeCents: number;
  totalExpensesCents: number;
}

export interface DashboardSummary {
  netBalanceCents: number;
  totalIncomeCents: number;
  totalExpensesCents: number;
  recentExpenses: ExpenseModel[];
  recentIncome: IncomeModel[];
  categorySpending: CategorySpending[];
  pendingSyncCount: number;
}

/**
 * Ultra-fast isolated query for Cashflow Overview Card metrics (<2ms).
 * Runs only 2 simple integer SQL SUMs without computing lists or breakdowns.
 */
export async function getCashflowMetricsUseCase(dateRange?: {
  startDate?: string;
  endDate?: string;
}): Promise<CashflowMetrics> {
  const expenseRepo = new SQLiteExpenseRepository();
  const incomeRepo = new SQLiteIncomeRepository();

  const [totalExpensesCents, totalIncomeCents] = await Promise.all([
    expenseRepo.getTotalCents(dateRange?.startDate, dateRange?.endDate),
    incomeRepo.getTotalCents(dateRange?.startDate, dateRange?.endDate),
  ]);

  const netBalanceCents = totalIncomeCents - totalExpensesCents;
  return {
    netBalanceCents,
    totalIncomeCents,
    totalExpensesCents,
  };
}

/**
 * Returns daily cumulative net balance data points for the sparkline chart.
 * Each value represents the running net balance at the end of that day.
 * Returns at most `points` values (default 14), evenly spaced across the date range.
 */
export async function getBalanceTrendUseCase(
  dateRange: { startDate: string; endDate: string },
  points: number = 14
): Promise<number[]> {
  const expenseRepo = new SQLiteExpenseRepository();
  const incomeRepo = new SQLiteIncomeRepository();

  const [expenses, incomes] = await Promise.all([
    expenseRepo.list({ startDate: dateRange.startDate, endDate: dateRange.endDate }),
    incomeRepo.list({ startDate: dateRange.startDate, endDate: dateRange.endDate }),
  ]);

  // Build a map of date -> { income, expense } in cents
  const dailyMap = new Map<string, { income: number; expense: number }>();

  for (const inc of incomes) {
    const d = inc.transactionDate;
    const entry = dailyMap.get(d) || { income: 0, expense: 0 };
    entry.income += inc.amountCents;
    dailyMap.set(d, entry);
  }
  for (const exp of expenses) {
    const d = exp.transactionDate;
    const entry = dailyMap.get(d) || { income: 0, expense: 0 };
    entry.expense += exp.amountCents;
    dailyMap.set(d, entry);
  }

  // Generate all dates in range
  const start = new Date(dateRange.startDate);
  const end = new Date(dateRange.endDate);
  const allDates: string[] = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    allDates.push(`${y}-${m}-${day}`);
  }

  // Compute cumulative net balance per day
  let running = 0;
  const dailyValues: number[] = allDates.map((date) => {
    const entry = dailyMap.get(date);
    if (entry) {
      running += entry.income - entry.expense;
    }
    return running;
  });

  if (dailyValues.length === 0) return [];
  if (dailyValues.length <= points) return dailyValues;

  // Down-sample to `points` evenly spaced values
  const step = (dailyValues.length - 1) / (points - 1);
  return Array.from({ length: points }, (_, i) => dailyValues[Math.round(i * step)]);
}

export async function getDashboardSummaryUseCase(dateRange?: {
  startDate?: string;
  endDate?: string;
}): Promise<DashboardSummary> {
  const expenseRepo = new SQLiteExpenseRepository();
  const incomeRepo = new SQLiteIncomeRepository();
  const outboxRepo = new SQLiteSyncOutboxRepository();

  const [totalExpensesCents, totalIncomeCents, recentExpenses, recentIncome, pendingSyncCount, allExpenses] =
    await Promise.all([
      expenseRepo.getTotalCents(dateRange?.startDate, dateRange?.endDate),
      incomeRepo.getTotalCents(dateRange?.startDate, dateRange?.endDate),
      expenseRepo.list({ limit: 5 }),
      incomeRepo.list({ limit: 5 }),
      outboxRepo.countPending(),
      expenseRepo.list(
        dateRange?.startDate || dateRange?.endDate
          ? { startDate: dateRange.startDate, endDate: dateRange.endDate }
          : undefined
      ),
    ]);

  // Exact Balance = Income - Expenses (integer arithmetic in cents)
  const netBalanceCents = totalIncomeCents - totalExpensesCents;
  const categoryMap = new Map<
    string,
    { name: string; icon: string; color: string; totalCents: number }
  >();

  for (const exp of allExpenses) {
    const catId = exp.categoryId;
    const existing = categoryMap.get(catId);
    if (existing) {
      existing.totalCents += exp.amountCents;
    } else {
      categoryMap.set(catId, {
        name: exp.categoryName || 'General',
        icon: exp.categoryIcon || '🏷️',
        color: exp.categoryColor || '#808080',
        totalCents: exp.amountCents,
      });
    }
  }

  const categorySpending: CategorySpending[] = Array.from(categoryMap.entries())
    .map(([catId, val]) => ({
      categoryId: catId,
      categoryName: val.name,
      categoryIcon: val.icon,
      categoryColor: val.color,
      totalCents: val.totalCents,
      percentage: totalExpensesCents > 0 ? Math.round((val.totalCents / totalExpensesCents) * 100) : 0,
    }))
    .sort((a, b) => b.totalCents - a.totalCents)
    .slice(0, 4);

  return {
    netBalanceCents,
    totalIncomeCents,
    totalExpensesCents,
    recentExpenses,
    recentIncome,
    categorySpending,
    pendingSyncCount,
  };
}
