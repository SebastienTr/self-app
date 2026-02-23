/**
 * Unit tests for moduleStore (Zustand).
 *
 * Tests module state management including cache persistence calls.
 */

import type { ModuleSpec } from '@/types/ws';
import type { CachedModule } from '@/types/module';

// Suppress console output during tests
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});

// Mock localDb to verify cache persistence calls
jest.mock('@/services/localDb', () => ({
  cacheModule: jest.fn(async () => {}),
  removeCachedModule: jest.fn(async () => {}),
}));

const localDb = require('@/services/localDb') as {
  cacheModule: jest.Mock;
  removeCachedModule: jest.Mock;
};

let useModuleStore: typeof import('./moduleStore').useModuleStore;

beforeEach(() => {
  jest.clearAllMocks();
  jest.resetModules();

  // Re-mock after resetModules
  jest.mock('@/services/localDb', () => ({
    cacheModule: jest.fn(async () => {}),
    removeCachedModule: jest.fn(async () => {}),
  }));

  useModuleStore = require('./moduleStore').useModuleStore;
});

describe('moduleStore', () => {
  describe('addModule', () => {
    it('adds a module to the store', () => {
      const spec: ModuleSpec = { moduleId: 'mod-1', name: 'Test' };
      useModuleStore.getState().addModule(spec, '2024-01-01T00:00:00Z');

      const mod = useModuleStore.getState().getModule('mod-1');
      expect(mod).toBeDefined();
      expect(mod!.spec.moduleId).toBe('mod-1');
      expect(mod!.status).toBe('active');
      expect(mod!.dataStatus).toBe('ok');
      expect(mod!.updatedAt).toBe('2024-01-01T00:00:00Z');
    });

    it('triggers cache persistence on add', () => {
      const db = require('@/services/localDb');
      const spec: ModuleSpec = { moduleId: 'mod-1' };
      useModuleStore.getState().addModule(spec, '2024-01-01T00:00:00Z');

      expect(db.cacheModule).toHaveBeenCalledWith(
        'mod-1',
        spec,
        'active',
        '2024-01-01T00:00:00Z',
      );
    });
  });

  describe('updateModule', () => {
    it('updates an existing module in the store', () => {
      const spec1: ModuleSpec = { moduleId: 'mod-1', name: 'Original' };
      const spec2: ModuleSpec = { moduleId: 'mod-1', name: 'Updated' };

      useModuleStore.getState().addModule(spec1, '2024-01-01T00:00:00Z');
      useModuleStore.getState().updateModule('mod-1', spec2, '2024-02-01T00:00:00Z');

      const mod = useModuleStore.getState().getModule('mod-1');
      expect(mod).toBeDefined();
      expect((mod!.spec as any).name).toBe('Updated');
      expect(mod!.updatedAt).toBe('2024-02-01T00:00:00Z');
    });
  });

  describe('removeModule', () => {
    it('removes a module from the store', () => {
      const spec: ModuleSpec = { moduleId: 'mod-1' };
      useModuleStore.getState().addModule(spec, '2024-01-01T00:00:00Z');
      useModuleStore.getState().removeModule('mod-1');

      const mod = useModuleStore.getState().getModule('mod-1');
      expect(mod).toBeUndefined();
    });

    it('triggers cache removal on remove', () => {
      const db = require('@/services/localDb');
      const spec: ModuleSpec = { moduleId: 'mod-1' };
      useModuleStore.getState().addModule(spec, '2024-01-01T00:00:00Z');
      useModuleStore.getState().removeModule('mod-1');

      expect(db.removeCachedModule).toHaveBeenCalledWith('mod-1');
    });
  });

  describe('loadFromCache', () => {
    it('populates the store from cached module data', () => {
      const cached: CachedModule[] = [
        {
          module_id: 'mod-1',
          spec: JSON.stringify({ moduleId: 'mod-1', name: 'Cached Module' }),
          status: 'active',
          updated_at: '2024-01-01T00:00:00Z',
          cached_at: '2024-01-02T00:00:00Z',
        },
      ];

      useModuleStore.getState().loadFromCache(cached);

      const mod = useModuleStore.getState().getModule('mod-1');
      expect(mod).toBeDefined();
      expect(mod!.spec.moduleId).toBe('mod-1');
      expect(mod!.updatedAt).toBe('2024-01-01T00:00:00Z');
      expect(mod!.cachedAt).toBe('2024-01-02T00:00:00Z');
    });

    it('replaces existing modules with cached data', () => {
      const spec: ModuleSpec = { moduleId: 'mod-old' };
      useModuleStore.getState().addModule(spec, '2024-01-01T00:00:00Z');

      const cached: CachedModule[] = [
        {
          module_id: 'mod-new',
          spec: JSON.stringify({ moduleId: 'mod-new' }),
          status: 'active',
          updated_at: '2024-02-01T00:00:00Z',
          cached_at: '2024-02-01T00:00:00Z',
        },
      ];

      useModuleStore.getState().loadFromCache(cached);

      expect(useModuleStore.getState().getModule('mod-old')).toBeUndefined();
      expect(useModuleStore.getState().getModule('mod-new')).toBeDefined();
    });
  });

  describe('selectors', () => {
    it('getModule returns a module by ID', () => {
      const spec: ModuleSpec = { moduleId: 'mod-1' };
      useModuleStore.getState().addModule(spec, '2024-01-01T00:00:00Z');

      expect(useModuleStore.getState().getModule('mod-1')).toBeDefined();
      expect(useModuleStore.getState().getModule('nonexistent')).toBeUndefined();
    });

    it('getActiveModules returns only modules with active status', () => {
      const spec1: ModuleSpec = { moduleId: 'mod-1' };
      const spec2: ModuleSpec = { moduleId: 'mod-2' };

      useModuleStore.getState().addModule(spec1, '2024-01-01T00:00:00Z');
      useModuleStore.getState().addModule(spec2, '2024-01-01T00:00:00Z');
      useModuleStore.getState().setModuleStatus('mod-2', 'error');

      const active = useModuleStore.getState().getActiveModules();
      expect(active).toHaveLength(1);
      expect(active[0].spec.moduleId).toBe('mod-1');
    });

    it('getModuleCount returns total module count', () => {
      expect(useModuleStore.getState().getModuleCount()).toBe(0);

      useModuleStore.getState().addModule({ moduleId: 'mod-1' }, '2024-01-01T00:00:00Z');
      useModuleStore.getState().addModule({ moduleId: 'mod-2' }, '2024-01-01T00:00:00Z');

      expect(useModuleStore.getState().getModuleCount()).toBe(2);
    });

    it('getAllModules returns all modules as array', () => {
      useModuleStore.getState().addModule({ moduleId: 'mod-1' }, '2024-01-01T00:00:00Z');
      useModuleStore.getState().addModule({ moduleId: 'mod-2' }, '2024-01-01T00:00:00Z');

      const all = useModuleStore.getState().getAllModules();
      expect(all).toHaveLength(2);
    });
  });

  describe('setModuleStatus', () => {
    it('updates module lifecycle status', () => {
      useModuleStore.getState().addModule({ moduleId: 'mod-1' }, '2024-01-01T00:00:00Z');
      useModuleStore.getState().setModuleStatus('mod-1', 'stale');

      expect(useModuleStore.getState().getModule('mod-1')!.status).toBe('stale');
    });
  });

  describe('setModuleDataStatus', () => {
    it('updates module data freshness status', () => {
      useModuleStore.getState().addModule({ moduleId: 'mod-1' }, '2024-01-01T00:00:00Z');
      useModuleStore.getState().setModuleDataStatus('mod-1', 'error');

      expect(useModuleStore.getState().getModule('mod-1')!.dataStatus).toBe('error');
    });
  });

  // --- Edge case tests ---

  describe('updateModule edge cases', () => {
    it('creates a new module when updating a non-existent ID', () => {
      const spec: ModuleSpec = { moduleId: 'new-mod', name: 'Created via update' };
      useModuleStore.getState().updateModule('new-mod', spec, '2024-03-01T00:00:00Z');

      const mod = useModuleStore.getState().getModule('new-mod');
      expect(mod).toBeDefined();
      expect(mod!.spec.moduleId).toBe('new-mod');
      expect(mod!.status).toBe('active');
      expect(mod!.dataStatus).toBe('ok');
    });

    it('preserves existing status and dataStatus on update', () => {
      useModuleStore.getState().addModule({ moduleId: 'mod-1' }, '2024-01-01T00:00:00Z');
      useModuleStore.getState().setModuleStatus('mod-1', 'refreshing');
      useModuleStore.getState().setModuleDataStatus('mod-1', 'stale');

      useModuleStore
        .getState()
        .updateModule('mod-1', { moduleId: 'mod-1', name: 'Updated' }, '2024-02-01T00:00:00Z');

      const mod = useModuleStore.getState().getModule('mod-1');
      expect(mod!.status).toBe('refreshing');
      expect(mod!.dataStatus).toBe('stale');
    });

    it('triggers cache persistence on update', () => {
      const db = require('@/services/localDb');
      useModuleStore.getState().addModule({ moduleId: 'mod-1' }, '2024-01-01T00:00:00Z');
      db.cacheModule.mockClear();

      const updatedSpec: ModuleSpec = { moduleId: 'mod-1', name: 'Updated' };
      useModuleStore.getState().updateModule('mod-1', updatedSpec, '2024-02-01T00:00:00Z');

      expect(db.cacheModule).toHaveBeenCalledWith(
        'mod-1',
        updatedSpec,
        expect.any(String),
        '2024-02-01T00:00:00Z',
      );
    });
  });

  describe('setModuleStatus edge cases', () => {
    it('is a no-op when module does not exist', () => {
      useModuleStore.getState().setModuleStatus('non-existent', 'stale');
      expect(useModuleStore.getState().getModule('non-existent')).toBeUndefined();
    });

    it('can transition through all status values', () => {
      useModuleStore.getState().addModule({ moduleId: 'mod-1' }, '2024-01-01T00:00:00Z');

      const statuses: Array<import('@/types/module').ModuleStatus> = [
        'loading',
        'active',
        'refreshing',
        'stale',
        'dormant',
        'error',
      ];

      for (const status of statuses) {
        useModuleStore.getState().setModuleStatus('mod-1', status);
        expect(useModuleStore.getState().getModule('mod-1')!.status).toBe(status);
      }
    });
  });

  describe('setModuleDataStatus edge cases', () => {
    it('is a no-op when module does not exist', () => {
      useModuleStore.getState().setModuleDataStatus('non-existent', 'error');
      expect(useModuleStore.getState().getModule('non-existent')).toBeUndefined();
    });

    it('can transition through all dataStatus values', () => {
      useModuleStore.getState().addModule({ moduleId: 'mod-1' }, '2024-01-01T00:00:00Z');

      const statuses: Array<import('@/types/module').DataStatus> = ['ok', 'stale', 'error'];

      for (const status of statuses) {
        useModuleStore.getState().setModuleDataStatus('mod-1', status);
        expect(useModuleStore.getState().getModule('mod-1')!.dataStatus).toBe(status);
      }
    });
  });

  describe('loadFromCache edge cases', () => {
    it('handles empty cache array', () => {
      useModuleStore.getState().addModule({ moduleId: 'existing' }, '2024-01-01T00:00:00Z');
      useModuleStore.getState().loadFromCache([]);

      expect(useModuleStore.getState().getModuleCount()).toBe(0);
    });

    it('skips modules with invalid JSON spec', () => {
      const cached: CachedModule[] = [
        {
          module_id: 'good',
          spec: JSON.stringify({ moduleId: 'good', name: 'Valid' }),
          status: 'active',
          updated_at: '2024-01-01T00:00:00Z',
          cached_at: '2024-01-01T00:00:00Z',
        },
        {
          module_id: 'bad',
          spec: '{{invalid json}}',
          status: 'active',
          updated_at: '2024-01-01T00:00:00Z',
          cached_at: '2024-01-01T00:00:00Z',
        },
      ];

      useModuleStore.getState().loadFromCache(cached);

      expect(useModuleStore.getState().getModuleCount()).toBe(1);
      expect(useModuleStore.getState().getModule('good')).toBeDefined();
      expect(useModuleStore.getState().getModule('bad')).toBeUndefined();
    });

    it('defaults status to active when status is empty string', () => {
      const cached: CachedModule[] = [
        {
          module_id: 'mod-1',
          spec: JSON.stringify({ moduleId: 'mod-1' }),
          status: '',
          updated_at: '2024-01-01T00:00:00Z',
          cached_at: '2024-01-01T00:00:00Z',
        },
      ];

      useModuleStore.getState().loadFromCache(cached);

      const mod = useModuleStore.getState().getModule('mod-1');
      expect(mod!.status).toBe('active');
    });

    it('sets dataStatus to ok for all cached modules', () => {
      const cached: CachedModule[] = [
        {
          module_id: 'mod-1',
          spec: JSON.stringify({ moduleId: 'mod-1' }),
          status: 'stale',
          updated_at: '2024-01-01T00:00:00Z',
          cached_at: '2024-01-01T00:00:00Z',
        },
      ];

      useModuleStore.getState().loadFromCache(cached);

      const mod = useModuleStore.getState().getModule('mod-1');
      expect(mod!.dataStatus).toBe('ok');
    });

    it('loads multiple modules preserving order', () => {
      const cached: CachedModule[] = [
        {
          module_id: 'mod-a',
          spec: JSON.stringify({ moduleId: 'mod-a' }),
          status: 'active',
          updated_at: '2024-01-01T00:00:00Z',
          cached_at: '2024-01-01T00:00:00Z',
        },
        {
          module_id: 'mod-b',
          spec: JSON.stringify({ moduleId: 'mod-b' }),
          status: 'active',
          updated_at: '2024-02-01T00:00:00Z',
          cached_at: '2024-02-01T00:00:00Z',
        },
        {
          module_id: 'mod-c',
          spec: JSON.stringify({ moduleId: 'mod-c' }),
          status: 'refreshing',
          updated_at: '2024-03-01T00:00:00Z',
          cached_at: '2024-03-01T00:00:00Z',
        },
      ];

      useModuleStore.getState().loadFromCache(cached);

      expect(useModuleStore.getState().getModuleCount()).toBe(3);
      expect(useModuleStore.getState().getModule('mod-a')).toBeDefined();
      expect(useModuleStore.getState().getModule('mod-b')).toBeDefined();
      expect(useModuleStore.getState().getModule('mod-c')!.status).toBe('refreshing');
    });
  });

  describe('removeModule edge cases', () => {
    it('is a no-op when removing non-existent module', () => {
      expect(() => {
        useModuleStore.getState().removeModule('non-existent');
      }).not.toThrow();

      expect(useModuleStore.getState().getModuleCount()).toBe(0);
    });

    it('only removes the targeted module in a multi-module store', () => {
      useModuleStore.getState().addModule({ moduleId: 'mod-1' }, '2024-01-01T00:00:00Z');
      useModuleStore.getState().addModule({ moduleId: 'mod-2' }, '2024-01-01T00:00:00Z');
      useModuleStore.getState().addModule({ moduleId: 'mod-3' }, '2024-01-01T00:00:00Z');

      useModuleStore.getState().removeModule('mod-2');

      expect(useModuleStore.getState().getModuleCount()).toBe(2);
      expect(useModuleStore.getState().getModule('mod-1')).toBeDefined();
      expect(useModuleStore.getState().getModule('mod-2')).toBeUndefined();
      expect(useModuleStore.getState().getModule('mod-3')).toBeDefined();
    });
  });

  describe('selector edge cases', () => {
    it('getActiveModules returns empty array when all modules have non-active status', () => {
      useModuleStore.getState().addModule({ moduleId: 'mod-1' }, '2024-01-01T00:00:00Z');
      useModuleStore.getState().addModule({ moduleId: 'mod-2' }, '2024-01-01T00:00:00Z');
      useModuleStore.getState().setModuleStatus('mod-1', 'error');
      useModuleStore.getState().setModuleStatus('mod-2', 'stale');

      expect(useModuleStore.getState().getActiveModules()).toHaveLength(0);
    });

    it('getAllModules returns empty array for empty store', () => {
      expect(useModuleStore.getState().getAllModules()).toHaveLength(0);
    });

    it('getModuleCount returns 0 for empty store', () => {
      expect(useModuleStore.getState().getModuleCount()).toBe(0);
    });
  });

  describe('add then update then remove cycle', () => {
    it('handles full lifecycle correctly', () => {
      const db = require('@/services/localDb');

      // Add
      useModuleStore.getState().addModule({ moduleId: 'mod-1', name: 'V1' }, '2024-01-01T00:00:00Z');
      expect(useModuleStore.getState().getModuleCount()).toBe(1);
      expect(db.cacheModule).toHaveBeenCalled();

      // Update
      db.cacheModule.mockClear();
      useModuleStore
        .getState()
        .updateModule('mod-1', { moduleId: 'mod-1', name: 'V2' }, '2024-02-01T00:00:00Z');
      expect((useModuleStore.getState().getModule('mod-1')!.spec as any).name).toBe('V2');
      expect(db.cacheModule).toHaveBeenCalled();

      // Remove
      useModuleStore.getState().removeModule('mod-1');
      expect(useModuleStore.getState().getModuleCount()).toBe(0);
      expect(db.removeCachedModule).toHaveBeenCalledWith('mod-1');
    });
  });
});
