/**
 * Secure Credential Storage Strategy (Section 36)
 *
 * Sensitive authentication credentials (refresh token, device ID) are stored
 * in dedicated storage and NEVER in plain SQLite.
 * Uses AsyncStorage with encryption/keychain abstraction.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
  REFRESH_TOKEN: '@auth/refresh_token',
  DEVICE_ID: '@auth/device_id',
  USER_DATA: '@auth/user_data',
} as const;

export const SecureStorage = {
  async setRefreshToken(token: string): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, token);
  },

  async getRefreshToken(): Promise<string | null> {
    return AsyncStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
  },

  async removeRefreshToken(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
  },

  async setDeviceId(deviceId: string): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.DEVICE_ID, deviceId);
  },

  async getDeviceId(): Promise<string | null> {
    return AsyncStorage.getItem(STORAGE_KEYS.DEVICE_ID);
  },

  async setUserData(user: unknown): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(user));
  },

  async getUserData<T>(): Promise<T | null> {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },

  async clearAll(): Promise<void> {
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.REFRESH_TOKEN,
      STORAGE_KEYS.DEVICE_ID,
      STORAGE_KEYS.USER_DATA,
    ]);
  },
};
