import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MobileUser, mobileAuthApi } from '../../api/services/mobileAuthApi';
import { SecureStorage } from '../../api/client/secureStorage';
import { tokenStore } from '../../api/client/mobileApiClient';
import { DatabaseManager } from '../../database/sqlite/DatabaseManager';
import { SQLiteCategoryRepository } from '../../database/repositories/SQLiteCategoryRepository';
import { SyncEngine } from '../../sync/engine/SyncEngine';
import { FCMPushService } from '../../services/fcmPushService';
import { generateUUID } from '../../utils/uuid';
import { DataEvents } from '../../database/sqlite/DataEvents';

const ONBOARDING_KEY_PREFIX = '@onboarding/completed_';

interface AuthContextType {
  user: MobileUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isOnboardingCompleted: boolean;
  markOnboardingComplete: () => void;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, baseCurrency?: string) => Promise<void>;
  loginWithPhone: (idToken: string, baseCurrency?: string) => Promise<void>;
  loginWithPhoneOtp: (phoneNumber: string, otp: string, baseCurrency?: string) => Promise<void>;
  logout: () => Promise<void>;
  updateBaseCurrency: (currency: string) => Promise<void>;
  pendingDeepLink: string | null;
  setPendingDeepLink: (url: string | null) => void;
  consumePendingDeepLink: () => string | null;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  isOnboardingCompleted: false,
  markOnboardingComplete: () => {},
  login: async () => {},
  register: async () => {},
  loginWithPhone: async () => {},
  loginWithPhoneOtp: async () => {},
  logout: async () => {},
  updateBaseCurrency: async () => {},
  pendingDeepLink: null,
  setPendingDeepLink: () => {},
  consumePendingDeepLink: () => null,
});


const isTestPhoneNumber = (phone?: string | null): boolean => {
  if (!phone) return false;
  return phone.replace(/\D/g, '').endsWith('9999999999');
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<MobileUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnboardingCompleted, setIsOnboardingCompleted] = useState(false);
  const [pendingDeepLink, setPendingDeepLink] = useState<string | null>(null);

  const consumePendingDeepLink = () => {
    const link = pendingDeepLink;
    if (link) setPendingDeepLink(null);
    return link;
  };

  const markOnboardingComplete = () => {
    setIsOnboardingCompleted(true);
  };

  // Initialize session and SQLite on launch
  useEffect(() => {
    async function bootstrap() {
      try {
        // Ensure device ID exists
        let deviceId = await SecureStorage.getDeviceId();
        if (!deviceId) {
          deviceId = generateUUID();
          await SecureStorage.setDeviceId(deviceId);
        }

        // Initialize local SQLite
        await DatabaseManager.getInstance().initialize();

        // Seed default categories
        const catRepo = new SQLiteCategoryRepository();
        await catRepo.seedDefaults();

        // Check for cached user & refresh token
        const cachedUser = await SecureStorage.getUserData<MobileUser>();
        const refreshToken = await SecureStorage.getRefreshToken();

        if (cachedUser && refreshToken) {
          // Test user 9999999999 always sees onboarding on each app entry
          let onboardingDone = false;
          if (isTestPhoneNumber(cachedUser.phoneNumber)) {
            await AsyncStorage.removeItem(`${ONBOARDING_KEY_PREFIX}${cachedUser.id}`);
            onboardingDone = false;
          } else {
            const onboardingFlag = await AsyncStorage.getItem(`${ONBOARDING_KEY_PREFIX}${cachedUser.id}`);
            onboardingDone = !!onboardingFlag;
          }

          setIsOnboardingCompleted(onboardingDone);
          setUser(cachedUser);
          DatabaseManager.getInstance().setCurrentUser(cachedUser.id);
          SyncEngine.getInstance().init();
          SyncEngine.getInstance().sync().catch(() => {});
          FCMPushService.getInstance().registerDevicePushToken().catch(() => {});
        }
      } catch (err) {
        // Fail gracefully
      } finally {
        setIsLoading(false);
      }
    }

    bootstrap();
  }, []);

  const login = async (email: string, password: string) => {
    let deviceId = await SecureStorage.getDeviceId();
    if (!deviceId) {
      deviceId = generateUUID();
      await SecureStorage.setDeviceId(deviceId);
    }

    const res = await mobileAuthApi.login(email, password, deviceId);
    tokenStore.setAccessToken(res.tokens.accessToken);
    await SecureStorage.setRefreshToken(res.tokens.refreshToken);
    await SecureStorage.setUserData(res.user);

    const flag = await AsyncStorage.getItem(`${ONBOARDING_KEY_PREFIX}${res.user.id}`);
    setIsOnboardingCompleted(!!flag);
    setUser(res.user);
    DatabaseManager.getInstance().setCurrentUser(res.user.id);
    SyncEngine.getInstance().init();
    SyncEngine.getInstance().sync().catch(() => {});
    FCMPushService.getInstance().registerDevicePushToken().catch(() => {});
  };

  const register = async (email: string, password: string, baseCurrency = 'USD') => {
    let deviceId = await SecureStorage.getDeviceId();
    if (!deviceId) {
      deviceId = generateUUID();
      await SecureStorage.setDeviceId(deviceId);
    }

    const res = await mobileAuthApi.register(email, password, deviceId, baseCurrency);
    tokenStore.setAccessToken(res.tokens.accessToken);
    await SecureStorage.setRefreshToken(res.tokens.refreshToken);
    await SecureStorage.setUserData(res.user);

    const flag = await AsyncStorage.getItem(`${ONBOARDING_KEY_PREFIX}${res.user.id}`);
    setIsOnboardingCompleted(!!flag);
    setUser(res.user);
    DatabaseManager.getInstance().setCurrentUser(res.user.id);
    SyncEngine.getInstance().init();
    SyncEngine.getInstance().sync().catch(() => {});
    FCMPushService.getInstance().registerDevicePushToken().catch(() => {});
  };

  const loginWithPhone = async (idToken: string, baseCurrency = 'INR') => {
    let deviceId = await SecureStorage.getDeviceId();
    if (!deviceId) {
      deviceId = generateUUID();
      await SecureStorage.setDeviceId(deviceId);
    }

    const res = await mobileAuthApi.loginWithPhone(idToken, deviceId, baseCurrency);
    tokenStore.setAccessToken(res.tokens.accessToken);
    await SecureStorage.setRefreshToken(res.tokens.refreshToken);
    await SecureStorage.setUserData(res.user);

    let onboardingDone = false;
    if (isTestPhoneNumber(res.user.phoneNumber)) {
      await AsyncStorage.removeItem(`${ONBOARDING_KEY_PREFIX}${res.user.id}`);
      onboardingDone = false;
    } else {
      const flag = await AsyncStorage.getItem(`${ONBOARDING_KEY_PREFIX}${res.user.id}`);
      onboardingDone = !!flag;
    }
    setIsOnboardingCompleted(onboardingDone);
    setUser(res.user);
    DatabaseManager.getInstance().setCurrentUser(res.user.id);
    SyncEngine.getInstance().init();
    SyncEngine.getInstance().sync().catch(() => {});
    FCMPushService.getInstance().registerDevicePushToken().catch(() => {});
  };

  const loginWithPhoneOtp = async (phoneNumber: string, otp: string, baseCurrency = 'INR') => {
    let deviceId = await SecureStorage.getDeviceId();
    if (!deviceId) {
      deviceId = generateUUID();
      await SecureStorage.setDeviceId(deviceId);
    }

    const res = await mobileAuthApi.verifyPhoneOtp(phoneNumber, otp, deviceId, baseCurrency);
    tokenStore.setAccessToken(res.tokens.accessToken);
    await SecureStorage.setRefreshToken(res.tokens.refreshToken);
    await SecureStorage.setUserData(res.user);

    let onboardingDone = false;
    if (isTestPhoneNumber(phoneNumber) || isTestPhoneNumber(res.user.phoneNumber)) {
      await AsyncStorage.removeItem(`${ONBOARDING_KEY_PREFIX}${res.user.id}`);
      onboardingDone = false;
    } else {
      const flag = await AsyncStorage.getItem(`${ONBOARDING_KEY_PREFIX}${res.user.id}`);
      onboardingDone = !!flag;
    }
    setIsOnboardingCompleted(onboardingDone);
    setUser(res.user);
    DatabaseManager.getInstance().setCurrentUser(res.user.id);
    SyncEngine.getInstance().init();
    SyncEngine.getInstance().sync().catch(() => {});
    FCMPushService.getInstance().registerDevicePushToken().catch(() => {});
  };

  const logout = async () => {
    try {
      if (user && isTestPhoneNumber(user.phoneNumber)) {
        await AsyncStorage.removeItem(`${ONBOARDING_KEY_PREFIX}${user.id}`);
      }
      const refreshToken = await SecureStorage.getRefreshToken();
      const deviceId = await SecureStorage.getDeviceId();
      if (refreshToken && deviceId) {
        await mobileAuthApi.logout(refreshToken, deviceId).catch(() => {});
      }
    } finally {
      tokenStore.setAccessToken(null);
      await SecureStorage.clearAll();
      setUser(null);
      setIsOnboardingCompleted(false);
      DatabaseManager.getInstance().setCurrentUser(null);
      SyncEngine.getInstance().reset();
      FCMPushService.getInstance().unregisterDevicePushToken().catch(() => {});
    }
  };

  const updateBaseCurrency = async (newCurrency: string) => {
    if (!user) return;
    const updatedUser: MobileUser = { ...user, baseCurrency: newCurrency };
    setUser(updatedUser);
    await SecureStorage.setUserData(updatedUser);
    DataEvents.notify('EXPENSES_CHANGED');
    DataEvents.notify('INCOME_CHANGED');
    DataEvents.notify('BUDGETS_CHANGED');
    // Also update server profile in background if online
    mobileAuthApi.updateProfile({ baseCurrency: newCurrency }).catch(() => {});
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        isOnboardingCompleted,
        markOnboardingComplete,
        login,
        register,
        loginWithPhone,
        loginWithPhoneOtp,
        logout,
        updateBaseCurrency,
        pendingDeepLink,
        setPendingDeepLink,
        consumePendingDeepLink,
      }}
    >
      {children}
    </AuthContext.Provider>
  );

};

export const useAuth = (): AuthContextType => useContext(AuthContext);


