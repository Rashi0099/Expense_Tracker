import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DatabaseManager } from '../database/sqlite/DatabaseManager';
import { MemorySQLiteAdapter } from '../database/sqlite/DatabaseConnection';
import { BackupService, BackupPayload } from '../services/backupService';
import { DataEvents } from '../database/sqlite/DataEvents';
import { SQLiteExpenseRepository } from '../database/repositories/SQLiteExpenseRepository';
import { SQLiteWalletRepository } from '../database/repositories/SQLiteWalletRepository';

describe('Local Backup & Restore Service Suite', () => {
  let db: MemorySQLiteAdapter;
  let backupService: BackupService;

  beforeEach(async () => {
    await DatabaseManager.getInstance().close();
    db = new MemorySQLiteAdapter();
    await DatabaseManager.getInstance().initialize(db);
    DatabaseManager.getInstance().setCurrentUser('user-test-123');
    backupService = BackupService.getInstance();
  });

  it('generates a valid Spending Book backup payload with correct structure', async () => {
    const walletRepo = new SQLiteWalletRepository();
    const expenseRepo = new SQLiteExpenseRepository();

    const w = await walletRepo.create({ name: 'Backup Test Wallet', isDefault: true });
    await expenseRepo.create({
      categoryId: 'c1',
      walletId: w.id,
      amountCents: 5000,
      currency: 'INR',
      transactionDate: '2026-09-18',
      paymentMethod: 'CASH',
      payee: 'Grocery Mart',
    });

    const backup = await backupService.createBackup();

    expect(backup.appName).toBe('Spending Book');
    expect(backup.version).toBe(1);
    expect(backup.counts.wallets).toBeGreaterThanOrEqual(1);
    expect(backup.counts.expenses).toBeGreaterThanOrEqual(1);
    expect(backup.data.expenses[0].payee).toBe('Grocery Mart');
  });

  it('validates good and bad backup JSON structures', () => {
    const invalidJson = 'not valid json at all';
    expect(backupService.validateBackup(invalidJson).valid).toBe(false);

    const wrongApp = JSON.stringify({ appName: 'Other App', data: {} });
    expect(backupService.validateBackup(wrongApp).valid).toBe(false);

    const validPayload: BackupPayload = {
      version: 1,
      appName: 'Spending Book',
      createdAt: '2026-09-18T12:00:00Z',
      counts: {
        wallets: 1,
        categories: 1,
        expenses: 1,
        income: 0,
        budgets: 0,
        recurringExpenses: 0,
      },
      data: {
        wallets: [{ id: 'w1', user_id: 'user-test-123', name: 'Wallet 1' }],
        categories: [{ id: 'c1', user_id: 'user-test-123', name: 'Food' }],
        expenses: [
          {
            id: 'e1',
            user_id: 'user-test-123',
            category_id: 'c1',
            wallet_id: 'w1',
            amount_cents: 1250,
          },
        ],
        income: [],
        budgets: [],
        recurringExpenses: [],
      },
    };

    const validResult = backupService.validateBackup(JSON.stringify(validPayload));
    expect(validResult.valid).toBe(true);
    expect(validResult.payload?.appName).toBe('Spending Book');
  });

  it('restores backup data atomically and triggers DataEvents', async () => {
    let notifiedExpenses = false;
    let notifiedWallets = false;

    const unsubExp = DataEvents.subscribe('EXPENSES_CHANGED', () => {
      notifiedExpenses = true;
    });
    const unsubWal = DataEvents.subscribe('WALLETS_CHANGED', () => {
      notifiedWallets = true;
    });

    const payload: BackupPayload = {
      version: 1,
      appName: 'Spending Book',
      createdAt: '2026-09-18T12:00:00Z',
      counts: {
        wallets: 2,
        categories: 1,
        expenses: 1,
        income: 1,
        budgets: 0,
        recurringExpenses: 0,
      },
      data: {
        wallets: [
          { id: 'w100', user_id: 'user-test-123', name: 'Restored Bank', is_default: 1 },
          { id: 'w101', user_id: 'user-test-123', name: 'Restored Cash', is_default: 0 },
        ],
        categories: [{ id: 'c100', user_id: 'user-test-123', name: 'Groceries', type: 'EXPENSE' }],
        expenses: [
          {
            id: 'e100',
            user_id: 'user-test-123',
            category_id: 'c100',
            wallet_id: 'w100',
            amount_cents: 4500,
            currency: 'INR',
            transaction_date: '2026-09-18',
            payment_method: 'CASH',
            payee: 'Supermarket',
          },
        ],
        income: [
          {
            id: 'i100',
            user_id: 'user-test-123',
            category_id: 'c100',
            wallet_id: 'w100',
            amount_cents: 150000,
            currency: 'INR',
            transaction_date: '2026-09-18',
            payment_method: 'BANK_TRANSFER',
            source: 'Salary',
          },
        ],
        budgets: [],
        recurringExpenses: [],
      },
    };

    const restoreRes = await backupService.restoreBackup(payload);
    expect(restoreRes.success).toBe(true);
    expect(restoreRes.counts?.wallets).toBe(2);
    expect(restoreRes.counts?.expenses).toBe(1);
    expect(notifiedExpenses).toBe(true);
    expect(notifiedWallets).toBe(true);

    // Verify restored records in SQLite
    const walletRepo = new SQLiteWalletRepository();
    const wallets = await walletRepo.list();
    expect(wallets.some((w) => w.name === 'Restored Bank')).toBe(true);

    const expenseRepo = new SQLiteExpenseRepository();
    const expenses = await expenseRepo.list();
    expect(expenses.some((e) => e.payee === 'Supermarket')).toBe(true);

    unsubExp();
    unsubWal();
  });
});
