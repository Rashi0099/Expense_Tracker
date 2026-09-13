import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authApi } from '@/services/api/authApi';
import { apiClient } from '@/services/api/client';

describe('authApi endpoints', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('calls POST /auth/register/ with normalized payload', async () => {
    const mockPost = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
      data: {
        user: { id: 'usr_1', email: 'test@example.com', baseCurrency: 'USD', createdAt: '2026-09-13T00:00:00Z' },
        tokens: { accessToken: 'acc_1', refreshToken: 'ref_1', expiresIn: 900 },
      },
    });

    const res = await authApi.register({
      email: '  TEST@Example.com ',
      password: 'SecurePassword123!',
      baseCurrency: 'USD',
    });

    expect(mockPost).toHaveBeenCalledWith(
      '/auth/register/',
      expect.objectContaining({
        email: 'test@example.com',
        password: 'SecurePassword123!',
        baseCurrency: 'USD',
      })
    );
    expect(res.user.email).toBe('test@example.com');
  });

  it('calls POST /auth/login/ with credentials', async () => {
    const mockPost = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
      data: {
        user: { id: 'usr_1', email: 'test@example.com', baseCurrency: 'USD', createdAt: '2026-09-13T00:00:00Z' },
        tokens: { accessToken: 'acc_1', refreshToken: 'ref_1', expiresIn: 900 },
      },
    });

    const res = await authApi.login({
      email: 'test@example.com',
      password: 'SecurePassword123!',
    });

    expect(mockPost).toHaveBeenCalledWith(
      '/auth/login/',
      expect.objectContaining({
        email: 'test@example.com',
        password: 'SecurePassword123!',
      })
    );
    expect(res.tokens.accessToken).toBe('acc_1');
  });

  it('calls GET /auth/me/ to fetch profile', async () => {
    const mockGet = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
      data: { id: 'usr_1', email: 'test@example.com', baseCurrency: 'USD', createdAt: '2026-09-13T00:00:00Z' },
    });

    const user = await authApi.getCurrentUser();
    expect(mockGet).toHaveBeenCalledWith('/auth/me/');
    expect(user.id).toBe('usr_1');
  });

  it('calls POST /auth/logout/ to revoke session', async () => {
    const mockPost = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({ data: {} });

    await authApi.logout('ref_token_to_revoke', 'dev_123');
    expect(mockPost).toHaveBeenCalledWith('/auth/logout/', {
      refreshToken: 'ref_token_to_revoke',
      deviceId: 'dev_123',
    });
  });
});
