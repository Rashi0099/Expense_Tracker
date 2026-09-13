/**
 * Local Notification & Reminder Engine (Section 15, 16, 17)
 *
 * Provides deterministic, noise-free local notifications:
 * - Recurring expense due date reminders with stable identifiers (rec_{id}_{dueDate})
 * - Budget limit warnings (>=80%) and exceeded alerts (>100%) with deduplication
 * - Zero repeated spam across device reboots, app restarts, or sync passes
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { listRecurringUseCase } from '../domain/usecases/recurringUseCases';
import { getMonthlyBudgetOverviewUseCase } from '../domain/usecases/budgetUseCases';
import { getTodayDateString, getCurrentMonthString, getUTCTimestamp } from '../utils/date';
import { centsToDollars } from '../utils/money';

const DELIVERED_NOTIFICATIONS_KEY = '@expense_tracker/delivered_notifications';
const NOTIFICATION_SETTINGS_KEY = '@expense_tracker/notification_settings';

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  type: 'RECURRING_REMINDER' | 'BUDGET_ALERT';
  createdAt: string;
  data?: Record<string, unknown>;
}

export interface NotificationSettings {
  recurringRemindersEnabled: boolean;
  budgetAlertsEnabled: boolean;
}

export class NotificationService {
  private static instance: NotificationService;
  private deliveredIds = new Set<string>();
  private settings: NotificationSettings = {
    recurringRemindersEnabled: true,
    budgetAlertsEnabled: true,
  };
  private isLoaded = false;
  private listeners: ((notification: NotificationItem) => void)[] = [];

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  async init(): Promise<void> {
    if (this.isLoaded) return;
    try {
      const storedIds = await AsyncStorage.getItem(DELIVERED_NOTIFICATIONS_KEY);
      if (storedIds) {
        const parsed = JSON.parse(storedIds) as string[];
        parsed.forEach((id) => this.deliveredIds.add(id));
      }

      const storedSettings = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_KEY);
      if (storedSettings) {
        this.settings = JSON.parse(storedSettings);
      }
    } catch {
      // Handled
    } finally {
      this.isLoaded = true;
    }
  }

  getSettings(): NotificationSettings {
    return { ...this.settings };
  }

  async updateSettings(newSettings: Partial<NotificationSettings>): Promise<void> {
    this.settings = { ...this.settings, ...newSettings };
    try {
      await AsyncStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(this.settings));
    } catch {
      // Handled
    }
  }

  isDelivered(id: string): boolean {
    return this.deliveredIds.has(id);
  }

  private async markDelivered(id: string): Promise<void> {
    this.deliveredIds.add(id);
    try {
      await AsyncStorage.setItem(
        DELIVERED_NOTIFICATIONS_KEY,
        JSON.stringify(Array.from(this.deliveredIds))
      );
    } catch {
      // Handled
    }
  }

  /**
   * Generates a stable identifier for recurring expense reminders.
   * Deterministic format: `rec_{recurringId}_{dueDate}`
   */
  generateRecurringReminderId(recurringId: string, dueDate: string): string {
    return `rec_${recurringId}_${dueDate}`;
  }

  /**
   * Generates a stable identifier for budget alerts.
   * Deterministic format: `budget_{budgetId}_{month}_{threshold}`
   */
  generateBudgetAlertId(budgetId: string, month: string, threshold: 'warning_80' | 'exceeded_100'): string {
    return `budget_${budgetId}_${month}_${threshold}`;
  }

  /**
   * Evaluates active recurring subscriptions and sends reminders for bills due today.
   * Uses stable IDs to ensure zero duplicate alerts upon restarts or repeated syncs.
   */
  async checkRecurringReminders(targetDate = getTodayDateString()): Promise<NotificationItem[]> {
    await this.init();
    if (!this.settings.recurringRemindersEnabled) return [];

    const recurring = await listRecurringUseCase();
    const generatedNotifications: NotificationItem[] = [];

    for (const item of recurring) {
      if (!item.isActive) continue;

      if (item.nextDueDate === targetDate) {
        const stableId = this.generateRecurringReminderId(item.id, targetDate);

        if (!this.isDelivered(stableId)) {
          const formattedAmount = `$${centsToDollars(item.amountCents)}`;
          const notification: NotificationItem = {
            id: stableId,
            title: 'Recurring Bill Due Today',
            body: `Your scheduled payment for ${item.title} (${formattedAmount}) is due today.`,
            type: 'RECURRING_REMINDER',
            createdAt: getUTCTimestamp(),
            data: { recurringId: item.id, dueDate: targetDate },
          };

          await this.markDelivered(stableId);
          this.dispatchNotification(notification);
          generatedNotifications.push(notification);
        }
      }
    }

    return generatedNotifications;
  }

  /**
   * Evaluates monthly budget limits and dispatches alerts for >=80% and >100% states.
   * Deduplicates per month and threshold condition.
   */
  async checkBudgetAlerts(month = getCurrentMonthString()): Promise<NotificationItem[]> {
    await this.init();
    if (!this.settings.budgetAlertsEnabled) return [];

    const overview = await getMonthlyBudgetOverviewUseCase(month);
    const generatedNotifications: NotificationItem[] = [];

    // Check overall budget
    if (overview.overallBudget) {
      const { budget, percentageUsed } = overview.overallBudget;
      const budgetId = budget.id;

      if (percentageUsed >= 100) {
        const stableId = this.generateBudgetAlertId(budgetId, month, 'exceeded_100');
        if (!this.isDelivered(stableId)) {
          const notification: NotificationItem = {
            id: stableId,
            title: 'Budget Limit Exceeded',
            body: `You have exceeded your overall monthly budget by ${(percentageUsed - 100).toFixed(0)}%.`,
            type: 'BUDGET_ALERT',
            createdAt: getUTCTimestamp(),
            data: { budgetId, month, percentageUsed },
          };
          await this.markDelivered(stableId);
          this.dispatchNotification(notification);
          generatedNotifications.push(notification);
        }
      } else if (percentageUsed >= 80) {
        const stableId = this.generateBudgetAlertId(budgetId, month, 'warning_80');
        if (!this.isDelivered(stableId)) {
          const notification: NotificationItem = {
            id: stableId,
            title: 'Approaching Budget Limit',
            body: `You have used ${percentageUsed.toFixed(0)}% of your monthly budget.`,
            type: 'BUDGET_ALERT',
            createdAt: getUTCTimestamp(),
            data: { budgetId, month, percentageUsed },
          };
          await this.markDelivered(stableId);
          this.dispatchNotification(notification);
          generatedNotifications.push(notification);
        }
      }
    }

    return generatedNotifications;
  }

  addListener(listener: (notification: NotificationItem) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private dispatchNotification(notification: NotificationItem): void {
    for (const listener of this.listeners) {
      try {
        listener(notification);
      } catch {
        // Handled
      }
    }
  }

  /**
   * Resets delivered registry (useful for testing and account resets).
   */
  async resetDelivered(): Promise<void> {
    this.deliveredIds.clear();
    await AsyncStorage.removeItem(DELIVERED_NOTIFICATIONS_KEY);
  }
}
