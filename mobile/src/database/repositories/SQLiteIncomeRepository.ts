import {
  IIncomeRepository,
  CreateIncomeParams,
  UpdateIncomeParams,
  IncomeFilters,
} from './interfaces/IIncomeRepository';
import { IncomeModel } from '../../domain/models';
import { IncomeMapper } from '../../domain/mappers';
import { SQLiteIncomeRow } from '../schema/types';
import { DatabaseManager } from '../sqlite/DatabaseManager';
import { generateUUID } from '../../utils/uuid';
import { getUTCTimestamp } from '../../utils/date';
import { centsToDollars } from '../../utils/money';

export class SQLiteIncomeRepository implements IIncomeRepository {
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

  async create(params: CreateIncomeParams): Promise<IncomeModel> {
    const db = this.getDb();
    const userId = this.getUserId();
    const incomeId = params.id || generateUUID();
    const outboxId = generateUUID();
    const now = getUTCTimestamp();
    const currency = params.currency || 'USD';
    const paymentMethod = params.paymentMethod || 'BANK_TRANSFER';

    return db.transaction(async (tx) => {
      await tx.executeSql(
        `INSERT INTO income (
          id, user_id, category_id, amount_cents, currency, transaction_date,
          payment_method, source, note, created_at, updated_at, deleted_at, version, sync_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 1, 'PENDING')`,
        [
          incomeId,
          userId,
          params.categoryId,
          params.amountCents,
          currency,
          params.transactionDate,
          paymentMethod,
          params.source,
          params.note || null,
          now,
          now,
        ]
      );

      const payload = JSON.stringify({
        id: incomeId,
        categoryId: params.categoryId,
        amount: centsToDollars(params.amountCents),
        currency,
        transactionDate: params.transactionDate,
        paymentMethod,
        source: params.source,
        note: params.note || null,
        clientCreatedAt: now,
      });

      await tx.executeSql(
        `INSERT INTO sync_outbox (
          operation_id, user_id, entity_type, entity_id, operation,
          payload, base_version, created_at, retry_count, status
        ) VALUES (?, ?, 'INCOME', ?, 'CREATE', ?, 0, ?, 0, 'PENDING')`,
        [outboxId, userId, incomeId, payload, now]
      );

      return {
        id: incomeId,
        userId,
        categoryId: params.categoryId,
        amountCents: params.amountCents,
        currency,
        transactionDate: params.transactionDate,
        paymentMethod,
        source: params.source,
        note: params.note,
        createdAt: now,
        updatedAt: now,
        version: 1,
        syncStatus: 'PENDING',
      };
    });
  }

  async update(id: string, params: UpdateIncomeParams): Promise<IncomeModel> {
    const db = this.getDb();
    const userId = this.getUserId();
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`Income with ID ${id} not found.`);
    }

    const now = getUTCTimestamp();
    const nextVersion = existing.version + 1;
    const outboxId = generateUUID();

    const categoryId = params.categoryId || existing.categoryId;
    const amountCents = params.amountCents !== undefined ? params.amountCents : existing.amountCents;
    const currency = params.currency || existing.currency;
    const transactionDate = params.transactionDate || existing.transactionDate;
    const paymentMethod = params.paymentMethod || existing.paymentMethod;
    const source = params.source !== undefined ? params.source : existing.source;
    const note = params.note !== undefined ? params.note : existing.note;

    return db.transaction(async (tx) => {
      await tx.executeSql(
        `UPDATE income SET
          category_id = ?, amount_cents = ?, currency = ?, transaction_date = ?,
          payment_method = ?, source = ?, note = ?, updated_at = ?, version = ?, sync_status = 'PENDING'
        WHERE id = ? AND user_id = ?`,
        [
          categoryId,
          amountCents,
          currency,
          transactionDate,
          paymentMethod,
          source,
          note || null,
          now,
          nextVersion,
          id,
          userId,
        ]
      );

      const payload = JSON.stringify({
        categoryId,
        amount: centsToDollars(amountCents),
        currency,
        transactionDate,
        paymentMethod,
        source,
        note: note || null,
      });

      await tx.executeSql(
        `INSERT INTO sync_outbox (
          operation_id, user_id, entity_type, entity_id, operation,
          payload, base_version, created_at, retry_count, status
        ) VALUES (?, ?, 'INCOME', ?, 'UPDATE', ?, ?, ?, 0, 'PENDING')`,
        [outboxId, userId, id, payload, existing.version, now]
      );

      return {
        ...existing,
        categoryId,
        amountCents,
        currency,
        transactionDate,
        paymentMethod,
        source,
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
        `UPDATE income SET deleted_at = ?, updated_at = ?, sync_status = 'PENDING' WHERE id = ? AND user_id = ?`,
        [now, now, id, userId]
      );

      await tx.executeSql(
        `INSERT INTO sync_outbox (
          operation_id, user_id, entity_type, entity_id, operation,
          payload, base_version, created_at, retry_count, status
        ) VALUES (?, ?, 'INCOME', ?, 'DELETE', '{}', ?, ?, 0, 'PENDING')`,
        [outboxId, userId, id, existing.version, now]
      );
    });
  }

  async getById(id: string): Promise<IncomeModel | null> {
    const db = this.getDb();
    const userId = this.getUserId();

    const res = await db.executeSql<SQLiteIncomeRow>(
      `SELECT i.*, c.name as category_name, c.icon as category_icon, c.color as category_color
       FROM income i
       LEFT JOIN categories c ON i.category_id = c.id
       WHERE i.id = ? AND i.user_id = ? AND i.deleted_at IS NULL`,
      [id, userId]
    );

    if (res.rows.length === 0) return null;
    return IncomeMapper.toDomain(res.rows[0]);
  }

  async list(filters?: IncomeFilters): Promise<IncomeModel[]> {
    const db = this.getDb();
    const userId = this.getUserId();

    let query = `
      SELECT i.*, c.name as category_name, c.icon as category_icon, c.color as category_color
      FROM income i
      LEFT JOIN categories c ON i.category_id = c.id
      WHERE i.user_id = ? AND i.deleted_at IS NULL
    `;
    const params: unknown[] = [userId];

    if (filters?.categoryId) {
      query += ` AND i.category_id = ?`;
      params.push(filters.categoryId);
    }
    if (filters?.paymentMethod) {
      query += ` AND i.payment_method = ?`;
      params.push(filters.paymentMethod);
    }
    if (filters?.startDate) {
      query += ` AND i.transaction_date >= ?`;
      params.push(filters.startDate);
    }
    if (filters?.endDate) {
      query += ` AND i.transaction_date <= ?`;
      params.push(filters.endDate);
    }
    if (filters?.search) {
      query += ` AND (i.source LIKE ? OR i.note LIKE ?)`;
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    query += ` ORDER BY i.transaction_date DESC, i.created_at DESC`;

    if (filters?.limit) {
      query += ` LIMIT ?`;
      params.push(filters.limit);
      if (filters?.offset) {
        query += ` OFFSET ?`;
        params.push(filters.offset);
      }
    }

    const res = await db.executeSql<SQLiteIncomeRow>(query, params);
    return res.rows.map(IncomeMapper.toDomain);
  }

  async getTotalCents(startDate?: string, endDate?: string): Promise<number> {
    const db = this.getDb();
    const userId = this.getUserId();

    let query = `SELECT SUM(amount_cents) as total FROM income WHERE user_id = ? AND deleted_at IS NULL`;
    const params: unknown[] = [userId];

    if (startDate) {
      query += ` AND transaction_date >= ?`;
      params.push(startDate);
    }
    if (endDate) {
      query += ` AND transaction_date <= ?`;
      params.push(endDate);
    }

    const res = await db.executeSql<{ total: number | null }>(query, params);
    return res.rows[0]?.total || 0;
  }
}
