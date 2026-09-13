import { ISQLiteDatabase } from '../DatabaseConnection';
import { SCHEMA_MIGRATIONS_TABLE } from '../../schema/tables';
import { migration001 } from './001_initial_schema';
import { getUTCTimestamp } from '../../../utils/date';

export interface Migration {
  version: number;
  name: string;
  up: (db: ISQLiteDatabase) => Promise<void>;
}

const ALL_MIGRATIONS: Migration[] = [migration001];

export class MigrationRunner {
  private db: ISQLiteDatabase;

  constructor(db: ISQLiteDatabase) {
    this.db = db;
  }

  async runMigrations(): Promise<number> {
    // 1. Ensure migrations table exists
    await this.db.executeSql(SCHEMA_MIGRATIONS_TABLE);

    // 2. Fetch applied migration versions
    const res = await this.db.executeSql<{ version: number }>(
      'SELECT version FROM schema_migrations ORDER BY version ASC'
    );
    const appliedVersions = new Set(res.rows.map((r) => r.version));

    let appliedCount = 0;

    // 3. Run pending migrations in transaction
    for (const mig of ALL_MIGRATIONS) {
      if (!appliedVersions.has(mig.version)) {
        await this.db.transaction(async (tx) => {
          await mig.up(tx);
          await tx.executeSql(
            'INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)',
            [mig.version, getUTCTimestamp()]
          );
        });
        appliedCount++;
      }
    }

    return appliedCount;
  }
}
