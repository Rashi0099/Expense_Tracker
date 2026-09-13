/**
 * Expense Domain Use Cases (Section 26)
 *
 * Implements business logic and validation for expense mutations and queries.
 */

import { SQLiteExpenseRepository } from '../../database/repositories/SQLiteExpenseRepository';
import {
  CreateExpenseParams,
  UpdateExpenseParams,
  ExpenseFilters,
} from '../../database/repositories/interfaces/IExpenseRepository';
import { ExpenseModel } from '../models';
import { ExpenseValidator } from '../validation';
import { DataEvents } from '../../database/sqlite/DataEvents';

export async function createExpenseUseCase(
  params: CreateExpenseParams,
  repo = new SQLiteExpenseRepository()
): Promise<ExpenseModel> {
  // Domain validation
  const validation = ExpenseValidator.validate({
    amountCents: params.amountCents,
    categoryId: params.categoryId,
    transactionDate: params.transactionDate,
  });

  if (!validation.isValid) {
    const firstError = Object.values(validation.errors)[0];
    throw new Error(firstError || 'Invalid expense data');
  }

  const created = await repo.create(params);
  DataEvents.notify('EXPENSES_CHANGED');
  DataEvents.notify('BUDGETS_CHANGED');
  DataEvents.notify('SYNC_OUTBOX_CHANGED');
  return created;
}

export async function updateExpenseUseCase(
  id: string,
  params: UpdateExpenseParams,
  repo = new SQLiteExpenseRepository()
): Promise<ExpenseModel> {
  if (params.amountCents !== undefined && params.amountCents <= 0) {
    throw new Error('Please enter an amount greater than zero.');
  }

  const updated = await repo.update(id, params);
  DataEvents.notify('EXPENSES_CHANGED');
  DataEvents.notify('BUDGETS_CHANGED');
  DataEvents.notify('SYNC_OUTBOX_CHANGED');
  return updated;
}

export async function deleteExpenseUseCase(
  id: string,
  repo = new SQLiteExpenseRepository()
): Promise<void> {
  await repo.softDelete(id);
  DataEvents.notify('EXPENSES_CHANGED');
  DataEvents.notify('BUDGETS_CHANGED');
  DataEvents.notify('SYNC_OUTBOX_CHANGED');
}

export async function listExpensesUseCase(
  filters?: ExpenseFilters,
  repo = new SQLiteExpenseRepository()
): Promise<ExpenseModel[]> {
  return repo.list(filters);
}

export async function getExpenseByIdUseCase(
  id: string,
  repo = new SQLiteExpenseRepository()
): Promise<ExpenseModel | null> {
  return repo.getById(id);
}

export async function getTotalExpensesCentsUseCase(
  startDate?: string,
  endDate?: string,
  repo = new SQLiteExpenseRepository()
): Promise<number> {
  return repo.getTotalCents(startDate, endDate);
}
