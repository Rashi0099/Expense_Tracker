import { WalletModel } from '../../../domain/models';

export interface CreateWalletParams {
  id?: string;
  name: string;
  isDefault?: boolean;
}

export interface UpdateWalletParams {
  name?: string;
  isDefault?: boolean;
}

export interface DeleteWalletCheckResult {
  canDelete: boolean;
  reason?: string;
  transactionCount?: number;
}

export interface IWalletRepository {
  create(params: CreateWalletParams): Promise<WalletModel>;
  update(id: string, params: UpdateWalletParams): Promise<WalletModel>;
  softDelete(id: string): Promise<void>;
  getById(id: string): Promise<WalletModel | null>;
  list(): Promise<WalletModel[]>;
  getDefault(): Promise<WalletModel | null>;
  ensureDefaultWallet(userId: string): Promise<WalletModel>;
  getWalletBalanceCents(walletId: string): Promise<number>;
  canDeleteWallet(walletId: string): Promise<DeleteWalletCheckResult>;
}
