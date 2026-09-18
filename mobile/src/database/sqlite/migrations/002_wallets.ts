import { ISQLiteDatabase } from '../DatabaseConnection';
import { WALLETS_TABLE } from '../../schema/tables';
import { getUTCTimestamp } from '../../../utils/date';
import { generateUUID } from '../../../utils/uuid';

export const migration002 = {
  version: 2,
  name: 'wallets',
  up: async (db: ISQLiteDatabase): Promise<void> => {
    // 1. Create wallets table
    await db.executeSql(WALLETS_TABLE);

    // 2. Add wallet_id column to expenses if not exists
    const expenseCols = await db.executeSql<{ name: string }>('PRAGMA table_info(expenses)');
    const hasExpenseWallet = expenseCols.rows.some((c) => c.name === 'wallet_id');
    if (!hasExpenseWallet) {
      await db.executeSql('ALTER TABLE expenses ADD COLUMN wallet_id TEXT');
    }
    await db.executeSql('CREATE INDEX IF NOT EXISTS idx_expenses_wallet ON expenses(wallet_id)');

    // 3. Add wallet_id column to income if not exists
    const incomeCols = await db.executeSql<{ name: string }>('PRAGMA table_info(income)');
    const hasIncomeWallet = incomeCols.rows.some((c) => c.name === 'wallet_id');
    if (!hasIncomeWallet) {
      await db.executeSql('ALTER TABLE income ADD COLUMN wallet_id TEXT');
    }
    await db.executeSql('CREATE INDEX IF NOT EXISTS idx_income_wallet ON income(wallet_id)');

    // 4. Backfill default Wallet 1 for existing users with transactions
    const usersWithExpenses = await db.executeSql<{ user_id: string }>(
      'SELECT DISTINCT user_id FROM expenses WHERE user_id IS NOT NULL'
    );
    const usersWithIncome = await db.executeSql<{ user_id: string }>(
      'SELECT DISTINCT user_id FROM income WHERE user_id IS NOT NULL'
    );

    const userIds = new Set<string>();
    usersWithExpenses.rows.forEach((r) => userIds.add(r.user_id));
    usersWithIncome.rows.forEach((r) => userIds.add(r.user_id));

    const now = getUTCTimestamp();

    for (const userId of userIds) {
      // Check if user already has a wallet
      const existing = await db.executeSql<{ id: string }>(
        'SELECT id FROM wallets WHERE user_id = ? AND deleted_at IS NULL LIMIT 1',
        [userId]
      );

      let walletId: string;
      if (existing.rows.length === 0) {
        walletId = generateUUID();
        await db.executeSql(
          `INSERT INTO wallets (id, user_id, name, is_default, created_at, updated_at, deleted_at, version)
           VALUES (?, ?, 'Wallet 1', 1, ?, ?, NULL, 1)`,
          [walletId, userId, now, now]
        );
      } else {
        walletId = existing.rows[0].id;
      }

      // Backfill any unassigned expenses and income
      await db.executeSql(
        'UPDATE expenses SET wallet_id = ? WHERE user_id = ? AND wallet_id IS NULL',
        [walletId, userId]
      );
      await db.executeSql(
        'UPDATE income SET wallet_id = ? WHERE user_id = ? AND wallet_id IS NULL',
        [walletId, userId]
      );
    }
  },
};
