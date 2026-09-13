import { describe, it, expect, beforeEach } from 'vitest';
import {
  clearAuthTokens,
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
} from '@/utils/tokenStorage';

describe('tokenStorage utility', () => {
  beforeEach(() => {
    clearAuthTokens();
  });

  it('keeps short-lived access token strictly in-memory', () => {
    setAccessToken('in_memory_jwt_access_token');
    expect(getAccessToken()).toBe('in_memory_jwt_access_token');
    // Verify NOT written to localStorage (preventing XSS harvesting)
    expect(localStorage.getItem('ef_access_token')).toBeNull();
  });

  it('stores refresh token in localStorage for session restoration', () => {
    setRefreshToken('refresh_token_xyz');
    expect(getRefreshToken()).toBe('refresh_token_xyz');
    expect(localStorage.getItem('ef_refresh_token')).toBe('refresh_token_xyz');
  });

  it('clears all tokens completely on logout', () => {
    setAccessToken('access_to_clear');
    setRefreshToken('refresh_to_clear');
    clearAuthTokens();

    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
    expect(localStorage.getItem('ef_refresh_token')).toBeNull();
  });
});
