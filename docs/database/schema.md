# Database Schema & Constraint Specification

## 1. Table Definitions

### `users`
| Column | Type | Nullable | Default | PK/FK | Unique | Description |
|---|---|---|---|---|---|---|
| `id` | `UUID` | No | None | **PK** | Yes | UUIDv7 identifier. |
| `email` | `VARCHAR(255)` | No | None | None | Yes | Normalized email address. |
| `password_hash` | `VARCHAR(255)` | No | None | None | No | Argon2id / PBKDF2 hash. |
| `base_currency` | `CHAR(3)` | No | `'USD'` | None | No | ISO 4217 code. |
| `is_active` | `BOOLEAN` | No | `TRUE` | None | No | Active account status. |
| `created_at` | `TIMESTAMPTZ`| No | `NOW()` | None | No | Registration timestamp (UTC). |
| `updated_at` | `TIMESTAMPTZ`| No | `NOW()` | None | No | Profile update timestamp (UTC). |

### `devices`
| Column | Type | Nullable | Default | PK/FK | Unique | Description |
|---|---|---|---|---|---|---|
| `id` | `UUID` | No | None | **PK** | Yes | Device UUID. |
| `user_id` | `UUID` | No | None | **FK** | No | Ref `users(id)` ON DELETE CASCADE. |
| `platform` | `VARCHAR(20)` | No | None | None | No | `IOS`, `ANDROID`, `WEB`. |
| `device_name` | `VARCHAR(100)`| No | None | None | No | Friendly device label. |
| `client_version`| `VARCHAR(20)` | No | None | None | No | Client application version. |
| `last_sync_sequence`| `BIGINT` | No | `0` | None | No | Highest server sequence processed. |
| `last_synced_at`| `TIMESTAMPTZ`| Yes| `NULL` | None | No | Timestamp of last sync. |
| `is_active` | `BOOLEAN` | No | `TRUE` | None | No | Active/revoked status. |
| `created_at` | `TIMESTAMPTZ`| No | `NOW()` | None | No | Device registration timestamp. |

### `categories`
| Column | Type | Nullable | Default | PK/FK | Unique | Description |
|---|---|---|---|---|---|---|
| `id` | `UUID` | No | None | **PK** | Yes | UUIDv7 identifier. |
| `user_id` | `UUID` | Yes | `NULL` | **FK** | No | `NULL` for System categories; set for Custom. |
| `parent_id` | `UUID` | Yes | `NULL` | **FK** | No | Subcategory self-reference. |
| `name` | `VARCHAR(64)` | No | None | None | No | Category name. |
| `type` | `VARCHAR(10)` | No | None | None | No | `EXPENSE` or `INCOME`. |
| `icon` | `VARCHAR(64)` | No | `'default'`| None | No | Icon identifier. |
| `color` | `CHAR(7)` | No | `'#808080'`| None| No | Hex color code (`#RRGGBB`). |
| `is_system` | `BOOLEAN` | No | `FALSE`| None | No | Seeded system-wide default. |
| `is_archived` | `BOOLEAN` | No | `FALSE`| None | No | Soft archive status. |
| `server_sequence`| `BIGINT` | No | `0` | None | No | Monotonic user-level sync revision sequence. |
| `version` | `INTEGER` | No | `1` | None | No | Optimistic locking counter. |
| `created_at` | `TIMESTAMPTZ`| No | `NOW()` | None | No | Creation timestamp (UTC). |
| `updated_at` | `TIMESTAMPTZ`| No | `NOW()` | None | No | Update timestamp (UTC). |
| `deleted_at` | `TIMESTAMPTZ`| Yes | `NULL` | None | No | Soft-delete timestamp. |

### `expenses`
| Column | Type | Nullable | Default | PK/FK | Unique | Description |
|---|---|---|---|---|---|---|
| `id` | `UUID` | No | None | **PK** | Yes | Client-generated UUIDv7. |
| `user_id` | `UUID` | No | None | **FK** | No | Ref `users(id)` ON DELETE CASCADE. |
| `category_id` | `UUID` | No | None | **FK** | No | Ref `categories(id)` ON DELETE RESTRICT. |
| `recurring_expense_id`| `UUID`| Yes| `NULL` | **FK** | No | Ref `recurring_expenses(id)` ON DELETE SET NULL. |
| `amount` | `NUMERIC(12,2)`| No | None | None | No | Exact monetary amount (> 0). |
| `currency` | `CHAR(3)` | No | `'USD'` | None | No | ISO 4217 currency code. |
| `transaction_date`| `DATE` | No | None | None | No | Calendar date of expense. |
| `payment_method`| `VARCHAR(32)`| No | `'CASH'` | None | No | E.g., `CASH`, `CARD`, `UPI`. |
| `payee` | `VARCHAR(100)`| Yes| `NULL` | None | No | Vendor/merchant name. |
| `note` | `TEXT` | Yes| `NULL` | None | No | Remarks/memo. |
| `server_sequence`| `BIGINT` | No | `0` | None | No | Sync sequence revision counter. |
| `version` | `INTEGER` | No | `1` | None | No | Mutation sequence version. |
| `client_created_at`| `TIMESTAMPTZ`| No| None | None | No | Mobile capture timestamp. |
| `created_at` | `TIMESTAMPTZ`| No | `NOW()` | None | No | Server arrival timestamp. |
| `updated_at` | `TIMESTAMPTZ`| No | `NOW()` | None | No | Server update timestamp. |
| `deleted_at` | `TIMESTAMPTZ`| Yes | `NULL` | None | No | Soft-delete timestamp. |

### `income`
| Column | Type | Nullable | Default | PK/FK | Unique | Description |
|---|---|---|---|---|---|---|
| `id` | `UUID` | No | None | **PK** | Yes | Client-generated UUIDv7. |
| `user_id` | `UUID` | No | None | **FK** | No | Ref `users(id)` ON DELETE CASCADE. |
| `category_id` | `UUID` | No | None | **FK** | No | Ref `categories(id)` ON DELETE RESTRICT. |
| `amount` | `NUMERIC(12,2)`| No | None | None | No | Exact positive inflow amount. |
| `currency` | `CHAR(3)` | No | `'USD'` | None | No | ISO 4217 code. |
| `transaction_date`| `DATE` | No | None | None | No | Calendar date income was received. |
| `source` | `VARCHAR(100)`| Yes| `NULL` | None | No | Employer / Client / Source name. |
| `payment_method`| `VARCHAR(32)`| No | `'BANK_TRANSFER'`| None| No | Transfer type. |
| `note` | `TEXT` | Yes| `NULL` | None | No | Optional notes. |
| `server_sequence`| `BIGINT` | No | `0` | None | No | Sync sequence counter. |
| `version` | `INTEGER` | No | `1` | None | No | Mutation version. |
| `client_created_at`| `TIMESTAMPTZ`| No| None | None | No | Mobile capture timestamp. |
| `created_at` | `TIMESTAMPTZ`| No | `NOW()` | None | No | Server arrival timestamp. |
| `updated_at` | `TIMESTAMPTZ`| No | `NOW()` | None | No | Server update timestamp. |
| `deleted_at` | `TIMESTAMPTZ`| Yes | `NULL` | None | No | Soft-delete timestamp. |

### `budgets`
| Column | Type | Nullable | Default | PK/FK | Unique | Description |
|---|---|---|---|---|---|---|
| `id` | `UUID` | No | None | **PK** | Yes | UUIDv7 identifier. |
| `user_id` | `UUID` | No | None | **FK** | No | Ref `users(id)` ON DELETE CASCADE. |
| `category_id` | `UUID` | Yes | `NULL` | **FK** | No | `NULL` indicates overall monthly budget. |
| `period_start` | `DATE` | No | None | None | No | Normalized 1st day of month (`YYYY-MM-01`). |
| `limit_amount` | `NUMERIC(12,2)`| No | None | None | No | Cap amount (> 0). |
| `currency` | `CHAR(3)` | No | `'USD'` | None | No | ISO 4217 code. |
| `server_sequence`| `BIGINT` | No | `0` | None | No | Sync sequence counter. |
| `version` | `INTEGER` | No | `1` | None | No | Mutation version. |
| `created_at` | `TIMESTAMPTZ`| No | `NOW()` | None | No | Creation timestamp. |
| `updated_at` | `TIMESTAMPTZ`| No | `NOW()` | None | No | Update timestamp. |
| `deleted_at` | `TIMESTAMPTZ`| Yes | `NULL` | None | No | Soft-delete timestamp. |

### `recurring_expenses`
| Column | Type | Nullable | Default | PK/FK | Unique | Description |
|---|---|---|---|---|---|---|
| `id` | `UUID` | No | None | **PK** | Yes | UUIDv7 identifier. |
| `user_id` | `UUID` | No | None | **FK** | No | Ref `users(id)` ON DELETE CASCADE. |
| `category_id` | `UUID` | No | None | **FK** | No | Ref `categories(id)` ON DELETE RESTRICT. |
| `amount` | `NUMERIC(12,2)`| No | None | None | No | Scheduled amount. |
| `currency` | `CHAR(3)` | No | `'USD'` | None | No | ISO 4217 code. |
| `title` | `VARCHAR(100)`| No | None | None | No | Subscription or bill title. |
| `frequency` | `VARCHAR(20)` | No | None | None | No | `DAILY`, `WEEKLY`, `MONTHLY`, `YEARLY`. |
| `start_date` | `DATE` | No | None | None | No | Active start date. |
| `next_due_date`| `DATE` | No | None | None | No | Next due date for generation. |
| `end_date` | `DATE` | Yes | `NULL` | None | No | Optional end date. |
| `is_active` | `BOOLEAN` | No | `TRUE` | None | No | Active/pause status. |
| `server_sequence`| `BIGINT` | No | `0` | None | No | Sync sequence counter. |
| `version` | `INTEGER` | No | `1` | None | No | Mutation version. |
| `created_at` | `TIMESTAMPTZ`| No | `NOW()` | None | No | Creation timestamp. |
| `updated_at` | `TIMESTAMPTZ`| No | `NOW()` | None | No | Update timestamp. |
| `deleted_at` | `TIMESTAMPTZ`| Yes | `NULL` | None | No | Soft-delete timestamp. |

---

## 2. Integrity Constraints & Indexes

### Check Constraints
```sql
ALTER TABLE expenses ADD CONSTRAINT chk_expense_amount_positive CHECK (amount > 0.00);
ALTER TABLE income ADD CONSTRAINT chk_income_amount_positive CHECK (amount > 0.00);
ALTER TABLE budgets ADD CONSTRAINT chk_budget_amount_positive CHECK (limit_amount > 0.00);
ALTER TABLE recurring_expenses ADD CONSTRAINT chk_recurring_amount_positive CHECK (amount > 0.00);

ALTER TABLE users ADD CONSTRAINT chk_user_currency_iso CHECK (base_currency ~ '^[A-Z]{3}$');
ALTER TABLE expenses ADD CONSTRAINT chk_expense_currency_iso CHECK (currency ~ '^[A-Z]{3}$');
ALTER TABLE income ADD CONSTRAINT chk_income_currency_iso CHECK (currency ~ '^[A-Z]{3}$');
ALTER TABLE budgets ADD CONSTRAINT chk_budget_currency_iso CHECK (currency ~ '^[A-Z]{3}$');
ALTER TABLE recurring_expenses ADD CONSTRAINT chk_recurring_currency_iso CHECK (currency ~ '^[A-Z]{3}$');

ALTER TABLE categories ADD CONSTRAINT chk_category_system_ownership CHECK (
  (is_system = TRUE AND user_id IS NULL) OR 
  (is_system = FALSE AND user_id IS NOT NULL)
);
ALTER TABLE categories ADD CONSTRAINT chk_category_hex_color CHECK (color ~ '^#[0-9A-Fa-f]{6}$');

ALTER TABLE budgets ADD CONSTRAINT chk_budget_period_start_first_of_month 
  CHECK (period_start = DATE_TRUNC('month', period_start)::DATE);

ALTER TABLE recurring_expenses ADD CONSTRAINT chk_recurring_date_range 
  CHECK (end_date IS NULL OR end_date >= start_date);
```

### Unique Indexes
```sql
-- Budget uniqueness per user per category per month (Active only)
CREATE UNIQUE INDEX uq_user_category_month_budget 
  ON budgets (user_id, category_id, period_start) 
  WHERE deleted_at IS NULL AND category_id IS NOT NULL;

-- Overall monthly budget uniqueness (Active only)
CREATE UNIQUE INDEX uq_user_overall_month_budget 
  ON budgets (user_id, period_start) 
  WHERE deleted_at IS NULL AND category_id IS NULL;

-- Idempotency key uniqueness
ALTER TABLE sync_operation_logs ADD CONSTRAINT uq_sync_operation_id UNIQUE (operation_id);
```

### Query Acceleration Indexes
```sql
-- Recent expenses & monthly date-range queries
CREATE INDEX idx_expenses_user_date ON expenses (user_id, transaction_date DESC) 
  WHERE deleted_at IS NULL;

-- Category budget spend aggregation
CREATE INDEX idx_expenses_category_spend ON expenses (user_id, category_id, transaction_date) 
  WHERE deleted_at IS NULL;

-- Delta sync sequence index
CREATE INDEX idx_expenses_sync_seq ON expenses (user_id, server_sequence);
CREATE INDEX idx_income_sync_seq ON income (user_id, server_sequence);
CREATE INDEX idx_categories_sync_seq ON categories (user_id, server_sequence);
CREATE INDEX idx_tombstones_sync_seq ON tombstones (user_id, server_sequence);

-- Scheduler worker index for due recurring expenses
CREATE INDEX idx_recurring_due ON recurring_expenses (next_due_date) 
  WHERE is_active = TRUE AND deleted_at IS NULL;
```

---

### `refresh_sessions` Table (Added in Step 4 for Session & RTR Security)
| Column | Type | Nullable | Default | PK/FK | Unique | Description |
|---|---|---|---|---|---|---|
| `id` | `UUID` | No | None | **PK** | Yes | UUIDv7 session identifier. |
| `device_id` | `UUID` | No | None | **FK** | No | Ref `devices(id)` ON DELETE CASCADE. |
| `token_hash`| `VARCHAR(64)` | No | None | None | **Yes** | SHA-256 hash of the 64-byte opaque token. |
| `family_id` | `UUID` | No | None | None | No | Lineage group for RTR reuse detection. |
| `is_revoked`| `BOOLEAN` | No | `FALSE` | None | No | Explicit revocation status flag. |
| `expires_at`| `TIMESTAMPTZ`| No | None | None | No | Expiration timestamp (30 days from issue). |
| `created_at`| `TIMESTAMPTZ`| No | `NOW()` | None | No | Session creation timestamp. |
| `last_used_at`| `TIMESTAMPTZ`| No | `NOW()` | None | No | Timestamp of last token rotation. |
