export type RecurringFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

export interface RecurringExpense {
  id: string;
  title: string;
  amount: string;
  currency: string;
  frequency: RecurringFrequency;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  categoryIcon: string;
  startDate: string;
  nextDueDate: string;
  endDate: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface RecurringCreateInput {
  title: string;
  amount: string;
  currency?: string;
  frequency: RecurringFrequency;
  categoryId: string;
  startDate: string;
  nextDueDate?: string;
  endDate?: string | null;
  isActive?: boolean;
}

export interface RecurringUpdateInput {
  title?: string;
  amount?: string;
  frequency?: RecurringFrequency;
  categoryId?: string;
  startDate?: string;
  nextDueDate?: string;
  endDate?: string | null;
  isActive?: boolean;
}
