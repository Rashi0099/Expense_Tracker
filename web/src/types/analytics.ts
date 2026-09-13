export interface CategoryBreakdown {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  categoryIcon: string;
  totalSpent: string;
  percentage: number;
}

export interface MonthlyTrend {
  month: string;
  monthKey: string;
  expenses: string;
  income: string;
  netSavings: string;
}

export interface DashboardSummary {
  currentBalance: string;
  totalIncome: string;
  totalExpenses: string;
  thisMonthSpending: string;
  budgetLimit: string | null;
  remainingBudget: string | null;
  currency: string;
}

export interface DashboardAnalytics {
  period: {
    startDate: string;
    endDate: string;
  };
  summary: DashboardSummary;
  categoryBreakdown: CategoryBreakdown[];
  monthlyTrends: MonthlyTrend[];
}

export type DateFilterPreset = 'THIS_MONTH' | 'LAST_MONTH' | 'LAST_3_MONTHS' | 'THIS_YEAR' | 'CUSTOM';
