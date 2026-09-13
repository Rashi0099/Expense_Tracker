/**
 * SQLite Database Schema Definitions (Section 22 & Step 2/Step 5 specifications)
 *
 * Local schema rules:
 * - Primary keys: 36-character UUID string (client generated)
 * - Money: Stored in Minor Units (Cents as INTEGER) to prevent IEEE 754 float drift
 * - Dates: ISO-8601 YYYY-MM-DD string
 * - Timestamps: ISO-8601 UTC string
 * - Booleans: INTEGER (1 = true, 0 = false)
 * - Soft-deletes: deleted_at TEXT
 */

export const SCHEMA_MIGRATIONS_TABLE = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);
`;

export const CATEGORIES_TABLE = `
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('EXPENSE', 'INCOME')),
  icon TEXT DEFAULT '🏷️',
  color TEXT DEFAULT '#808080',
  is_system INTEGER NOT NULL DEFAULT 0,
  is_archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_categories_user ON categories(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_type ON categories(type);
`;

export const EXPENSES_TABLE = `
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK(amount_cents > 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  transaction_date TEXT NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'CASH',
  payee TEXT,
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  sync_status TEXT NOT NULL DEFAULT 'PENDING' CHECK(sync_status IN ('SYNCED', 'PENDING', 'FAILED')),
  FOREIGN KEY (category_id) REFERENCES categories(id)
);
CREATE INDEX IF NOT EXISTS idx_expenses_user ON expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(transaction_date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_expenses_deleted ON expenses(deleted_at);
`;

export const INCOME_TABLE = `
CREATE TABLE IF NOT EXISTS income (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK(amount_cents > 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  transaction_date TEXT NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'BANK_TRANSFER',
  source TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  sync_status TEXT NOT NULL DEFAULT 'PENDING' CHECK(sync_status IN ('SYNCED', 'PENDING', 'FAILED')),
  FOREIGN KEY (category_id) REFERENCES categories(id)
);
CREATE INDEX IF NOT EXISTS idx_income_user ON income(user_id);
CREATE INDEX IF NOT EXISTS idx_income_date ON income(transaction_date);
CREATE INDEX IF NOT EXISTS idx_income_deleted ON income(deleted_at);
`;

export const BUDGETS_TABLE = `
CREATE TABLE IF NOT EXISTS budgets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  category_id TEXT,
  period_start TEXT NOT NULL,
  limit_amount_cents INTEGER NOT NULL CHECK(limit_amount_cents > 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (category_id) REFERENCES categories(id)
);
CREATE INDEX IF NOT EXISTS idx_budgets_user_period ON budgets(user_id, period_start);
`;

export const RECURRING_EXPENSES_TABLE = `
CREATE TABLE IF NOT EXISTS recurring_expenses (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  title TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK(amount_cents > 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  frequency TEXT NOT NULL CHECK(frequency IN ('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY')),
  start_date TEXT NOT NULL,
  next_due_date TEXT NOT NULL,
  end_date TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (category_id) REFERENCES categories(id)
);
CREATE INDEX IF NOT EXISTS idx_recurring_user ON recurring_expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_due ON recurring_expenses(next_due_date);
`;

export const SYNC_OUTBOX_TABLE = `
CREATE TABLE IF NOT EXISTS sync_outbox (
  operation_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK(entity_type IN ('EXPENSE', 'INCOME', 'CATEGORY', 'BUDGET', 'RECURRING')),
  entity_id TEXT NOT NULL,
  operation TEXT NOT NULL CHECK(operation IN ('CREATE', 'UPDATE', 'DELETE')),
  payload TEXT NOT NULL,
  base_version INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  next_retry_at TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'PROCESSING', 'FAILED', 'COMPLETED')),
  last_error TEXT
);
CREATE INDEX IF NOT EXISTS idx_outbox_user_status ON sync_outbox(user_id, status);
CREATE INDEX IF NOT EXISTS idx_outbox_created ON sync_outbox(created_at);
`;

export const SYNC_METADATA_TABLE = `
CREATE TABLE IF NOT EXISTS sync_metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`;

export const CATEGORY_MEMORY_TABLE = `
CREATE TABLE IF NOT EXISTS category_memory (
  user_id TEXT NOT NULL,
  keyword_normalized TEXT NOT NULL,
  category_id TEXT NOT NULL,
  frequency INTEGER NOT NULL DEFAULT 1,
  last_used_at TEXT NOT NULL,
  PRIMARY KEY (user_id, keyword_normalized)
);
CREATE INDEX IF NOT EXISTS idx_category_memory_user ON category_memory(user_id);
`;
