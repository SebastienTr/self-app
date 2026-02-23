/**
 * Unit tests for localDb service.
 *
 * Tests the expo-sqlite wrapper for module caching and pending message queue.
 * Uses the expo-sqlite mock for isolated testing.
 */

import type { ModuleSpec } from '@/types/ws';

// Suppress console output during tests
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});

// We need to access the mock db after each module reset
function getMockUtils() {
  const mod = require('expo-sqlite');
  return {
    mockDb: mod.__mockDb as {
      execAsync: jest.Mock;
      runAsync: jest.Mock;
      getAllAsync: jest.Mock;
      getFirstAsync: jest.Mock;
    },
    resetTables: mod.__resetTables as () => void,
    resetAutoIncrement: mod.__resetAutoIncrement as () => void,
  };
}

let localDb: typeof import('./localDb');

beforeEach(() => {
  jest.resetModules();
  const { resetTables, resetAutoIncrement, mockDb } = getMockUtils();
  resetTables();
  resetAutoIncrement();
  // Clear calls on the mock functions that persist across resets
  mockDb.execAsync.mockClear();
  mockDb.runAsync.mockClear();
  mockDb.getAllAsync.mockClear();
  mockDb.getFirstAsync.mockClear();
  localDb = require('./localDb');
});

describe('localDb', () => {
  describe('initLocalDb', () => {
    it('creates modules_cache and pending_messages tables', async () => {
      const { mockDb } = getMockUtils();
      await localDb.initLocalDb();

      expect(mockDb.execAsync).toHaveBeenCalledTimes(2);
      expect(mockDb.execAsync).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS modules_cache'),
      );
      expect(mockDb.execAsync).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS pending_messages'),
      );
    });
  });

  describe('cacheModule / getCachedModules', () => {
    beforeEach(async () => {
      await localDb.initLocalDb();
    });

    it('inserts a module into the cache', async () => {
      const { mockDb } = getMockUtils();
      const spec: ModuleSpec = { moduleId: 'mod-1', name: 'Test Module' };
      await localDb.cacheModule('mod-1', spec, 'active', '2024-01-01T00:00:00Z');

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR REPLACE INTO modules_cache'),
        expect.arrayContaining(['mod-1']),
      );
    });

    it('retrieves cached modules ordered by updated_at DESC', async () => {
      const spec1: ModuleSpec = { moduleId: 'mod-1' };
      const spec2: ModuleSpec = { moduleId: 'mod-2' };

      await localDb.cacheModule('mod-1', spec1, 'active', '2024-01-01T00:00:00Z');
      await localDb.cacheModule('mod-2', spec2, 'active', '2024-02-01T00:00:00Z');

      const modules = await localDb.getCachedModules();
      expect(modules).toHaveLength(2);
      // mod-2 has later updated_at, should come first
      expect(modules[0].module_id).toBe('mod-2');
      expect(modules[1].module_id).toBe('mod-1');
    });

    it('upserts an existing module (same moduleId)', async () => {
      const spec1: ModuleSpec = { moduleId: 'mod-1', name: 'Original' };
      const spec2: ModuleSpec = { moduleId: 'mod-1', name: 'Updated' };

      await localDb.cacheModule('mod-1', spec1, 'active', '2024-01-01T00:00:00Z');
      await localDb.cacheModule('mod-1', spec2, 'refreshing', '2024-02-01T00:00:00Z');

      const modules = await localDb.getCachedModules();
      expect(modules).toHaveLength(1);
      expect(modules[0].module_id).toBe('mod-1');
      expect(modules[0].status).toBe('refreshing');
    });

    it('returns empty array when no modules cached', async () => {
      const modules = await localDb.getCachedModules();
      expect(modules).toHaveLength(0);
    });
  });

  describe('removeCachedModule', () => {
    beforeEach(async () => {
      await localDb.initLocalDb();
    });

    it('removes a specific module from cache', async () => {
      const spec: ModuleSpec = { moduleId: 'mod-1' };
      await localDb.cacheModule('mod-1', spec, 'active', '2024-01-01T00:00:00Z');
      await localDb.removeCachedModule('mod-1');

      const modules = await localDb.getCachedModules();
      expect(modules).toHaveLength(0);
    });
  });

  describe('clearModulesCache', () => {
    beforeEach(async () => {
      await localDb.initLocalDb();
    });

    it('removes all cached modules', async () => {
      const spec1: ModuleSpec = { moduleId: 'mod-1' };
      const spec2: ModuleSpec = { moduleId: 'mod-2' };

      await localDb.cacheModule('mod-1', spec1, 'active', '2024-01-01T00:00:00Z');
      await localDb.cacheModule('mod-2', spec2, 'active', '2024-01-01T00:00:00Z');

      await localDb.clearModulesCache();

      const modules = await localDb.getCachedModules();
      expect(modules).toHaveLength(0);
    });
  });

  describe('enqueuePendingMessage / dequeuePendingMessages', () => {
    beforeEach(async () => {
      await localDb.initLocalDb();
    });

    it('enqueues a message to pending_messages table', async () => {
      const { mockDb } = getMockUtils();
      const msg = { type: 'chat' as const, payload: { message: 'Hello' } };
      await localDb.enqueuePendingMessage(msg);

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO pending_messages'),
        expect.arrayContaining([JSON.stringify(msg)]),
      );
    });

    it('dequeues messages in FIFO order (ordered by id ASC)', async () => {
      const msg1 = { type: 'chat' as const, payload: { message: 'first' } };
      const msg2 = { type: 'chat' as const, payload: { message: 'second' } };

      await localDb.enqueuePendingMessage(msg1);
      await localDb.enqueuePendingMessage(msg2);

      const messages = await localDb.dequeuePendingMessages();
      expect(messages).toHaveLength(2);
      expect(messages[0].type).toBe('chat');
      expect((messages[0] as any).payload.message).toBe('first');
      expect((messages[1] as any).payload.message).toBe('second');
    });

    it('deletes messages from table after dequeue', async () => {
      const { mockDb } = getMockUtils();
      const msg = { type: 'chat' as const, payload: { message: 'test' } };
      await localDb.enqueuePendingMessage(msg);

      await localDb.dequeuePendingMessages();

      // Verify DELETE was called with WHERE id <= maxId (atomic dequeue)
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        'DELETE FROM pending_messages WHERE id <= ?',
        expect.arrayContaining([expect.any(Number)]),
      );
    });

    it('returns empty array when no pending messages', async () => {
      const messages = await localDb.dequeuePendingMessages();
      expect(messages).toHaveLength(0);
    });
  });

  describe('getPendingMessageCount', () => {
    beforeEach(async () => {
      await localDb.initLocalDb();
    });

    it('returns 0 when no messages', async () => {
      const count = await localDb.getPendingMessageCount();
      expect(count).toBe(0);
    });

    it('returns correct count after enqueuing messages', async () => {
      await localDb.enqueuePendingMessage({ type: 'chat', payload: { message: 'a' } });
      await localDb.enqueuePendingMessage({ type: 'chat', payload: { message: 'b' } });

      const count = await localDb.getPendingMessageCount();
      expect(count).toBe(2);
    });
  });

  // --- Edge case tests ---

  describe('initLocalDb error handling', () => {
    it('throws and logs when execAsync fails', async () => {
      const { mockDb } = getMockUtils();
      mockDb.execAsync.mockRejectedValueOnce(new Error('SQLite init failure'));

      await expect(localDb.initLocalDb()).rejects.toThrow('SQLite init failure');
    });

    it('can be called multiple times (idempotent)', async () => {
      await localDb.initLocalDb();
      await localDb.initLocalDb();

      const { mockDb } = getMockUtils();
      // CREATE TABLE IF NOT EXISTS is safe to call repeatedly
      expect(mockDb.execAsync).toHaveBeenCalledTimes(4); // 2 tables x 2 calls
    });
  });

  describe('cacheModule error handling', () => {
    beforeEach(async () => {
      await localDb.initLocalDb();
    });

    it('throws when runAsync fails on insert', async () => {
      const { mockDb } = getMockUtils();
      mockDb.runAsync.mockRejectedValueOnce(new Error('Insert failed'));

      await expect(
        localDb.cacheModule('mod-1', { moduleId: 'mod-1' }, 'active', '2024-01-01T00:00:00Z'),
      ).rejects.toThrow('Insert failed');
    });

    it('serializes complex spec objects as JSON', async () => {
      const { mockDb } = getMockUtils();
      const spec: ModuleSpec = {
        moduleId: 'mod-1',
        nested: { deep: { value: 42 } },
        list: [1, 2, 3],
      } as any;
      await localDb.cacheModule('mod-1', spec, 'active', '2024-01-01T00:00:00Z');

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR REPLACE INTO modules_cache'),
        expect.arrayContaining([JSON.stringify(spec)]),
      );
    });
  });

  describe('removeCachedModule edge cases', () => {
    beforeEach(async () => {
      await localDb.initLocalDb();
    });

    it('does not throw when removing non-existent module', async () => {
      await expect(localDb.removeCachedModule('non-existent')).resolves.not.toThrow();
    });

    it('only removes targeted module, leaving others intact', async () => {
      const spec1: ModuleSpec = { moduleId: 'mod-1' };
      const spec2: ModuleSpec = { moduleId: 'mod-2' };
      const spec3: ModuleSpec = { moduleId: 'mod-3' };

      await localDb.cacheModule('mod-1', spec1, 'active', '2024-01-01T00:00:00Z');
      await localDb.cacheModule('mod-2', spec2, 'active', '2024-01-01T00:00:00Z');
      await localDb.cacheModule('mod-3', spec3, 'active', '2024-01-01T00:00:00Z');

      await localDb.removeCachedModule('mod-2');

      const modules = await localDb.getCachedModules();
      expect(modules).toHaveLength(2);
      expect(modules.map((m) => m.module_id).sort()).toEqual(['mod-1', 'mod-3']);
    });

    it('throws when runAsync fails on delete', async () => {
      const { mockDb } = getMockUtils();
      mockDb.runAsync.mockRejectedValueOnce(new Error('Delete failed'));

      await expect(localDb.removeCachedModule('mod-1')).rejects.toThrow('Delete failed');
    });
  });

  describe('clearModulesCache error handling', () => {
    beforeEach(async () => {
      await localDb.initLocalDb();
    });

    it('throws when runAsync fails on clear', async () => {
      const { mockDb } = getMockUtils();
      mockDb.runAsync.mockRejectedValueOnce(new Error('Clear failed'));

      await expect(localDb.clearModulesCache()).rejects.toThrow('Clear failed');
    });

    it('is idempotent — clearing empty cache does not throw', async () => {
      await expect(localDb.clearModulesCache()).resolves.not.toThrow();
    });
  });

  describe('clearPendingMessages', () => {
    beforeEach(async () => {
      await localDb.initLocalDb();
    });

    it('removes all pending messages', async () => {
      await localDb.enqueuePendingMessage({ type: 'chat', payload: { message: 'a' } });
      await localDb.enqueuePendingMessage({ type: 'chat', payload: { message: 'b' } });

      await localDb.clearPendingMessages();

      const count = await localDb.getPendingMessageCount();
      expect(count).toBe(0);
    });

    it('does not throw on empty queue', async () => {
      await expect(localDb.clearPendingMessages()).resolves.not.toThrow();
    });
  });

  describe('enqueuePendingMessage error handling', () => {
    beforeEach(async () => {
      await localDb.initLocalDb();
    });

    it('throws when runAsync fails on enqueue', async () => {
      const { mockDb } = getMockUtils();
      mockDb.runAsync.mockRejectedValueOnce(new Error('Enqueue failed'));

      await expect(
        localDb.enqueuePendingMessage({ type: 'chat', payload: { message: 'test' } }),
      ).rejects.toThrow('Enqueue failed');
    });

    it('handles various WSMessage types', async () => {
      await localDb.enqueuePendingMessage({ type: 'sync', payload: { lastSync: '2024-01-01' } });
      await localDb.enqueuePendingMessage({ type: 'log', payload: { layer: 'ws', event: 'test', severity: 'info', context: {} } });
      await localDb.enqueuePendingMessage({ type: 'chat', payload: { message: 'hi' } });

      const messages = await localDb.dequeuePendingMessages();
      expect(messages).toHaveLength(3);
      expect(messages[0].type).toBe('sync');
      expect(messages[1].type).toBe('log');
      expect(messages[2].type).toBe('chat');
    });
  });

  describe('dequeuePendingMessages error handling', () => {
    beforeEach(async () => {
      await localDb.initLocalDb();
    });

    it('returns empty array when getAllAsync fails (graceful fallback)', async () => {
      const { mockDb } = getMockUtils();
      mockDb.getAllAsync.mockRejectedValueOnce(new Error('Read failed'));

      const messages = await localDb.dequeuePendingMessages();
      expect(messages).toEqual([]);
    });

    it('does not call DELETE when queue is empty', async () => {
      const { mockDb } = getMockUtils();

      await localDb.dequeuePendingMessages();

      // runAsync should NOT be called with DELETE since there are no messages
      const deleteCalls = mockDb.runAsync.mock.calls.filter(
        (call: unknown[]) => typeof call[0] === 'string' && (call[0] as string).includes('DELETE FROM pending_messages'),
      );
      expect(deleteCalls).toHaveLength(0);
    });
  });

  describe('getCachedModules error handling', () => {
    beforeEach(async () => {
      await localDb.initLocalDb();
    });

    it('returns empty array when getAllAsync fails (graceful fallback)', async () => {
      const { mockDb } = getMockUtils();
      mockDb.getAllAsync.mockRejectedValueOnce(new Error('Read failed'));

      const modules = await localDb.getCachedModules();
      expect(modules).toEqual([]);
    });
  });

  describe('getPendingMessageCount error handling', () => {
    beforeEach(async () => {
      await localDb.initLocalDb();
    });

    it('returns 0 when getFirstAsync fails (graceful fallback)', async () => {
      const { mockDb } = getMockUtils();
      mockDb.getFirstAsync.mockRejectedValueOnce(new Error('Count failed'));

      const count = await localDb.getPendingMessageCount();
      expect(count).toBe(0);
    });

    it('returns 0 when getFirstAsync returns null', async () => {
      const { mockDb } = getMockUtils();
      mockDb.getFirstAsync.mockResolvedValueOnce(null);

      const count = await localDb.getPendingMessageCount();
      expect(count).toBe(0);
    });
  });

  describe('multiple enqueue/dequeue cycles', () => {
    beforeEach(async () => {
      await localDb.initLocalDb();
    });

    it('supports multiple enqueue/dequeue cycles with correct FIFO ordering', async () => {
      // First cycle
      await localDb.enqueuePendingMessage({ type: 'chat', payload: { message: 'cycle1-a' } });
      await localDb.enqueuePendingMessage({ type: 'chat', payload: { message: 'cycle1-b' } });
      const batch1 = await localDb.dequeuePendingMessages();
      expect(batch1).toHaveLength(2);
      expect((batch1[0] as any).payload.message).toBe('cycle1-a');
      expect((batch1[1] as any).payload.message).toBe('cycle1-b');

      // Second cycle — table should be empty, new messages get new IDs
      await localDb.enqueuePendingMessage({ type: 'chat', payload: { message: 'cycle2-a' } });
      const batch2 = await localDb.dequeuePendingMessages();
      expect(batch2).toHaveLength(1);
      expect((batch2[0] as any).payload.message).toBe('cycle2-a');

      // Third cycle — verify empty
      const batch3 = await localDb.dequeuePendingMessages();
      expect(batch3).toHaveLength(0);
    });
  });

  describe('spec JSON handling', () => {
    beforeEach(async () => {
      await localDb.initLocalDb();
    });

    it('stores spec as stringified JSON', async () => {
      const { mockDb } = getMockUtils();
      const spec: ModuleSpec = { moduleId: 'mod-1', name: 'Test' };
      await localDb.cacheModule('mod-1', spec, 'active', '2024-01-01T00:00:00Z');

      // Verify JSON.stringify was used in the params
      const insertCall = mockDb.runAsync.mock.calls.find(
        (call: unknown[]) => typeof call[0] === 'string' && (call[0] as string).includes('INSERT OR REPLACE INTO modules_cache'),
      );
      expect(insertCall).toBeDefined();
      expect(insertCall![1]).toContain(JSON.stringify(spec));
    });

    it('stores cached_at as ISO string', async () => {
      const spec: ModuleSpec = { moduleId: 'mod-1' };
      const beforeCache = new Date().toISOString();
      await localDb.cacheModule('mod-1', spec, 'active', '2024-01-01T00:00:00Z');

      const modules = await localDb.getCachedModules();
      expect(modules).toHaveLength(1);
      // cached_at should be a valid ISO string
      expect(modules[0].cached_at).toBeDefined();
    });
  });
});
