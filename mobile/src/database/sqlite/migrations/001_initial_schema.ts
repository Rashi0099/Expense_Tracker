import { ISQLiteDatabase } from '../DatabaseConnection';
import {
  CATEGORIES_TABLE,
  EXPENSES_TABLE,
  INCOME_TABLE,
  BUDGETS_TABLE,
  RECURRING_EXPENSES_TABLE,
  SYNC_OUTBOX_TABLE,
  SYNC_METADATA_TABLE,
  CATEGORY_MEMORY_TABLE,
} from '../../schema/tables';

export const migration001 = {
  version: 1,
  name: 'initial_schema',
  up: async (db: ISQLiteDatabase): Promise<void> => {
    // 1. Categories
    await db.executeSql(CATEGORIES_TABLE);

    // 2. Expenses
    await db.executeSql(EXPENSES_TABLE);

    // 3. Income
    await db.executeSql(INCOME_TABLE);

    // 4. Budgets
    await db.executeSql(BUDGETS_TABLE);

    // 5. Recurring Expenses
    await db.executeSql(RECURRING_EXPENSES_TABLE);

    // 6. Sync Outbox
    await db.executeSql(SYNC_OUTBOX_TABLE);

    // 7. Sync Metadata
    await db.executeSql(SYNC_METADATA_TABLE);

    // 8. Category Memory
    await db.executeSql(CATEGORY_MEMORY_TABLE);
  },
};
