/**
 * Unit tests for moduleSync — WS message handler registration for module messages.
 *
 * Tests handler registration and message routing for module_created,
 * module_updated, module_list, and module_sync.
 */

// Suppress console output during tests
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});

// Track registered handlers from wsClient.onMessage — must start with 'mock' prefix
type MockMessageHandler = (msg: any) => void;
const mockRegisteredHandlers = new Map<string, MockMessageHandler>();

jest.mock('@/services/wsClient', () => ({
  onMessage: jest.fn((type: string, handler: MockMessageHandler) => {
    mockRegisteredHandlers.set(type, handler);
    return () => {
      mockRegisteredHandlers.delete(type);
    };
  }),
}));

// Mock localDb
jest.mock('@/services/localDb', () => ({
  cacheModule: jest.fn(async () => {}),
  removeCachedModule: jest.fn(async () => {}),
  clearModulesCache: jest.fn(async () => {}),
}));

let useModuleStore: typeof import('@/stores/moduleStore').useModuleStore;
let useConnectionStore: typeof import('@/stores/connectionStore').useConnectionStore;

beforeEach(() => {
  jest.resetModules();
  mockRegisteredHandlers.clear();

  // Re-apply mocks after resetModules
  jest.mock('@/services/wsClient', () => ({
    onMessage: jest.fn((type: string, handler: MockMessageHandler) => {
      mockRegisteredHandlers.set(type, handler);
      return () => {
        mockRegisteredHandlers.delete(type);
      };
    }),
  }));
  jest.mock('@/services/localDb', () => ({
    cacheModule: jest.fn(async () => {}),
    removeCachedModule: jest.fn(async () => {}),
    clearModulesCache: jest.fn(async () => {}),
  }));

  useModuleStore = require('@/stores/moduleStore').useModuleStore;
  useConnectionStore = require('@/stores/connectionStore').useConnectionStore;

  // Reset stores
  useModuleStore.setState({ modules: new Map() });
  useConnectionStore.setState({
    status: 'connected',
    reconnectAttempts: 0,
    lastSync: null,
    backendUrl: 'ws://localhost:8000/ws',
  });

  // Initialize moduleSync (registers handlers)
  require('./moduleSync').initModuleSync();
});

describe('moduleSync', () => {
  it('registers handlers for module_created, module_updated, module_list, module_sync', () => {
    expect(mockRegisteredHandlers.has('module_created')).toBe(true);
    expect(mockRegisteredHandlers.has('module_updated')).toBe(true);
    expect(mockRegisteredHandlers.has('module_list')).toBe(true);
    expect(mockRegisteredHandlers.has('module_sync')).toBe(true);
  });

  describe('module_created handler', () => {
    it('adds module to store', () => {
      const handler = mockRegisteredHandlers.get('module_created')!;
      handler({
        type: 'module_created',
        payload: { moduleId: 'mod-1', name: 'New Module' },
      });

      const mod = useModuleStore.getState().getModule('mod-1');
      expect(mod).toBeDefined();
      expect(mod!.spec.moduleId).toBe('mod-1');
    });
  });

  describe('module_updated handler', () => {
    it('updates module in store', () => {
      // First add a module
      useModuleStore.getState().addModule(
        { moduleId: 'mod-1', name: 'Original' },
        '2024-01-01T00:00:00Z',
      );

      const handler = mockRegisteredHandlers.get('module_updated')!;
      handler({
        type: 'module_updated',
        payload: {
          moduleId: 'mod-1',
          spec: { moduleId: 'mod-1', name: 'Updated' },
        },
      });

      const mod = useModuleStore.getState().getModule('mod-1');
      expect(mod).toBeDefined();
      expect((mod!.spec as any).name).toBe('Updated');
    });
  });

  describe('module_list handler', () => {
    it('replaces all modules in store (full sync response)', () => {
      // Pre-populate with old module
      useModuleStore.getState().addModule(
        { moduleId: 'old-mod' },
        '2024-01-01T00:00:00Z',
      );

      const handler = mockRegisteredHandlers.get('module_list')!;
      handler({
        type: 'module_list',
        payload: {
          modules: [
            { moduleId: 'new-1', name: 'New One' },
            { moduleId: 'new-2', name: 'New Two' },
          ],
        },
      });

      expect(useModuleStore.getState().getModule('old-mod')).toBeUndefined();
      expect(useModuleStore.getState().getModule('new-1')).toBeDefined();
      expect(useModuleStore.getState().getModule('new-2')).toBeDefined();
      expect(useModuleStore.getState().getModuleCount()).toBe(2);
    });
  });

  describe('module_sync handler', () => {
    it('merges delta sync response into store', () => {
      // Pre-populate
      useModuleStore.getState().addModule(
        { moduleId: 'mod-1', name: 'Original' },
        '2024-01-01T00:00:00Z',
      );

      const handler = mockRegisteredHandlers.get('module_sync')!;
      handler({
        type: 'module_sync',
        payload: {
          modules: [
            { moduleId: 'mod-1', name: 'Refreshed' },
            { moduleId: 'mod-2', name: 'Brand New' },
          ],
          lastSync: '2024-02-01T00:00:00Z',
        },
      });

      // mod-1 should be updated
      const mod1 = useModuleStore.getState().getModule('mod-1');
      expect((mod1!.spec as any).name).toBe('Refreshed');

      // mod-2 should be added
      const mod2 = useModuleStore.getState().getModule('mod-2');
      expect(mod2).toBeDefined();
    });

    it('updates connectionStore.lastSync', () => {
      const handler = mockRegisteredHandlers.get('module_sync')!;
      handler({
        type: 'module_sync',
        payload: {
          modules: [],
          lastSync: '2024-06-15T12:00:00Z',
        },
      });

      expect(useConnectionStore.getState().lastSync).toBe('2024-06-15T12:00:00Z');
    });

    it('handles empty modules array in delta sync', () => {
      // Pre-populate with a module
      useModuleStore.getState().addModule(
        { moduleId: 'mod-1', name: 'Existing' },
        '2024-01-01T00:00:00Z',
      );

      const handler = mockRegisteredHandlers.get('module_sync')!;
      handler({
        type: 'module_sync',
        payload: {
          modules: [],
          lastSync: '2024-06-15T12:00:00Z',
        },
      });

      // Existing module should be untouched (delta sync only merges, does not remove)
      expect(useModuleStore.getState().getModule('mod-1')).toBeDefined();
      expect(useModuleStore.getState().getModuleCount()).toBe(1);
    });
  });

  describe('module_list handler edge cases', () => {
    it('handles empty modules array in full sync', () => {
      // Pre-populate
      useModuleStore.getState().addModule(
        { moduleId: 'old-mod' },
        '2024-01-01T00:00:00Z',
      );

      const handler = mockRegisteredHandlers.get('module_list')!;
      handler({
        type: 'module_list',
        payload: { modules: [] },
      });

      // Full sync replaces all — store should be empty
      expect(useModuleStore.getState().getModuleCount()).toBe(0);
    });
  });

  describe('cleanupModuleSync', () => {
    it('unregisters all handlers', () => {
      const { cleanupModuleSync } = require('./moduleSync');

      expect(mockRegisteredHandlers.size).toBe(4);
      cleanupModuleSync();
      expect(mockRegisteredHandlers.size).toBe(0);
    });

    it('prevents handlers from receiving messages after cleanup', () => {
      const { cleanupModuleSync } = require('./moduleSync');

      cleanupModuleSync();

      // module_created handler should not exist
      expect(mockRegisteredHandlers.has('module_created')).toBe(false);
    });
  });

  describe('re-initialization', () => {
    it('cleans up previous handlers before registering new ones', () => {
      const wsClient = require('@/services/wsClient');

      // initModuleSync was already called in beforeEach.
      // Calling it again should clean up first, then re-register.
      const { initModuleSync } = require('./moduleSync');
      initModuleSync();

      // Should still have exactly 4 handlers (not 8)
      expect(mockRegisteredHandlers.size).toBe(4);
    });
  });

  describe('module_created handler edge cases', () => {
    it('assigns current timestamp as updatedAt', () => {
      const handler = mockRegisteredHandlers.get('module_created')!;
      const beforeTime = new Date().toISOString();

      handler({
        type: 'module_created',
        payload: { moduleId: 'mod-new' },
      });

      const mod = useModuleStore.getState().getModule('mod-new');
      expect(mod).toBeDefined();
      // updatedAt should be a valid ISO string set around now
      expect(mod!.updatedAt).toBeDefined();
      expect(new Date(mod!.updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(beforeTime).getTime() - 1000,
      );
    });
  });

  describe('module_updated handler edge cases', () => {
    it('handles update for non-existent module (updateModule creates it)', () => {
      const handler = mockRegisteredHandlers.get('module_updated')!;
      handler({
        type: 'module_updated',
        payload: {
          moduleId: 'mod-new',
          spec: { moduleId: 'mod-new', name: 'Brand New via Update' },
        },
      });

      const mod = useModuleStore.getState().getModule('mod-new');
      expect(mod).toBeDefined();
      expect((mod!.spec as any).name).toBe('Brand New via Update');
    });
  });
});
