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

export async function getDashboardSummaryUseCase(dateRange?: {
  startDate?: string;
  endDate?: string;
}): Promise<DashboardSummary> {
  const expenseRepo = new SQLiteExpenseRepository();
  const incomeRepo = new SQLiteIncomeRepository();
  const outboxRepo = new SQLiteSyncOutboxRepository();

  const [totalExpensesCents, totalIncomeCents, recentExpenses, recentIncome, pendingSyncCount] =
    await Promise.all([
      expenseRepo.getTotalCents(dateRange?.startDate, dateRange?.endDate),
      incomeRepo.getTotalCents(dateRange?.startDate, dateRange?.endDate),
      expenseRepo.list({ limit: 5 }),
      incomeRepo.list({ limit: 5 }),
      outboxRepo.countPending(),
    ]);

  // Exact Balance = Income - Expenses (integer arithmetic in cents)
  const netBalanceCents = totalIncomeCents - totalExpensesCents;

  // Derive category spending breakdown from expenses within the date range
  const allExpenses = await expenseRepo.list(
    dateRange?.startDate || dateRange?.endDate
      ? { startDate: dateRange.startDate, endDate: dateRange.endDate }
      : undefined
  );
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
