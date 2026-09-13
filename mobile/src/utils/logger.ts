/**
 * Controlled Diagnostic Logger (Section 39)
 *
 * Enforces production security rules:
 * - NEVER logs tokens, passwords, sensitive financial payloads, or auth headers.
 * - Suppresses debug logs in production builds.
 * - Recursively scrubs sensitive keys from any objects passed.
 */

const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'access',
  'refresh',
  'refreshtoken',
  'accesstoken',
  'authorization',
  'secret',
  'key',
  'amount_cents',
  'amountcents',
  'headers',
  'cookie',
]);

function redactSensitiveData(data: unknown, depth = 0): unknown {
  if (depth > 5 || data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'string') {
    // Redact JWT-like strings
    if (data.startsWith('eyJ') && data.length > 50) {
      return '[REDACTED_JWT]';
    }
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => redactSensitiveData(item, depth + 1));
  }

  if (typeof data === 'object') {
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      const lowerKey = key.toLowerCase().replace(/[-_]/g, '');
      if (SENSITIVE_KEYS.has(lowerKey)) {
        cleaned[key] = '[REDACTED]';
      } else {
        cleaned[key] = redactSensitiveData(value, depth + 1);
      }
    }
    return cleaned;
  }

  return data;
}

// In React Native, __DEV__ is globally defined. In Node test environments, default to true or check NODE_ENV.
const isDev =
  typeof __DEV__ !== 'undefined'
    ? __DEV__
    : process.env.NODE_ENV !== 'production';

export const logger = {
  debug(message: string, ...args: unknown[]): void {
    if (!isDev) return;
    const sanitizedArgs = args.map((arg) => redactSensitiveData(arg));
    console.log(`[DEBUG] ${message}`, ...sanitizedArgs);
  },

  info(message: string, ...args: unknown[]): void {
    if (!isDev) return;
    const sanitizedArgs = args.map((arg) => redactSensitiveData(arg));
    console.info(`[INFO] ${message}`, ...sanitizedArgs);
  },

  warn(message: string, ...args: unknown[]): void {
    const sanitizedArgs = args.map((arg) => redactSensitiveData(arg));
    console.warn(`[WARN] ${message}`, ...sanitizedArgs);
  },

  error(message: string, error?: unknown, ...args: unknown[]): void {
    const sanitizedError = redactSensitiveData(
      error instanceof Error ? { message: error.message, name: error.name } : error
    );
    const sanitizedArgs = args.map((arg) => redactSensitiveData(arg));
    console.error(`[ERROR] ${message}`, sanitizedError, ...sanitizedArgs);
  },

  // Exported for direct testing
  _redact: redactSensitiveData,
};
