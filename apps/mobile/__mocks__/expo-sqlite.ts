/**
 * Mock for expo-sqlite (SDK 54 API).
 *
 * Provides an in-memory store that simulates SQLite table operations.
 * Used by Jest tests for localDb service and any module that depends on expo-sqlite.
 */

type Row = Record<string, unknown>;

interface MockDatabase {
  execAsync: jest.Mock;
  runAsync: jest.Mock;
  getAllAsync: jest.Mock;
  getFirstAsync: jest.Mock;
}

// In-memory table storage for realistic mock behavior
const tables: Map<string, Row[]> = new Map();

function resetTables(): void {
  tables.clear();
}

function getTable(name: string): Row[] {
  if (!tables.has(name)) {
    tables.set(name, []);
  }
  return tables.get(name)!;
}

// Auto-increment counter for pending_messages
let autoIncrementId = 0;

const mockDb: MockDatabase = {
  execAsync: jest.fn(async (sql: string) => {
    // Handle CREATE TABLE statements by initializing empty tables
    const createMatch = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/i);
    if (createMatch) {
      const tableName = createMatch[1];
      if (!tables.has(tableName)) {
        tables.set(tableName, []);
      }
    }
    return undefined;
  }),

  runAsync: jest.fn(async (sql: string, params?: unknown[]) => {
    const p = params || [];

    // INSERT OR REPLACE INTO modules_cache
    if (sql.includes('INSERT OR REPLACE INTO modules_cache')) {
      const table = getTable('modules_cache');
      const existing = table.findIndex((r) => r.module_id === p[0]);
      const row: Row = {
        module_id: p[0],
        spec: p[1],
        status: p[2],
        updated_at: p[3],
        cached_at: p[4],
      };
      if (existing >= 0) {
        table[existing] = row;
      } else {
        table.push(row);
      }
      return { changes: 1, lastInsertRowId: 0 };
    }

    // INSERT INTO pending_messages
    if (sql.includes('INSERT INTO pending_messages')) {
      const table = getTable('pending_messages');
      autoIncrementId++;
      table.push({
        id: autoIncrementId,
        message: p[0],
        created_at: p[1],
      });
      return { changes: 1, lastInsertRowId: autoIncrementId };
    }

    // DELETE FROM modules_cache WHERE module_id = ?
    if (sql.includes('DELETE FROM modules_cache WHERE module_id')) {
      const table = getTable('modules_cache');
      const idx = table.findIndex((r) => r.module_id === p[0]);
      if (idx >= 0) table.splice(idx, 1);
      return { changes: idx >= 0 ? 1 : 0, lastInsertRowId: 0 };
    }

    // DELETE FROM modules_cache (clear all)
    if (sql.match(/DELETE FROM modules_cache\s*$/i) || sql === 'DELETE FROM modules_cache') {
      const table = getTable('modules_cache');
      const count = table.length;
      table.length = 0;
      return { changes: count, lastInsertRowId: 0 };
    }

    // DELETE FROM pending_messages WHERE id <= ?
    if (sql.includes('DELETE FROM pending_messages WHERE id <=')) {
      const table = getTable('pending_messages');
      const maxId = p[0] as number;
      const before = table.length;
      const remaining = table.filter((r) => (r.id as number) > maxId);
      table.length = 0;
      table.push(...remaining);
      return { changes: before - remaining.length, lastInsertRowId: 0 };
    }

    // DELETE FROM pending_messages (clear all)
    if (sql.match(/DELETE FROM pending_messages\s*$/i) || sql === 'DELETE FROM pending_messages') {
      const table = getTable('pending_messages');
      const count = table.length;
      table.length = 0;
      return { changes: count, lastInsertRowId: 0 };
    }

    return { changes: 0, lastInsertRowId: 0 };
  }),

  getAllAsync: jest.fn(async (sql: string) => {
    // SELECT * FROM modules_cache ORDER BY updated_at DESC
    if (sql.includes('FROM modules_cache')) {
      const table = getTable('modules_cache');
      return [...table].sort((a, b) =>
        String(b.updated_at).localeCompare(String(a.updated_at)),
      );
    }

    // SELECT * FROM pending_messages ORDER BY id ASC
    if (sql.includes('FROM pending_messages')) {
      const table = getTable('pending_messages');
      return [...table].sort((a, b) => (a.id as number) - (b.id as number));
    }

    return [];
  }),

  getFirstAsync: jest.fn(async (sql: string) => {
    // SELECT COUNT(*) as count FROM pending_messages
    if (sql.includes('COUNT(*)') && sql.includes('pending_messages')) {
      return { count: getTable('pending_messages').length };
    }
    return null;
  }),
};

export function openDatabaseSync(_name: string): MockDatabase {
  return mockDb;
}

// Test utility exports for resetting state between tests
export const __mockDb = mockDb;
export const __resetTables = resetTables;
export const __resetAutoIncrement = () => {
  autoIncrementId = 0;
};
