import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MemorySQLiteAdapter } from '../database/sqlite/DatabaseConnection';
import { DatabaseManager } from '../database/sqlite/DatabaseManager';
import { SQLiteCategoryRepository } from '../database/repositories/SQLiteCategoryRepository';
import { SQLiteSyncOutboxRepository } from '../database/repositories/SQLiteSyncOutboxRepository';
import { SQLiteSyncMetadataRepository } from '../database/repositories/SQLiteSyncMetadataRepository';
import { SyncEngine } from '../sync/engine/SyncEngine';
import { syncApiClient, SyncResponseDTO } from '../sync/client/syncApiClient';
import { NetworkStateManager } from '../sync/network/NetworkState';
import { SecureStorage } from '../api/client/secureStorage';
import {
  createExpenseUseCase,
  getExpenseByIdUseCase,
  listExpensesUseCase,
} from '../domain/usecases/expenseUseCases';

const storage: Record<string, string> = {};
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    setItem: vi.fn(async (key: string, value: string) => {
      storage[key] = value;
    }),
    getItem: vi.fn(async (key: string) => storage[key] ?? null),
    removeItem: vi.fn(async (key: string) => {
      delete storage[key];
    }),
    clear: vi.fn(async () => {
      Object.keys(storage).forEach((k) => delete storage[k]);
    }),
    multiRemove: vi.fn(async (keys: string[]) => {
      keys.forEach((k) => delete storage[k]);
    }),
  },
}));

describe('Complete Offline-First Synchronization Engine', () => {
  let memoryDb: MemorySQLiteAdapter;
  const userId = 'sync_test_user_001';
  const deviceId = 'test_device_uuid_001';

  beforeEach(async () => {
    vi.restoreAllMocks();
    await DatabaseManager.getInstance().close();
    memoryDb = new MemorySQLiteAdapter();
    await DatabaseManager.getInstance().initialize(memoryDb);
    DatabaseManager.getInstance().setCurrentUser(userId);

    // Seed default categories
    const catRepo = new SQLiteCategoryRepository();
    await catRepo.seedDefaults();

    // Setup device ID
    await SecureStorage.setDeviceId(deviceId);

    // Ensure network is online
    NetworkStateManager.getInstance().setMockStatus({
      isConnected: true,
      isInternetReachable: true,
      type: 'wifi',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('pushes local outbox mutations, reconciles status, and purges completed operations', async () => {
    // 1. Create local expense offline
    const exp = await createExpenseUseCase({
      categoryId: 'c0000000-0000-0000-0000-000000000001',
      amountCents: 4550, // $45.50
      transactionDate: '2026-09-13',
      payee: 'Subway',
      note: 'Lunch sandwich',
    });

    const outboxRepo = new SQLiteSyncOutboxRepository();
    const pendingBefore = await outboxRepo.getPending();
    expect(pendingBefore.length).toBe(1);
    expect(pendingBefore[0].entityId).toBe(exp.id);
    expect(pendingBefore[0].operation).toBe('CREATE');

    // 2. Mock server response accepting the operation
    const mockResponse: SyncResponseDTO = {
      processedOperations: [
        {
          operationId: pendingBefore[0].operationId,
          entityId: exp.id,
          status: 'ACCEPTED',
          serverVersion: 1,
          serverSequence: 1,
        },
      ],
      serverChanges: {
        expenses: [],
        income: [],
        categories: [],
        budgets: [],
        recurring: [],
        tombstones: [],
      },
      latestServerSequence: 1,
      hasMore: false,
    };

    const postSyncSpy = vi
      .spyOn(syncApiClient, 'postSyncBatch')
      .mockResolvedValue(mockResponse);

    // 3. Execute synchronization
    const engine = SyncEngine.getInstance();
    await engine.sync();

    // Verify API called with exact payload
    expect(postSyncSpy).toHaveBeenCalledTimes(1);
    const callArg = postSyncSpy.mock.calls[0][0];
    expect(callArg.deviceId).toBe(deviceId);
    expect(callArg.sinceSequence).toBe(0);
    expect(callArg.operations.length).toBe(1);
    expect(callArg.operations[0].operationId).toBe(pendingBefore[0].operationId);

    // Verify outbox was purged of completed items
    const pendingAfter = await outboxRepo.getPending();
    expect(pendingAfter.length).toBe(0);

    // Verify local expense record marked SYNCED
    const syncedExp = await getExpenseByIdUseCase(exp.id);
    expect(syncedExp).not.toBeNull();
    expect(syncedExp?.syncStatus).toBe('SYNCED');
    expect(syncedExp?.version).toBe(1);

    // Verify sequence cursor advanced
    const metaRepo = new SQLiteSyncMetadataRepository();
    const lastSeq = await metaRepo.getLastSyncedSequence();
    expect(lastSeq).toBe(1);

    // Verify engine state is SYNCED
    expect(engine.getStatus().state).toBe('SYNCED');
    expect(engine.getStatus().pendingCount).toBe(0);
  });

  it('pulls server changes and upserts into local SQLite with financial precision', async () => {
    // Mock server returning an expense created on Web client
    const serverExpenseId = '018d3a50-8b10-7e12-9214-5b4321fedcba';
    const mockResponse: SyncResponseDTO = {
      processedOperations: [],
      serverChanges: {
        expenses: [
          {
            id: serverExpenseId,
            amount: '89.99', // $89.99 -> 8999 cents
            currency: 'USD',
            categoryId: 'c0000000-0000-0000-0000-000000000001',
            categoryName: 'Food & Dining',
            transactionDate: '2026-09-12',
            paymentMethod: 'CREDIT_CARD',
            payee: 'Grocery Store',
            note: 'Weekly essentials',
            version: 1,
            serverSequence: 2,
            createdAt: '2026-09-12T14:00:00.000Z',
            updatedAt: '2026-09-12T14:00:00.000Z',
          },
        ],
        income: [],
        categories: [],
        budgets: [],
        recurring: [],
        tombstones: [],
      },
      latestServerSequence: 2,
      hasMore: false,
    };

    vi.spyOn(syncApiClient, 'postSyncBatch').mockResolvedValue(mockResponse);

    // Run sync
    const engine = SyncEngine.getInstance();
    await engine.sync();

    // Verify entity was inserted into local SQLite
    const insertedExp = await getExpenseByIdUseCase(serverExpenseId);
    expect(insertedExp).not.toBeNull();
    expect(insertedExp?.id).toBe(serverExpenseId);
    expect(insertedExp?.amountCents).toBe(8999);
    expect(insertedExp?.payee).toBe('Grocery Store');
    expect(insertedExp?.syncStatus).toBe('SYNCED');
    expect(insertedExp?.version).toBe(1);

    // Verify listed through use case
    const allExpenses = await listExpensesUseCase();
    expect(allExpenses.some((e) => e.id === serverExpenseId)).toBe(true);
  });

  it('pulls tombstones and purges deleted rows from SQLite', async () => {
    // 1. Create a local expense
    const exp = await createExpenseUseCase({
      categoryId: 'c0000000-0000-0000-0000-000000000001',
      amountCents: 1500,
      transactionDate: '2026-09-13',
      payee: 'Coffee Shop',
    });

    // Verify it exists locally
    expect(await getExpenseByIdUseCase(exp.id)).not.toBeNull();

    // 2. Server sends tombstone for this expense
    const mockResponse: SyncResponseDTO = {
      processedOperations: [],
      serverChanges: {
        expenses: [],
        income: [],
        categories: [],
        budgets: [],
        recurring: [],
        tombstones: [
          {
            entityType: 'EXPENSE',
            entityId: exp.id,
            serverSequence: 8,
            deletedAt: '2026-09-13T16:00:00.000Z',
          },
        ],
      },
      latestServerSequence: 8,
      hasMore: false,
    };

    vi.spyOn(syncApiClient, 'postSyncBatch').mockResolvedValue(mockResponse);

    await SyncEngine.getInstance().sync();

    // Verify row was purged from SQLite
    const purgedExp = await getExpenseByIdUseCase(exp.id);
    expect(purgedExp).toBeNull();
  });

  it('resolves conflicts by applying server authoritative record', async () => {
    // 1. Create expense
    const exp = await createExpenseUseCase({
      categoryId: 'c0000000-0000-0000-0000-000000000001',
      amountCents: 5000, // $50.00
      transactionDate: '2026-09-13',
      payee: 'Store',
    });

    const outboxRepo = new SQLiteSyncOutboxRepository();
    const pending = await outboxRepo.getPending();

    // 2. Server detects conflict and returns authoritative version with $65.00
    const mockResponse: SyncResponseDTO = {
      processedOperations: [
        {
          operationId: pending[0].operationId,
          entityId: exp.id,
          status: 'CONFLICT',
          serverVersion: 3,
          serverSequence: 12,
        },
      ],
      serverChanges: {
        expenses: [
          {
            id: exp.id,
            amount: '65.00',
            currency: 'USD',
            categoryId: 'c0000000-0000-0000-0000-000000000001',
            transactionDate: '2026-09-13',
            paymentMethod: 'CASH',
            payee: 'Store Authoritative',
            note: 'Resolved by LWW',
            version: 3,
            serverSequence: 12,
            createdAt: '2026-09-13T10:00:00.000Z',
            updatedAt: '2026-09-13T12:00:00.000Z',
          },
        ],
        income: [],
        categories: [],
        budgets: [],
        recurring: [],
        tombstones: [],
      },
      latestServerSequence: 12,
      hasMore: false,
    };

    vi.spyOn(syncApiClient, 'postSyncBatch').mockResolvedValue(mockResponse);

    await SyncEngine.getInstance().sync();

    // Verify local record updated to authoritative server state
    const resolvedExp = await getExpenseByIdUseCase(exp.id);
    expect(resolvedExp).not.toBeNull();
    expect(resolvedExp?.amountCents).toBe(6500);
    expect(resolvedExp?.payee).toBe('Store Authoritative');
    expect(resolvedExp?.version).toBe(3);
    expect(resolvedExp?.syncStatus).toBe('SYNCED');

    // Outbox item was completed and cleared
    expect((await outboxRepo.getPending()).length).toBe(0);
  });

  it('pauses execution when network is offline and transitions to OFFLINE state', async () => {
    NetworkStateManager.getInstance().setMockStatus({
      isConnected: false,
      isInternetReachable: false,
    });

    const postSyncSpy = vi.spyOn(syncApiClient, 'postSyncBatch');

    const engine = SyncEngine.getInstance();
    await engine.sync();

    // Assert API was not called
    expect(postSyncSpy).not.toHaveBeenCalled();
    expect(engine.getStatus().state).toBe('OFFLINE');
  });

  it('prevents overlapping concurrent sync operations via mutex lock', async () => {
    let resolveFirst: (val: SyncResponseDTO) => void = () => {};
    const firstPromise = new Promise<SyncResponseDTO>((resolve) => {
      resolveFirst = resolve;
    });

    const emptyResponse: SyncResponseDTO = {
      processedOperations: [],
      serverChanges: {
        expenses: [],
        income: [],
        categories: [],
        budgets: [],
        recurring: [],
        tombstones: [],
      },
      latestServerSequence: 0,
      hasMore: false,
    };

    const postSyncSpy = vi
      .spyOn(syncApiClient, 'postSyncBatch')
      .mockImplementationOnce(() => firstPromise)
      .mockResolvedValue(emptyResponse);

    const engine = SyncEngine.getInstance();

    // Trigger two sync operations concurrently
    const call1 = engine.sync();
    const call2 = engine.sync();

    // Call 1 is in-flight, Call 2 should be queued
    expect(engine.getStatus().state).toBe('SYNCING');

    resolveFirst(emptyResponse);
    await Promise.all([call1, call2]);

    // Ensure engine returned to clean state
    expect(engine.getStatus().state).toBe('SYNCED');
  });
});
