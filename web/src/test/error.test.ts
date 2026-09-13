import { describe, it, expect } from 'vitest';
import { parseApiError, AppApiError } from '@/utils/error';

describe('parseApiError utility', () => {
  it('returns AppApiError directly if already an instance', () => {
    const original = new AppApiError('Direct error', 'CUSTOM_CODE', 400);
    const parsed = parseApiError(original);
    expect(parsed).toBe(original);
    expect(parsed.code).toBe('CUSTOM_CODE');
  });

  it('correctly parses standard backend ApiErrorEnvelope', () => {
    const axiosErrorMock = {
      isAxiosError: true,
      response: {
        status: 400,
        data: {
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Request validation failed.',
            requestId: 'req_12345',
            timestamp: '2026-09-13T10:00:00Z',
            details: [
              { field: 'email', issue: 'invalid', message: 'An account with this email already exists.' },
              { field: 'password', issue: 'too_short', message: 'Password must be at least 10 characters.' },
            ],
          },
        },
      },
    };

    const parsed = parseApiError(axiosErrorMock);
    expect(parsed.code).toBe('VALIDATION_FAILED');
    expect(parsed.status).toBe(400);
    expect(parsed.requestId).toBe('req_12345');
    expect(parsed.fieldErrors.email).toBe('An account with this email already exists.');
    expect(parsed.fieldErrors.password).toBe('Password must be at least 10 characters.');
  });

  it('handles network disconnection gracefully', () => {
    const networkErrorMock = {
      isAxiosError: true,
      code: 'ERR_NETWORK',
      response: undefined,
    };

    const parsed = parseApiError(networkErrorMock);
    expect(parsed.code).toBe('NETWORK_ERROR');
    expect(parsed.message).toContain('network connection');
  });

  it('handles request timeout gracefully', () => {
    const timeoutMock = {
      isAxiosError: true,
      code: 'ECONNABORTED',
    };

    const parsed = parseApiError(timeoutMock);
    expect(parsed.code).toBe('TIMEOUT');
    expect(parsed.message).toContain('timed out');
  });
});
