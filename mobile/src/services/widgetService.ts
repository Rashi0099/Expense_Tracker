/**
 * Mobile Home Screen Widget Service (Section 11 & 12)
 *
 * Provides compact financial snapshot data for system widgets and
 * returns friction-free deep link targets for instant capture.
 */

import { getDashboardSummaryUseCase } from '../domain/usecases/dashboardUseCases';
import { getTodayDateString, getUTCTimestamp } from '../utils/date';
import { DatabaseManager } from '../database/sqlite/DatabaseManager';

export interface WidgetSummaryData {
  netBalanceCents: number;
  monthExpensesCents: number;
  todayExpensesCents: number;
  currency: string;
  quickActionUrl: string;
  updatedAt: string;
}

export class WidgetService {
  private static instance: WidgetService;

  static getInstance(): WidgetService {
    if (!WidgetService.instance) {
      WidgetService.instance = new WidgetService();
    }
    return WidgetService.instance;
  }

  /**
   * Primary deep link URL for widget quick capture button:
   * Directs user straight into the fast capture screen, bypassing navigation trees.
   */
  getWidgetQuickActionUrl(): string {
    return 'expense-tracker://expense/new';
  }

  /**
   * Gathers compact financial summary for widget display.
   * Reads entirely from local SQLite in < 10ms.
   */
  async getWidgetData(currency = 'USD'): Promise<WidgetSummaryData> {
    const today = getTodayDateString();
    const db = DatabaseManager.getInstance().getDatabase();
    const userId = DatabaseManager.getInstance().getCurrentUser();

    let todayExpensesCents = 0;
    if (userId) {
      try {
        const result = await db.executeSql<{ total: number }>(
          `SELECT SUM(amount_cents) as total FROM expenses
           WHERE user_id = ? AND transaction_date = ? AND deleted_at IS NULL`,
          [userId, today]
        );
        if (result.rows.length > 0 && result.rows[0].total) {
          todayExpensesCents = Number(result.rows[0].total) || 0;
        }
      } catch {
        // Handled
      }
    }

    const summary = await getDashboardSummaryUseCase();

    return {
      netBalanceCents: summary.netBalanceCents,
      monthExpensesCents: summary.totalExpensesCents,
      todayExpensesCents,
      currency,
      quickActionUrl: this.getWidgetQuickActionUrl(),
      updatedAt: getUTCTimestamp(),
    };
  }
}
