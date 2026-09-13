/**
 * Recurring Expense Domain Use Cases (Section 22 & 26)
 *
 * Models recurring subscriptions and bills as schedule definitions,
 * strictly keeping them separate from active spending ledgers.
 */

import { SQLiteRecurringExpenseRepository } from '../../database/repositories/SQLiteRecurringExpenseRepository';
import { CreateRecurringParams } from '../../database/repositories/interfaces/IRecurringExpenseRepository';
import { RecurringExpenseModel } from '../models';
import { DataEvents } from '../../database/sqlite/DataEvents';

export async function listRecurringUseCase(
  repo = new SQLiteRecurringExpenseRepository()
): Promise<RecurringExpenseModel[]> {
  return repo.list();
}

export async function createRecurringUseCase(
  params: CreateRecurringParams,
  repo = new SQLiteRecurringExpenseRepository()
): Promise<RecurringExpenseModel> {
  if (!params.title || params.title.trim() === '') {
    throw new Error('Title is required for recurring expense.');
  }
  if (!params.amountCents || params.amountCents <= 0) {
    throw new Error('Amount must be greater than zero.');
  }

  const created = await repo.create(params);
  DataEvents.notify('RECURRING_CHANGED');
  DataEvents.notify('SYNC_OUTBOX_CHANGED');
  return created;
}

export async function toggleRecurringActiveUseCase(
  id: string,
  isActive: boolean,
  repo = new SQLiteRecurringExpenseRepository()
): Promise<RecurringExpenseModel> {
  const updated = await repo.toggleActive(id, isActive);
  DataEvents.notify('RECURRING_CHANGED');
  DataEvents.notify('SYNC_OUTBOX_CHANGED');
  return updated;
}

export async function deleteRecurringUseCase(
  id: string,
  repo = new SQLiteRecurringExpenseRepository()
): Promise<void> {
  await repo.delete(id);
  DataEvents.notify('RECURRING_CHANGED');
  DataEvents.notify('SYNC_OUTBOX_CHANGED');
}
