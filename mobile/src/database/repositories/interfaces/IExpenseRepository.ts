import { ExpenseModel, PaymentMethod } from '../../../domain/models';

export interface ExpenseFilters {
  categoryId?: string;
  walletId?: string;
  startDate?: string;
  endDate?: string;
  paymentMethod?: PaymentMethod;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface CreateExpenseParams {
  id?: string;
  categoryId: string;
  walletId?: string;
  amountCents: number;
  currency?: string;
  transactionDate: string;
  paymentMethod?: PaymentMethod;
  payee?: string;
  note?: string;
}

export interface UpdateExpenseParams {
  categoryId?: string;
  walletId?: string;
  amountCents?: number;
  currency?: string;
  transactionDate?: string;
  paymentMethod?: PaymentMethod;
  payee?: string;
  note?: string;
}

export interface IExpenseRepository {
  create(params: CreateExpenseParams): Promise<ExpenseModel>;
  update(id: string, params: UpdateExpenseParams): Promise<ExpenseModel>;
  softDelete(id: string): Promise<void>;
  getById(id: string): Promise<ExpenseModel | null>;
  list(filters?: ExpenseFilters): Promise<ExpenseModel[]>;
  getTotalCents(startDate?: string, endDate?: string, walletId?: string): Promise<number>;
}
