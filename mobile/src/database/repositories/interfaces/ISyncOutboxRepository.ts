import { SyncOutboxItem } from '../../../domain/models';

export interface ISyncOutboxRepository {
  getPending(limit?: number): Promise<SyncOutboxItem[]>;
  markCompleted(operationId: string): Promise<void>;
  markFailed(operationId: string, error: string): Promise<void>;
  countPending(): Promise<number>;
  countPermanentlyFailed?(): Promise<number>;
  getNextRetryAt?(): Promise<string | null>;
  resetFailed?(operationId: string): Promise<void>;
  clearCompleted(): Promise<void>;
}
