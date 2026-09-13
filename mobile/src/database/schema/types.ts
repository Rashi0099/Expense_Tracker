/**
 * SQLite Raw Row Types
 */

export interface SQLiteCategoryRow {
  id: string;
  user_id: string | null;
  name: string;
  type: 'EXPENSE' | 'INCOME';
  icon: string | null;
  color: string | null;
  is_system: number;
  is_archived: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  version: number;
}

export interface SQLiteExpenseRow {
  id: string;
  user_id: string;
  category_id: string;
  amount_cents: number;
  currency: string;
  transaction_date: string;
  payment_method: string;
  payee: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  version: number;
  sync_status: 'SYNCED' | 'PENDING' | 'FAILED';
  // Joined fields
  category_name?: string;
  category_icon?: string;
  category_color?: string;
}

export interface SQLiteIncomeRow {
  id: string;
  user_id: string;
  category_id: string;
  amount_cents: number;
  currency: string;
  transaction_date: string;
  payment_method: string;
  source: string;
  note: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  version: number;
  sync_status: 'SYNCED' | 'PENDING' | 'FAILED';
  // Joined fields
  category_name?: string;
  category_icon?: string;
  category_color?: string;
}

export interface SQLiteBudgetRow {
  id: string;
  user_id: string;
  category_id: string | null;
  period_start: string;
  limit_amount_cents: number;
  currency: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  version: number;
  // Joined fields
  category_name?: string;
  category_icon?: string;
  category_color?: string;
}

export interface SQLiteRecurringExpenseRow {
  id: string;
  user_id: string;
  category_id: string;
  title: string;
  amount_cents: number;
  currency: string;
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  start_date: string;
  next_due_date: string;
  end_date: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  version: number;
  // Joined fields
  category_name?: string;
  category_icon?: string;
}

export interface SQLiteSyncOutboxRow {
  operation_id: string;
  user_id: string;
  entity_type: 'EXPENSE' | 'INCOME' | 'CATEGORY' | 'BUDGET' | 'RECURRING';
  entity_id: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  payload: string;
  base_version: number;
  created_at: string;
  retry_count: number;
  next_retry_at: string | null;
  status: 'PENDING' | 'PROCESSING' | 'FAILED' | 'COMPLETED';
  last_error: string | null;
}

export interface SQLiteCategoryMemoryRow {
  user_id: string;
  keyword_normalized: string;
  category_id: string;
  frequency: number;
  last_used_at: string;
}

