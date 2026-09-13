import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import {
  clearAuthTokens,
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
} from '@/utils/tokenStorage';
import { getOrCreateDeviceId } from '@/utils/device';
import { TokenResponse } from '@/types/auth';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Single callback listener for when authentication expires completely
let onAuthExpiredCallback: (() => void) | null = null;

export function setOnAuthExpired(callback: (() => void) | null): void {
  onAuthExpiredCallback = callback;
}

// Request Interceptor: Attach in-memory access token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getAccessToken();
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle 401 & Concurrent Refresh Token Rotation
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // If no response or not a 401 error, reject immediately
    if (!error.response || error.response.status !== 401 || !originalRequest) {
      return Promise.reject(error);
    }

    // Do NOT attempt refresh on login, register, or refresh endpoints themselves!
    const isAuthRoute =
      originalRequest.url?.includes('/auth/login') ||
      originalRequest.url?.includes('/auth/register') ||
      originalRequest.url?.includes('/auth/refresh');

    if (isAuthRoute || originalRequest._retry) {
      return Promise.reject(error);
    }

    const currentRefreshToken = getRefreshToken();
    const deviceId = getOrCreateDeviceId();

    // If we have no refresh token, session is definitely unauthenticated
    if (!currentRefreshToken) {
      clearAuthTokens();
      onAuthExpiredCallback?.();
      return Promise.reject(error);
    }

    // If another request is already refreshing, queue this request
    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((newAccessToken) => {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return apiClient(originalRequest);
        })
        .catch((err) => Promise.reject(err));
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      // Use raw axios instance to prevent recursive interceptor invocation
      const refreshResponse = await axios.post<TokenResponse>(
        `${BASE_URL}/auth/refresh/`,
        {
          refreshToken: currentRefreshToken,
          deviceId: deviceId,
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000,
        }
      );

      const { accessToken: newAccessToken, refreshToken: newRefreshToken } = refreshResponse.data;

      // Update tokens in memory and storage (Refresh Token Rotation per Step 4)
      setAccessToken(newAccessToken);
      setRefreshToken(newRefreshToken);

      // Drain queued requests with the fresh token
      processQueue(null, newAccessToken);

      // Retry original request with new access token
      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
      return apiClient(originalRequest);
    } catch (refreshError) {
      // Refresh token is revoked, expired, or rejected (e.g. replay attack detected)
      processQueue(refreshError, null);
      clearAuthTokens();
      onAuthExpiredCallback?.();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);
