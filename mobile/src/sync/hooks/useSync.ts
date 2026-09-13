import { useState, useEffect, useCallback } from 'react';
import { SyncEngine } from '../engine/SyncEngine';
import { SyncStatusInfo } from '../types';

export function useSync() {
  const [status, setStatus] = useState<SyncStatusInfo>(() =>
    SyncEngine.getInstance().getStatus()
  );

  useEffect(() => {
    const engine = SyncEngine.getInstance();
    const unsubscribe = engine.subscribe((newStatus) => {
      setStatus(newStatus);
    });
    return unsubscribe;
  }, []);

  const syncNow = useCallback(async () => {
    await SyncEngine.getInstance().syncNow();
  }, []);

  return {
    state: status.state,
    isSyncing: status.state === 'SYNCING',
    isOffline: status.state === 'OFFLINE',
    hasPendingChanges: status.pendingCount > 0,
    pendingCount: status.pendingCount,
    lastSyncedAt: status.lastSyncedAt,
    lastError: status.lastError,
    syncNow,
  };
}
