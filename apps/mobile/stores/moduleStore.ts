/**
 * Zustand store for module state management.
 *
 * Conventions (from architecture):
 *   - State  = nouns (modules)
 *   - Actions = imperative verbs (addModule, updateModule, removeModule)
 *   - Selectors = get + descriptive noun (getModule, getActiveModules)
 *   - NEVER use isLoading: boolean — always use status enums
 *
 * Every mutation also persists to expo-sqlite via localDb.
 * One store per domain: moduleStore manages module state only.
 */

import { create } from 'zustand';

import type { CachedModule, DataStatus, ModuleState, ModuleStatus } from '@/types/module';
import type { ModuleSpec } from '@/types/ws';
import { cacheModule, removeCachedModule } from '@/services/localDb';

interface ModuleStore {
  // State (nouns)
  modules: Map<string, ModuleState>;
  newModulesSinceLastHomeVisit: number;

  // Actions (imperative verbs)
  addModule: (spec: ModuleSpec, updatedAt: string) => void;
  updateModule: (id: string, spec: ModuleSpec, updatedAt: string) => void;
  removeModule: (id: string) => void;
  setModuleStatus: (id: string, status: ModuleStatus) => void;
  setModuleDataStatus: (id: string, dataStatus: DataStatus) => void;
  loadFromCache: (modules: CachedModule[]) => void;
  incrementNewModuleCount: () => void;
  resetNewModuleCount: () => void;
  clearAll: () => void;

  // Selectors (get + descriptive noun)
  getModule: (id: string) => ModuleState | undefined;
  getActiveModules: () => ModuleState[];
  getModuleCount: () => number;
  getAllModules: () => ModuleState[];
}

export const useModuleStore = create<ModuleStore>((set, get) => ({
  // Initial state
  modules: new Map<string, ModuleState>(),
  newModulesSinceLastHomeVisit: 0,

  // Actions
  addModule: (spec, updatedAt) => {
    const now = new Date().toISOString();
    const moduleState: ModuleState = {
      spec,
      status: 'active',
      dataStatus: 'ok',
      updatedAt,
      cachedAt: now,
    };
    set((state) => {
      const next = new Map(state.modules);
      next.set(spec.moduleId, moduleState);
      return { modules: next };
    });
    // Persist to local cache (fire-and-forget)
    cacheModule(spec.moduleId, spec, 'active', updatedAt);
  },

  updateModule: (id, spec, updatedAt) => {
    set((state) => {
      const next = new Map(state.modules);
      const existing = next.get(id);
      if (existing) {
        const updated: ModuleState = {
          ...existing,
          spec,
          updatedAt,
          cachedAt: new Date().toISOString(),
        };
        next.set(id, updated);
      } else {
        // If module doesn't exist, add it
        next.set(id, {
          spec,
          status: 'active',
          dataStatus: 'ok',
          updatedAt,
          cachedAt: new Date().toISOString(),
        });
      }
      return { modules: next };
    });
    // Persist to local cache
    const mod = get().modules.get(id);
    if (mod) {
      cacheModule(id, spec, mod.status, updatedAt);
    }
  },

  removeModule: (id) => {
    set((state) => {
      const next = new Map(state.modules);
      next.delete(id);
      return { modules: next };
    });
    // Remove from local cache
    removeCachedModule(id);
  },

  setModuleStatus: (id, status) => {
    set((state) => {
      const next = new Map(state.modules);
      const existing = next.get(id);
      if (existing) {
        next.set(id, { ...existing, status });
      }
      return { modules: next };
    });
  },

  setModuleDataStatus: (id, dataStatus) => {
    set((state) => {
      const next = new Map(state.modules);
      const existing = next.get(id);
      if (existing) {
        next.set(id, { ...existing, dataStatus });
      }
      return { modules: next };
    });
  },

  loadFromCache: (cachedModules) => {
    const newModules = new Map<string, ModuleState>();
    for (const cached of cachedModules) {
      try {
        const spec = JSON.parse(cached.spec) as ModuleSpec;
        newModules.set(cached.module_id, {
          spec,
          status: (cached.status as ModuleStatus) || 'active',
          dataStatus: 'ok',
          updatedAt: cached.updated_at,
          cachedAt: cached.cached_at,
        });
      } catch {
        // Skip modules with invalid JSON spec
      }
    }
    set({ modules: newModules });
  },

  incrementNewModuleCount: () => {
    set((state) => ({ newModulesSinceLastHomeVisit: state.newModulesSinceLastHomeVisit + 1 }));
  },

  resetNewModuleCount: () => {
    set({ newModulesSinceLastHomeVisit: 0 });
  },

  clearAll: () => {
    set({ modules: new Map(), newModulesSinceLastHomeVisit: 0 });
  },

  // Selectors
  getModule: (id) => get().modules.get(id),

  getActiveModules: () =>
    Array.from(get().modules.values()).filter((m) => m.status === 'active'),

  getModuleCount: () => get().modules.size,

  getAllModules: () => Array.from(get().modules.values()),
}));
