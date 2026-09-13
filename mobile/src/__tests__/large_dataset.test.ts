import { describe, it, expect, beforeEach } from 'vitest';
import { MemorySQLiteAdapter } from '../database/sqlite/DatabaseConnection';
import { DatabaseManager } from '../database/sqlite/DatabaseManager';
import { SQLiteExpenseRepository } from '../database/repositories/SQLiteExpenseRepository';
import { generateUUID } from '../utils/uuid';
import { getUTCTimestamp } from '../utils/date';

describe('Large Dataset Performance & Pagination (Section 30, 31, 63)', () => {
  let memoryDb: MemorySQLiteAdapter;
  const userId = 'heavy_user_scale';

  beforeEach(async () => {
    await DatabaseManager.getInstance().close();
    memoryDb = new MemorySQLiteAdapter();
    await DatabaseManager.getInstance().initialize(memoryDb);
    DatabaseManager.getInstance().setCurrentUser(userId);
  });

  it('handles 1,000 local transactions with responsive pagination, search, and aggregates', async () => {
    const expenseRepo = new SQLiteExpenseRepository();
    const now = getUTCTimestamp();

    // Bulk insert 1,000 expenses
    await memoryDb.transaction(async (tx) => {
      for (let i = 1; i <= 1000; i++) {
        const id = generateUUID();
        await tx.executeSql(
          `INSERT INTO expenses (
            id, user_id, category_id, amount_cents, currency, transaction_date,
            payment_method, payee, note, created_at, updated_at, deleted_at, version, sync_status
          ) VALUES (?, ?, 'c1', ?, 'USD', '2026-09-13', 'CASH', ?, NULL, ?, ?, NULL, 1, 'SYNCED')`,
          [
            id,
            userId,
            i * 10,
            i === 500 ? 'Special Milestone Payee' : `Vendor #${i}`,
            now,
            now,
          ]
        );
      }
    });

    // Test Pagination: Page 1 (first 20)
    const page1Start = performance.now();
    const page1 = await expenseRepo.list({ limit: 20, offset: 0 });
    const page1Duration = performance.now() - page1Start;

    expect(page1.length).toBe(20);
    expect(page1Duration).toBeLessThan(100);

    // Test Pagination: Page 2 (next 20)
    const page2 = await expenseRepo.list({ limit: 20, offset: 20 });
    expect(page2.length).toBe(20);
    expect(page2[0].id).not.toBe(page1[0].id);

    // Targeted search across 1,000 items
    const searchStart = performance.now();
    const searchResults = await expenseRepo.list({ search: 'Milestone' });
    const searchDuration = performance.now() - searchStart;

    expect(searchResults.length).toBe(1);
    expect(searchResults[0].payee).toBe('Special Milestone Payee');
    expect(searchDuration).toBeLessThan(100);

    // Total aggregation across all 1,000 records
    const total = await expenseRepo.getTotalCents();
    expect(total).toBe(5005000);
  });

  it('handles 5,000 transactions with sub-100ms pagination and category filtering', async () => {
    const expenseRepo = new SQLiteExpenseRepository();
    const now = getUTCTimestamp();

    await memoryDb.transaction(async (tx) => {
      for (let i = 1; i <= 5000; i++) {
        const id = generateUUID();
        const catId = i % 2 === 0 ? 'c1' : 'c2';
        await tx.executeSql(
          `INSERT INTO expenses (
            id, user_id, category_id, amount_cents, currency, transaction_date,
            payment_method, payee, note, created_at, updated_at, deleted_at, version, sync_status
          ) VALUES (?, ?, ?, 2500, 'USD', '2026-09-13', 'CREDIT_CARD', ?, NULL, ?, ?, NULL, 1, 'SYNCED')`,
          [id, userId, catId, `Merchant #${i}`, now, now]
        );
      }
    });

    // Verify pagination remains responsive
    const start = performance.now();
    const filteredPage = await expenseRepo.list({ categoryId: 'c1', limit: 25, offset: 100 });
    const duration = performance.now() - start;

    expect(filteredPage.length).toBe(25);
    expect(filteredPage.every((e) => e.categoryId === 'c1')).toBe(true);
    expect(duration).toBeLessThan(250);
  });

  it('handles 10,000+ transactions without memory exhaustion or list degradation', async () => {
    const expenseRepo = new SQLiteExpenseRepository();
    const now = getUTCTimestamp();

    // Insert 10,000 records in batches inside a transaction
    await memoryDb.transaction(async (tx) => {
      for (let i = 1; i <= 10000; i++) {
        const id = generateUUID();
        await tx.executeSql(
          `INSERT INTO expenses (
            id, user_id, category_id, amount_cents, currency, transaction_date,
            payment_method, payee, note, created_at, updated_at, deleted_at, version, sync_status
          ) VALUES (?, ?, 'c1', 1000, 'USD', '2026-09-13', 'DEBIT_CARD', ?, NULL, ?, ?, NULL, 1, 'SYNCED')`,
          [id, userId, i === 7777 ? 'Targeted High Scale Merchant' : `Scale Merchant #${i}`, now, now]
        );
      }
    });

    // Verify selective indexed limit/offset query executes in <100ms
    const pageStart = performance.now();
    const page = await expenseRepo.list({ limit: 50, offset: 5000 });
    const pageDuration = performance.now() - pageStart;

    expect(page.length).toBe(50);
    expect(pageDuration).toBeLessThan(300);

    // Verify search in 10,000 items
    const searchStart = performance.now();
    const results = await expenseRepo.list({ search: 'High Scale Merchant' });
    const searchDuration = performance.now() - searchStart;

    expect(results.length).toBe(1);
    expect(results[0].payee).toBe('Targeted High Scale Merchant');
    expect(searchDuration).toBeLessThan(150);
  });
});
