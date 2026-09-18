import { describe, it, expect, beforeEach } from 'vitest';
import { MemorySQLiteAdapter } from '../database/sqlite/DatabaseConnection';
import { DatabaseManager } from '../database/sqlite/DatabaseManager';
import { SQLiteWalletRepository } from '../database/repositories/SQLiteWalletRepository';
import { SQLiteExpenseRepository } from '../database/repositories/SQLiteExpenseRepository';
import { SQLiteIncomeRepository } from '../database/repositories/SQLiteIncomeRepository';
import {
  createWalletUseCase,
  renameWalletUseCase,
  deleteWalletUseCase,
  listWalletsUseCase,
  ensureDefaultWalletUseCase,
  getWalletBalanceUseCase,
  canDeleteWalletUseCase,
} from '../domain/usecases/walletUseCases';
import { getSixMonthTrendUseCase } from '../domain/usecases/dashboardUseCases';
import { DataEvents } from '../database/sqlite/DataEvents';

describe('Wallet 1 & Multi-Wallet Isolation Feature', () => {
  let memoryDb: MemorySQLiteAdapter;
  const TEST_USER = 'usr_wallet_test_001';

  beforeEach(async () => {
    await DatabaseManager.getInstance().close();
    memoryDb = new MemorySQLiteAdapter();
    await DatabaseManager.getInstance().initialize(memoryDb);
    DatabaseManager.getInstance().setCurrentUser(TEST_USER);
  });

  it('runs migration 002 and creates wallets table and wallet_id columns', async () => {
    const migrations = await memoryDb.executeSql<{ version: number }>(
      'SELECT version FROM schema_migrations ORDER BY version ASC'
    );
    const versions = migrations.rows.map((r) => r.version);
    expect(versions).toContain(1);
    expect(versions).toContain(2);

    // Verify wallets table exists
    const checkTable = await memoryDb.executeSql(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='wallets'"
    );
    expect(checkTable.rows.length).toBe(1);
  });

  it('automatically creates default "Wallet 1" on first access', async () => {
    const walletRepo = new SQLiteWalletRepository();

    // Prior to creation, no wallets exist
    const initialList = await walletRepo.list();
    expect(initialList.length).toBe(0);

    // Auto-create default wallet
    const defaultWallet = await walletRepo.ensureDefaultWallet(TEST_USER);
    expect(defaultWallet.name).toBe('Wallet 1');
    expect(defaultWallet.isDefault).toBe(true);
    expect(defaultWallet.userId).toBe(TEST_USER);

    // Calling again returns the exact same default wallet
    const secondCall = await walletRepo.ensureDefaultWallet(TEST_USER);
    expect(secondCall.id).toBe(defaultWallet.id);
    expect(secondCall.name).toBe('Wallet 1');
  });

  it('supports creating and listing multiple wallets', async () => {
    const walletRepo = new SQLiteWalletRepository();
    await walletRepo.ensureDefaultWallet(TEST_USER);

    const cashWallet = await walletRepo.create({
      name: 'Cash',
    });

    const bankWallet = await walletRepo.create({
      name: 'Bank',
    });

    const wallets = await walletRepo.list();
    expect(wallets.length).toBe(3);
    const names = wallets.map((w) => w.name);
    expect(names).toContain('Wallet 1');
    expect(names).toContain('Cash');
    expect(names).toContain('Bank');
  });

  it('calculates separate per-wallet balances accurately (Balance = Income - Expense)', async () => {
    const walletRepo = new SQLiteWalletRepository();
    const expenseRepo = new SQLiteExpenseRepository();
    const incomeRepo = new SQLiteIncomeRepository();

    const wallet1 = await walletRepo.ensureDefaultWallet(TEST_USER);
    const bankWallet = await walletRepo.create({
      name: 'Bank Account',
    });

    // Wallet 1: +$500 income, -$120 expense => Balance = $380 (38000 cents)
    await incomeRepo.create({
      categoryId: 'cat_income_salary',
      walletId: wallet1.id,
      amountCents: 50000,
      source: 'Freelance Client',
      transactionDate: '2026-09-18',
    });

    await expenseRepo.create({
      categoryId: 'cat_expense_groceries',
      walletId: wallet1.id,
      amountCents: 12000,
      payee: 'Supermarket',
      transactionDate: '2026-09-18',
    });

    // Bank Wallet: +$1,000 income, -$400 expense => Balance = $600 (60000 cents)
    await incomeRepo.create({
      categoryId: 'cat_income_salary',
      walletId: bankWallet.id,
      amountCents: 100000,
      source: 'Monthly Employer',
      transactionDate: '2026-09-18',
    });

    await expenseRepo.create({
      categoryId: 'cat_expense_rent',
      walletId: bankWallet.id,
      amountCents: 40000,
      payee: 'Landlord',
      transactionDate: '2026-09-18',
    });

    // Verify per-wallet balances
    const balance1 = await walletRepo.getWalletBalanceCents(wallet1.id);
    expect(balance1).toBe(38000);

    const balanceBank = await walletRepo.getWalletBalanceCents(bankWallet.id);
    expect(balanceBank).toBe(60000);

    // Verify list includes per-wallet balanceCents
    const walletsWithBalances = await walletRepo.list();
    const w1 = walletsWithBalances.find((w) => w.id === wallet1.id);
    const wBank = walletsWithBalances.find((w) => w.id === bankWallet.id);

    expect(w1?.balanceCents).toBe(38000);
    expect(wBank?.balanceCents).toBe(60000);
  });

  it('allows renaming a wallet', async () => {
    const walletRepo = new SQLiteWalletRepository();
    const defaultWallet = await walletRepo.ensureDefaultWallet(TEST_USER);

    const updated = await walletRepo.update(defaultWallet.id, {
      name: 'Primary Checking',
    });

    expect(updated.name).toBe('Primary Checking');

    const fetched = await walletRepo.getById(defaultWallet.id);
    expect(fetched?.name).toBe('Primary Checking');
  });

  it('safely prevents deleting a wallet that has transactions', async () => {
    const walletRepo = new SQLiteWalletRepository();
    const expenseRepo = new SQLiteExpenseRepository();

    await walletRepo.ensureDefaultWallet(TEST_USER);
    const secondaryWallet = await walletRepo.create({ name: 'Travel Card' });

    // Add transaction to secondary wallet
    await expenseRepo.create({
      categoryId: 'cat_flight',
      walletId: secondaryWallet.id,
      amountCents: 25000,
      payee: 'Airline',
      transactionDate: '2026-09-18',
    });

    // Check delete safety
    const check = await walletRepo.canDeleteWallet(secondaryWallet.id);
    expect(check.canDelete).toBe(false);
    expect(check.transactionCount).toBe(1);

    // Deleting secondary wallet must throw error
    await expect(walletRepo.softDelete(secondaryWallet.id)).rejects.toThrow(
      /only delete an empty wallet/i
    );
  });

  it('safely prevents deleting the only wallet', async () => {
    const walletRepo = new SQLiteWalletRepository();
    const defaultWallet = await walletRepo.ensureDefaultWallet(TEST_USER);

    // Only 1 wallet exists
    const check = await walletRepo.canDeleteWallet(defaultWallet.id);
    expect(check.canDelete).toBe(false);
    expect(check.reason).toMatch(/only.*wallet/i);

    await expect(walletRepo.softDelete(defaultWallet.id)).rejects.toThrow(
      /only.*wallet/i
    );
  });

  it('allows deleting an empty non-default wallet when another wallet exists', async () => {
    const walletRepo = new SQLiteWalletRepository();
    await walletRepo.ensureDefaultWallet(TEST_USER);
    const tempWallet = await walletRepo.create({ name: 'Temp Wallet' });

    // Check safety
    const check = await walletRepo.canDeleteWallet(tempWallet.id);
    expect(check.canDelete).toBe(true);

    // Deleting empty wallet succeeds
    await walletRepo.softDelete(tempWallet.id);

    const remaining = await walletRepo.list();
    expect(remaining.length).toBe(1);
    expect(remaining.some((w) => w.id === tempWallet.id)).toBe(false);
  });

  it('triggers WALLETS_CHANGED event on use case operations', async () => {
    let eventFired = false;
    const unsub = DataEvents.subscribe('WALLETS_CHANGED', () => {
      eventFired = true;
    });

    // Ensure default wallet first
    await ensureDefaultWalletUseCase(TEST_USER);
    expect(eventFired).toBe(true);

    eventFired = false;
    const newWallet = await createWalletUseCase('Crypto Wallet');
    expect(newWallet.name).toBe('Crypto Wallet');
    expect(eventFired).toBe(true);

    eventFired = false;
    await renameWalletUseCase(newWallet.id, 'Web3 Wallet');
    expect(eventFired).toBe(true);

    eventFired = false;
    await deleteWalletUseCase(newWallet.id);
    expect(eventFired).toBe(true);

    unsub();
  });

  it('calculates 6-month historical income vs expenses trend with wallet isolation', async () => {
    const defaultWallet = await ensureDefaultWalletUseCase(TEST_USER);
    const wallet2 = await createWalletUseCase('Second Wallet');

    const expRepo = new SQLiteExpenseRepository();
    const incRepo = new SQLiteIncomeRepository();

    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = String(now.getMonth() + 1).padStart(2, '0');
    const curDate = `${curYear}-${curMonth}-10`;

    // Add income and expense to defaultWallet in current month
    await incRepo.create({
      userId: TEST_USER,
      amountCents: 50000,
      transactionDate: curDate,
      source: 'Salary',
      walletId: defaultWallet.id,
    });
    await expRepo.create({
      userId: TEST_USER,
      amountCents: 15000,
      transactionDate: curDate,
      categoryId: 'cat_food',
      walletId: defaultWallet.id,
    });

    // Add income to wallet2
    await incRepo.create({
      userId: TEST_USER,
      amountCents: 80000,
      transactionDate: curDate,
      source: 'Freelance',
      walletId: wallet2.id,
    });

    // Overall 6-month trend (all wallets)
    const overallTrends = await getSixMonthTrendUseCase(6);
    expect(overallTrends.length).toBe(6);
    const currentMonthData = overallTrends[overallTrends.length - 1];
    expect(currentMonthData.incomeCents).toBe(130000); // 50000 + 80000
    expect(currentMonthData.expenseCents).toBe(15000);

    // Default wallet isolation
    const wallet1Trends = await getSixMonthTrendUseCase(6, defaultWallet.id);
    const w1CurMonth = wallet1Trends[wallet1Trends.length - 1];
    expect(w1CurMonth.incomeCents).toBe(50000);
    expect(w1CurMonth.expenseCents).toBe(15000);

    // Wallet 2 isolation
    const wallet2Trends = await getSixMonthTrendUseCase(6, wallet2.id);
    const w2CurMonth = wallet2Trends[wallet2Trends.length - 1];
    expect(w2CurMonth.incomeCents).toBe(80000);
    expect(w2CurMonth.expenseCents).toBe(0);
  });
});
