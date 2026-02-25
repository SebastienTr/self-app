/**
 * Unit tests for moduleStore badge system (story 2-5b).
 *
 * Tests newModulesSinceLastHomeVisit counter:
 *   - incrementNewModuleCount
 *   - resetNewModuleCount
 *   - Edge cases: multiple increments, reset idempotency, independence from modules Map
 */

// Suppress console output
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});

// Mock localDb to prevent expo-sqlite crash
jest.mock('@/services/localDb', () => ({
  cacheModule: jest.fn(async () => {}),
  removeCachedModule: jest.fn(async () => {}),
}));

import { useModuleStore } from './moduleStore';

describe('moduleStore badge system', () => {
  beforeEach(() => {
    useModuleStore.setState({
      modules: new Map(),
      newModulesSinceLastHomeVisit: 0,
    });
  });

  describe('initial state', () => {
    it('starts with newModulesSinceLastHomeVisit at 0', () => {
      expect(useModuleStore.getState().newModulesSinceLastHomeVisit).toBe(0);
    });
  });

  describe('incrementNewModuleCount', () => {
    it('increments counter by 1', () => {
      useModuleStore.getState().incrementNewModuleCount();
      expect(useModuleStore.getState().newModulesSinceLastHomeVisit).toBe(1);
    });

    it('increments counter multiple times', () => {
      useModuleStore.getState().incrementNewModuleCount();
      useModuleStore.getState().incrementNewModuleCount();
      useModuleStore.getState().incrementNewModuleCount();
      expect(useModuleStore.getState().newModulesSinceLastHomeVisit).toBe(3);
    });

    it('increments from non-zero value', () => {
      useModuleStore.setState({ newModulesSinceLastHomeVisit: 5 });
      useModuleStore.getState().incrementNewModuleCount();
      expect(useModuleStore.getState().newModulesSinceLastHomeVisit).toBe(6);
    });
  });

  describe('resetNewModuleCount', () => {
    it('resets counter to 0', () => {
      useModuleStore.setState({ newModulesSinceLastHomeVisit: 5 });
      useModuleStore.getState().resetNewModuleCount();
      expect(useModuleStore.getState().newModulesSinceLastHomeVisit).toBe(0);
    });

    it('is idempotent — resetting 0 remains 0', () => {
      useModuleStore.getState().resetNewModuleCount();
      expect(useModuleStore.getState().newModulesSinceLastHomeVisit).toBe(0);
    });
  });

  describe('increment then reset cycle', () => {
    it('handles full increment-reset cycle', () => {
      useModuleStore.getState().incrementNewModuleCount();
      useModuleStore.getState().incrementNewModuleCount();
      expect(useModuleStore.getState().newModulesSinceLastHomeVisit).toBe(2);

      useModuleStore.getState().resetNewModuleCount();
      expect(useModuleStore.getState().newModulesSinceLastHomeVisit).toBe(0);

      useModuleStore.getState().incrementNewModuleCount();
      expect(useModuleStore.getState().newModulesSinceLastHomeVisit).toBe(1);
    });
  });

  describe('independence from modules Map', () => {
    it('badge count is independent of modules being added', () => {
      useModuleStore.getState().addModule({ moduleId: 'mod-1' }, new Date().toISOString());
      // addModule alone does not increment badge count
      expect(useModuleStore.getState().newModulesSinceLastHomeVisit).toBe(0);
    });

    it('badge count is independent of modules being removed', () => {
      useModuleStore.setState({ newModulesSinceLastHomeVisit: 3 });
      useModuleStore.getState().addModule({ moduleId: 'mod-1' }, new Date().toISOString());
      useModuleStore.getState().removeModule('mod-1');
      // Removing a module does not change badge count
      expect(useModuleStore.getState().newModulesSinceLastHomeVisit).toBe(3);
    });

    it('loadFromCache does not affect badge count', () => {
      useModuleStore.setState({ newModulesSinceLastHomeVisit: 3 });
      useModuleStore.getState().loadFromCache([
        {
          module_id: 'mod-1',
          spec: JSON.stringify({ moduleId: 'mod-1' }),
          status: 'active',
          updated_at: new Date().toISOString(),
          cached_at: new Date().toISOString(),
        },
      ]);
      // loadFromCache sets modules but should not reset badge count
      // (it only sets { modules: newModules })
      expect(useModuleStore.getState().newModulesSinceLastHomeVisit).toBe(3);
    });
  });
});

describe('moduleSync incrementNewModuleCount integration', () => {
  // This verifies that module_created in moduleSync calls incrementNewModuleCount
  // (tested at moduleSync level, but we verify the store action works correctly)
  it('multiple rapid increments produce correct count', () => {
    useModuleStore.setState({ newModulesSinceLastHomeVisit: 0 });

    for (let i = 0; i < 10; i++) {
      useModuleStore.getState().incrementNewModuleCount();
    }

    expect(useModuleStore.getState().newModulesSinceLastHomeVisit).toBe(10);
  });
});
