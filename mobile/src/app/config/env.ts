/**
 * Environment Configuration (Section 6)
 *
 * Never hardcode production credentials, JWT secrets, or database credentials.
 * Configures platform-safe API defaults:
 * - Android Emulator maps localhost to 10.0.2.2
 * - iOS Simulator / Local maps to 127.0.0.1
 */

import { Platform } from 'react-native';

const DEFAULT_DEV_HOST = Platform.OS === 'android' ? '10.0.2.2' : '127.0.0.1';

export const ENV = {
  API_BASE_URL: `http://${DEFAULT_DEV_HOST}:8000/api/v1`,
  SQLITE_DB_NAME: 'expenseflow_local.db',
  SYNC_INTERVAL_SECONDS: 30,
  CLIENT_VERSION: '1.0.0',
  PLATFORM: Platform.OS === 'android' ? 'ANDROID' : Platform.OS === 'ios' ? 'IOS' : 'WEB',
  TIMEOUT_MS: 10000,
} as const;
