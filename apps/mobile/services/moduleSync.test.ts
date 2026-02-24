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

  describe('module creation end-to-end flow (Story 3.4)', () => {
    it('module_created with full spec adds module with all fields to store', () => {
      const handler = mockRegisteredHandlers.get('module_created')!;

      // Simulate the module_created payload that backend sends (after toCamel conversion)
      handler({
        type: 'module_created',
        payload: {
          moduleId: 'weather-mod-1',
          name: 'Paris Weather',
          type: 'metric',
          template: 'metric-dashboard',
          dataSources: [
            {
              id: 'openmeteo-paris',
              type: 'rest_api',
              config: {
                url: 'https://api.open-meteo.com/v1/forecast',
                method: 'GET',
              },
            },
          ],
          refreshInterval: 3600,
          schemaVersion: 1,
          accessibleLabel: 'Paris weather forecast',
        },
      });

      const mod = useModuleStore.getState().getModule('weather-mod-1');
      expect(mod).toBeDefined();
      expect(mod!.spec.moduleId).toBe('weather-mod-1');
      expect((mod!.spec as any).name).toBe('Paris Weather');
      expect((mod!.spec as any).type).toBe('metric');
      expect((mod!.spec as any).template).toBe('metric-dashboard');
      expect((mod!.spec as any).dataSources).toHaveLength(1);
      expect(mod!.status).toBe('active');
    });

    it('module_created followed by module_list sync keeps module', () => {
      // Step 1: module_created adds module to store
      const createdHandler = mockRegisteredHandlers.get('module_created')!;
      createdHandler({
        type: 'module_created',
        payload: { moduleId: 'new-mod', name: 'New Module' },
      });
      expect(useModuleStore.getState().getModule('new-mod')).toBeDefined();

      // Step 2: module_list replaces store but includes the same module
      const listHandler = mockRegisteredHandlers.get('module_list')!;
      listHandler({
        type: 'module_list',
        payload: {
          modules: [
            { moduleId: 'new-mod', name: 'New Module' },
            { moduleId: 'other-mod', name: 'Other Module' },
          ],
        },
      });

      expect(useModuleStore.getState().getModuleCount()).toBe(2);
      expect(useModuleStore.getState().getModule('new-mod')).toBeDefined();
      expect(useModuleStore.getState().getModule('other-mod')).toBeDefined();
    });

    it('multiple module_created messages add distinct modules', () => {
      const handler = mockRegisteredHandlers.get('module_created')!;

      handler({
        type: 'module_created',
        payload: { moduleId: 'mod-a', name: 'Module A' },
      });
      handler({
        type: 'module_created',
        payload: { moduleId: 'mod-b', name: 'Module B' },
      });

      expect(useModuleStore.getState().getModuleCount()).toBe(2);
      expect(useModuleStore.getState().getModule('mod-a')).toBeDefined();
      expect(useModuleStore.getState().getModule('mod-b')).toBeDefined();
    });
  });

  describe('module_created edge cases (Story 3.4 TEA expansion)', () => {
    it('module_created with extra unknown fields preserves them in spec', () => {
      const handler = mockRegisteredHandlers.get('module_created')!;

      handler({
        type: 'module_created',
        payload: {
          moduleId: 'extra-mod',
          name: 'Extra Fields Module',
          customField: 'custom_value',
          priority: 99,
          tags: ['weather', 'outdoor'],
        },
      });

      const mod = useModuleStore.getState().getModule('extra-mod');
      expect(mod).toBeDefined();
      expect((mod!.spec as any).customField).toBe('custom_value');
      expect((mod!.spec as any).priority).toBe(99);
      expect((mod!.spec as any).tags).toEqual(['weather', 'outdoor']);
    });

    it('module_created with same moduleId overwrites existing module', () => {
      const handler = mockRegisteredHandlers.get('module_created')!;

      // Add first version
      handler({
        type: 'module_created',
        payload: { moduleId: 'dup-mod', name: 'Version 1' },
      });
      expect((useModuleStore.getState().getModule('dup-mod')!.spec as any).name).toBe(
        'Version 1',
      );

      // Add second version with same ID
      handler({
        type: 'module_created',
        payload: { moduleId: 'dup-mod', name: 'Version 2' },
      });

      // Should overwrite, not create duplicate
      expect(useModuleStore.getState().getModuleCount()).toBe(1);
      expect((useModuleStore.getState().getModule('dup-mod')!.spec as any).name).toBe(
        'Version 2',
      );
    });

    it('module_created with minimal payload (only moduleId) still adds to store', () => {
      const handler = mockRegisteredHandlers.get('module_created')!;

      handler({
        type: 'module_created',
        payload: { moduleId: 'minimal-mod' },
      });

      const mod = useModuleStore.getState().getModule('minimal-mod');
      expect(mod).toBeDefined();
      expect(mod!.spec.moduleId).toBe('minimal-mod');
      expect(mod!.status).toBe('active');
    });

    it('module_created sets dataStatus to ok', () => {
      const handler = mockRegisteredHandlers.get('module_created')!;

      handler({
        type: 'module_created',
        payload: { moduleId: 'data-status-mod', name: 'DS Module' },
      });

      const mod = useModuleStore.getState().getModule('data-status-mod');
      expect(mod).toBeDefined();
      expect(mod!.dataStatus).toBe('ok');
    });
  });

  describe('module_list with duplicate moduleIds (Story 3.4 TEA expansion)', () => {
    it('last occurrence wins when module_list contains duplicate moduleIds', () => {
      const handler = mockRegisteredHandlers.get('module_list')!;

      handler({
        type: 'module_list',
        payload: {
          modules: [
            { moduleId: 'dup-id', name: 'First' },
            { moduleId: 'dup-id', name: 'Second' },
          ],
        },
      });

      // loadFromCache iterates sequentially; last one sets the value
      expect(useModuleStore.getState().getModuleCount()).toBe(1);
      const mod = useModuleStore.getState().getModule('dup-id');
      expect(mod).toBeDefined();
      expect((mod!.spec as any).name).toBe('Second');
    });
  });

  describe('rapid successive messages (Story 3.4 TEA expansion)', () => {
    it('module_created then immediate module_sync updates module correctly', () => {
      const createdHandler = mockRegisteredHandlers.get('module_created')!;
      const syncHandler = mockRegisteredHandlers.get('module_sync')!;

      // Step 1: module_created arrives first
      createdHandler({
        type: 'module_created',
        payload: { moduleId: 'rapid-mod', name: 'Original Name' },
      });

      // Step 2: module_sync arrives immediately with updated version
      syncHandler({
        type: 'module_sync',
        payload: {
          modules: [{ moduleId: 'rapid-mod', name: 'Updated Name' }],
          lastSync: '2024-03-01T00:00:00Z',
        },
      });

      // Module should have the updated name from sync
      const mod = useModuleStore.getState().getModule('rapid-mod');
      expect((mod!.spec as any).name).toBe('Updated Name');
      expect(useModuleStore.getState().getModuleCount()).toBe(1);
    });

    it('module_created then module_list replaces store correctly', () => {
      const createdHandler = mockRegisteredHandlers.get('module_created')!;
      const listHandler = mockRegisteredHandlers.get('module_list')!;

      // Create several modules via module_created
      createdHandler({
        type: 'module_created',
        payload: { moduleId: 'created-1', name: 'Created 1' },
      });
      createdHandler({
        type: 'module_created',
        payload: { moduleId: 'created-2', name: 'Created 2' },
      });

      expect(useModuleStore.getState().getModuleCount()).toBe(2);

      // Full sync replaces everything with only one module
      listHandler({
        type: 'module_list',
        payload: {
          modules: [{ moduleId: 'sync-only', name: 'Sync Only Module' }],
        },
      });

      // Only the sync module should remain
      expect(useModuleStore.getState().getModuleCount()).toBe(1);
      expect(useModuleStore.getState().getModule('created-1')).toBeUndefined();
      expect(useModuleStore.getState().getModule('created-2')).toBeUndefined();
      expect(useModuleStore.getState().getModule('sync-only')).toBeDefined();
    });
  });

  describe('module_sync handler edge cases (Story 3.4 TEA expansion)', () => {
    it('module_sync preserves existing modules not in delta', () => {
      // Pre-populate with two modules
      useModuleStore.getState().addModule(
        { moduleId: 'existing-1', name: 'Existing 1' },
        '2024-01-01T00:00:00Z',
      );
      useModuleStore.getState().addModule(
        { moduleId: 'existing-2', name: 'Existing 2' },
        '2024-01-01T00:00:00Z',
      );

      const handler = mockRegisteredHandlers.get('module_sync')!;
      // Delta sync only includes existing-1 update and a new module
      handler({
        type: 'module_sync',
        payload: {
          modules: [
            { moduleId: 'existing-1', name: 'Updated 1' },
            { moduleId: 'new-mod', name: 'New Module' },
          ],
          lastSync: '2024-02-01T00:00:00Z',
        },
      });

      // existing-1 updated, existing-2 preserved, new-mod added
      expect(useModuleStore.getState().getModuleCount()).toBe(3);
      expect((useModuleStore.getState().getModule('existing-1')!.spec as any).name).toBe(
        'Updated 1',
      );
      expect((useModuleStore.getState().getModule('existing-2')!.spec as any).name).toBe(
        'Existing 2',
      );
      expect(useModuleStore.getState().getModule('new-mod')).toBeDefined();
    });

    it('module_sync with many modules processes all correctly', () => {
      const handler = mockRegisteredHandlers.get('module_sync')!;

      const modules = Array.from({ length: 20 }, (_, i) => ({
        moduleId: `bulk-mod-${i}`,
        name: `Bulk Module ${i}`,
      }));

      handler({
        type: 'module_sync',
        payload: {
          modules,
          lastSync: '2024-05-01T00:00:00Z',
        },
      });

      expect(useModuleStore.getState().getModuleCount()).toBe(20);
      expect(useModuleStore.getState().getModule('bulk-mod-0')).toBeDefined();
      expect(useModuleStore.getState().getModule('bulk-mod-19')).toBeDefined();
    });
  });
});
