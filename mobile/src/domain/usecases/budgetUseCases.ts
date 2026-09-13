/**
 * Budget Domain Use Cases (Section 26 & 39 & 40)
 *
 * Implements business logic, validation, and status calculations for budgets.
 */

import { SQLiteBudgetRepository } from '../../database/repositories/SQLiteBudgetRepository';
import {
  CreateBudgetParams,
  MonthlyBudgetOverview,
} from '../../database/repositories/interfaces/IBudgetRepository';
import { BudgetModel } from '../models';
import { BudgetValidator } from '../validation';
import { DataEvents } from '../../database/sqlite/DataEvents';

export type BudgetStatusLevel = 'ON_TRACK' | 'NEAR_LIMIT' | 'OVER_BUDGET';

export function calculateBudgetStatus(percentageUsed: number): BudgetStatusLevel {
  if (percentageUsed > 100) return 'OVER_BUDGET';
  if (percentageUsed >= 80) return 'NEAR_LIMIT';
  return 'ON_TRACK';
}

export async function createBudgetUseCase(
  params: CreateBudgetParams,
  repo = new SQLiteBudgetRepository()
): Promise<BudgetModel> {
  const validation = BudgetValidator.validate({
    limitAmountCents: params.limitAmountCents,
    periodStart: params.periodStart,
  });

  if (!validation.isValid) {
    const firstError = Object.values(validation.errors)[0];
    throw new Error(firstError || 'Invalid budget data');
  }

  const created = await repo.create(params);
  DataEvents.notify('BUDGETS_CHANGED');
  DataEvents.notify('SYNC_OUTBOX_CHANGED');
  return created;
}

export async function updateBudgetLimitUseCase(
  id: string,
  limitAmountCents: number,
  repo = new SQLiteBudgetRepository()
): Promise<BudgetModel> {
  if (limitAmountCents <= 0) {
    throw new Error('Budget limit must be greater than zero.');
  }

  const updated = await repo.updateLimit(id, limitAmountCents);
  DataEvents.notify('BUDGETS_CHANGED');
  DataEvents.notify('SYNC_OUTBOX_CHANGED');
  return updated;
}

export async function deleteBudgetUseCase(
  id: string,
  repo = new SQLiteBudgetRepository()
): Promise<void> {
  await repo.delete(id);
  DataEvents.notify('BUDGETS_CHANGED');
  DataEvents.notify('SYNC_OUTBOX_CHANGED');
}

export async function getMonthlyBudgetOverviewUseCase(
  monthStr: string,
  repo = new SQLiteBudgetRepository()
): Promise<MonthlyBudgetOverview> {
  return repo.getMonthlyOverview(monthStr);
}
