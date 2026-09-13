import {
  IRecurringExpenseRepository,
  CreateRecurringParams,
} from './interfaces/IRecurringExpenseRepository';
import { RecurringExpenseModel } from '../../domain/models';
import { RecurringExpenseMapper } from '../../domain/mappers';
import { SQLiteRecurringExpenseRow } from '../schema/types';
import { DatabaseManager } from '../sqlite/DatabaseManager';
import { generateUUID } from '../../utils/uuid';
import { getUTCTimestamp } from '../../utils/date';
import { centsToDollars } from '../../utils/money';

export class SQLiteRecurringExpenseRepository implements IRecurringExpenseRepository {
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

  async create(params: CreateRecurringParams): Promise<RecurringExpenseModel> {
    const db = this.getDb();
    const userId = this.getUserId();
    const recId = params.id || generateUUID();
    const outboxId = generateUUID();
    const now = getUTCTimestamp();
    const currency = params.currency || 'USD';
    const isActive = params.isActive !== undefined ? params.isActive : true;

    return db.transaction(async (tx) => {
      await tx.executeSql(
        `INSERT INTO recurring_expenses (
          id, user_id, category_id, title, amount_cents, currency,
          frequency, start_date, next_due_date, end_date, is_active,
          created_at, updated_at, version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          recId,
          userId,
          params.categoryId,
          params.title,
          params.amountCents,
          currency,
          params.frequency,
          params.startDate,
          params.nextDueDate,
          params.endDate || null,
          isActive ? 1 : 0,
          now,
          now,
        ]
      );

      const payload = JSON.stringify({
        id: recId,
        categoryId: params.categoryId,
        title: params.title,
        amount: centsToDollars(params.amountCents),
        currency,
        frequency: params.frequency,
        startDate: params.startDate,
        nextDueDate: params.nextDueDate,
        endDate: params.endDate || null,
        isActive,
      });

      await tx.executeSql(
        `INSERT INTO sync_outbox (
          operation_id, user_id, entity_type, entity_id, operation,
          payload, base_version, created_at, retry_count, status
        ) VALUES (?, ?, 'RECURRING', ?, 'CREATE', ?, 0, ?, 0, 'PENDING')`,
        [outboxId, userId, recId, payload, now]
      );

      return {
        id: recId,
        userId,
        categoryId: params.categoryId,
        title: params.title,
        amountCents: params.amountCents,
        currency,
        frequency: params.frequency,
        startDate: params.startDate,
        nextDueDate: params.nextDueDate,
        endDate: params.endDate,
        isActive,
        createdAt: now,
        updatedAt: now,
        version: 1,
      };
    });
  }

  async toggleActive(id: string, isActive: boolean): Promise<RecurringExpenseModel> {
    const db = this.getDb();
    const userId = this.getUserId();
    const now = getUTCTimestamp();
    const outboxId = generateUUID();

    const existingRes = await db.executeSql<SQLiteRecurringExpenseRow>(
      'SELECT * FROM recurring_expenses WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    if (existingRes.rows.length === 0) {
      throw new Error(`Recurring expense ${id} not found.`);
    }
    const existing = existingRes.rows[0];
    const nextVersion = existing.version + 1;

    await db.transaction(async (tx) => {
      await tx.executeSql(
        'UPDATE recurring_expenses SET is_active = ?, updated_at = ?, version = ? WHERE id = ? AND user_id = ?',
        [isActive ? 1 : 0, now, nextVersion, id, userId]
      );

      const payload = JSON.stringify({ isActive });
      await tx.executeSql(
        `INSERT INTO sync_outbox (
          operation_id, user_id, entity_type, entity_id, operation,
          payload, base_version, created_at, retry_count, status
        ) VALUES (?, ?, 'RECURRING', ?, 'UPDATE', ?, ?, ?, 0, 'PENDING')`,
        [outboxId, userId, id, payload, existing.version, now]
      );
    });

    return {
      ...RecurringExpenseMapper.toDomain(existing),
      isActive,
      updatedAt: now,
      version: nextVersion,
    };
  }

  async delete(id: string): Promise<void> {
    const db = this.getDb();
    const userId = this.getUserId();
    const now = getUTCTimestamp();
    const outboxId = generateUUID();

    await db.transaction(async (tx) => {
      await tx.executeSql('DELETE FROM recurring_expenses WHERE id = ? AND user_id = ?', [id, userId]);

      await tx.executeSql(
        `INSERT INTO sync_outbox (
          operation_id, user_id, entity_type, entity_id, operation,
          payload, base_version, created_at, retry_count, status
        ) VALUES (?, ?, 'RECURRING', ?, 'DELETE', '{}', 1, ?, 0, 'PENDING')`,
        [outboxId, userId, id, now]
      );
    });
  }

  async list(): Promise<RecurringExpenseModel[]> {
    const db = this.getDb();
    const userId = this.getUserId();

    const res = await db.executeSql<SQLiteRecurringExpenseRow>(
      `SELECT r.*, c.name as category_name, c.icon as category_icon
       FROM recurring_expenses r
       LEFT JOIN categories c ON r.category_id = c.id
       WHERE r.user_id = ? AND r.deleted_at IS NULL
       ORDER BY r.next_due_date ASC`,
      [userId]
    );

    return res.rows.map(RecurringExpenseMapper.toDomain);
  }
}
