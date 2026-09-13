import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SecureStorage } from '../api/client/secureStorage';
import { DatabaseManager } from '../database/sqlite/DatabaseManager';
import { MemorySQLiteAdapter } from '../database/sqlite/DatabaseConnection';
import { SQLiteExpenseRepository } from '../database/repositories/SQLiteExpenseRepository';
import { SQLiteIncomeRepository } from '../database/repositories/SQLiteIncomeRepository';
import { SQLiteBudgetRepository } from '../database/repositories/SQLiteBudgetRepository';
import { SQLiteRecurringExpenseRepository } from '../database/repositories/SQLiteRecurringExpenseRepository';
import { logger } from '../utils/logger';

const storageMap: Record<string, string> = {};
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    setItem: vi.fn(async (key: string, value: string) => {
      storageMap[key] = value;
    }),
    getItem: vi.fn(async (key: string) => storageMap[key] ?? null),
    removeItem: vi.fn(async (key: string) => {
      delete storageMap[key];
    }),
    multiRemove: vi.fn(async (keys: string[]) => {
      keys.forEach((k) => delete storageMap[k]);
    }),
    clear: vi.fn(async () => {
      Object.keys(storageMap).forEach((k) => delete storageMap[k]);
    }),
  },
}));

describe('Mobile App Comprehensive Security Audit Suite', () => {
  let db: MemorySQLiteAdapter;

  beforeEach(async () => {
    Object.keys(storageMap).forEach((k) => delete storageMap[k]);
    await DatabaseManager.getInstance().close();
    db = new MemorySQLiteAdapter();
    await DatabaseManager.getInstance().initialize(db);
  });

  it('verifies authentication credentials are never stored in plain SQLite tables', async () => {
    // Store tokens via SecureStorage
    await SecureStorage.setRefreshToken('refresh_token_secret_123');
    await SecureStorage.setDeviceId('device_uuid_456');

    // Inspect all SQLite tables
    const allTables = ['expenses', 'income', 'categories', 'budgets', 'recurring_expenses', 'sync_outbox'];
    for (const table of allTables) {
      const rows = await db.executeSql<Record<string, unknown>>(`SELECT * FROM ${table}`);
      for (const row of rows.rows) {
        const serialized = JSON.stringify(row).toLowerCase();
        expect(serialized).not.toContain('refresh_token_secret_123');
      }
    }
  });

  it('rejects database operations across all domain repositories if unauthenticated', async () => {
    DatabaseManager.getInstance().setCurrentUser(null);

    const expenseRepo = new SQLiteExpenseRepository();
    const incomeRepo = new SQLiteIncomeRepository();
    const budgetRepo = new SQLiteBudgetRepository();
    const recurringRepo = new SQLiteRecurringExpenseRepository();

    await expect(expenseRepo.list()).rejects.toThrow('authenticated user ID');
    await expect(incomeRepo.list()).rejects.toThrow('authenticated user ID');
    await expect(budgetRepo.getMonthlyOverview('2026-09')).rejects.toThrow('authenticated user ID');
    await expect(recurringRepo.list()).rejects.toThrow('authenticated user ID');
  });

  it('completely purges all credentials on logout via clearAll', async () => {
    await SecureStorage.setRefreshToken('active_jwt_refresh');
    await SecureStorage.setDeviceId('device_789');
    await SecureStorage.setUserData({ id: 'u1', email: 'alice@example.com' });

    expect(await SecureStorage.getRefreshToken()).toBe('active_jwt_refresh');
    expect(await SecureStorage.getDeviceId()).toBe('device_789');
    expect(await SecureStorage.getUserData()).not.toBeNull();

    // Clear all
    await SecureStorage.clearAll();

    expect(await SecureStorage.getRefreshToken()).toBeNull();
    expect(await SecureStorage.getDeviceId()).toBeNull();
    expect(await SecureStorage.getUserData()).toBeNull();
  });

  it('recursively redacts nested sensitive keys in logger without stack overflow', () => {
    const deepNested = {
      level1: {
        level2: {
          level3: {
            password: 'secret_nested_password',
            amount_cents: 99999,
            token: 'eyJhbGciOiJIUzI1NiIsInR5cCI...',
            nonSensitive: 'Safe string',
          },
        },
      },
    };

    const sanitized = logger._redact(deepNested) as any;
    expect(sanitized.level1.level2.level3.password).toBe('[REDACTED]');
    expect(sanitized.level1.level2.level3.amount_cents).toBe('[REDACTED]');
    expect(sanitized.level1.level2.level3.token).toBe('[REDACTED]');
    expect(sanitized.level1.level2.level3.nonSensitive).toBe('Safe string');
  });
});
