import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { MobileUser, mobileAuthApi } from '../../api/services/mobileAuthApi';
import { SecureStorage } from '../../api/client/secureStorage';
import { tokenStore } from '../../api/client/mobileApiClient';
import { DatabaseManager } from '../../database/sqlite/DatabaseManager';
import { SQLiteCategoryRepository } from '../../database/repositories/SQLiteCategoryRepository';
import { SyncEngine } from '../../sync/engine/SyncEngine';
import { FCMPushService } from '../../services/fcmPushService';
import { generateUUID } from '../../utils/uuid';

interface AuthContextType {
  user: MobileUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, baseCurrency?: string) => Promise<void>;
  logout: () => Promise<void>;
  pendingDeepLink: string | null;
  setPendingDeepLink: (url: string | null) => void;
  consumePendingDeepLink: () => string | null;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
  pendingDeepLink: null,
  setPendingDeepLink: () => {},
  consumePendingDeepLink: () => null,
});

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<MobileUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingDeepLink, setPendingDeepLink] = useState<string | null>(null);

  const consumePendingDeepLink = () => {
    const link = pendingDeepLink;
    if (link) setPendingDeepLink(null);
    return link;
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

    setUser(res.user);
    DatabaseManager.getInstance().setCurrentUser(res.user.id);
    SyncEngine.getInstance().init();
    SyncEngine.getInstance().sync().catch(() => {});
    FCMPushService.getInstance().registerDevicePushToken().catch(() => {});
  };

  const logout = async () => {
    try {
      const refreshToken = await SecureStorage.getRefreshToken();
      const deviceId = await SecureStorage.getDeviceId();
      if (refreshToken && deviceId) {
        await mobileAuthApi.logout(refreshToken, deviceId).catch(() => {});
      }
    } finally {
      tokenStore.setAccessToken(null);
      await SecureStorage.clearAll();
      setUser(null);
      DatabaseManager.getInstance().setCurrentUser(null);
      SyncEngine.getInstance().reset();
      FCMPushService.getInstance().unregisterDevicePushToken().catch(() => {});
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
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
