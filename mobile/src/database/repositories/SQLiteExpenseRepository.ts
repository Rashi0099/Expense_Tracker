import {
  IExpenseRepository,
  CreateExpenseParams,
  UpdateExpenseParams,
  ExpenseFilters,
} from './interfaces/IExpenseRepository';
import { ExpenseModel } from '../../domain/models';
import { ExpenseMapper } from '../../domain/mappers';
import { SQLiteExpenseRow } from '../schema/types';
import { DatabaseManager } from '../sqlite/DatabaseManager';
import { generateUUID } from '../../utils/uuid';
import { getUTCTimestamp } from '../../utils/date';
import { centsToDollars } from '../../utils/money';

export class SQLiteExpenseRepository implements IExpenseRepository {
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

  async create(params: CreateExpenseParams): Promise<ExpenseModel> {
    const db = this.getDb();
    const userId = this.getUserId();
    const expenseId = params.id || generateUUID();
    const outboxId = generateUUID();
    const now = getUTCTimestamp();
    const currency = params.currency || 'USD';
    const paymentMethod = params.paymentMethod || 'CASH';

    // Atomic SQLite Transaction: commit expense + sync_outbox together (Section 27 & 44)
    return db.transaction(async (tx) => {
      // 1. Resolve walletId (use provided or user's default/first active wallet)
      let walletId = params.walletId;
      if (!walletId) {
        const defaultWalletRes = await tx.executeSql<{ id: string }>(
          'SELECT id FROM wallets WHERE user_id = ? AND is_default = 1 AND deleted_at IS NULL LIMIT 1',
          [userId]
        );
        if (defaultWalletRes.rows.length > 0) {
          walletId = defaultWalletRes.rows[0].id;
        } else {
          const anyWalletRes = await tx.executeSql<{ id: string }>(
            'SELECT id FROM wallets WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at ASC LIMIT 1',
            [userId]
          );
          walletId = anyWalletRes.rows[0]?.id;
        }
      }

      // 2. Insert into local expenses table
      await tx.executeSql(
        `INSERT INTO expenses (
          id, user_id, category_id, wallet_id, amount_cents, currency, transaction_date,
          payment_method, payee, note, created_at, updated_at, deleted_at, version, sync_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 1, 'PENDING')`,
        [
          expenseId,
          userId,
          params.categoryId,
          walletId || null,
          params.amountCents,
          currency,
          params.transactionDate,
          paymentMethod,
          params.payee || null,
          params.note || null,
          now,
          now,
        ]
      );

      // 3. Insert into sync_outbox table
      const payload = JSON.stringify({
        id: expenseId,
        categoryId: params.categoryId,
        walletId: walletId || null,
        amount: centsToDollars(params.amountCents),
        currency,
        transactionDate: params.transactionDate,
        paymentMethod,
        payee: params.payee || null,
        note: params.note || null,
        clientCreatedAt: now,
      });

      await tx.executeSql(
        `INSERT INTO sync_outbox (
          operation_id, user_id, entity_type, entity_id, operation,
          payload, base_version, created_at, retry_count, status
        ) VALUES (?, ?, 'EXPENSE', ?, 'CREATE', ?, 0, ?, 0, 'PENDING')`,
        [outboxId, userId, expenseId, payload, now]
      );

      return {
        id: expenseId,
        userId,
        categoryId: params.categoryId,
        walletId: walletId || undefined,
        amountCents: params.amountCents,
        currency,
        transactionDate: params.transactionDate,
        paymentMethod,
        payee: params.payee,
        note: params.note,
        createdAt: now,
        updatedAt: now,
        version: 1,
        syncStatus: 'PENDING',
      };
    });
  }

  async update(id: string, params: UpdateExpenseParams): Promise<ExpenseModel> {
    const db = this.getDb();
    const userId = this.getUserId();
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`Expense with ID ${id} not found.`);
    }

    const now = getUTCTimestamp();
    const nextVersion = existing.version + 1;
    const outboxId = generateUUID();

    const categoryId = params.categoryId || existing.categoryId;
    const walletId = params.walletId !== undefined ? params.walletId : existing.walletId;
    const amountCents = params.amountCents !== undefined ? params.amountCents : existing.amountCents;
    const currency = params.currency || existing.currency;
    const transactionDate = params.transactionDate || existing.transactionDate;
    const paymentMethod = params.paymentMethod || existing.paymentMethod;
    const payee = params.payee !== undefined ? params.payee : existing.payee;
    const note = params.note !== undefined ? params.note : existing.note;

    return db.transaction(async (tx) => {
      await tx.executeSql(
        `UPDATE expenses SET
          category_id = ?, wallet_id = ?, amount_cents = ?, currency = ?, transaction_date = ?,
          payment_method = ?, payee = ?, note = ?, updated_at = ?, version = ?, sync_status = 'PENDING'
        WHERE id = ? AND user_id = ?`,
        [
          categoryId,
          walletId || null,
          amountCents,
          currency,
          transactionDate,
          paymentMethod,
          payee || null,
          note || null,
          now,
          nextVersion,
          id,
          userId,
        ]
      );

      const payload = JSON.stringify({
        categoryId,
        walletId: walletId || null,
        amount: centsToDollars(amountCents),
        currency,
        transactionDate,
        paymentMethod,
        payee: payee || null,
        note: note || null,
      });

      await tx.executeSql(
        `INSERT INTO sync_outbox (
          operation_id, user_id, entity_type, entity_id, operation,
          payload, base_version, created_at, retry_count, status
        ) VALUES (?, ?, 'EXPENSE', ?, 'UPDATE', ?, ?, ?, 0, 'PENDING')`,
        [outboxId, userId, id, payload, existing.version, now]
      );

      return {
        ...existing,
        categoryId,
        walletId,
        amountCents,
        currency,
        transactionDate,
        paymentMethod,
        payee,
        note,
        updatedAt: now,
        version: nextVersion,
        syncStatus: 'PENDING',
      };
    });
  }

  async softDelete(id: string): Promise<void> {
    const db = this.getDb();
    const userId = this.getUserId();
    const existing = await this.getById(id);
    if (!existing) return;

    const now = getUTCTimestamp();
    const outboxId = generateUUID();

    await db.transaction(async (tx) => {
      await tx.executeSql(
        `UPDATE expenses SET deleted_at = ?, updated_at = ?, sync_status = 'PENDING' WHERE id = ? AND user_id = ?`,
        [now, now, id, userId]
      );

      await tx.executeSql(
        `INSERT INTO sync_outbox (
          operation_id, user_id, entity_type, entity_id, operation,
          payload, base_version, created_at, retry_count, status
        ) VALUES (?, ?, 'EXPENSE', ?, 'DELETE', '{}', ?, ?, 0, 'PENDING')`,
        [outboxId, userId, id, existing.version, now]
      );
    });
  }

  async getById(id: string): Promise<ExpenseModel | null> {
    const db = this.getDb();
    const userId = this.getUserId();

    const res = await db.executeSql<SQLiteExpenseRow>(
      `SELECT e.*, c.name as category_name, c.icon as category_icon, c.color as category_color, w.name as wallet_name
       FROM expenses e
       LEFT JOIN categories c ON e.category_id = c.id
       LEFT JOIN wallets w ON e.wallet_id = w.id
       WHERE e.id = ? AND e.user_id = ? AND e.deleted_at IS NULL`,
      [id, userId]
    );

    if (res.rows.length === 0) return null;
    return ExpenseMapper.toDomain(res.rows[0]);
  }

  async list(filters?: ExpenseFilters): Promise<ExpenseModel[]> {
    const db = this.getDb();
    const userId = this.getUserId();

    let query = `
      SELECT e.*, c.name as category_name, c.icon as category_icon, c.color as category_color, w.name as wallet_name
      FROM expenses e
      LEFT JOIN categories c ON e.category_id = c.id
      LEFT JOIN wallets w ON e.wallet_id = w.id
      WHERE e.user_id = ? AND e.deleted_at IS NULL
    `;
    const params: unknown[] = [userId];

    if (filters?.categoryId) {
      query += ` AND e.category_id = ?`;
      params.push(filters.categoryId);
    }
    if (filters?.walletId) {
      query += ` AND e.wallet_id = ?`;
      params.push(filters.walletId);
    }
    if (filters?.startDate) {
      query += ` AND e.transaction_date >= ?`;
      params.push(filters.startDate);
    }
    if (filters?.endDate) {
      query += ` AND e.transaction_date <= ?`;
      params.push(filters.endDate);
    }
    if (filters?.paymentMethod) {
      query += ` AND e.payment_method = ?`;
      params.push(filters.paymentMethod);
    }
    if (filters?.minAmountCents !== undefined) {
      query += ` AND e.amount_cents >= ?`;
      params.push(filters.minAmountCents);
    }
    if (filters?.maxAmountCents !== undefined) {
      query += ` AND e.amount_cents <= ?`;
      params.push(filters.maxAmountCents);
    }
    if (filters?.search) {
      query += ` AND (e.payee LIKE ? OR e.note LIKE ? OR c.name LIKE ?)`;
      params.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`);
    }

    query += ` ORDER BY e.transaction_date DESC, e.created_at DESC`;

    if (filters?.limit) {
      query += ` LIMIT ?`;
      params.push(filters.limit);
      if (filters?.offset) {
        query += ` OFFSET ?`;
        params.push(filters.offset);
      }
    }

    const res = await db.executeSql<SQLiteExpenseRow>(query, params);
    return res.rows.map(ExpenseMapper.toDomain);
  }

  async getTotalCents(startDate?: string, endDate?: string, walletId?: string): Promise<number> {
    const db = this.getDb();
    const userId = this.getUserId();

    let query = `SELECT SUM(amount_cents) as total FROM expenses WHERE user_id = ? AND deleted_at IS NULL`;
    const params: unknown[] = [userId];

    if (startDate) {
      query += ` AND transaction_date >= ?`;
      params.push(startDate);
    }
    if (endDate) {
      query += ` AND transaction_date <= ?`;
      params.push(endDate);
    }
    if (walletId) {
      query += ` AND wallet_id = ?`;
      params.push(walletId);
    }

    const res = await db.executeSql<{ total: number | null }>(query, params);
    return res.rows[0]?.total || 0;
  }
}
