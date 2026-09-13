import { mobileApiClient } from '../../api/client/mobileApiClient';

export interface SyncOperationDTO {
  operationId: string;
  entityType: 'EXPENSE' | 'INCOME' | 'CATEGORY' | 'BUDGET' | 'RECURRING';
  entityId: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  baseVersion: number;
  payload: Record<string, unknown>;
}

export interface SyncRequestDTO {
  deviceId: string;
  sinceSequence: number;
  operations: SyncOperationDTO[];
}

export interface ProcessedOperationDTO {
  operationId: string;
  entityId: string;
  status: 'ACCEPTED' | 'CONFLICT' | 'REJECTED';
  serverVersion: number;
  serverSequence: number;
  reason?: string | null;
}

export interface ServerExpenseDTO {
  id: string;
  amount: string;
  currency: string;
  categoryId: string;
  categoryName?: string;
  categoryColor?: string;
  categoryIcon?: string;
  transactionDate: string;
  paymentMethod: string;
  payee?: string;
  note?: string;
  version: number;
  serverSequence: number;
  createdAt: string;
  updatedAt: string;
}

export interface ServerIncomeDTO {
  id: string;
  amount: string;
  currency: string;
  categoryId: string;
  categoryName?: string;
  categoryColor?: string;
  categoryIcon?: string;
  transactionDate: string;
  paymentMethod: string;
  source?: string;
  note?: string;
  version: number;
  serverSequence: number;
  createdAt: string;
  updatedAt: string;
}

export interface ServerCategoryDTO {
  id: string;
  name: string;
  type: 'EXPENSE' | 'INCOME';
  parentId?: string | null;
  icon: string;
  color: string;
  isSystem: boolean;
  isArchived: boolean;
  version: number;
  serverSequence: number;
}

export interface ServerBudgetDTO {
  id: string;
  categoryId?: string | null;
  categoryName?: string | null;
  periodStart: string;
  limitAmount: string;
  currency: string;
  version: number;
  serverSequence: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ServerRecurringDTO {
  id: string;
  title: string;
  amount: string;
  currency: string;
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  categoryId: string;
  categoryName?: string;
  categoryColor?: string;
  categoryIcon?: string;
  startDate: string;
  nextDueDate: string;
  endDate?: string | null;
  isActive: boolean;
  version: number;
  serverSequence: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ServerTombstoneDTO {
  entityType: 'EXPENSE' | 'INCOME' | 'CATEGORY' | 'BUDGET' | 'RECURRING';
  entityId: string;
  serverSequence: number;
  deletedAt: string;
}

export interface ServerChangesDTO {
  expenses: ServerExpenseDTO[];
  income: ServerIncomeDTO[];
  categories: ServerCategoryDTO[];
  budgets: ServerBudgetDTO[];
  recurring: ServerRecurringDTO[];
  tombstones: ServerTombstoneDTO[];
}

export interface SyncResponseDTO {
  processedOperations: ProcessedOperationDTO[];
  serverChanges: ServerChangesDTO;
  latestServerSequence: number;
  hasMore: boolean;
}

export const syncApiClient = {
  async postSyncBatch(data: SyncRequestDTO): Promise<SyncResponseDTO> {
    const res = await mobileApiClient.post<SyncResponseDTO>('/sync/', data);
    return res.data;
  },
};
