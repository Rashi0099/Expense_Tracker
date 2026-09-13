export type SyncGlobalState =
  | 'SYNCED'
  | 'SYNCING'
  | 'OFFLINE'
  | 'PENDING_CHANGES'
  | 'ERROR';

export interface SyncStatusInfo {
  state: SyncGlobalState;
  pendingCount: number;
  lastSyncedAt: string | null;
  lastError: string | null;
}
