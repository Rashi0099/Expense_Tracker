export type PaymentMethod =
  | 'CASH'
  | 'DEBIT_CARD'
  | 'CREDIT_CARD'
  | 'BANK_TRANSFER'
  | 'UPI'
  | 'OTHER';

export interface Expense {
  id: string;
  amount: string;
  currency: string;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  categoryIcon: string;
  transactionDate: string;
  paymentMethod: PaymentMethod;
  payee: string | null;
  note: string | null;
  version: number;
  createdAt: string;
}

export interface ExpenseCreateInput {
  amount: string;
  currency?: string;
  categoryId: string;
  transactionDate: string;
  paymentMethod?: PaymentMethod;
  payee?: string;
  note?: string;
}

export interface ExpenseUpdateInput {
  amount?: string;
  currency?: string;
  categoryId?: string;
  transactionDate?: string;
  paymentMethod?: PaymentMethod;
  payee?: string;
  note?: string;
}

export interface ExpenseFilters {
  page?: number;
  pageSize?: number;
  search?: string;
  categoryId?: string;
  startDate?: string;
  endDate?: string;
  paymentMethod?: PaymentMethod | '';
}
