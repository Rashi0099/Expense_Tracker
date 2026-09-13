import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios, { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { apiClient, setOnAuthExpired } from '@/services/api/client';
import {
  clearAuthTokens,
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
} from '@/utils/tokenStorage';

describe('apiClient interceptors & refresh flow', () => {
  const originalAdapter = apiClient.defaults.adapter;

  beforeEach(() => {
    clearAuthTokens();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    apiClient.defaults.adapter = originalAdapter;
  });

  it('attaches in-memory access token to outgoing requests', async () => {
    setAccessToken('jwt_bearer_token_123');

    let capturedHeaders: InternalAxiosRequestConfig['headers'] | undefined;
    apiClient.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      capturedHeaders = config.headers;
      return {
        data: { status: 'ok' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      };
    };

    await apiClient.get('/test-endpoint/');
    expect(capturedHeaders?.Authorization).toBe('Bearer jwt_bearer_token_123');
  });

  it('handles token refresh when receiving 401 and updates in-memory token', async () => {
    setAccessToken('expired_access_token');
    setRefreshToken('valid_refresh_token');

    let requestCount = 0;
    apiClient.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      requestCount++;
      if (requestCount === 1) {
        // First request receives 401 Unauthorized
        const err = new axios.AxiosError('Request failed with status code 401', 'ERR_BAD_REQUEST', config, undefined, {
          status: 401,
          data: {},
          statusText: 'Unauthorized',
          headers: {},
          config,
        });
        throw err;
      }
      // Retried request succeeds
      return {
        data: { success: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      };
    };

    // Mock direct axios.post for refresh endpoint
    vi.spyOn(axios, 'post').mockResolvedValueOnce({
      data: {
        accessToken: 'new_access_token_456',
        refreshToken: 'new_refresh_token_789',
        expiresIn: 900,
      },
    });

    const response = await apiClient.get('/expenses/');
    expect(response.data).toEqual({ success: true });
    expect(getAccessToken()).toBe('new_access_token_456');
    expect(getRefreshToken()).toBe('new_refresh_token_789');
  });

  it('clears tokens and calls onAuthExpired when refresh fails', async () => {
    setAccessToken('expired_token');
    setRefreshToken('revoked_refresh_token');

    const authExpiredSpy = vi.fn();
    setOnAuthExpired(authExpiredSpy);

    apiClient.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      const err = new axios.AxiosError('Request failed with status code 401', 'ERR_BAD_REQUEST', config, undefined, {
        status: 401,
        data: {},
        statusText: 'Unauthorized',
        headers: {},
        config,
      });
      throw err;
    };

    vi.spyOn(axios, 'post').mockRejectedValueOnce(new Error('Revoked token'));

    await expect(apiClient.get('/expenses/')).rejects.toThrow();
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
    expect(authExpiredSpy).toHaveBeenCalled();
  });
});
