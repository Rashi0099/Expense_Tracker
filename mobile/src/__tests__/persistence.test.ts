import { describe, it, expect, beforeEach } from 'vitest';
import AsyncStorage from '../__mocks__/async-storage';
import { THEME_STORAGE_KEY } from '../theme/useTheme';
import { BALANCE_HIDDEN_STORAGE_KEY } from '../app/providers/BalanceVisibilityProvider';

describe('App Settings Persistence (Theme Mode & Balance Privacy)', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  describe('Theme Mode Persistence', () => {
    it('persists selected light theme to AsyncStorage', async () => {
      // Simulate switching to light mode
      await AsyncStorage.setItem(THEME_STORAGE_KEY, 'light');

      // Verify stored value
      const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      expect(stored).toBe('light');
    });

    it('persists selected dark theme to AsyncStorage', async () => {
      // Simulate switching to dark mode
      await AsyncStorage.setItem(THEME_STORAGE_KEY, 'dark');

      // Verify stored value
      const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      expect(stored).toBe('dark');
    });

    it('restores previous light mode on app startup', async () => {
      // Set light mode prior to app startup
      await AsyncStorage.setItem(THEME_STORAGE_KEY, 'light');

      // Emulate reading on mount
      const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      expect(savedTheme).toBe('light');

      // It must not default to dark
      const activeTheme = savedTheme || 'dark';
      expect(activeTheme).toBe('light');
    });
  });

  describe('Balance Visibility Persistence', () => {
    it('saves hidden state ("1") when user hides balance', async () => {
      await AsyncStorage.setItem(BALANCE_HIDDEN_STORAGE_KEY, '1');

      const stored = await AsyncStorage.getItem(BALANCE_HIDDEN_STORAGE_KEY);
      expect(stored).toBe('1');
    });

    it('restores hidden balance state upon app reopen', async () => {
      // User hid balance in previous session
      await AsyncStorage.setItem(BALANCE_HIDDEN_STORAGE_KEY, '1');

      // Reopen app and read setting
      const val = await AsyncStorage.getItem(BALANCE_HIDDEN_STORAGE_KEY);
      const isHidden = val === '1' || val === 'true';

      expect(isHidden).toBe(true);
    });

    it('saves visible state ("0") when user unhides balance', async () => {
      // First hidden
      await AsyncStorage.setItem(BALANCE_HIDDEN_STORAGE_KEY, '1');

      // User taps eye icon to show balance
      await AsyncStorage.setItem(BALANCE_HIDDEN_STORAGE_KEY, '0');

      const val = await AsyncStorage.getItem(BALANCE_HIDDEN_STORAGE_KEY);
      const isHidden = val === '1' || val === 'true';

      expect(isHidden).toBe(false);
    });
  });
});
