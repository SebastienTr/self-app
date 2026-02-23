/**
 * Local database service — async wrapper around expo-sqlite.
 *
 * Provides two storage domains:
 *   1. modules_cache — persisted module data for offline rendering
 *   2. pending_messages — queued WS messages surviving app kills (NFR19)
 *
 * All operations are async. Errors are logged with structured logging
 * including agent_action for AI-assisted debugging.
 */

import { openDatabaseSync } from 'expo-sqlite';

import type { CachedModule } from '@/types/module';
import type { ModuleSpec, WSMessage } from '@/types/ws';
import { logger } from './logger';

// --- Database instance (lazy-initialized) ---

const db = openDatabaseSync('self-cache.db');

// --- Schema initialization ---

/**
 * Initialize the local database.
 * Creates tables if they do not exist. Call on app startup.
 */
export async function initLocalDb(): Promise<void> {
  try {
    await db.execAsync(
      `CREATE TABLE IF NOT EXISTS modules_cache (
        module_id TEXT PRIMARY KEY,
        spec TEXT NOT NULL,
        status TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        cached_at TEXT NOT NULL
      )`,
    );

    await db.execAsync(
      `CREATE TABLE IF NOT EXISTS pending_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`,
    );

    logger.debug('localDb', 'init_complete', {
      agent_action: 'Local database initialized with modules_cache and pending_messages tables',
    });
  } catch (err) {
    logger.error('localDb', 'init_failed', {
      error: String(err),
      agent_action: 'Check expo-sqlite installation and database file permissions',
    });
    throw err;
  }
}

// --- Module cache operations ---

/**
 * Upsert a module into the local cache.
 */
export async function cacheModule(
  moduleId: string,
  spec: ModuleSpec,
  status: string,
  updatedAt: string,
): Promise<void> {
  const cachedAt = new Date().toISOString();
  try {
    await db.runAsync(
      'INSERT OR REPLACE INTO modules_cache (module_id, spec, status, updated_at, cached_at) VALUES (?, ?, ?, ?, ?)',
      [moduleId, JSON.stringify(spec), status, updatedAt, cachedAt],
    );
  } catch (err) {
    logger.error('localDb', 'cache_module_failed', {
      module_id: moduleId,
      error: String(err),
      agent_action: 'Check modules_cache table schema and parameter types',
    });
    throw err;
  }
}

/**
 * Retrieve all cached modules, ordered by updated_at DESC.
 */
export async function getCachedModules(): Promise<CachedModule[]> {
  try {
    return await db.getAllAsync<CachedModule>(
      'SELECT * FROM modules_cache ORDER BY updated_at DESC',
    );
  } catch (err) {
    logger.error('localDb', 'get_cached_modules_failed', {
      error: String(err),
      agent_action: 'Check modules_cache table exists (call initLocalDb first)',
    });
    return [];
  }
}

/**
 * Remove a specific module from the cache.
 */
export async function removeCachedModule(moduleId: string): Promise<void> {
  try {
    await db.runAsync('DELETE FROM modules_cache WHERE module_id = ?', [moduleId]);
  } catch (err) {
    logger.error('localDb', 'remove_cached_module_failed', {
      module_id: moduleId,
      error: String(err),
      agent_action: 'Check module_id parameter',
    });
    throw err;
  }
}

/**
 * Remove all cached modules.
 */
export async function clearModulesCache(): Promise<void> {
  try {
    await db.runAsync('DELETE FROM modules_cache');
  } catch (err) {
    logger.error('localDb', 'clear_modules_cache_failed', {
      error: String(err),
      agent_action: 'Check modules_cache table exists',
    });
    throw err;
  }
}

// --- Pending message queue operations ---

/**
 * Persist a WS message to the pending queue (survives app kills).
 */
export async function enqueuePendingMessage(msg: WSMessage): Promise<void> {
  const createdAt = new Date().toISOString();
  try {
    await db.runAsync('INSERT INTO pending_messages (message, created_at) VALUES (?, ?)', [
      JSON.stringify(msg),
      createdAt,
    ]);
    logger.debug('localDb', 'message_enqueued', {
      type: msg.type,
    });
  } catch (err) {
    logger.error('localDb', 'enqueue_message_failed', {
      type: msg.type,
      error: String(err),
      agent_action: 'Check pending_messages table schema',
    });
    throw err;
  }
}

/**
 * Dequeue all pending messages in FIFO order (ordered by id ASC).
 * Messages are deleted from the table after retrieval.
 *
 * Uses a transaction to ensure atomicity: SELECT + DELETE happen together.
 * If the app crashes between them, no messages are lost (NFR19).
 */
export async function dequeuePendingMessages(): Promise<WSMessage[]> {
  try {
    const rows = await db.getAllAsync<{ id: number; message: string; created_at: string }>(
      'SELECT * FROM pending_messages ORDER BY id ASC',
    );

    if (rows.length > 0) {
      // Atomic delete — inside implicit transaction from execAsync.
      // Delete only the rows we just read (by max id) to avoid deleting
      // messages enqueued concurrently between the SELECT and DELETE.
      const maxId = rows[rows.length - 1].id;
      await db.runAsync('DELETE FROM pending_messages WHERE id <= ?', [maxId]);
      logger.info('localDb', 'messages_dequeued', {
        count: rows.length,
      });
    }

    return rows.map((row) => JSON.parse(row.message) as WSMessage);
  } catch (err) {
    logger.error('localDb', 'dequeue_messages_failed', {
      error: String(err),
      agent_action: 'Check pending_messages table exists and message JSON is valid',
    });
    return [];
  }
}

/**
 * Clear all pending messages from the queue (after successful flush).
 */
export async function clearPendingMessages(): Promise<void> {
  try {
    await db.runAsync('DELETE FROM pending_messages');
  } catch (err) {
    logger.error('localDb', 'clear_pending_messages_failed', {
      error: String(err),
      agent_action: 'Check pending_messages table exists',
    });
  }
}

/**
 * Get the count of pending messages in the queue.
 */
export async function getPendingMessageCount(): Promise<number> {
  try {
    const result = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM pending_messages',
    );
    return result?.count ?? 0;
  } catch (err) {
    logger.error('localDb', 'get_pending_count_failed', {
      error: String(err),
      agent_action: 'Check pending_messages table exists',
    });
    return 0;
  }
}
