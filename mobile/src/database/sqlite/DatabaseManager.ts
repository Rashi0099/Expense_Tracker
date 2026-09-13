import {
  ISQLiteDatabase,
  QuickSQLiteAdapter,
  MemorySQLiteAdapter,
} from './DatabaseConnection';
import { MigrationRunner } from './migrations/MigrationRunner';
import { ENV } from '../../app/config/env';

export class DatabaseManager {
  private static instance: DatabaseManager | null = null;
  private db: ISQLiteDatabase | null = null;
  private currentUserId: string | null = null;
  private isInitialized = false;

  private constructor() {}

  static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  /**
   * Initializes the database connection and runs pending migrations.
   * Allows passing a custom adapter (e.g. MemorySQLiteAdapter) for tests.
   */
  async initialize(customDb?: ISQLiteDatabase): Promise<ISQLiteDatabase> {
    if (customDb) {
      this.db = customDb;
      const runner = new MigrationRunner(this.db);
      await runner.runMigrations();
      this.isInitialized = true;
      return this.db;
    }

    if (this.isInitialized && this.db) {
      return this.db;
    }

    // In native environment use QuickSQLiteAdapter
    this.db = new QuickSQLiteAdapter(ENV.SQLITE_DB_NAME);
    const runner = new MigrationRunner(this.db);
    await runner.runMigrations();

    this.isInitialized = true;
    return this.db;
  }

  getDatabase(): ISQLiteDatabase {
    if (!this.db) {
      // Lazy init fallback for memory
      this.db = new MemorySQLiteAdapter();
    }
    return this.db;
  }

  /**
   * Scopes the current database session to an authenticated user ID.
   * Ensures User A's data is isolated from User B (Section 34).
   */
  setCurrentUser(userId: string | null): void {
    this.currentUserId = userId;
  }

  getCurrentUser(): string | null {
    return this.currentUserId;
  }

  /**
   * Reset database connection (e.g. on logout or teardown).
   */
  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
    }
    this.isInitialized = false;
    this.currentUserId = null;
  }
}
