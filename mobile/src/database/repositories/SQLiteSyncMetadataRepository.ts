import { DatabaseManager } from '../sqlite/DatabaseManager';
import { getUTCTimestamp } from '../../utils/date';

const KEYS = {
  LAST_SYNCED_SEQUENCE: 'last_synced_sequence',
  LAST_SYNCED_AT: 'last_synced_at',
  LAST_SYNC_ERROR: 'last_sync_error',
} as const;

export class SQLiteSyncMetadataRepository {
  private getDb() {
    return DatabaseManager.getInstance().getDatabase();
  }

  async getMetadata(key: string): Promise<string | null> {
    const db = this.getDb();
    const res = await db.executeSql<{ value: string }>(
      'SELECT value FROM sync_metadata WHERE key = ?',
      [key]
    );
    if (res.rows.length === 0) return null;
    return res.rows[0].value;
  }

  async setMetadata(key: string, value: string): Promise<void> {
    const db = this.getDb();
    const now = getUTCTimestamp();
    await db.executeSql(
      `INSERT INTO sync_metadata (key, value, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [key, value, now]
    );
  }

  async getLastSyncedSequence(): Promise<number> {
    const val = await this.getMetadata(KEYS.LAST_SYNCED_SEQUENCE);
    if (!val) return 0;
    const seq = parseInt(val, 10);
    return isNaN(seq) ? 0 : seq;
  }

  async setLastSyncedSequence(seq: number): Promise<void> {
    await this.setMetadata(KEYS.LAST_SYNCED_SEQUENCE, seq.toString());
  }

  async getLastSyncedAt(): Promise<string | null> {
    return this.getMetadata(KEYS.LAST_SYNCED_AT);
  }

  async setLastSyncedAt(timestamp: string): Promise<void> {
    await this.setMetadata(KEYS.LAST_SYNCED_AT, timestamp);
  }

  async getLastSyncError(): Promise<string | null> {
    return this.getMetadata(KEYS.LAST_SYNC_ERROR);
  }

  async setLastSyncError(error: string | null): Promise<void> {
    if (error === null) {
      const db = this.getDb();
      await db.executeSql('DELETE FROM sync_metadata WHERE key = ?', [KEYS.LAST_SYNC_ERROR]);
    } else {
      await this.setMetadata(KEYS.LAST_SYNC_ERROR, error);
    }
  }

  async clearAll(): Promise<void> {
    const db = this.getDb();
    await db.executeSql('DELETE FROM sync_metadata');
  }
}
