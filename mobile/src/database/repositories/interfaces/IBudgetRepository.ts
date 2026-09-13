import { BudgetModel } from '../../../domain/models';

export interface BudgetConsumption {
  budget: BudgetModel;
  spentCents: number;
  remainingCents: number;
  percentageUsed: number;
}

export interface MonthlyBudgetOverview {
  overallBudget: BudgetConsumption | null;
  categoryBudgets: BudgetConsumption[];
}

export interface CreateBudgetParams {
  id?: string;
  categoryId?: string;
  periodStart: string;
  limitAmountCents: number;
  currency?: string;
}

export interface IBudgetRepository {
  create(params: CreateBudgetParams): Promise<BudgetModel>;
  updateLimit(id: string, limitAmountCents: number): Promise<BudgetModel>;
  delete(id: string): Promise<void>;
  getMonthlyOverview(monthStr: string): Promise<MonthlyBudgetOverview>;
}
