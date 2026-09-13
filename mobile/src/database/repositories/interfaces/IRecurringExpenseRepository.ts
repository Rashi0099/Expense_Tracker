import { RecurringExpenseModel, RecurringFrequency } from '../../../domain/models';

export interface CreateRecurringParams {
  id?: string;
  categoryId: string;
  title: string;
  amountCents: number;
  currency?: string;
  frequency: RecurringFrequency;
  startDate: string;
  nextDueDate: string;
  endDate?: string;
  isActive?: boolean;
}

export interface IRecurringExpenseRepository {
  create(params: CreateRecurringParams): Promise<RecurringExpenseModel>;
  toggleActive(id: string, isActive: boolean): Promise<RecurringExpenseModel>;
  delete(id: string): Promise<void>;
  list(): Promise<RecurringExpenseModel[]>;
}
