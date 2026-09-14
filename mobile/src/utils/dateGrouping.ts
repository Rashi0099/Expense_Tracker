import { ExpenseModel, IncomeModel } from '../domain/models';
import { getTodayDateString, formatRelativeDate } from './date';

export interface ExpenseDateGroup {
  title: string;
  dateKey: string;
  data: ExpenseModel[];
}

export interface IncomeDateGroup {
  title: string;
  dateKey: string;
  data: IncomeModel[];
}

/**
 * Groups expenses by calendar date with human-friendly section titles:
 * - "Today" for current local day
 * - "Yesterday" for previous day
 * - Formatted date (e.g. "Sep 11, 2026") for earlier days
 */
export function groupExpensesByDate(
  expenses: ExpenseModel[],
  todayStr: string = getTodayDateString()
): ExpenseDateGroup[] {
  if (!expenses || expenses.length === 0) return [];

  const groupsMap = new Map<string, ExpenseModel[]>();

  for (const exp of expenses) {
    const key = exp.transactionDate;
    const list = groupsMap.get(key) || [];
    list.push(exp);
    groupsMap.set(key, list);
  }

  const groups: ExpenseDateGroup[] = [];
  for (const [dateKey, data] of groupsMap.entries()) {
    groups.push({
      title: formatRelativeDate(dateKey, todayStr),
      dateKey,
      data,
    });
  }

  return groups;
}

/**
 * Groups incomes by calendar date with human-friendly section titles.
 */
export function groupIncomesByDate(
  incomes: IncomeModel[],
  todayStr: string = getTodayDateString()
): IncomeDateGroup[] {
  if (!incomes || incomes.length === 0) return [];

  const groupsMap = new Map<string, IncomeModel[]>();

  for (const inc of incomes) {
    const key = inc.transactionDate;
    const list = groupsMap.get(key) || [];
    list.push(inc);
    groupsMap.set(key, list);
  }

  const groups: IncomeDateGroup[] = [];
  for (const [dateKey, data] of groupsMap.entries()) {
    groups.push({
      title: formatRelativeDate(dateKey, todayStr),
      dateKey,
      data,
    });
  }

  return groups;
}

