import { describe, it, expect, vi } from 'vitest';
import { logger } from '../utils/logger';

describe('Controlled Diagnostic Logger & Sensitive Payload Redaction (Section 39)', () => {
  it('redacts sensitive auth tokens and passwords from objects', () => {
    const rawPayload = {
      email: 'user@example.com',
      password: 'SuperSecretPassword123!',
      token: 'jwt_token_value_abc',
      accessToken: 'access_xyz',
      refreshToken: 'refresh_xyz',
      authorization: 'Bearer secret_key',
      amount_cents: 5000,
      safeField: 'Regular note',
    };

    const redacted = logger._redact(rawPayload) as Record<string, unknown>;

    expect(redacted.email).toBe('user@example.com');
    expect(redacted.safeField).toBe('Regular note');
    expect(redacted.password).toBe('[REDACTED]');
    expect(redacted.token).toBe('[REDACTED]');
    expect(redacted.accessToken).toBe('[REDACTED]');
    expect(redacted.refreshToken).toBe('[REDACTED]');
    expect(redacted.authorization).toBe('[REDACTED]');
    expect(redacted.amount_cents).toBe('[REDACTED]');
  });

  it('redacts raw JWT strings passed in payloads', () => {
    const jwtToken =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

    const redacted = logger._redact(jwtToken);
    expect(redacted).toBe('[REDACTED_JWT]');
  });

  it('safely outputs log statements with console mocks', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    logger.warn('Warning message with sensitive data', {
      password: 'mypassword',
      merchant: 'Starbucks',
    });

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const loggedArgs = consoleSpy.mock.calls[0];
    expect(loggedArgs[0]).toContain('[WARN]');
    expect(loggedArgs[1]).toEqual({
      password: '[REDACTED]',
      merchant: 'Starbucks',
    });

    consoleSpy.mockRestore();
  });
});
