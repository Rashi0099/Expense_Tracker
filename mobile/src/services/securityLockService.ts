import AsyncStorage from '@react-native-async-storage/async-storage';

export const PIN_LOCK_ENABLED_KEY = '@security/pin_lock_enabled';
export const PIN_HASH_KEY = '@security/pin_hash';
export const PIN_TIMEOUT_KEY = '@security/pin_timeout';
export const PIN_LOCKOUT_KEY = '@security/pin_lockout_until';

const PIN_SALT = 'SPENDING_BOOK_SECURE_PIN_v1_SALT_';
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 30 * 1000; // 30 seconds

/**
 * Standard SHA-256 implementation in pure TypeScript.
 * Guarantees zero external native dependencies and 100% deterministic hashing.
 */
export function sha256(ascii: string): string {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount));
  }

  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let result = '';

  const words: number[] = [];
  const asciiBitLength = ascii.length * 8;

  const hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];

  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  for (let i = 0; i < ascii.length; i++) {
    const j = (i >> 2);
    words[j] = ((words[j] || 0) << 8) | ascii.charCodeAt(i);
  }

  const finalJ = (ascii.length >> 2);
  words[finalJ] = ((words[finalJ] || 0) << 8) | 0x80;
  const targetWords = (((ascii.length + 8) >> 6) + 1) * 16;
  for (let i = words.length; i < targetWords; i++) {
    words[i] = 0;
  }
  words[targetWords - 1] = asciiBitLength;

  for (let j = 0; j < words.length; j += 16) {
    const w = words.slice(j, j + 16);
    const oldHash = [...hash];

    for (let i = 0; i < 64; i++) {
      let s0: number, s1: number;
      if (i >= 16) {
        const w15 = w[i - 15];
        s0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3);
        const w2 = w[i - 2];
        s1 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10);
        w[i] = ((w[i - 16] + s0 + w[i - 7] + s1) % maxWord) >>> 0;
      }

      const ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
      const maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
      const s1_h4 = rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25);
      const s0_h0 = rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22);
      const temp1 = (hash[7] + s1_h4 + ch + k[i] + w[i]) % maxWord;
      const temp2 = (s0_h0 + maj) % maxWord;

      hash[7] = hash[6];
      hash[6] = hash[5];
      hash[5] = hash[4];
      hash[4] = ((hash[3] + temp1) % maxWord) >>> 0;
      hash[3] = hash[2];
      hash[2] = hash[1];
      hash[1] = hash[0];
      hash[0] = ((temp1 + temp2) % maxWord) >>> 0;
    }

    for (let i = 0; i < 8; i++) {
      hash[i] = ((hash[i] + oldHash[i]) % maxWord) >>> 0;
    }
  }

  for (let i = 0; i < 8; i++) {
    result += ('00000000' + hash[i].toString(16)).slice(-8);
  }

  return result;
}

export function hashPin(pin: string): string {
  return sha256(PIN_SALT + pin.trim());
}

export class SecurityLockService {
  private static instance: SecurityLockService;

  private isSessionUnlocked: boolean = false;
  private lastBackgroundTime: number | null = null;
  private failedAttempts: number = 0;
  private lockoutUntil: number = 0;

  private constructor() {}

  public static getInstance(): SecurityLockService {
    if (!SecurityLockService.instance) {
      SecurityLockService.instance = new SecurityLockService();
    }
    return SecurityLockService.instance;
  }

  /**
   * Check if PIN lock is enabled by the user.
   */
  public async isLockEnabled(): Promise<boolean> {
    try {
      const enabled = await AsyncStorage.getItem(PIN_LOCK_ENABLED_KEY);
      const hash = await AsyncStorage.getItem(PIN_HASH_KEY);
      return enabled === 'true' && !!hash;
    } catch {
      return false;
    }
  }

  /**
   * Set and enable a new 4-digit PIN.
   */
  public async enableLock(pin: string): Promise<boolean> {
    if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      return false;
    }
    try {
      const hashed = hashPin(pin);
      await AsyncStorage.setItem(PIN_HASH_KEY, hashed);
      await AsyncStorage.setItem(PIN_LOCK_ENABLED_KEY, 'true');
      this.isSessionUnlocked = true;
      this.failedAttempts = 0;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Disable PIN lock (requires verification of current PIN).
   */
  public async disableLock(pin: string): Promise<boolean> {
    const verified = await this.verifyPin(pin);
    if (!verified.success) {
      return false;
    }
    try {
      await AsyncStorage.removeItem(PIN_HASH_KEY);
      await AsyncStorage.setItem(PIN_LOCK_ENABLED_KEY, 'false');
      this.isSessionUnlocked = true;
      this.failedAttempts = 0;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Reset and disable PIN lock directly for recovery (e.g. user forgot PIN and resets via OTP auth).
   */
  public async disableLockDirectlyForRecovery(): Promise<void> {
    try {
      await AsyncStorage.removeItem(PIN_HASH_KEY);
      await AsyncStorage.removeItem(PIN_LOCK_ENABLED_KEY);
      await AsyncStorage.removeItem(PIN_TIMEOUT_KEY);
      await AsyncStorage.removeItem(PIN_LOCKOUT_KEY);
      this.isSessionUnlocked = true;
      this.failedAttempts = 0;
      this.lockoutUntil = 0;
    } catch {}
  }

  /**
   * Change current PIN to a new 4-digit PIN.
   */
  public async changePin(oldPin: string, newPin: string): Promise<boolean> {
    if (!newPin || newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      return false;
    }
    const verified = await this.verifyPin(oldPin);
    if (!verified.success) {
      return false;
    }
    try {
      const newHash = hashPin(newPin);
      await AsyncStorage.setItem(PIN_HASH_KEY, newHash);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Verify input PIN against saved hash.
   * Tracks failed attempts and enforces lockout if threshold reached.
   */
  public async verifyPin(
    inputPin: string
  ): Promise<{ success: boolean; isLockedOut?: boolean; lockoutRemainingSeconds?: number }> {
    const now = Date.now();
    if (this.lockoutUntil > now) {
      const remainingSec = Math.ceil((this.lockoutUntil - now) / 1000);
      return { success: false, isLockedOut: true, lockoutRemainingSeconds: remainingSec };
    }

    try {
      const storedHash = await AsyncStorage.getItem(PIN_HASH_KEY);
      if (!storedHash) {
        return { success: false };
      }

      const inputHash = hashPin(inputPin);
      if (inputHash === storedHash) {
        this.isSessionUnlocked = true;
        this.failedAttempts = 0;
        this.lockoutUntil = 0;
        return { success: true };
      } else {
        this.failedAttempts += 1;
        if (this.failedAttempts >= MAX_FAILED_ATTEMPTS) {
          this.lockoutUntil = Date.now() + LOCKOUT_DURATION_MS;
          return {
            success: false,
            isLockedOut: true,
            lockoutRemainingSeconds: Math.ceil(LOCKOUT_DURATION_MS / 1000),
          };
        }
        return { success: false };
      }
    } catch {
      return { success: false };
    }
  }

  /**
   * Get auto-lock timeout in seconds (0 = Immediately, 30, 60, 300). Default is 0.
   */
  public async getTimeout(): Promise<number> {
    try {
      const val = await AsyncStorage.getItem(PIN_TIMEOUT_KEY);
      if (val !== null) {
        const parsed = parseInt(val, 10);
        return isNaN(parsed) ? 0 : parsed;
      }
      return 0;
    } catch {
      return 0;
    }
  }

  /**
   * Set auto-lock timeout in seconds.
   */
  public async setTimeout(seconds: number): Promise<void> {
    try {
      await AsyncStorage.setItem(PIN_TIMEOUT_KEY, seconds.toString());
    } catch {}
  }

  /**
   * Record timestamp when app transitions into background or inactive state.
   */
  public onAppBackground(): void {
    this.lastBackgroundTime = Date.now();
  }

  /**
   * Check if app should display lock screen upon resuming.
   */
  public async shouldShowLock(): Promise<boolean> {
    const isEnabled = await this.isLockEnabled();
    if (!isEnabled) {
      return false;
    }

    // If session is not unlocked yet (e.g. cold start)
    if (!this.isSessionUnlocked) {
      return true;
    }

    // Check timeout against last background time
    if (this.lastBackgroundTime !== null) {
      const timeoutSec = await this.getTimeout();
      const elapsedSec = (Date.now() - this.lastBackgroundTime) / 1000;
      if (elapsedSec >= timeoutSec) {
        this.isSessionUnlocked = false;
        return true;
      }
    }

    return false;
  }

  public unlockSession(): void {
    this.isSessionUnlocked = true;
    this.lastBackgroundTime = null;
    this.failedAttempts = 0;
  }

  public lockSession(): void {
    this.isSessionUnlocked = false;
    this.lastBackgroundTime = null;
  }

  public isUnlocked(): boolean {
    return this.isSessionUnlocked;
  }

  public getLockoutRemainingSeconds(): number {
    const now = Date.now();
    if (this.lockoutUntil > now) {
      return Math.ceil((this.lockoutUntil - now) / 1000);
    }
    return 0;
  }

  /**
   * Test helper to reset internal state between tests.
   */
  public resetStateForTesting(): void {
    this.isSessionUnlocked = false;
    this.lastBackgroundTime = null;
    this.failedAttempts = 0;
    this.lockoutUntil = 0;
  }
}

export const securityLockService = SecurityLockService.getInstance();
