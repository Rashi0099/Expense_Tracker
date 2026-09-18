import { Share } from 'react-native';
import { DatabaseManager } from '../database/sqlite/DatabaseManager';
import { DataEvents } from '../database/sqlite/DataEvents';
import { getUTCTimestamp } from '../utils/date';

export interface BackupPayload {
  version: number;
  appName: string;
  createdAt: string;
  userId?: string | null;
  counts: {
    wallets: number;
    categories: number;
    expenses: number;
    income: number;
    budgets: number;
    recurringExpenses: number;
  };
  data: {
    wallets: Record<string, any>[];
    categories: Record<string, any>[];
    expenses: Record<string, any>[];
    income: Record<string, any>[];
    budgets: Record<string, any>[];
    recurringExpenses: Record<string, any>[];
  };
}

export class BackupService {
  private static instance: BackupService;

  private constructor() {}

  public static getInstance(): BackupService {
    if (!BackupService.instance) {
      BackupService.instance = new BackupService();
    }
    return BackupService.instance;
  }

  /**
   * Generates a complete JSON backup object of the user's financial database.
   */
  public async createBackup(): Promise<BackupPayload> {
    const db = DatabaseManager.getInstance().getDatabase();
    const userId = DatabaseManager.getInstance().getCurrentUser();

    // Query all entities for current user
    const [
      walletsRes,
      categoriesRes,
      expensesRes,
      incomeRes,
      budgetsRes,
      recurringRes,
    ] = await Promise.all([
      userId
        ? db.executeSql<Record<string, any>>('SELECT * FROM wallets WHERE user_id = ?', [userId])
        : db.executeSql<Record<string, any>>('SELECT * FROM wallets'),
      userId
        ? db.executeSql<Record<string, any>>(
            'SELECT * FROM categories WHERE (is_system = 1 OR user_id = ?)',
            [userId]
          )
        : db.executeSql<Record<string, any>>('SELECT * FROM categories'),
      userId
        ? db.executeSql<Record<string, any>>('SELECT * FROM expenses WHERE user_id = ?', [userId])
        : db.executeSql<Record<string, any>>('SELECT * FROM expenses'),
      userId
        ? db.executeSql<Record<string, any>>('SELECT * FROM income WHERE user_id = ?', [userId])
        : db.executeSql<Record<string, any>>('SELECT * FROM income'),
      userId
        ? db.executeSql<Record<string, any>>('SELECT * FROM budgets WHERE user_id = ?', [userId])
        : db.executeSql<Record<string, any>>('SELECT * FROM budgets'),
      userId
        ? db.executeSql<Record<string, any>>(
            'SELECT * FROM recurring_expenses WHERE user_id = ?',
            [userId]
          )
        : db.executeSql<Record<string, any>>('SELECT * FROM recurring_expenses'),
    ]);

    const payload: BackupPayload = {
      version: 1,
      appName: 'Spending Book',
      createdAt: getUTCTimestamp(),
      userId,
      counts: {
        wallets: walletsRes.rows.length,
        categories: categoriesRes.rows.length,
        expenses: expensesRes.rows.length,
        income: incomeRes.rows.length,
        budgets: budgetsRes.rows.length,
        recurringExpenses: recurringRes.rows.length,
      },
      data: {
        wallets: walletsRes.rows,
        categories: categoriesRes.rows,
        expenses: expensesRes.rows,
        income: incomeRes.rows,
        budgets: budgetsRes.rows,
        recurringExpenses: recurringRes.rows,
      },
    };

    return payload;
  }

  /**
   * Shares the backup JSON payload via native system share dialog (WhatsApp, Email, Drive, Files).
   */
  public async shareBackup(): Promise<boolean> {
    try {
      const backup = await this.createBackup();
      const jsonString = JSON.stringify(backup, null, 2);
      const filename = `SpendingBook_Backup_${new Date().toISOString().split('T')[0]}.json`;

      await Share.share(
        {
          title: filename,
          message: jsonString,
        },
        {
          dialogTitle: 'Save Spending Book Backup',
        }
      );
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validates a candidate backup string before restoring.
   */
  public validateBackup(jsonString: string): {
    valid: boolean;
    error?: string;
    payload?: BackupPayload;
  } {
    if (!jsonString || typeof jsonString !== 'string') {
      return { valid: false, error: 'Empty backup data provided.' };
    }

    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed || typeof parsed !== 'object') {
        return { valid: false, error: 'Invalid JSON structure.' };
      }

      if (parsed.appName !== 'Spending Book') {
        return {
          valid: false,
          error: 'Unrecognized backup file. Expected "Spending Book" backup.',
        };
      }

      if (!parsed.data || typeof parsed.data !== 'object') {
        return { valid: false, error: 'Backup data payload is missing.' };
      }

      const { wallets, categories, expenses, income } = parsed.data;
      if (!Array.isArray(wallets) || !Array.isArray(categories) || !Array.isArray(expenses) || !Array.isArray(income)) {
        return { valid: false, error: 'Backup data arrays are incomplete or corrupted.' };
      }

      return { valid: true, payload: parsed as BackupPayload };
    } catch (err: any) {
      return { valid: false, error: `Invalid JSON syntax: ${err.message || 'SyntaxError'}` };
    }
  }

  /**
   * Restores records from a valid backup payload inside an atomic transaction.
   * Emits DataEvents to update all active views immediately.
   */
  public async restoreBackup(
    backupInput: string | BackupPayload
  ): Promise<{ success: boolean; error?: string; counts?: Record<string, number> }> {
    let payload: BackupPayload;

    if (typeof backupInput === 'string') {
      const validation = this.validateBackup(backupInput);
      if (!validation.valid || !validation.payload) {
        return { success: false, error: validation.error || 'Invalid backup data' };
      }
      payload = validation.payload;
    } else {
      payload = backupInput;
    }

    const db = DatabaseManager.getInstance().getDatabase();
    const currentUserId = DatabaseManager.getInstance().getCurrentUser();

    try {
      await db.transaction(async (tx) => {
        // 1. Wipe existing user records (or all records if currentUserId is set)
        if (currentUserId) {
          await tx.executeSql('DELETE FROM expenses WHERE user_id = ?', [currentUserId]);
          await tx.executeSql('DELETE FROM income WHERE user_id = ?', [currentUserId]);
          await tx.executeSql('DELETE FROM budgets WHERE user_id = ?', [currentUserId]);
          await tx.executeSql('DELETE FROM recurring_expenses WHERE user_id = ?', [currentUserId]);
          await tx.executeSql('DELETE FROM wallets WHERE user_id = ?', [currentUserId]);
          await tx.executeSql('DELETE FROM categories WHERE user_id = ?', [currentUserId]);
        } else {
          await tx.executeSql('DELETE FROM expenses');
          await tx.executeSql('DELETE FROM income');
          await tx.executeSql('DELETE FROM budgets');
          await tx.executeSql('DELETE FROM recurring_expenses');
          await tx.executeSql('DELETE FROM wallets');
          await tx.executeSql('DELETE FROM categories WHERE is_system = 0');
        }

        // Helper to batch insert rows
        const insertRows = async (tableName: string, rows: Record<string, any>[]) => {
          for (const row of rows) {
            const keys = Object.keys(row);
            if (keys.length === 0) continue;

            const placeholders = keys.map(() => '?').join(', ');
            const query = `INSERT OR REPLACE INTO ${tableName} (${keys.join(', ')}) VALUES (${placeholders})`;
            const values = keys.map((k) => row[k]);
            await tx.executeSql(query, values);
          }
        };

        // 2. Insert in order of foreign key dependency:
        // Categories -> Wallets -> Budgets -> Recurring -> Expenses -> Income
        await insertRows('categories', payload.data.categories || []);
        await insertRows('wallets', payload.data.wallets || []);
        await insertRows('budgets', payload.data.budgets || []);
        await insertRows('recurring_expenses', payload.data.recurringExpenses || []);
        await insertRows('expenses', payload.data.expenses || []);
        await insertRows('income', payload.data.income || []);
      });

      // 3. Notify all listeners across the entire mobile application
      DataEvents.notify('CATEGORIES_CHANGED');
      DataEvents.notify('WALLETS_CHANGED');
      DataEvents.notify('BUDGETS_CHANGED');
      DataEvents.notify('RECURRING_CHANGED');
      DataEvents.notify('EXPENSES_CHANGED');
      DataEvents.notify('INCOME_CHANGED');

      return {
        success: true,
        counts: {
          wallets: payload.data.wallets?.length || 0,
          categories: payload.data.categories?.length || 0,
          expenses: payload.data.expenses?.length || 0,
          income: payload.data.income?.length || 0,
          budgets: payload.data.budgets?.length || 0,
          recurringExpenses: payload.data.recurringExpenses?.length || 0,
        },
      };
    } catch (err: any) {
      return { success: false, error: err.message || 'Database restore failed' };
    }
  }
}

export const backupService = BackupService.getInstance();
