import {
  SQLiteCategoryRow,
  SQLiteExpenseRow,
  SQLiteIncomeRow,
  SQLiteBudgetRow,
  SQLiteRecurringExpenseRow,
  SQLiteSyncOutboxRow,
} from '../../database/schema/types';
import {
  CategoryModel,
  ExpenseModel,
  IncomeModel,
  BudgetModel,
  RecurringExpenseModel,
  SyncOutboxItem,
  PaymentMethod,
  RecurringFrequency,
} from '../models';

export const CategoryMapper = {
  toDomain(row: SQLiteCategoryRow): CategoryModel {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      type: row.type,
      icon: row.icon || '🏷️',
      color: row.color || '#808080',
      isSystem: row.is_system === 1,
      isArchived: row.is_archived === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      version: row.version,
    };
  },
};

export const ExpenseMapper = {
  toDomain(row: SQLiteExpenseRow): ExpenseModel {
    return {
      id: row.id,
      userId: row.user_id,
      categoryId: row.category_id,
      amountCents: row.amount_cents,
      currency: row.currency,
      transactionDate: row.transaction_date,
      paymentMethod: (row.payment_method || 'CASH') as PaymentMethod,
      payee: row.payee || undefined,
      note: row.note || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at,
      version: row.version,
      syncStatus: row.sync_status,
      categoryName: row.category_name,
      categoryIcon: row.category_icon,
      categoryColor: row.category_color,
    };
  },
};

export const IncomeMapper = {
  toDomain(row: SQLiteIncomeRow): IncomeModel {
    return {
      id: row.id,
      userId: row.user_id,
      categoryId: row.category_id,
      amountCents: row.amount_cents,
      currency: row.currency,
      transactionDate: row.transaction_date,
      paymentMethod: (row.payment_method || 'BANK_TRANSFER') as PaymentMethod,
      source: row.source,
      note: row.note || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at,
      version: row.version,
      syncStatus: row.sync_status,
      categoryName: row.category_name,
      categoryIcon: row.category_icon,
      categoryColor: row.category_color,
    };
  },
};

export const BudgetMapper = {
  toDomain(row: SQLiteBudgetRow): BudgetModel {
    return {
      id: row.id,
      userId: row.user_id,
      categoryId: row.category_id,
      periodStart: row.period_start,
      limitAmountCents: row.limit_amount_cents,
      currency: row.currency,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      version: row.version,
      categoryName: row.category_name,
      categoryIcon: row.category_icon,
      categoryColor: row.category_color,
    };
  },
};

export const RecurringExpenseMapper = {
  toDomain(row: SQLiteRecurringExpenseRow): RecurringExpenseModel {
    return {
      id: row.id,
      userId: row.user_id,
      categoryId: row.category_id,
      title: row.title,
      amountCents: row.amount_cents,
      currency: row.currency,
      frequency: row.frequency as RecurringFrequency,
      startDate: row.start_date,
      nextDueDate: row.next_due_date,
      endDate: row.end_date,
      isActive: row.is_active === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      version: row.version,
      categoryName: row.category_name,
      categoryIcon: row.category_icon,
    };
  },
};

export const SyncOutboxMapper = {
  toDomain(row: SQLiteSyncOutboxRow): SyncOutboxItem {
    let parsedPayload: Record<string, unknown> = {};
    try {
      parsedPayload = JSON.parse(row.payload);
    } catch {
      parsedPayload = {};
    }
    return {
      operationId: row.operation_id,
      userId: row.user_id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      operation: row.operation,
      payload: parsedPayload,
      baseVersion: row.base_version,
      createdAt: row.created_at,
      retryCount: row.retry_count,
      nextRetryAt: row.next_retry_at,
      status: row.status,
      lastError: row.last_error,
    };
  },
};
