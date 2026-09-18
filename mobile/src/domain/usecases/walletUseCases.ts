import { SQLiteWalletRepository } from '../../database/repositories/SQLiteWalletRepository';
import { IWalletRepository, DeleteWalletCheckResult } from '../../database/repositories/interfaces/IWalletRepository';
import { WalletModel } from '../models';
import { DataEvents } from '../../database/sqlite/DataEvents';

export async function listWalletsUseCase(
  repo: IWalletRepository = new SQLiteWalletRepository()
): Promise<WalletModel[]> {
  return repo.list();
}

export async function createWalletUseCase(
  name: string,
  isDefault?: boolean,
  repo: IWalletRepository = new SQLiteWalletRepository()
): Promise<WalletModel> {
  const created = await repo.create({ name, isDefault });
  DataEvents.notify('WALLETS_CHANGED');
  return created;
}

export async function renameWalletUseCase(
  id: string,
  name: string,
  repo: IWalletRepository = new SQLiteWalletRepository()
): Promise<WalletModel> {
  const updated = await repo.update(id, { name });
  DataEvents.notify('WALLETS_CHANGED');
  return updated;
}

export async function deleteWalletUseCase(
  id: string,
  repo: IWalletRepository = new SQLiteWalletRepository()
): Promise<void> {
  await repo.softDelete(id);
  DataEvents.notify('WALLETS_CHANGED');
}

export async function canDeleteWalletUseCase(
  id: string,
  repo: IWalletRepository = new SQLiteWalletRepository()
): Promise<DeleteWalletCheckResult> {
  return repo.canDeleteWallet(id);
}

export async function getWalletBalanceUseCase(
  id: string,
  repo: IWalletRepository = new SQLiteWalletRepository()
): Promise<number> {
  return repo.getWalletBalanceCents(id);
}

export async function ensureDefaultWalletUseCase(
  userId: string,
  repo: IWalletRepository = new SQLiteWalletRepository()
): Promise<WalletModel> {
  const wallet = await repo.ensureDefaultWallet(userId);
  return wallet;
}

export interface TransferParams {
  fromWalletId: string;
  toWalletId: string;
  amountCents: number;
  transactionDate?: string;
  note?: string;
}

export interface TransferResult {
  expenseId: string;
  incomeId: string;
  amountCents: number;
  fromWallet: WalletModel;
  toWallet: WalletModel;
}

export async function transferBetweenWalletsUseCase(
  params: TransferParams,
  walletRepo: IWalletRepository = new SQLiteWalletRepository()
): Promise<TransferResult> {
  const { fromWalletId, toWalletId, amountCents, note } = params;

  if (!fromWalletId || !toWalletId) {
    throw new Error('Both source and destination wallets must be selected.');
  }

  if (fromWalletId === toWalletId) {
    throw new Error('Source and destination wallets must be different.');
  }

  if (!amountCents || amountCents <= 0 || !Number.isInteger(amountCents)) {
    throw new Error('Transfer amount must be greater than zero.');
  }

  const [fromWallet, toWallet, fromBalance] = await Promise.all([
    walletRepo.getById(fromWalletId),
    walletRepo.getById(toWalletId),
    walletRepo.getWalletBalanceCents(fromWalletId),
  ]);

  if (!fromWallet) {
    throw new Error('Source wallet not found.');
  }
  if (!toWallet) {
    throw new Error('Destination wallet not found.');
  }

  if (fromBalance < amountCents) {
    const availStr = (fromBalance / 100).toFixed(2);
    const reqStr = (amountCents / 100).toFixed(2);
    throw new Error(`Insufficient balance in ${fromWallet.name}. Available: ${availStr}, Requested: ${reqStr}`);
  }

  const date = params.transactionDate || new Date().toISOString().split('T')[0];

  // Dynamic import or direct call to avoid circular dependency
  const { createExpenseUseCase } = await import('./expenseUseCases');
  const { createIncomeUseCase } = await import('./incomeUseCases');
  const { listCategoriesUseCase } = await import('./categoryUseCases');

  const [expenseCats, incomeCats] = await Promise.all([
    listCategoriesUseCase('EXPENSE'),
    listCategoriesUseCase('INCOME'),
  ]);

  const expenseCategory =
    expenseCats.find((c) => c.id === 'c0000000-0000-0000-0000-000000000010' || c.name.toLowerCase() === 'transfer') ||
    expenseCats[0];
  const incomeCategory =
    incomeCats.find((c) => c.id === 'c0000000-0000-0000-0000-000000000011' || c.name.toLowerCase() === 'transfer') ||
    incomeCats[0];

  const expenseNote = note ? `Transfer to ${toWallet.name} • ${note}` : `Transfer to ${toWallet.name}`;
  const incomeNote = note ? `Transfer from ${fromWallet.name} • ${note}` : `Transfer from ${fromWallet.name}`;

  const expense = await createExpenseUseCase({
    amountCents,
    categoryId: expenseCategory ? expenseCategory.id : 'c0000000-0000-0000-0000-000000000010',
    walletId: fromWalletId,
    transactionDate: date,
    payee: toWallet.name,
    note: expenseNote,
    paymentMethod: 'BANK_TRANSFER',
  });

  const income = await createIncomeUseCase({
    amountCents,
    categoryId: incomeCategory ? incomeCategory.id : 'c0000000-0000-0000-0000-000000000011',
    walletId: toWalletId,
    transactionDate: date,
    source: fromWallet.name,
    note: incomeNote,
    paymentMethod: 'BANK_TRANSFER',
  });

  DataEvents.notify('WALLETS_CHANGED');

  return {
    expenseId: expense.id,
    incomeId: income.id,
    amountCents,
    fromWallet,
    toWallet,
  };
}

