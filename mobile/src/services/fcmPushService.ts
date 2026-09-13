/**
 * Cloud Push Notifications Service (Firebase Cloud Messaging / APNs)
 *
 * Manages device push registration with Django backend, handles incoming
 * remote alerts when app is closed or open, and routes deep-links.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { mobileApiClient } from '../api/client/mobileApiClient';
import { SecureStorage } from '../api/client/secureStorage';
import { NotificationService, NotificationItem } from './notificationService';
import { getUTCTimestamp } from '../utils/date';
import { logger } from '../utils/logger';

const FCM_TOKEN_STORAGE_KEY = '@auth/fcm_push_token';

export interface RemotePushPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export class FCMPushService {
  private static instance: FCMPushService;
  private currentToken: string | null = null;

  static getInstance(): FCMPushService {
    if (!FCMPushService.instance) {
      FCMPushService.instance = new FCMPushService();
    }
    return FCMPushService.instance;
  }

  /**
   * Registers the device's FCM push token with the Django backend.
   * If running in test or simulator without active native FCM, generates
   * a client token bound to the device UUID.
   */
  async registerDevicePushToken(providedToken?: string): Promise<string | null> {
    try {
      const deviceId = await SecureStorage.getDeviceId();
      if (!deviceId) return null;

      const token = providedToken || this.currentToken || `fcm_dev_${deviceId.slice(0, 8)}`;
      this.currentToken = token;

      // Check if already registered with backend
      const cachedToken = await AsyncStorage.getItem(FCM_TOKEN_STORAGE_KEY);
      if (cachedToken === token) {
        return token;
      }

      await mobileApiClient.post('/notifications/push-token/', {
        deviceId,
        pushToken: token,
      });

      await AsyncStorage.setItem(FCM_TOKEN_STORAGE_KEY, token);
      logger.info('FCM push token registered with server successfully.');
      return token;
    } catch (err: unknown) {
      logger.warn('Failed to register FCM push token with backend:', err);
      return null;
    }
  }

  /**
   * Clears push token cache upon logout.
   */
  async unregisterDevicePushToken(): Promise<void> {
    this.currentToken = null;
    try {
      await AsyncStorage.removeItem(FCM_TOKEN_STORAGE_KEY);
    } catch {
      // Handled
    }
  }

  /**
   * Dispatches incoming remote push messages to the in-app NotificationService.
   */
  handleIncomingRemoteNotification(payload: RemotePushPayload): NotificationItem {
    const notifService = NotificationService.getInstance();
    const type = (payload.data?.type as any) === 'BUDGET_WARNING' || (payload.data?.type as any) === 'BUDGET_EXCEEDED'
      ? 'BUDGET_ALERT'
      : 'RECURRING_REMINDER';

    const item: NotificationItem = {
      id: `remote_${Date.now()}`,
      title: payload.title,
      body: payload.body,
      type,
      createdAt: getUTCTimestamp(),
      data: payload.data,
    };

    // Forward to local listeners
    (notifService as any).dispatchNotification?.(item);
    return item;
  }

  /**
   * Handles user tapping on a notification, routing them directly
   * to the relevant screen (Deep Linking).
   */
  handleNotificationTap(
    data: Record<string, unknown>,
    navigate: (screen: string, params?: Record<string, unknown>) => void
  ): boolean {
    if (!data) return false;

    const type = data.type as string;
    const deepLink = data.deepLink as string;

    if (deepLink?.includes('/recurring') || type === 'RECURRING_DUE') {
      navigate('RecurringExpenses', { recurringId: data.recurringId });
      return true;
    }

    if (deepLink?.includes('/budgets') || type === 'BUDGET_WARNING' || type === 'BUDGET_EXCEEDED') {
      navigate('Budgets', { budgetId: data.budgetId });
      return true;
    }

    if (deepLink?.includes('/expense/new') || type === 'QUICK_EXPENSE') {
      navigate('QuickExpense');
      return true;
    }

    return false;
  }
}
