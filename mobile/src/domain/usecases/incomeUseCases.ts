/**
 * Income Domain Use Cases (Section 26 & 37)
 *
 * Implements business logic and validation for income mutations and queries.
 */

import { SQLiteIncomeRepository } from '../../database/repositories/SQLiteIncomeRepository';
import {
  CreateIncomeParams,
  UpdateIncomeParams,
  IncomeFilters,
} from '../../database/repositories/interfaces/IIncomeRepository';
import { IncomeModel } from '../models';
import { IncomeValidator } from '../validation';
import { DataEvents } from '../../database/sqlite/DataEvents';

export async function createIncomeUseCase(
  params: CreateIncomeParams,
  repo = new SQLiteIncomeRepository()
): Promise<IncomeModel> {
  const validation = IncomeValidator.validate({
    amountCents: params.amountCents,
    categoryId: params.categoryId,
    source: params.source,
    transactionDate: params.transactionDate,
  });

  if (!validation.isValid) {
    const firstError = Object.values(validation.errors)[0];
    throw new Error(firstError || 'Invalid income data');
  }

  const created = await repo.create(params);
  DataEvents.notify('INCOME_CHANGED');
  DataEvents.notify('SYNC_OUTBOX_CHANGED');
  return created;
}

export async function updateIncomeUseCase(
  id: string,
  params: UpdateIncomeParams,
  repo = new SQLiteIncomeRepository()
): Promise<IncomeModel> {
  if (params.amountCents !== undefined && params.amountCents <= 0) {
    throw new Error('Please enter an amount greater than zero.');
  }

  const updated = await repo.update(id, params);
  DataEvents.notify('INCOME_CHANGED');
  DataEvents.notify('SYNC_OUTBOX_CHANGED');
  return updated;
}

export async function deleteIncomeUseCase(
  id: string,
  repo = new SQLiteIncomeRepository()
): Promise<void> {
  await repo.softDelete(id);
  DataEvents.notify('INCOME_CHANGED');
  DataEvents.notify('SYNC_OUTBOX_CHANGED');
}

export async function listIncomeUseCase(
  filters?: IncomeFilters,
  repo = new SQLiteIncomeRepository()
): Promise<IncomeModel[]> {
  return repo.list(filters);
}

export async function getIncomeByIdUseCase(
  id: string,
  repo = new SQLiteIncomeRepository()
): Promise<IncomeModel | null> {
  return repo.getById(id);
}

export async function getTotalIncomeCentsUseCase(
  startDate?: string,
  endDate?: string,
  repo = new SQLiteIncomeRepository()
): Promise<number> {
  return repo.getTotalCents(startDate, endDate);
}
