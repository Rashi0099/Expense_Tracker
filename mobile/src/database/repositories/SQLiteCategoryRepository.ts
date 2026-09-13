import {
  ICategoryRepository,
  CreateCategoryParams,
} from './interfaces/ICategoryRepository';
import { CategoryModel, CategoryType } from '../../domain/models';
import { CategoryMapper } from '../../domain/mappers';
import { SQLiteCategoryRow } from '../schema/types';
import { DatabaseManager } from '../sqlite/DatabaseManager';
import { generateUUID } from '../../utils/uuid';
import { getUTCTimestamp } from '../../utils/date';

export const DEFAULT_SYSTEM_CATEGORIES = [
  { id: 'c0000000-0000-0000-0000-000000000001', name: 'Food & Dining', type: 'EXPENSE', icon: '🍔', color: '#F97316' },
  { id: 'c0000000-0000-0000-0000-000000000002', name: 'Groceries', type: 'EXPENSE', icon: '🛒', color: '#10B981' },
  { id: 'c0000000-0000-0000-0000-000000000003', name: 'Transport & Fuel', type: 'EXPENSE', icon: '🚗', color: '#3B82F6' },
  { id: 'c0000000-0000-0000-0000-000000000004', name: 'Shopping', type: 'EXPENSE', icon: '🛍️', color: '#EC4899' },
  { id: 'c0000000-0000-0000-0000-000000000005', name: 'Bills & Utilities', type: 'EXPENSE', icon: '⚡', color: '#F59E0B' },
  { id: 'c0000000-0000-0000-0000-000000000006', name: 'Entertainment', type: 'EXPENSE', icon: '🎬', color: '#8B5CF6' },
  { id: 'c0000000-0000-0000-0000-000000000007', name: 'Salary', type: 'INCOME', icon: '💼', color: '#059669' },
  { id: 'c0000000-0000-0000-0000-000000000008', name: 'Investments', type: 'INCOME', icon: '📈', color: '#0284C7' },
  { id: 'c0000000-0000-0000-0000-000000000009', name: 'Freelance', type: 'INCOME', icon: '💻', color: '#6366F1' },
];

export class SQLiteCategoryRepository implements ICategoryRepository {
  private getDb() {
    return DatabaseManager.getInstance().getDatabase();
  }

  private getUserId(): string | null {
    return DatabaseManager.getInstance().getCurrentUser();
  }

  async seedDefaults(): Promise<void> {
    const db = this.getDb();
    const now = getUTCTimestamp();

    for (const cat of DEFAULT_SYSTEM_CATEGORIES) {
      await db.executeSql(
        `INSERT OR IGNORE INTO categories (
          id, user_id, name, type, icon, color, is_system, is_archived, created_at, updated_at, version
        ) VALUES (?, NULL, ?, ?, ?, ?, 1, 0, ?, ?, 1)`,
        [cat.id, cat.name, cat.type, cat.icon, cat.color, now, now]
      );
    }
  }

  async create(params: CreateCategoryParams): Promise<CategoryModel> {
    const db = this.getDb();
    const userId = this.getUserId();
    const categoryId = params.id || generateUUID();
    const now = getUTCTimestamp();

    const outboxId = generateUUID();

    return db.transaction(async (tx) => {
      await tx.executeSql(
        `INSERT INTO categories (
          id, user_id, name, type, icon, color, is_system, is_archived, created_at, updated_at, version
        ) VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?, 1)`,
        [
          categoryId,
          userId,
          params.name,
          params.type,
          params.icon || '🏷️',
          params.color || '#808080',
          now,
          now,
        ]
      );

      const payload = JSON.stringify({
        id: categoryId,
        name: params.name,
        type: params.type,
        icon: params.icon || '🏷️',
        color: params.color || '#808080',
      });

      if (userId) {
        await tx.executeSql(
          `INSERT INTO sync_outbox (
            operation_id, user_id, entity_type, entity_id, operation,
            payload, base_version, created_at, retry_count, status
          ) VALUES (?, ?, 'CATEGORY', ?, 'CREATE', ?, 0, ?, 0, 'PENDING')`,
          [outboxId, userId, categoryId, payload, now]
        );
      }

      return {
        id: categoryId,
        userId,
        name: params.name,
        type: params.type,
        icon: params.icon || '🏷️',
        color: params.color || '#808080',
        isSystem: false,
        isArchived: false,
        createdAt: now,
        updatedAt: now,
        version: 1,
      };
    });
  }

  async getById(id: string): Promise<CategoryModel | null> {
    const db = this.getDb();
    const userId = this.getUserId();

    const res = await db.executeSql<SQLiteCategoryRow>(
      `SELECT * FROM categories WHERE id = ? AND (is_system = 1 OR user_id = ?) AND deleted_at IS NULL`,
      [id, userId || '']
    );

    if (res.rows.length === 0) return null;
    return CategoryMapper.toDomain(res.rows[0]);
  }

  async list(type?: CategoryType): Promise<CategoryModel[]> {
    const db = this.getDb();
    const userId = this.getUserId();

    let query = `
      SELECT * FROM categories
      WHERE (is_system = 1 OR user_id = ?) AND is_archived = 0 AND deleted_at IS NULL
    `;
    const params: unknown[] = [userId || ''];

    if (type) {
      query += ` AND type = ?`;
      params.push(type);
    }

    query += ` ORDER BY is_system DESC, name ASC`;

    const res = await db.executeSql<SQLiteCategoryRow>(query, params);
    return res.rows.map(CategoryMapper.toDomain);
  }
}
