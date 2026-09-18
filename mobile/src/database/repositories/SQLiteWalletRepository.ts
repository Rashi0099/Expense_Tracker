import {
  IWalletRepository,
  CreateWalletParams,
  UpdateWalletParams,
  DeleteWalletCheckResult,
} from './interfaces/IWalletRepository';
import { WalletModel } from '../../domain/models';
import { WalletMapper } from '../../domain/mappers';
import { SQLiteWalletRow } from '../schema/types';
import { DatabaseManager } from '../sqlite/DatabaseManager';
import { generateUUID } from '../../utils/uuid';
import { getUTCTimestamp } from '../../utils/date';

export class SQLiteWalletRepository implements IWalletRepository {
  private getDb() {
    return DatabaseManager.getInstance().getDatabase();
  }

  private getUserId(): string {
    const userId = DatabaseManager.getInstance().getCurrentUser();
    if (!userId) {
      throw new Error('Database session must be scoped to an authenticated user ID.');
    }
    return userId;
  }

  async create(params: CreateWalletParams): Promise<WalletModel> {
    const db = this.getDb();
    const userId = this.getUserId();
    const trimmedName = params.name.trim();

    if (!trimmedName) {
      throw new Error('Wallet name cannot be empty.');
    }

    // Check duplicate name for this user
    const dup = await db.executeSql<{ id: string }>(
      'SELECT id FROM wallets WHERE user_id = ? AND name = ? COLLATE NOCASE AND deleted_at IS NULL LIMIT 1',
      [userId, trimmedName]
    );
    if (dup.rows.length > 0) {
      throw new Error(`A wallet named "${trimmedName}" already exists.`);
    }

    const walletId = params.id || generateUUID();
    const now = getUTCTimestamp();
    const isDefault = params.isDefault ? 1 : 0;

    return db.transaction(async (tx) => {
      if (isDefault) {
        await tx.executeSql(
          'UPDATE wallets SET is_default = 0, updated_at = ? WHERE user_id = ? AND deleted_at IS NULL',
          [now, userId]
        );
      }

      await tx.executeSql(
        `INSERT INTO wallets (id, user_id, name, is_default, created_at, updated_at, deleted_at, version)
         VALUES (?, ?, ?, ?, ?, ?, NULL, 1)`,
        [walletId, userId, trimmedName, isDefault, now, now]
      );

      return {
        id: walletId,
        userId,
        name: trimmedName,
        isDefault: isDefault === 1,
        createdAt: now,
        updatedAt: now,
        version: 1,
        balanceCents: 0,
      };
    });
  }

  async update(id: string, params: UpdateWalletParams): Promise<WalletModel> {
    const db = this.getDb();
    const userId = this.getUserId();
    const existing = await this.getById(id);

    if (!existing) {
      throw new Error('Wallet not found.');
    }

    const now = getUTCTimestamp();
    let name = existing.name;

    if (params.name !== undefined) {
      const trimmed = params.name.trim();
      if (!trimmed) {
        throw new Error('Wallet name cannot be empty.');
      }
      // Check duplicate
      const dup = await db.executeSql<{ id: string }>(
        'SELECT id FROM wallets WHERE user_id = ? AND name = ? COLLATE NOCASE AND id != ? AND deleted_at IS NULL LIMIT 1',
        [userId, trimmed, id]
      );
      if (dup.rows.length > 0) {
        throw new Error(`A wallet named "${trimmed}" already exists.`);
      }
      name = trimmed;
    }

    const nextDefault = params.isDefault !== undefined ? (params.isDefault ? 1 : 0) : (existing.isDefault ? 1 : 0);

    return db.transaction(async (tx) => {
      if (params.isDefault) {
        await tx.executeSql(
          'UPDATE wallets SET is_default = 0, updated_at = ? WHERE user_id = ? AND id != ? AND deleted_at IS NULL',
          [now, userId, id]
        );
      }

      await tx.executeSql(
        `UPDATE wallets SET name = ?, is_default = ?, updated_at = ?, version = version + 1
         WHERE id = ? AND user_id = ?`,
        [name, nextDefault, now, id, userId]
      );

      const balance = await this.getWalletBalanceCents(id);

      return {
        ...existing,
        name,
        isDefault: nextDefault === 1,
        updatedAt: now,
        version: existing.version + 1,
        balanceCents: balance,
      };
    });
  }

  async softDelete(id: string): Promise<void> {
    const safety = await this.canDeleteWallet(id);
    if (!safety.canDelete) {
      throw new Error(safety.reason || 'This wallet cannot be deleted.');
    }

    const db = this.getDb();
    const userId = this.getUserId();
    const now = getUTCTimestamp();

    await db.executeSql(
      'UPDATE wallets SET deleted_at = ?, updated_at = ? WHERE id = ? AND user_id = ?',
      [now, now, id, userId]
    );
  }

  async getById(id: string): Promise<WalletModel | null> {
    const db = this.getDb();
    const userId = this.getUserId();

    const res = await db.executeSql<SQLiteWalletRow>(
      'SELECT * FROM wallets WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
      [id, userId]
    );

    if (res.rows.length === 0) return null;
    const balance = await this.getWalletBalanceCents(id);
    return WalletMapper.toDomain(res.rows[0], balance);
  }

  async list(): Promise<WalletModel[]> {
    const db = this.getDb();
    const userId = this.getUserId();

    const res = await db.executeSql<SQLiteWalletRow>(
      'SELECT * FROM wallets WHERE user_id = ? AND deleted_at IS NULL ORDER BY is_default DESC, created_at ASC',
      [userId]
    );

    const wallets: WalletModel[] = [];
    for (const row of res.rows) {
      const balance = await this.getWalletBalanceCents(row.id);
      wallets.push(WalletMapper.toDomain(row, balance));
    }

    return wallets;
  }

  async getDefault(): Promise<WalletModel | null> {
    const db = this.getDb();
    const userId = this.getUserId();

    const res = await db.executeSql<SQLiteWalletRow>(
      'SELECT * FROM wallets WHERE user_id = ? AND is_default = 1 AND deleted_at IS NULL LIMIT 1',
      [userId]
    );

    if (res.rows.length > 0) {
      const balance = await this.getWalletBalanceCents(res.rows[0].id);
      return WalletMapper.toDomain(res.rows[0], balance);
    }

    // Fallback: return first non-deleted wallet
    const fallback = await db.executeSql<SQLiteWalletRow>(
      'SELECT * FROM wallets WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at ASC LIMIT 1',
      [userId]
    );

    if (fallback.rows.length > 0) {
      const balance = await this.getWalletBalanceCents(fallback.rows[0].id);
      return WalletMapper.toDomain(fallback.rows[0], balance);
    }

    return null;
  }

  async ensureDefaultWallet(userId: string): Promise<WalletModel> {
    const db = this.getDb();
    const now = getUTCTimestamp();

    // Check if user already has a wallet
    const existing = await db.executeSql<SQLiteWalletRow>(
      'SELECT * FROM wallets WHERE user_id = ? AND deleted_at IS NULL ORDER BY is_default DESC, created_at ASC LIMIT 1',
      [userId]
    );

    if (existing.rows.length > 0) {
      const balance = await this.getWalletBalanceCents(existing.rows[0].id);
      return WalletMapper.toDomain(existing.rows[0], balance);
    }

    // Create default 'Wallet 1'
    const walletId = generateUUID();
    await db.transaction(async (tx) => {
      await tx.executeSql(
        `INSERT INTO wallets (id, user_id, name, is_default, created_at, updated_at, deleted_at, version)
         VALUES (?, ?, 'Wallet 1', 1, ?, ?, NULL, 1)`,
        [walletId, userId, now, now]
      );

      // Backfill any existing unassigned records
      await tx.executeSql(
        'UPDATE expenses SET wallet_id = ? WHERE user_id = ? AND wallet_id IS NULL',
        [walletId, userId]
      );
      await tx.executeSql(
        'UPDATE income SET wallet_id = ? WHERE user_id = ? AND wallet_id IS NULL',
        [walletId, userId]
      );
    });

    const balance = await this.getWalletBalanceCents(walletId);
    return {
      id: walletId,
      userId,
      name: 'Wallet 1',
      isDefault: true,
      createdAt: now,
      updatedAt: now,
      version: 1,
      balanceCents: balance,
    };
  }

  async getWalletBalanceCents(walletId: string): Promise<number> {
    const db = this.getDb();
    const userId = this.getUserId();

    const [incomeRes, expenseRes] = await Promise.all([
      db.executeSql<{ total: number | null }>(
        'SELECT SUM(amount_cents) as total FROM income WHERE user_id = ? AND wallet_id = ? AND deleted_at IS NULL',
        [userId, walletId]
      ),
      db.executeSql<{ total: number | null }>(
        'SELECT SUM(amount_cents) as total FROM expenses WHERE user_id = ? AND wallet_id = ? AND deleted_at IS NULL',
        [userId, walletId]
      ),
    ]);

    const incomeTotal = incomeRes.rows[0]?.total || 0;
    const expenseTotal = expenseRes.rows[0]?.total || 0;

    return incomeTotal - expenseTotal;
  }

  async canDeleteWallet(walletId: string): Promise<DeleteWalletCheckResult> {
    const db = this.getDb();
    const userId = this.getUserId();

    // Check count of active wallets
    const totalWalletsRes = await db.executeSql<{ count: number }>(
      'SELECT COUNT(*) as count FROM wallets WHERE user_id = ? AND deleted_at IS NULL',
      [userId]
    );
    const totalWallets = totalWalletsRes.rows[0]?.count || 0;
    if (totalWallets <= 1) {
      return {
        canDelete: false,
        reason: 'Cannot delete your only wallet.',
      };
    }

    // Check associated expenses and incomes
    const [expenseCountRes, incomeCountRes] = await Promise.all([
      db.executeSql<{ count: number }>(
        'SELECT COUNT(*) as count FROM expenses WHERE user_id = ? AND wallet_id = ? AND deleted_at IS NULL',
        [userId, walletId]
      ),
      db.executeSql<{ count: number }>(
        'SELECT COUNT(*) as count FROM income WHERE user_id = ? AND wallet_id = ? AND deleted_at IS NULL',
        [userId, walletId]
      ),
    ]);

    const expCount = expenseCountRes.rows[0]?.count || 0;
    const incCount = incomeCountRes.rows[0]?.count || 0;
    const totalTransactions = expCount + incCount;

    if (totalTransactions > 0) {
      return {
        canDelete: false,
        reason: `This wallet contains ${totalTransactions} transaction(s). You can only delete an empty wallet.`,
        transactionCount: totalTransactions,
      };
    }

    return { canDelete: true };
  }
}
