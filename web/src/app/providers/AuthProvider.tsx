import React, { useEffect, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/services/api/authApi';
import { setOnAuthExpired } from '@/services/api/client';
import {
  clearAuthTokens,
  getRefreshToken,
  listenToStorageEvents,
  setAccessToken,
  setRefreshToken,
} from '@/utils/tokenStorage';
import { getOrCreateDeviceId } from '@/utils/device';
import { parseApiError } from '@/utils/error';
import { AuthStatus, LoginCredentials, PhoneAuthPayload, RegisterCredentials, User } from '@/types/auth';
import { AuthContext } from './AuthContext';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>('INITIALIZING');
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Clean local session and clear private query cache
  const performLocalLogout = useCallback(() => {
    clearAuthTokens();
    queryClient.clear();
    setUser(null);
    setStatus('UNAUTHENTICATED');
    setError(null);
  }, [queryClient]);

  // Handle server logout & local cleanup
  const logout = useCallback(async () => {
    const refreshToken = getRefreshToken();
    const deviceId = getOrCreateDeviceId();
    if (refreshToken) {
      try {
        await authApi.logout(refreshToken, deviceId);
      } catch {
        // Continue with local cleanup even if server request fails
      }
    }
    performLocalLogout();
  }, [performLocalLogout]);

  // Session restoration on app boot
  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      const refreshToken = getRefreshToken();
      if (!refreshToken) {
        if (isMounted) setStatus('UNAUTHENTICATED');
        return;
      }

      try {
        const deviceId = getOrCreateDeviceId();
        // Restore session via refresh rotation
        const tokenData = await authApi.refresh(refreshToken, deviceId);
        setAccessToken(tokenData.accessToken);
        setRefreshToken(tokenData.refreshToken);

        // Retrieve current authoritative user profile
        const userProfile = await authApi.getCurrentUser();
        if (isMounted) {
          setUser(userProfile);
          setStatus('AUTHENTICATED');
        }
      } catch {
        if (isMounted) {
          performLocalLogout();
        }
      }
    };

    initializeAuth();

    // Wire up token expiration from central API client
    setOnAuthExpired(() => {
      performLocalLogout();
    });

    // Wire up multi-tab synchronization
    const unsubscribeStorage = listenToStorageEvents(() => {
      performLocalLogout();
    });

    return () => {
      isMounted = false;
      setOnAuthExpired(null);
      unsubscribeStorage();
    };
  }, [performLocalLogout]);

  // Login handler
  const login = async (credentials: LoginCredentials) => {
    setError(null);
    try {
      const authData = await authApi.login(credentials);
      setAccessToken(authData.tokens.accessToken);
      setRefreshToken(authData.tokens.refreshToken);
      setUser(authData.user);
      setStatus('AUTHENTICATED');
    } catch (err) {
      const apiErr = parseApiError(err);
      setError(apiErr.message);
      throw apiErr;
    }
  };

  // Register handler
  const register = async (credentials: RegisterCredentials) => {
    setError(null);
    try {
      const authData = await authApi.register(credentials);
      setAccessToken(authData.tokens.accessToken);
      setRefreshToken(authData.tokens.refreshToken);
      setUser(authData.user);
      setStatus('AUTHENTICATED');
    } catch (err) {
      const apiErr = parseApiError(err);
      setError(apiErr.message);
      throw apiErr;
    }
  };

  // Phone authentication handler (Login & Register in one via Firebase ID token)
  const loginWithPhone = async (payload: PhoneAuthPayload) => {
    setError(null);
    try {
      const authData = await authApi.loginWithPhone(payload);
      setAccessToken(authData.tokens.accessToken);
      setRefreshToken(authData.tokens.refreshToken);
      setUser(authData.user);
      setStatus('AUTHENTICATED');
    } catch (err) {
      const apiErr = parseApiError(err);
      setError(apiErr.message);
      throw apiErr;
    }
  };

  // Phone OTP authentication handler (Fast2SMS / Backend OTP)
  const loginWithPhoneOtp = async (phoneNumber: string, otp: string, baseCurrency = 'INR') => {
    setError(null);
    try {
      const authData = await authApi.verifyPhoneOtp(phoneNumber, otp, baseCurrency);
      setAccessToken(authData.tokens.accessToken);
      setRefreshToken(authData.tokens.refreshToken);
      setUser(authData.user);
      setStatus('AUTHENTICATED');
    } catch (err) {
      const apiErr = parseApiError(err);
      setError(apiErr.message);
      throw apiErr;
    }
  };

  // Update current user profile (e.g. base currency)
  const updateUser = async (payload: { baseCurrency?: string }) => {
    const updated = await authApi.updateCurrentUser(payload);
    setUser(updated);
    queryClient.invalidateQueries({ queryKey: ['analytics'] });
    queryClient.invalidateQueries({ queryKey: ['budgets'] });
    return updated;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        status,
        error,
        login,
        register,
        loginWithPhone,
        loginWithPhoneOtp,
        updateUser,
        logout,
        isAuthenticated: status === 'AUTHENTICATED',
        isInitializing: status === 'INITIALIZING',
      }}
    >
      {children}
    </AuthContext.Provider>
  );

};

