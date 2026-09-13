import {
  ICategoryMemoryRepository,
  CategoryMemoryEntry,
} from './interfaces/ICategoryMemoryRepository';
import { SQLiteCategoryMemoryRow } from '../schema/types';
import { DatabaseManager } from '../sqlite/DatabaseManager';
import { getUTCTimestamp } from '../../utils/date';

export class SQLiteCategoryMemoryRepository implements ICategoryMemoryRepository {
  private getDb() {
    return DatabaseManager.getInstance().getDatabase();
  }

  async recordChoice(userId: string, merchant: string, categoryId: string): Promise<void> {
    const normalized = merchant.trim().toLowerCase();
    if (!normalized || !userId || !categoryId) return;

    const db = this.getDb();
    const now = getUTCTimestamp();

    await db.executeSql(
      `INSERT INTO category_memory (user_id, keyword_normalized, category_id, frequency, last_used_at)
       VALUES (?, ?, ?, 1, ?)
       ON CONFLICT(user_id, keyword_normalized) DO UPDATE SET
         category_id = excluded.category_id,
         frequency = category_memory.frequency + 1,
         last_used_at = excluded.last_used_at;`,
      [userId, normalized, categoryId, now]
    );
  }

  async getPreferredCategory(userId: string, merchant: string): Promise<string | null> {
    const normalized = merchant.trim().toLowerCase();
    if (!normalized || !userId) return null;

    const db = this.getDb();

    // 1. Direct exact match
    const exactResult = await db.executeSql<SQLiteCategoryMemoryRow>(
      `SELECT category_id, frequency, last_used_at FROM category_memory
       WHERE user_id = ? AND keyword_normalized = ?
       LIMIT 1;`,
      [userId, normalized]
    );

    if (exactResult.rows.length > 0) {
      return exactResult.rows[0].category_id;
    }

    // 2. Substring match against stored keywords ordered by highest frequency first
    const allRecords = await db.executeSql<SQLiteCategoryMemoryRow>(
      `SELECT keyword_normalized, category_id, frequency, last_used_at FROM category_memory
       WHERE user_id = ?
       ORDER BY frequency DESC, last_used_at DESC;`,
      [userId]
    );

    for (const row of allRecords.rows) {
      const kw = row.keyword_normalized;
      if (normalized.includes(kw) || kw.includes(normalized)) {
        return row.category_id;
      }
    }

    return null;
  }

  async getAllForUser(userId: string): Promise<CategoryMemoryEntry[]> {
    if (!userId) return [];
    const db = this.getDb();
    const result = await db.executeSql<SQLiteCategoryMemoryRow>(
      `SELECT user_id, keyword_normalized, category_id, frequency, last_used_at FROM category_memory
       WHERE user_id = ?
       ORDER BY frequency DESC, last_used_at DESC;`,
      [userId]
    );

    return result.rows.map((r) => ({
      userId: r.user_id,
      keywordNormalized: r.keyword_normalized,
      categoryId: r.category_id,
      frequency: Number(r.frequency) || 1,
      lastUsedAt: r.last_used_at,
    }));
  }

  async clearForUser(userId: string): Promise<void> {
    if (!userId) return;
    const db = this.getDb();
    await db.executeSql(`DELETE FROM category_memory WHERE user_id = ?;`, [userId]);
  }
}
