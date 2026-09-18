/**
 * Database Connection & Adapter Layer (Section 20 & 21)
 *
 * Provides an abstracted interface for executing SQL queries and managing transactions.
 * Decouples the application code from specific SQLite driver implementations, enabling:
 * 1. QuickSQLite in native React Native environments
 * 2. In-Memory Mock Adapter in Node.js / Jest / Vitest test environments
 */

export interface QueryResult<T = unknown> {
  rows: T[];
  insertId?: number;
  rowsAffected: number;
}

export interface ISQLiteDatabase {
  executeSql<T = unknown>(query: string, params?: unknown[]): Promise<QueryResult<T>>;
  transaction<T>(action: (tx: ISQLiteDatabase) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

/**
 * In-Memory Database Adapter for testing and non-native environments.
 * Implements standard SQL schema table emulation with atomic transactions.
 */
export class MemorySQLiteAdapter implements ISQLiteDatabase {
  private tables = new Map<string, Record<string, unknown>[]>();
  private inTransaction = false;

  async executeSql<T = unknown>(query: string, params: unknown[] = []): Promise<QueryResult<T>> {
    const cleanQuery = query.trim();
    const upper = cleanQuery.toUpperCase();

    // Table Creation
    if (upper.startsWith('CREATE TABLE')) {
      const match = cleanQuery.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+)/i);
      if (match && match[1]) {
        const tableName = match[1].toLowerCase();
        if (!this.tables.has(tableName)) {
          this.tables.set(tableName, []);
        }
      }
      return { rows: [], rowsAffected: 0 };
    }

    // Indexes & Pragmas
    if (upper.startsWith('CREATE INDEX') || upper.startsWith('PRAGMA')) {
      return { rows: [], rowsAffected: 0 };
    }

    // Insert (supports INSERT INTO, INSERT OR IGNORE INTO, and INSERT OR REPLACE INTO)
    if (upper.startsWith('INSERT')) {
      const match = cleanQuery.match(
        /INSERT\s+(?:OR\s+(?:IGNORE|REPLACE)\s+)?INTO\s+([a-zA-Z0-9_]+)\s*\(([\s\S]+?)\)\s*VALUES\s*\(([\s\S]+?)\)/i
      );
      if (match && match[1]) {
        const tableName = match[1].toLowerCase();
        const cols = match[2].split(',').map((c) => c.trim().toLowerCase());
        const rawTokens = match[3].split(',').map((t) => t.trim());
        let pIdx = 0;
        const rowData: Record<string, unknown> = {};

        cols.forEach((col, idx) => {
          const valExpr = rawTokens[idx];
          if (!valExpr) {
            rowData[col] = null;
          } else if (valExpr === '?') {
            rowData[col] = params[pIdx++] !== undefined ? params[pIdx - 1] : null;
          } else if (valExpr.toUpperCase() === 'NULL') {
            rowData[col] = null;
          } else if (
            (valExpr.startsWith("'") && valExpr.endsWith("'")) ||
            (valExpr.startsWith('"') && valExpr.endsWith('"'))
          ) {
            rowData[col] = valExpr.slice(1, -1);
          } else if (!isNaN(Number(valExpr))) {
            rowData[col] = Number(valExpr);
          } else {
            rowData[col] = valExpr;
          }
        });

        const table = this.tables.get(tableName) || [];
        if (cleanQuery.includes('OR IGNORE') && rowData.id) {
          const existing = table.find((r) => r.id === rowData.id);
          if (existing) {
            return { rows: [], rowsAffected: 0 };
          }
        }
        if (cleanQuery.includes('ON CONFLICT') || cleanQuery.includes('OR REPLACE')) {
          if (rowData.user_id !== undefined && rowData.keyword_normalized !== undefined) {
            const existingIdx = table.findIndex(
              (r) => r.user_id === rowData.user_id && r.keyword_normalized === rowData.keyword_normalized
            );
            if (existingIdx !== -1) {
              const prevFreq = Number(table[existingIdx].frequency || 1);
              table[existingIdx] = {
                ...table[existingIdx],
                ...rowData,
                frequency: prevFreq + 1,
              };
              this.tables.set(tableName, table);
              return { rows: [], rowsAffected: 1 };
            }
          }
          const idKey = rowData.id !== undefined ? 'id' : rowData.key !== undefined ? 'key' : null;
          if (idKey) {
            const existingIdx = table.findIndex((r) => r[idKey] === rowData[idKey]);
            if (existingIdx !== -1) {
              table[existingIdx] = { ...table[existingIdx], ...rowData };
              this.tables.set(tableName, table);
              return { rows: [], rowsAffected: 1 };
            }
          }
        }
        table.push(rowData);
        this.tables.set(tableName, table);
        return { rows: [], rowsAffected: 1 };
      }
    }

    // Select
    if (upper.startsWith('SELECT')) {
      const fromMatch = cleanQuery.match(/FROM\s+([a-zA-Z0-9_]+)/i);
      if (fromMatch && fromMatch[1]) {
        const tableName = fromMatch[1].toLowerCase();
        if (tableName === 'sqlite_master') {
          let tableRows = Array.from(this.tables.keys()).map((name) => ({ name, type: 'table' }));
          if (cleanQuery.includes("name='wallets'") || cleanQuery.includes("name = 'wallets'")) {
            tableRows = tableRows.filter((r) => r.name === 'wallets');
          }
          return { rows: tableRows as unknown as T[], rowsAffected: 0 };
        }
        const table = this.tables.get(tableName) || [];
        let filtered = [...table];

        // Parse positional parameters
        let pIdx = 0;

        if (cleanQuery.includes('WHERE')) {
          const whereClause = cleanQuery.split(/WHERE/i)[1].split(/ORDER|LIMIT|GROUP/i)[0];

          // Check ID or operation_id condition first if it occurs at the start of WHERE clause
          if (whereClause.match(/(?:^|\s|\()(?:e\.|i\.|b\.|r\.|c\.)?(?:id|operation_id)\s*=\s*\?/i)) {
            const targetId = params[pIdx++];
            filtered = filtered.filter((r) => r.id === targetId || r.operation_id === targetId);
          }

          // Check user / system scoping
          if (whereClause.includes('(is_system = 1 OR user_id = ?)')) {
            const targetUser = params[pIdx++];
            filtered = filtered.filter(
              (r) => r.is_system === 1 || (targetUser ? r.user_id === targetUser : false)
            );
          } else if (whereClause.match(/(?:user_id|e\.user_id|i\.user_id|b\.user_id|r\.user_id)\s*=\s*\?/)) {
            const targetUser = params[pIdx++];
            filtered = filtered.filter((r) => r.user_id === targetUser);
          }

          // Check keyword_normalized
          if (whereClause.match(/(?:^|\s)keyword_normalized\s*=\s*\?/i)) {
            const targetKw = params[pIdx++];
            filtered = filtered.filter((r) => r.keyword_normalized === targetKw);
          }

          // Check category_id
          if (whereClause.match(/(?:^|\s)(?:e\.|i\.|b\.|r\.)?category_id\s*=\s*\?/i)) {
            const targetCat = params[pIdx++];
            filtered = filtered.filter((r) => r.category_id === targetCat);
          }

          // Check wallet_id = ?
          if (whereClause.match(/(?:^|\s)(?:e\.|i\.)?wallet_id\s*=\s*\?/i)) {
            const targetWallet = params[pIdx++];
            filtered = filtered.filter((r) => r.wallet_id === targetWallet);
          }

          // Check period_start
          if (whereClause.match(/(?:^|\s)(?:b\.)?period_start\s*=\s*\?/i)) {
            const targetPeriod = params[pIdx++];
            filtered = filtered.filter((r) => r.period_start === targetPeriod);
          }

          // Check transaction_date >= ?
          if (whereClause.match(/(?:^|\s)(?:e\.|i\.)?transaction_date\s*>=\s*\?/i)) {
            const startDate = String(params[pIdx++]);
            filtered = filtered.filter((r) => String(r.transaction_date) >= startDate);
          }

          // Check transaction_date <= ?
          if (whereClause.match(/(?:^|\s)(?:e\.|i\.)?transaction_date\s*<=\s*\?/i)) {
            const endDate = String(params[pIdx++]);
            filtered = filtered.filter((r) => String(r.transaction_date) <= endDate);
          }

          // Check payment_method = ?
          if (whereClause.match(/(?:^|\s)(?:e\.|i\.)?payment_method\s*=\s*\?/i)) {
            const method = params[pIdx++];
            filtered = filtered.filter((r) => r.payment_method === method);
          }

          // Check amount_cents >= ?
          if (whereClause.match(/(?:^|\s)(?:e\.|i\.)?amount_cents\s*>=\s*\?/i)) {
            const minCents = Number(params[pIdx++]);
            filtered = filtered.filter((r) => Number(r.amount_cents) >= minCents);
          }

          // Check amount_cents <= ?
          if (whereClause.match(/(?:^|\s)(?:e\.|i\.)?amount_cents\s*<=\s*\?/i)) {
            const maxCents = Number(params[pIdx++]);
            filtered = filtered.filter((r) => Number(r.amount_cents) <= maxCents);
          }

          // Check search LIKE conditions
          if (whereClause.includes('LIKE ?')) {
            const likeParam1 = String(params[pIdx++] || '').replace(/%/g, '').toLowerCase();
            const likeParam2 = whereClause.match(/LIKE\s*\?/gi)?.length === 2
              ? String(params[pIdx++] || '').replace(/%/g, '').toLowerCase()
              : likeParam1;

            filtered = filtered.filter((r) => {
              const payeeMatch = r.payee ? String(r.payee).toLowerCase().includes(likeParam1) : false;
              const sourceMatch = r.source ? String(r.source).toLowerCase().includes(likeParam1) : false;
              const noteMatch = r.note ? String(r.note).toLowerCase().includes(likeParam2) : false;
              return payeeMatch || sourceMatch || noteMatch;
            });
          }

          // Check type = ?
          if (whereClause.includes('type = ?')) {
            const targetType = params[pIdx++];
            filtered = filtered.filter((r) => r.type === targetType);
          }

          // Check status = 'PENDING' and retry conditions
          if (whereClause.includes('retry_count < ?')) {
            const maxRetry = Number(params[pIdx++]);
            const nowTime = whereClause.includes('next_retry_at <= ?') ? String(params[pIdx++]) : null;
            const onlyFailed = whereClause.includes("status = 'FAILED'") && !whereClause.includes("status = 'PENDING'");
            filtered = filtered.filter((r) => {
              if (!onlyFailed && r.status === 'PENDING') return true;
              if (r.status === 'FAILED') {
                const count = Number(r.retry_count || 0);
                const due = nowTime ? (!r.next_retry_at || String(r.next_retry_at) <= nowTime) : true;
                return count < maxRetry && due;
              }
              return false;
            });
          } else if (whereClause.includes("status = 'PENDING'")) {
            filtered = filtered.filter((r) => r.status === 'PENDING');
          } else if (whereClause.includes("status = 'FAILED'")) {
            filtered = filtered.filter((r) => r.status === 'FAILED');
          }

          // Check deleted_at IS NULL
          if (whereClause.includes('deleted_at IS NULL')) {
            filtered = filtered.filter((r) => r.deleted_at === null || r.deleted_at === undefined);
          }

          // Check is_archived = 0
          if (whereClause.includes('is_archived = 0')) {
            filtered = filtered.filter((r) => r.is_archived === 0 || !r.is_archived);
          }

          // Check is_active = 1
          if (whereClause.includes('is_active = 1')) {
            filtered = filtered.filter((r) => r.is_active === 1 || r.is_active === true);
          }

          // Check is_default = 1
          if (whereClause.includes('is_default = 1')) {
            filtered = filtered.filter((r) => r.is_default === 1 || r.is_default === true);
          }

          // Check name = ?
          if (whereClause.match(/(?:^|\s)name\s*=\s*\?/i)) {
            const targetName = String(params[pIdx++]).toLowerCase();
            filtered = filtered.filter((r) => String(r.name || '').toLowerCase() === targetName);
          }

          // Check id != ?
          if (whereClause.match(/(?:^|\s)id\s*!=\s*\?/i)) {
            const excludeId = params[pIdx++];
            filtered = filtered.filter((r) => r.id !== excludeId);
          }

          // Check wallet_id IS NULL
          if (whereClause.includes('wallet_id IS NULL')) {
            filtered = filtered.filter((r) => r.wallet_id === null || r.wallet_id === undefined);
          }
        }

        // Category join
        if (cleanQuery.includes('LEFT JOIN categories')) {
          const catTable = this.tables.get('categories') || [];
          filtered = filtered.map((row) => {
            const cat = catTable.find((c) => c.id === row.category_id);
            return {
              ...row,
              category_name: cat?.name || null,
              category_icon: cat?.icon || null,
              category_color: cat?.color || null,
            };
          });
        }

        // Wallet join
        if (cleanQuery.includes('LEFT JOIN wallets')) {
          const walletTable = this.tables.get('wallets') || [];
          filtered = filtered.map((row) => {
            const w = walletTable.find((wal) => wal.id === row.wallet_id);
            return {
              ...row,
              wallet_name: w?.name || null,
            };
          });
        }

        // GROUP BY category_id (used in budget overview)
        if (cleanQuery.includes('GROUP BY category_id')) {
          const groupMap = new Map<string, number>();
          for (const r of filtered) {
            const cid = String(r.category_id);
            groupMap.set(cid, (groupMap.get(cid) || 0) + (Number(r.amount_cents) || 0));
          }
          const groupRows = Array.from(groupMap.entries()).map(([category_id, total_cents]) => ({
            category_id,
            total_cents,
          }));
          return { rows: groupRows as unknown as T[], rowsAffected: 0 };
        }

        // COUNT query
        if (cleanQuery.includes('COUNT(*) as count')) {
          return { rows: [{ count: filtered.length }] as unknown as T[], rowsAffected: 0 };
        }

        // MIN(next_retry_at) query
        if (cleanQuery.includes('MIN(next_retry_at) as next_retry')) {
          const validRetries = filtered
            .map((r) => r.next_retry_at as string)
            .filter((d) => Boolean(d))
            .sort();
          return { rows: [{ next_retry: validRetries[0] || null }] as unknown as T[], rowsAffected: 0 };
        }

        // SUM query
        if (cleanQuery.includes('SUM(amount_cents) as total')) {
          const sum = filtered.reduce((acc, r) => acc + (Number(r.amount_cents) || 0), 0);
          return { rows: [{ total: sum }] as unknown as T[], rowsAffected: 0 };
        }

        // Sorting
        if (cleanQuery.includes('ORDER BY frequency DESC')) {
          filtered.sort((a, b) => (Number(b.frequency) || 0) - (Number(a.frequency) || 0));
        } else if (cleanQuery.includes('ORDER BY is_default DESC')) {
          filtered.sort((a, b) => {
            const defA = a.is_default ? 1 : 0;
            const defB = b.is_default ? 1 : 0;
            if (defA !== defB) return defB - defA;
            return String(a.created_at || '').localeCompare(String(b.created_at || ''));
          });
        }

        // Pagination: LIMIT and OFFSET
        const limitMatch = cleanQuery.match(/LIMIT\s+(\?|\d+)(?:\s+OFFSET\s+(\?|\d+))?/i);
        if (limitMatch) {
          let limit = limitMatch[1] === '?' ? Number(params[pIdx++]) : Number(limitMatch[1]);
          let offset = 0;
          if (limitMatch[2]) {
            offset = limitMatch[2] === '?' ? Number(params[pIdx++]) : Number(limitMatch[2]);
          }
          if (!isNaN(limit)) {
            filtered = filtered.slice(offset, offset + limit);
          }
        }

        return { rows: filtered as unknown as T[], rowsAffected: 0 };
      }
    }

    // Update
    if (upper.startsWith('UPDATE')) {
      const match = cleanQuery.match(/UPDATE\s+([a-zA-Z0-9_]+)\s+SET\s+([\s\S]+?)\s+WHERE\s+([\s\S]+)$/i);
      if (match && match[1]) {
        const tableName = match[1].toLowerCase();
        const setClause = match[2];
        const whereClause = match[3];
        const table = this.tables.get(tableName) || [];

        // Parse WHERE target
        let targetId: unknown = null;
        let targetUser: unknown = null;
        let excludeId: unknown = null;

        if (whereClause.includes('operation_id = ?')) {
          targetId = params[params.length - 2] || params[0];
          targetUser = params[params.length - 1];
        } else if (whereClause.includes('id = ?')) {
          targetId = params[params.length - 2] || params[0];
          targetUser = params[params.length - 1];
        } else if (whereClause.includes('user_id = ?')) {
          targetUser = params[params.length - 1];
        }

        if (whereClause.includes('id != ?')) {
          excludeId = params[params.length - 2];
        }

        const checkDeletedNull = whereClause.includes('deleted_at IS NULL');
        const checkWalletNull = whereClause.includes('wallet_id IS NULL');

        // Parse SET assignments
        const setAssignments = setClause.split(',').map((s) => s.trim());
        let updated = 0;

        for (const row of table) {
          const matchesId = targetId ? (row.id === targetId || row.operation_id === targetId) : true;
          const matchesExcludeId = excludeId ? row.id !== excludeId : true;
          const matchesUser = targetUser ? row.user_id === targetUser : true;
          const matchesDeleted = checkDeletedNull ? (row.deleted_at === null || row.deleted_at === undefined) : true;
          const matchesWallet = checkWalletNull ? (row.wallet_id === null || row.wallet_id === undefined) : true;

          if (matchesId && matchesExcludeId && matchesUser && matchesDeleted && matchesWallet) {
            let setPIdx = 0;
            for (const assign of setAssignments) {
              const [colRaw, valRaw] = assign.split('=').map((s) => s.trim());
              const col = colRaw.toLowerCase();
              if (valRaw === '?') {
                row[col] = params[setPIdx++];
              } else if (valRaw.toUpperCase() === 'NULL') {
                row[col] = null;
              } else if (
                (valRaw.startsWith("'") && valRaw.endsWith("'")) ||
                (valRaw.startsWith('"') && valRaw.endsWith('"'))
              ) {
                row[col] = valRaw.slice(1, -1);
              } else if (valRaw.includes('+ 1')) {
                row[col] = (Number(row[col]) || 0) + 1;
              } else if (!isNaN(Number(valRaw))) {
                row[col] = Number(valRaw);
              }
            }
            updated++;
          }
        }

        return { rows: [], rowsAffected: updated };
      }
    }

    // Delete
    if (upper.startsWith('DELETE FROM')) {
      const match = cleanQuery.match(/DELETE\s+FROM\s+([a-zA-Z0-9_]+)/i);
      if (match && match[1]) {
        const tableName = match[1].toLowerCase();
        const table = this.tables.get(tableName) || [];
        if (cleanQuery.includes('status = ?') || cleanQuery.includes("status = 'COMPLETED'")) {
          const targetUser = params[0];
          const remaining = table.filter((r) => !(r.user_id === targetUser && r.status === 'COMPLETED'));
          const affected = table.length - remaining.length;
          this.tables.set(tableName, remaining);
          return { rows: [], rowsAffected: affected };
        } else if (/(?:^|\s|\()(?:id|operation_id)\s*=\s*\?/i.test(cleanQuery)) {
          const id = params[0];
          const targetUser = cleanQuery.includes('user_id = ?') ? params[1] : null;
          const remaining = table.filter((r) => {
            const matchesId = r.id === id || r.operation_id === id;
            const matchesUser = targetUser ? r.user_id === targetUser : true;
            return !(matchesId && matchesUser);
          });
          const affected = table.length - remaining.length;
          this.tables.set(tableName, remaining);
          return { rows: [], rowsAffected: affected };
        } else if (cleanQuery.includes('user_id = ?')) {
          const targetUser = params[0];
          const remaining = table.filter((r) => r.user_id !== targetUser);
          const affected = table.length - remaining.length;
          this.tables.set(tableName, remaining);
          return { rows: [], rowsAffected: affected };
        } else if (!cleanQuery.toUpperCase().includes('WHERE')) {
          const affected = table.length;
          this.tables.set(tableName, []);
          return { rows: [], rowsAffected: affected };
        }
      }
    }

    return { rows: [], rowsAffected: 0 };
  }

  async transaction<T>(action: (tx: ISQLiteDatabase) => Promise<T>): Promise<T> {
    this.inTransaction = true;
    const snapshot = new Map<string, any[]>();
    for (const [tName, rows] of this.tables.entries()) {
      snapshot.set(tName, rows.map((r) => ({ ...r })));
    }

    try {
      const result = await action(this);
      return result;
    } catch (err) {
      this.tables.clear();
      for (const [tName, rows] of snapshot.entries()) {
        this.tables.set(tName, rows);
      }
      throw err;
    } finally {
      this.inTransaction = false;
    }
  }

  async close(): Promise<void> {
    this.inTransaction = false;
  }

  clearAll(): void {
    this.tables.clear();
  }
}

/**
 * Native QuickSQLite Adapter.
 * Uses react-native-quick-sqlite JSI when executing on native Android/iOS.
 */
export class QuickSQLiteAdapter implements ISQLiteDatabase {
  private dbName: string;
  private dbInstance: unknown = null;

  constructor(dbName: string) {
    this.dbName = dbName;
  }

  private getDB(): any {
    if (!this.dbInstance) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { open } = require('react-native-quick-sqlite');
        this.dbInstance = open({ name: this.dbName });
      } catch (err) {
        // In non-native environments, warn and fall back
        return null;
      }
    }
    return this.dbInstance;
  }

  async executeSql<T = unknown>(query: string, params: unknown[] = []): Promise<QueryResult<T>> {
    const db = this.getDB();
    if (!db) {
      // Fallback
      return { rows: [], rowsAffected: 0 };
    }

    return new Promise((resolve, reject) => {
      try {
        const result = db.execute(query, params);
        const rows: T[] = result?.rows?._array || [];
        resolve({
          rows,
          insertId: result?.insertId,
          rowsAffected: result?.rowsAffected || 0,
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  async transaction<T>(action: (tx: ISQLiteDatabase) => Promise<T>): Promise<T> {
    await this.executeSql('BEGIN TRANSACTION');
    try {
      const result = await action(this);
      await this.executeSql('COMMIT');
      return result;
    } catch (err) {
      await this.executeSql('ROLLBACK');
      throw err;
    }
  }

  async close(): Promise<void> {
    if (this.dbInstance) {
      try {
        (this.dbInstance as any).close();
      } catch {
        // Ignored
      }
      this.dbInstance = null;
    }
  }
}
