import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseManager } from '../database/sqlite/DatabaseManager';
import { MemorySQLiteAdapter } from '../database/sqlite/DatabaseConnection';
import { SQLiteCategoryRepository } from '../database/repositories/SQLiteCategoryRepository';

describe('App Startup & Resiliency Tests', () => {
  beforeEach(async () => {
    const db = new MemorySQLiteAdapter();
    await DatabaseManager.getInstance().initialize(db);
  });

  it('initializes DatabaseManager gracefully', async () => {
    const manager = DatabaseManager.getInstance();
    const db = manager.getDatabase();
    expect(db).toBeDefined();
  });

  it('seeds default categories without error', async () => {
    const catRepo = new SQLiteCategoryRepository();
    await catRepo.seedDefaults();
    const categories = await catRepo.list();
    expect(categories.length).toBeGreaterThan(0);
    expect(categories.some((c) => c.name === 'Food & Dining')).toBe(true);
  });

  it('splits and executes multi-statement SQL strings cleanly', async () => {
    const db = DatabaseManager.getInstance().getDatabase();
    const multiSql = `
      CREATE TABLE IF NOT EXISTS test_tbl (id TEXT PRIMARY KEY, val TEXT);
      CREATE INDEX IF NOT EXISTS idx_test_val ON test_tbl(val);
      INSERT INTO test_tbl (id, val) VALUES ('1', 'hello');
      INSERT INTO test_tbl (id, val) VALUES ('2', 'world');
    `;
    
    const statements = multiSql
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const stmt of statements) {
      await db.executeSql(stmt);
    }

    const res = await db.executeSql<{ id: string; val: string }>('SELECT * FROM test_tbl ORDER BY id ASC');
    expect(res.rows.length).toBe(2);
    expect(res.rows[0].val).toBe('hello');
    expect(res.rows[1].val).toBe('world');
  });
});
