import { IncomeModel, PaymentMethod } from '../../../domain/models';

export interface IncomeFilters {
  categoryId?: string;
  walletId?: string;
  paymentMethod?: PaymentMethod;
  startDate?: string;
  endDate?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface CreateIncomeParams {
  id?: string;
  categoryId: string;
  walletId?: string;
  amountCents: number;
  currency?: string;
  transactionDate: string;
  paymentMethod?: PaymentMethod;
  source: string;
  note?: string;
}

export interface UpdateIncomeParams {
  categoryId?: string;
  walletId?: string;
  amountCents?: number;
  currency?: string;
  transactionDate?: string;
  paymentMethod?: PaymentMethod;
  source?: string;
  note?: string;
}

export interface IIncomeRepository {
  create(params: CreateIncomeParams): Promise<IncomeModel>;
  update(id: string, params: UpdateIncomeParams): Promise<IncomeModel>;
  softDelete(id: string): Promise<void>;
  getById(id: string): Promise<IncomeModel | null>;
  list(filters?: IncomeFilters): Promise<IncomeModel[]>;
  getTotalCents(startDate?: string, endDate?: string, walletId?: string): Promise<number>;
}
