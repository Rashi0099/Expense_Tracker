import { PaymentMethod } from './expense';

export interface Income {
  id: string;
  amount: string;
  currency: string;
  categoryId: string;
  categoryName: string;
  transactionDate: string;
  paymentMethod: PaymentMethod;
  source: string;
  note: string | null;
  version: number;
  createdAt: string;
}

export interface IncomeCreateInput {
  amount: string;
  currency?: string;
  categoryId: string;
  transactionDate: string;
  paymentMethod?: PaymentMethod;
  source: string;
  note?: string;
}

export interface IncomeUpdateInput {
  amount?: string;
  currency?: string;
  categoryId?: string;
  transactionDate?: string;
  paymentMethod?: PaymentMethod;
  source?: string;
  note?: string;
}

export interface IncomeFilters {
  page?: number;
  pageSize?: number;
  search?: string;
  categoryId?: string;
  startDate?: string;
  endDate?: string;
}
