import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  SecurityLockService,
  hashPin,
  sha256,
  PIN_LOCK_ENABLED_KEY,
  PIN_HASH_KEY,
} from '../services/securityLockService';

const storageMap: Record<string, string> = {};
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    setItem: vi.fn(async (key: string, value: string) => {
      storageMap[key] = value;
    }),
    getItem: vi.fn(async (key: string) => storageMap[key] ?? null),
    removeItem: vi.fn(async (key: string) => {
      delete storageMap[key];
    }),
    multiRemove: vi.fn(async (keys: string[]) => {
      keys.forEach((k) => delete storageMap[k]);
    }),
    clear: vi.fn(async () => {
      Object.keys(storageMap).forEach((k) => delete storageMap[k]);
    }),
  },
}));

describe('Security Lock & 4-Digit PIN Suite', () => {
  let service: SecurityLockService;

  beforeEach(() => {
    Object.keys(storageMap).forEach((k) => delete storageMap[k]);
    service = SecurityLockService.getInstance();
    service.resetStateForTesting();
  });

  it('verifies pure SHA-256 implementation generates correct standard hashes', () => {
    const hash = sha256('hello world');
    expect(hash).toBe('b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9');
  });

  it('hashes 4-digit PIN deterministically with salt', () => {
    const hash1 = hashPin('1234');
    const hash2 = hashPin('1234');
    const hashDifferent = hashPin('4321');

    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(hashDifferent);
    expect(hash1).not.toContain('1234');
  });

  it('enables PIN lock and stores hashed value in storage', async () => {
    const success = await service.enableLock('5678');
    expect(success).toBe(true);
    expect(storageMap[PIN_LOCK_ENABLED_KEY]).toBe('true');
    expect(storageMap[PIN_HASH_KEY]).toBe(hashPin('5678'));
    expect(await service.isLockEnabled()).toBe(true);
  });

  it('rejects invalid PIN formats (non-numeric or not 4 digits)', async () => {
    expect(await service.enableLock('123')).toBe(false);
    expect(await service.enableLock('12345')).toBe(false);
    expect(await service.enableLock('abcd')).toBe(false);
  });

  it('verifies correct PIN and rejects incorrect PIN', async () => {
    await service.enableLock('2468');

    const wrongRes = await service.verifyPin('1111');
    expect(wrongRes.success).toBe(false);

    const rightRes = await service.verifyPin('2468');
    expect(rightRes.success).toBe(true);
    expect(service.isUnlocked()).toBe(true);
  });

  it('locks out after 5 consecutive failed PIN attempts', async () => {
    await service.enableLock('9999');

    for (let i = 0; i < 4; i++) {
      const res = await service.verifyPin('0000');
      expect(res.success).toBe(false);
      expect(res.isLockedOut).toBeFalsy();
    }

    // 5th failed attempt
    const lockoutRes = await service.verifyPin('0000');
    expect(lockoutRes.success).toBe(false);
    expect(lockoutRes.isLockedOut).toBe(true);
    expect(lockoutRes.lockoutRemainingSeconds).toBeGreaterThan(0);

    // Subsequent attempt during lockout is immediately rejected
    const blockedRes = await service.verifyPin('9999'); // even with right PIN
    expect(blockedRes.success).toBe(false);
    expect(blockedRes.isLockedOut).toBe(true);
  });

  it('changes PIN when old PIN is verified', async () => {
    await service.enableLock('1111');

    const failChange = await service.changePin('0000', '2222');
    expect(failChange).toBe(false);

    const successChange = await service.changePin('1111', '2222');
    expect(successChange).toBe(true);

    const verifyOld = await service.verifyPin('1111');
    expect(verifyOld.success).toBe(false);

    const verifyNew = await service.verifyPin('2222');
    expect(verifyNew.success).toBe(true);
  });

  it('disables lock when correct PIN is provided', async () => {
    await service.enableLock('1234');
    expect(await service.isLockEnabled()).toBe(true);

    const failDisable = await service.disableLock('9999');
    expect(failDisable).toBe(false);

    const successDisable = await service.disableLock('1234');
    expect(successDisable).toBe(true);
    expect(await service.isLockEnabled()).toBe(false);
    expect(storageMap[PIN_HASH_KEY]).toBeUndefined();
  });

  it('checks auto-lock timeout on resume', async () => {
    await service.enableLock('1234');
    await service.setTimeout(30); // 30 seconds

    service.unlockSession();
    expect(await service.shouldShowLock()).toBe(false);

    // App goes to background
    service.onAppBackground();

    // Resuming immediately (under 30s) -> should not lock
    expect(await service.shouldShowLock()).toBe(false);

    // Simulate 35 seconds elapsed
    (service as any).lastBackgroundTime = Date.now() - 35000;
    expect(await service.shouldShowLock()).toBe(true);
  });
});
