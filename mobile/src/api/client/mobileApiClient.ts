import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { ENV } from '../../app/config/env';
import { SecureStorage } from './secureStorage';

let inMemoryAccessToken: string | null = null;

export const tokenStore = {
  getAccessToken: () => inMemoryAccessToken,
  setAccessToken: (token: string | null) => {
    inMemoryAccessToken = token;
  },
};

export const mobileApiClient: AxiosInstance = axios.create({
  baseURL: ENV.API_BASE_URL,
  timeout: ENV.TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// Request Interceptor: Attach in-memory Bearer token
mobileApiClient.interceptors.request.use(
  async (config) => {
    const token = tokenStore.getAccessToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle 401 & token refresh
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

mobileApiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${token}`;
          }
          return mobileApiClient(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = await SecureStorage.getRefreshToken();
        const deviceId = await SecureStorage.getDeviceId();

        if (!refreshToken || !deviceId) {
          throw new Error('No refresh token or device ID available.');
        }

        const refreshRes = await axios.post<{
          accessToken: string;
          refreshToken: string;
        }>(`${ENV.API_BASE_URL}/auth/refresh/`, {
          refreshToken,
          deviceId,
        });

        const newAccessToken = refreshRes.data.accessToken;
        const newRefreshToken = refreshRes.data.refreshToken;

        tokenStore.setAccessToken(newAccessToken);
        await SecureStorage.setRefreshToken(newRefreshToken);

        processQueue(null, newAccessToken);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        }
        return mobileApiClient(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        tokenStore.setAccessToken(null);
        await SecureStorage.clearAll();
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
