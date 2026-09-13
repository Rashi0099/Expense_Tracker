import {
  IBudgetRepository,
  CreateBudgetParams,
  MonthlyBudgetOverview,
  BudgetConsumption,
} from './interfaces/IBudgetRepository';
import { BudgetModel } from '../../domain/models';
import { BudgetMapper } from '../../domain/mappers';
import { SQLiteBudgetRow } from '../schema/types';
import { DatabaseManager } from '../sqlite/DatabaseManager';
import { generateUUID } from '../../utils/uuid';
import { getUTCTimestamp } from '../../utils/date';
import { centsToDollars } from '../../utils/money';

export class SQLiteBudgetRepository implements IBudgetRepository {
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

  async create(params: CreateBudgetParams): Promise<BudgetModel> {
    const db = this.getDb();
    const userId = this.getUserId();
    const budgetId = params.id || generateUUID();
    const outboxId = generateUUID();
    const now = getUTCTimestamp();
    const currency = params.currency || 'USD';

    return db.transaction(async (tx) => {
      await tx.executeSql(
        `INSERT INTO budgets (
          id, user_id, category_id, period_start, limit_amount_cents, currency, created_at, updated_at, version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          budgetId,
          userId,
          params.categoryId || null,
          params.periodStart,
          params.limitAmountCents,
          currency,
          now,
          now,
        ]
      );

      const payload = JSON.stringify({
        id: budgetId,
        categoryId: params.categoryId || null,
        periodStart: params.periodStart,
        limitAmount: centsToDollars(params.limitAmountCents),
        currency,
      });

      await tx.executeSql(
        `INSERT INTO sync_outbox (
          operation_id, user_id, entity_type, entity_id, operation,
          payload, base_version, created_at, retry_count, status
        ) VALUES (?, ?, 'BUDGET', ?, 'CREATE', ?, 0, ?, 0, 'PENDING')`,
        [outboxId, userId, budgetId, payload, now]
      );

      return {
        id: budgetId,
        userId,
        categoryId: params.categoryId || null,
        periodStart: params.periodStart,
        limitAmountCents: params.limitAmountCents,
        currency,
        createdAt: now,
        updatedAt: now,
        version: 1,
      };
    });
  }

  async updateLimit(id: string, limitAmountCents: number): Promise<BudgetModel> {
    const db = this.getDb();
    const userId = this.getUserId();
    const now = getUTCTimestamp();
    const outboxId = generateUUID();

    const existingRes = await db.executeSql<SQLiteBudgetRow>(
      'SELECT * FROM budgets WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    if (existingRes.rows.length === 0) {
      throw new Error(`Budget ${id} not found.`);
    }
    const existing = existingRes.rows[0];
    const nextVersion = existing.version + 1;

    await db.transaction(async (tx) => {
      await tx.executeSql(
        'UPDATE budgets SET limit_amount_cents = ?, updated_at = ?, version = ? WHERE id = ? AND user_id = ?',
        [limitAmountCents, now, nextVersion, id, userId]
      );

      const payload = JSON.stringify({
        limitAmount: centsToDollars(limitAmountCents),
      });

      await tx.executeSql(
        `INSERT INTO sync_outbox (
          operation_id, user_id, entity_type, entity_id, operation,
          payload, base_version, created_at, retry_count, status
        ) VALUES (?, ?, 'BUDGET', ?, 'UPDATE', ?, ?, ?, 0, 'PENDING')`,
        [outboxId, userId, id, payload, existing.version, now]
      );
    });

    return {
      ...BudgetMapper.toDomain(existing),
      limitAmountCents,
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
      await tx.executeSql('DELETE FROM budgets WHERE id = ? AND user_id = ?', [id, userId]);

      await tx.executeSql(
        `INSERT INTO sync_outbox (
          operation_id, user_id, entity_type, entity_id, operation,
          payload, base_version, created_at, retry_count, status
        ) VALUES (?, ?, 'BUDGET', ?, 'DELETE', '{}', 1, ?, 0, 'PENDING')`,
        [outboxId, userId, id, now]
      );
    });
  }

  async getMonthlyOverview(monthStr: string): Promise<MonthlyBudgetOverview> {
    const db = this.getDb();
    const userId = this.getUserId();
    const periodStart = `${monthStr}-01`;

    // 1. Fetch budgets for this period
    const budgetsRes = await db.executeSql<SQLiteBudgetRow>(
      `SELECT b.*, c.name as category_name, c.icon as category_icon, c.color as category_color
       FROM budgets b
       LEFT JOIN categories c ON b.category_id = c.id
       WHERE b.user_id = ? AND b.period_start = ? AND b.deleted_at IS NULL`,
      [userId, periodStart]
    );

    // 2. Fetch category expenses for this month
    const startRange = `${monthStr}-01`;
    const endRange = `${monthStr}-31`;

    const expensesRes = await db.executeSql<{ category_id: string; total_cents: number }>(
      `SELECT category_id, SUM(amount_cents) as total_cents
       FROM expenses
       WHERE user_id = ? AND transaction_date >= ? AND transaction_date <= ? AND deleted_at IS NULL
       GROUP BY category_id`,
      [userId, startRange, endRange]
    );

    const spentByCategory = new Map<string, number>();
    let totalSpentCents = 0;

    for (const row of expensesRes.rows) {
      const cents = row.total_cents || 0;
      spentByCategory.set(row.category_id, cents);
      totalSpentCents += cents;
    }

    let overallBudget: BudgetConsumption | null = null;
    const categoryBudgets: BudgetConsumption[] = [];

    for (const row of budgetsRes.rows) {
      const model = BudgetMapper.toDomain(row);
      const isOverall = !model.categoryId;
      const spentCents = isOverall
        ? totalSpentCents
        : spentByCategory.get(model.categoryId!) || 0;

      const remainingCents = model.limitAmountCents - spentCents;
      const percentageUsed =
        model.limitAmountCents > 0
          ? Math.round((spentCents / model.limitAmountCents) * 100)
          : 0;

      const consumption: BudgetConsumption = {
        budget: model,
        spentCents,
        remainingCents,
        percentageUsed,
      };

      if (isOverall) {
        overallBudget = consumption;
      } else {
        categoryBudgets.push(consumption);
      }
    }

    return {
      overallBudget,
      categoryBudgets,
    };
  }
}
