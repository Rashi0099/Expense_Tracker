import { describe, it, expect } from 'vitest';
import { MemorySQLiteAdapter } from '../database/sqlite/DatabaseConnection';
import { MigrationRunner } from '../database/sqlite/migrations/MigrationRunner';
import {
  SCHEMA_MIGRATIONS_TABLE,
  CATEGORIES_TABLE,
  EXPENSES_TABLE,
  INCOME_TABLE,
  BUDGETS_TABLE,
  RECURRING_EXPENSES_TABLE,
  SYNC_OUTBOX_TABLE,
  SYNC_METADATA_TABLE,
} from '../database/schema/tables';

describe('App Database Upgrade & Migration Preservation (Section 47)', () => {
  const TEST_USER = 'usr_migration_test_user';

  it('preserves all user records, budgets, recurring schedules, and outbox across migrations', async () => {
    const db = new MemorySQLiteAdapter();

    // 1. Install Base Schema (Simulating previous application release)
    await db.executeSql(SCHEMA_MIGRATIONS_TABLE);
    await db.executeSql(CATEGORIES_TABLE);
    await db.executeSql(EXPENSES_TABLE);
    await db.executeSql(INCOME_TABLE);
    await db.executeSql(BUDGETS_TABLE);
    await db.executeSql(RECURRING_EXPENSES_TABLE);
    await db.executeSql(SYNC_OUTBOX_TABLE);
    await db.executeSql(SYNC_METADATA_TABLE);

    // Record migration v1 as applied
    await db.executeSql(
      'INSERT INTO schema_migrations (version, applied_at) VALUES (1, ?)',
      ['2026-08-01T00:00:00.000Z']
    );

    // 2. Populate legacy data before application upgrade
    const catId = 'cat_legacy_groceries';
    await db.executeSql(
      `INSERT INTO categories (id, user_id, name, type, icon, color, is_system, is_archived, created_at, updated_at, version)
       VALUES (?, ?, 'Groceries', 'EXPENSE', '🛒', '#10B981', 0, 0, '2026-08-01', '2026-08-01', 1)`,
      [catId, TEST_USER]
    );

    const expenseId = 'exp_legacy_001';
    await db.executeSql(
      `INSERT INTO expenses (id, user_id, category_id, amount_cents, currency, transaction_date, payment_method, payee, note, created_at, updated_at, version, sync_status)
       VALUES (?, ?, ?, 4599, 'USD', '2026-08-05', 'CREDIT_CARD', 'Supermarket', 'Weekly groceries', '2026-08-05', '2026-08-05', 1, 'SYNCED')`,
      [expenseId, TEST_USER, catId]
    );

    const incomeId = 'inc_legacy_001';
    await db.executeSql(
      `INSERT INTO income (id, user_id, category_id, amount_cents, currency, received_date, source, note, created_at, updated_at, version, sync_status)
       VALUES (?, ?, ?, 350000, 'USD', '2026-08-01', 'Acme Corp', 'Monthly Salary', '2026-08-01', '2026-08-01', 1, 'SYNCED')`,
      [incomeId, TEST_USER, catId]
    );

    const budgetId = 'bud_legacy_001';
    await db.executeSql(
      `INSERT INTO budgets (id, user_id, category_id, period_start, limit_amount_cents, currency, created_at, updated_at, version, sync_status)
       VALUES (?, ?, NULL, '2026-08-01', 200000, 'USD', '2026-08-01', '2026-08-01', 1, 'SYNCED')`,
      [budgetId, TEST_USER]
    );

    const recurringId = 'rec_legacy_001';
    await db.executeSql(
      `INSERT INTO recurring_expenses (id, user_id, category_id, title, amount_cents, currency, frequency, start_date, next_due_date, is_active, created_at, updated_at, version, sync_status)
       VALUES (?, ?, ?, 'Gym Membership', 4999, 'USD', 'MONTHLY', '2026-08-01', '2026-09-01', 1, '2026-08-01', '2026-08-01', 1, 'SYNCED')`,
      [recurringId, TEST_USER, catId]
    );

    const outboxId = 'out_legacy_001';
    await db.executeSql(
      `INSERT INTO sync_outbox (operation_id, user_id, entity_type, entity_id, operation, payload, base_version, created_at, retry_count, status)
       VALUES (?, ?, 'EXPENSE', ?, 'CREATE', '{"payee":"Supermarket"}', 1, '2026-08-05', 0, 'PENDING')`,
      [outboxId, TEST_USER, expenseId]
    );

    // 3. Simulate App Upgrade: Run MigrationRunner
    const runner = new MigrationRunner(db);
    await runner.runMigrations();

    // 4. Verify that ALL entities exist with exact legacy values
    const expensesRes = await db.executeSql<any>('SELECT * FROM expenses WHERE id = ?', [expenseId]);
    expect(expensesRes.rows).toHaveLength(1);
    expect(expensesRes.rows[0].amount_cents).toBe(4599);
    expect(expensesRes.rows[0].payee).toBe('Supermarket');

    const incomeRes = await db.executeSql<any>('SELECT * FROM income WHERE id = ?', [incomeId]);
    expect(incomeRes.rows).toHaveLength(1);
    expect(incomeRes.rows[0].amount_cents).toBe(350000);
    expect(incomeRes.rows[0].source).toBe('Acme Corp');

    const budgetRes = await db.executeSql<any>('SELECT * FROM budgets WHERE id = ?', [budgetId]);
    expect(budgetRes.rows).toHaveLength(1);
    expect(budgetRes.rows[0].limit_amount_cents).toBe(200000);

    const recurringRes = await db.executeSql<any>('SELECT * FROM recurring_expenses WHERE id = ?', [recurringId]);
    expect(recurringRes.rows).toHaveLength(1);
    expect(recurringRes.rows[0].title).toBe('Gym Membership');
    expect(recurringRes.rows[0].amount_cents).toBe(4999);

    const outboxRes = await db.executeSql<any>('SELECT * FROM sync_outbox WHERE operation_id = ?', [outboxId]);
    expect(outboxRes.rows).toHaveLength(1);
    expect(outboxRes.rows[0].status).toBe('PENDING');

    const categoriesRes = await db.executeSql<any>('SELECT * FROM categories WHERE id = ?', [catId]);
    expect(categoriesRes.rows).toHaveLength(1);
    expect(categoriesRes.rows[0].name).toBe('Groceries');
  });
});
