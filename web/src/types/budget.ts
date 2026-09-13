export interface OverallBudgetConsumption {
  id: string;
  limitAmount: string;
  currency: string;
  spent: string;
  remaining: string;
  percentageUsed: number;
}

export interface CategoryBudgetConsumption {
  id: string;
  categoryId: string;
  categoryName: string;
  categoryColor?: string;
  categoryIcon?: string;
  limitAmount: string;
  currency: string;
  spent: string;
  remaining: string;
  percentageUsed: number;
  version?: number;
}

export interface BudgetOverview {
  period: string;
  overallBudget: OverallBudgetConsumption | null;
  categoryBudgets: CategoryBudgetConsumption[];
}

export interface BudgetCreateInput {
  periodStart: string; // YYYY-MM-01
  limitAmount: string;
  currency?: string;
  categoryId?: string | null;
}
