import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FCMPushService } from '../services/fcmPushService';
import { SecureStorage } from '../api/client/secureStorage';
import { mobileApiClient } from '../api/client/mobileApiClient';
import { NotificationService } from '../services/notificationService';

const storage: Record<string, string> = {};
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    setItem: vi.fn(async (key: string, value: string) => {
      storage[key] = value;
    }),
    getItem: vi.fn(async (key: string) => storage[key] ?? null),
    removeItem: vi.fn(async (key: string) => {
      delete storage[key];
    }),
    clear: vi.fn(async () => {
      Object.keys(storage).forEach((k) => delete storage[k]);
    }),
  },
}));

describe('Mobile Cloud Push Notifications Service (FCM / APNs)', () => {
  let fcmService: FCMPushService;
  const testDeviceId = 'test_dev_uuid_12345';

  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.spyOn(mobileApiClient, 'post').mockResolvedValue({ data: { status: 'SUCCESS' } });
    Object.keys(storage).forEach((k) => delete storage[k]);
    await SecureStorage.setDeviceId(testDeviceId);
    fcmService = FCMPushService.getInstance();
    await fcmService.unregisterDevicePushToken();
  });

  it('registers FCM push token with backend and caches locally', async () => {
    const postSpy = vi.spyOn(mobileApiClient, 'post').mockResolvedValue({ data: { status: 'SUCCESS' } });

    const token = await fcmService.registerDevicePushToken('fcm_token_sample_abc');
    expect(token).toBe('fcm_token_sample_abc');

    // Verify API called with deviceId and pushToken
    expect(postSpy).toHaveBeenCalledTimes(1);
    expect(postSpy).toHaveBeenCalledWith('/notifications/push-token/', {
      deviceId: testDeviceId,
      pushToken: 'fcm_token_sample_abc',
    });

    // Subsequent call with same token must be cached (zero redundant network requests)
    await fcmService.registerDevicePushToken('fcm_token_sample_abc');
    expect(postSpy).toHaveBeenCalledTimes(1);
  });

  it('dispatches incoming remote push messages to in-app NotificationService', () => {
    const notifService = NotificationService.getInstance();
    const listenerSpy = vi.fn();
    const unsub = notifService.addListener(listenerSpy);

    const remotePayload = {
      title: 'Recurring Bill Due',
      body: 'Your Spotify bill is due today',
      data: {
        type: 'RECURRING_DUE',
        recurringId: 'rec_123',
      },
    };

    const item = fcmService.handleIncomingRemoteNotification(remotePayload);
    expect(item.title).toBe('Recurring Bill Due');
    expect(item.type).toBe('RECURRING_REMINDER');
    expect(listenerSpy).toHaveBeenCalledTimes(1);
    expect(listenerSpy.mock.calls[0][0].title).toBe('Recurring Bill Due');

    unsub();
  });

  it('routes notification tap events directly to relevant screens via deep links', () => {
    const navigateMock = vi.fn();

    // 1. Recurring Due Notification -> Navigates to RecurringExpenses
    const handledRecurring = fcmService.handleNotificationTap(
      { type: 'RECURRING_DUE', recurringId: 'rec_abc' },
      navigateMock
    );
    expect(handledRecurring).toBe(true);
    expect(navigateMock).toHaveBeenCalledWith('RecurringExpenses', { recurringId: 'rec_abc' });

    // 2. Budget Alert Notification -> Navigates to Budgets
    const handledBudget = fcmService.handleNotificationTap(
      { type: 'BUDGET_WARNING', budgetId: 'bud_xyz' },
      navigateMock
    );
    expect(handledBudget).toBe(true);
    expect(navigateMock).toHaveBeenCalledWith('Budgets', { budgetId: 'bud_xyz' });

    // 3. Quick Expense Deep Link
    const handledExpense = fcmService.handleNotificationTap(
      { type: 'QUICK_EXPENSE', deepLink: 'expense-tracker://expense/new' },
      navigateMock
    );
    expect(handledExpense).toBe(true);
    expect(navigateMock).toHaveBeenCalledWith('QuickExpense');
  });

  it('clears token cache upon logout via unregisterDevicePushToken', async () => {
    await fcmService.registerDevicePushToken('active_push_token_xyz');
    expect(storage['@auth/fcm_push_token']).toBe('active_push_token_xyz');

    await fcmService.unregisterDevicePushToken();
    expect(storage['@auth/fcm_push_token']).toBeUndefined();
  });
});
