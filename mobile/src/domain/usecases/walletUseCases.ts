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
  DataEvents.notify('WALLETS_CHANGED');
  return wallet;
}
