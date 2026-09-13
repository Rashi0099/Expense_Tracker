export type PaymentMethod =
  | 'CASH'
  | 'DEBIT_CARD'
  | 'CREDIT_CARD'
  | 'UPI'
  | 'BANK_TRANSFER'
  | 'OTHER';

export type CategoryType = 'EXPENSE' | 'INCOME';

export type RecurringFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

export type SyncStatus = 'SYNCED' | 'PENDING' | 'FAILED';

export interface CategoryModel {
  id: string;
  userId: string | null;
  name: string;
  type: CategoryType;
  icon: string;
  color: string;
  isSystem: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface ExpenseModel {
  id: string;
  userId: string;
  categoryId: string;
  amountCents: number;
  currency: string;
  transactionDate: string;
  paymentMethod: PaymentMethod;
  payee?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  version: number;
  syncStatus: SyncStatus;
  // Joined representation
  categoryName?: string;
  categoryIcon?: string;
  categoryColor?: string;
}

export interface IncomeModel {
  id: string;
  userId: string;
  categoryId: string;
  amountCents: number;
  currency: string;
  transactionDate: string;
  paymentMethod: PaymentMethod;
  source: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  version: number;
  syncStatus: SyncStatus;
  categoryName?: string;
  categoryIcon?: string;
  categoryColor?: string;
}

export interface BudgetModel {
  id: string;
  userId: string;
  categoryId: string | null;
  periodStart: string;
  limitAmountCents: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  categoryName?: string;
  categoryIcon?: string;
  categoryColor?: string;
}

export interface RecurringExpenseModel {
  id: string;
  userId: string;
  categoryId: string;
  title: string;
  amountCents: number;
  currency: string;
  frequency: RecurringFrequency;
  startDate: string;
  nextDueDate: string;
  endDate?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  version: number;
  categoryName?: string;
  categoryIcon?: string;
}

export interface SyncOutboxItem {
  operationId: string;
  userId: string;
  entityType: 'EXPENSE' | 'INCOME' | 'CATEGORY' | 'BUDGET' | 'RECURRING';
  entityId: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  payload: Record<string, unknown>;
  baseVersion: number;
  createdAt: string;
  retryCount: number;
  nextRetryAt: string | null;
  status: 'PENDING' | 'PROCESSING' | 'FAILED' | 'COMPLETED';
  lastError: string | null;
}
