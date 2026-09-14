/**
 * Daily Expense Reminder Service
 *
 * Coordinates 3x daily notifications (Morning 9 AM, Afternoon 2 PM, Night 9 PM)
 * to remind the user to record their daily expenses.
 * Bridges to native Android AlarmManager and NotificationManager.
 */

import { NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { ReminderNotificationModule } = NativeModules;
const DAILY_REMINDERS_KEY = '@settings/daily_reminders_enabled';

export type ReminderSlot = 'MORNING' | 'AFTERNOON' | 'NIGHT';

export class ReminderService {
  private static instance: ReminderService;
  private isEnabled = true;
  private isInitialized = false;

  static getInstance(): ReminderService {
    if (!ReminderService.instance) {
      ReminderService.instance = new ReminderService();
    }
    return ReminderService.instance;
  }

  /**
   * Initializes reminder service, loads user preferences, and ensures alarms are scheduled.
   */
  async init(): Promise<void> {
    if (this.isInitialized) return;

    try {
      const stored = await AsyncStorage.getItem(DAILY_REMINDERS_KEY);
      if (stored !== null) {
        this.isEnabled = JSON.parse(stored);
      } else {
        this.isEnabled = true; // Enabled by default
        await AsyncStorage.setItem(DAILY_REMINDERS_KEY, JSON.stringify(true));
      }

      if (this.isEnabled && Platform.OS === 'android' && ReminderNotificationModule) {
        await ReminderNotificationModule.scheduleDailyReminders();
      }
    } catch (e) {
      console.warn('[ReminderService] Failed to initialize daily reminders:', e);
    } finally {
      this.isInitialized = true;
    }
  }

  isDailyRemindersEnabled(): boolean {
    return this.isEnabled;
  }

  async setDailyRemindersEnabled(enabled: boolean): Promise<void> {
    this.isEnabled = enabled;
    try {
      await AsyncStorage.setItem(DAILY_REMINDERS_KEY, JSON.stringify(enabled));

      if (Platform.OS === 'android' && ReminderNotificationModule) {
        if (enabled) {
          await ReminderNotificationModule.scheduleDailyReminders();
        } else {
          await ReminderNotificationModule.cancelReminders();
        }
      }
    } catch (e) {
      console.warn('[ReminderService] Failed to toggle daily reminders:', e);
    }
  }

  /**
   * Dispatches an immediate test reminder for verification.
   */
  async sendTestNotification(slot: ReminderSlot = 'NIGHT'): Promise<boolean> {
    if (Platform.OS === 'android' && ReminderNotificationModule) {
      try {
        await ReminderNotificationModule.sendTestNotification(slot);
        return true;
      } catch (e) {
        console.warn('[ReminderService] Test notification failed:', e);
        return false;
      }
    }
    return false;
  }
}

export const reminderService = ReminderService.getInstance();
