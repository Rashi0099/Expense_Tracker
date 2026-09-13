import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  clearAuthTokens,
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
  listenToStorageEvents,
} from '@/utils/tokenStorage';
import { apiClient } from '@/services/api/client';

describe('Web Frontend Security Audit Suite', () => {
  beforeEach(() => {
    clearAuthTokens();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('verifies access token is never leaked to persistent browser storage', () => {
    const sensitiveJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.sensitivePayload.fakeSig';
    setAccessToken(sensitiveJwt);

    // Stored in RAM
    expect(getAccessToken()).toBe(sensitiveJwt);

    // Never leaked to localStorage or sessionStorage (protects against XSS token harvesting)
    expect(localStorage.getItem('access_token')).toBeNull();
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('jwt')).toBeNull();
    expect(localStorage.getItem('ef_access_token')).toBeNull();
    expect(sessionStorage.getItem('access_token')).toBeNull();
  });

  it('synchronizes logout across multiple tabs to prevent ghost session hijack', () => {
    const onLogoutMock = vi.fn();
    const cleanup = listenToStorageEvents(onLogoutMock);

    // Simulate another browser tab logging out (setting ef_refresh_token to null)
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'ef_refresh_token',
        newValue: null,
      })
    );

    expect(onLogoutMock).toHaveBeenCalledTimes(1);
    expect(getAccessToken()).toBeNull();

    cleanup();
  });

  it('attaches Bearer authorization header to outgoing API requests when authenticated', async () => {
    setAccessToken('valid_authenticated_token');

    let capturedHeaders: any;
    const originalAdapter = apiClient.defaults.adapter;
    apiClient.defaults.adapter = async (config: any): Promise<any> => {
      capturedHeaders = config.headers;
      return {
        data: { ok: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      };
    };

    try {
      await apiClient.get('/security-test/');
      expect(capturedHeaders?.Authorization).toBe('Bearer valid_authenticated_token');
    } finally {
      apiClient.defaults.adapter = originalAdapter;
    }
  });

  it('clears all session state on complete auth expiration', () => {
    setAccessToken('active_access_token');
    setRefreshToken('active_refresh_token');

    clearAuthTokens();

    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
    expect(localStorage.getItem('ef_refresh_token')).toBeNull();
  });
});
