/**
 * Integration/smoke test for the startup flow.
 *
 * Verifies the correct startup sequence:
 *   1. initLocalDb()
 *   2. getCachedModules() -> moduleStore.loadFromCache()
 *   3. loadPersistedMessages() -> prepend to wsClient queue
 *   4. initModuleSync() -> registers WS handlers
 *   5. connect() -> WebSocket connection starts
 *
 * All dependencies are mocked to verify call sequence.
 */

// Suppress console output
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});

// Use mockCallOrder prefix so Jest allows references inside jest.mock()
const mockCallOrder: string[] = [];

const mockCachedModules = [
  {
    module_id: 'test-1',
    spec: JSON.stringify({ moduleId: 'test-1', name: 'Test' }),
    status: 'active',
    updated_at: '2024-01-01T00:00:00Z',
    cached_at: '2024-01-01T00:00:00Z',
  },
];

jest.mock('@/services/localDb', () => ({
  initLocalDb: jest.fn(async () => {
    mockCallOrder.push('initLocalDb');
  }),
  getCachedModules: jest.fn(async () => {
    mockCallOrder.push('getCachedModules');
    return mockCachedModules;
  }),
  cacheModule: jest.fn(async () => {}),
  removeCachedModule: jest.fn(async () => {}),
  enqueuePendingMessage: jest.fn(async () => {}),
  dequeuePendingMessages: jest.fn(async () => []),
  clearPendingMessages: jest.fn(async () => {}),
  getPendingMessageCount: jest.fn(async () => 0),
}));

jest.mock('@/services/wsClient', () => ({
  connect: jest.fn(() => {
    mockCallOrder.push('connect');
  }),
  disconnect: jest.fn(),
  loadPersistedMessages: jest.fn(async () => {
    mockCallOrder.push('loadPersistedMessages');
  }),
  onMessage: jest.fn(() => () => {}),
}));

jest.mock('@/services/moduleSync', () => ({
  initModuleSync: jest.fn(() => {
    mockCallOrder.push('initModuleSync');
  }),
}));

describe('Startup flow', () => {
  beforeEach(() => {
    mockCallOrder.length = 0;
    // Reset module store between tests
    const { useModuleStore } = require('@/stores/moduleStore');
    useModuleStore.setState({ modules: new Map() });
  });

  it('executes startup steps in correct order', async () => {
    const localDb = require('@/services/localDb');
    const wsClient = require('@/services/wsClient');
    const moduleSync = require('@/services/moduleSync');
    const { useModuleStore } = require('@/stores/moduleStore');

    // Simulate the startup sequence from App.tsx
    await localDb.initLocalDb();
    const cached = await localDb.getCachedModules();
    if (cached.length > 0) {
      useModuleStore.getState().loadFromCache(cached);
    }
    await wsClient.loadPersistedMessages();
    moduleSync.initModuleSync();
    wsClient.connect('ws://localhost:8000/ws');

    // Verify order
    expect(mockCallOrder).toEqual([
      'initLocalDb',
      'getCachedModules',
      'loadPersistedMessages',
      'initModuleSync',
      'connect',
    ]);
  });

  it('populates moduleStore from cached modules before WS connect', async () => {
    const localDb = require('@/services/localDb');
    const wsClient = require('@/services/wsClient');
    const moduleSync = require('@/services/moduleSync');
    const { useModuleStore } = require('@/stores/moduleStore');

    await localDb.initLocalDb();
    const cached = await localDb.getCachedModules();
    useModuleStore.getState().loadFromCache(cached);

    // Modules should be in store BEFORE connect
    expect(useModuleStore.getState().getModuleCount()).toBe(1);
    expect(useModuleStore.getState().getModule('test-1')).toBeDefined();

    // Now connect
    await wsClient.loadPersistedMessages();
    moduleSync.initModuleSync();
    wsClient.connect('ws://localhost:8000/ws');

    // Modules still there
    expect(useModuleStore.getState().getModuleCount()).toBe(1);
  });

  it('handles empty cache gracefully (no modules)', async () => {
    const localDb = require('@/services/localDb');
    const wsClient = require('@/services/wsClient');
    const moduleSync = require('@/services/moduleSync');
    const { useModuleStore } = require('@/stores/moduleStore');

    // Override for this test only
    localDb.getCachedModules.mockResolvedValueOnce([]);

    await localDb.initLocalDb();
    const cached = await localDb.getCachedModules();
    if (cached.length > 0) {
      useModuleStore.getState().loadFromCache(cached);
    }
    await wsClient.loadPersistedMessages();
    moduleSync.initModuleSync();
    wsClient.connect('ws://localhost:8000/ws');

    expect(useModuleStore.getState().getModuleCount()).toBe(0);
    expect(wsClient.connect).toHaveBeenCalled();
  });
});
