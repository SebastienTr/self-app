/**
 * Module sync service — WS message handler registration for module-related messages.
 *
 * Registers handlers for:
 *   - module_created → adds module to store + appends module_card to chatStore
 *   - module_updated → updates module in store
 *   - module_list   → replaces all modules (full sync response)
 *   - module_sync   → merges delta sync into store, updates lastSync
 *
 * Call initModuleSync() on app startup to register handlers.
 */

import type { WSMessage, ModuleSpec } from '@/types/ws';
import { onMessage } from '@/services/wsClient';
import { useModuleStore } from '@/stores/moduleStore';
import { useChatStore } from '@/stores/chatStore';
import { useConnectionStore } from '@/stores/connectionStore';
import { logger } from './logger';

/** Unsubscribe functions returned by onMessage registrations. */
let unsubscribers: (() => void)[] = [];

/** Pending module cards waiting for agent to finish streaming. */
let pendingModuleCards: string[] = [];

/** One-shot subscription cleanup for agent status watching. */
let agentStatusUnsub: (() => void) | null = null;

/**
 * Append a module_card to chatStore immediately if agent is idle,
 * or defer until agent finishes streaming.
 */
function scheduleModuleCard(moduleId: string): void {
  const chatStore = useChatStore.getState();

  if (chatStore.agentStatus === 'idle') {
    // Agent is idle — append immediately
    chatStore.addModuleCard(moduleId);
    return;
  }

  // Agent is streaming/thinking — defer the card
  pendingModuleCards.push(moduleId);

  // Only set up one subscription at a time
  if (agentStatusUnsub) return;

  agentStatusUnsub = useChatStore.subscribe((state) => {
    if (state.agentStatus === 'idle' && pendingModuleCards.length > 0) {
      // Flush all pending cards
      const cards = [...pendingModuleCards];
      pendingModuleCards = [];

      for (const id of cards) {
        useChatStore.getState().addModuleCard(id);
      }

      // Clean up one-shot subscription
      if (agentStatusUnsub) {
        agentStatusUnsub();
        agentStatusUnsub = null;
      }
    }
  });
}

/**
 * Initialize module sync handlers.
 * Registers WS message handlers for all module-related message types.
 * Call once on app startup.
 */
export function initModuleSync(): void {
  // Clean up any previous registrations
  for (const unsub of unsubscribers) {
    unsub();
  }
  unsubscribers = [];
  pendingModuleCards = [];
  if (agentStatusUnsub) {
    agentStatusUnsub();
    agentStatusUnsub = null;
  }

  // module_created — a new module was created by the agent
  unsubscribers.push(
    onMessage('module_created', (msg: WSMessage) => {
      if (msg.type !== 'module_created') return;
      const spec = msg.payload as ModuleSpec;
      const updatedAt = new Date().toISOString();

      useModuleStore.getState().addModule(spec, updatedAt);

      // Schedule inline module card in chat thread
      scheduleModuleCard(spec.moduleId);

      logger.info('moduleSync', 'module_created', {
        module_id: spec.moduleId,
      });
    }),
  );

  // module_updated — an existing module was updated
  unsubscribers.push(
    onMessage('module_updated', (msg: WSMessage) => {
      if (msg.type !== 'module_updated') return;
      const payload = msg.payload as { moduleId: string; spec: ModuleSpec };
      const updatedAt = new Date().toISOString();

      useModuleStore.getState().updateModule(payload.moduleId, payload.spec, updatedAt);
      logger.info('moduleSync', 'module_updated', {
        module_id: payload.moduleId,
      });
    }),
  );

  // module_list — full sync response (replaces all modules)
  unsubscribers.push(
    onMessage('module_list', (msg: WSMessage) => {
      if (msg.type !== 'module_list') return;
      const payload = msg.payload as { modules: ModuleSpec[] };
      const now = new Date().toISOString();
      const store = useModuleStore.getState();

      // Clear existing modules and add new ones
      // Build a CachedModule-like array for loadFromCache
      const cachedModules = payload.modules.map((spec) => ({
        module_id: spec.moduleId,
        spec: JSON.stringify(spec),
        status: 'active',
        updated_at: now,
        cached_at: now,
      }));

      store.loadFromCache(cachedModules);

      logger.info('moduleSync', 'module_list_received', {
        count: payload.modules.length,
      });
    }),
  );

  // module_sync — delta sync response (merge into existing modules)
  unsubscribers.push(
    onMessage('module_sync', (msg: WSMessage) => {
      if (msg.type !== 'module_sync') return;
      const payload = msg.payload as { modules: ModuleSpec[]; lastSync: string };
      const store = useModuleStore.getState();
      const now = new Date().toISOString();

      // Merge each module: update if exists, add if new
      for (const spec of payload.modules) {
        const existing = store.getModule(spec.moduleId);
        if (existing) {
          store.updateModule(spec.moduleId, spec, now);
        } else {
          store.addModule(spec, now);
        }
      }

      // Update lastSync timestamp in connection store
      useConnectionStore.getState().setLastSync(payload.lastSync);

      logger.info('moduleSync', 'module_sync_received', {
        count: payload.modules.length,
        last_sync: payload.lastSync,
      });
    }),
  );
}

/**
 * Clean up module sync handlers.
 */
export function cleanupModuleSync(): void {
  for (const unsub of unsubscribers) {
    unsub();
  }
  unsubscribers = [];
  pendingModuleCards = [];
  if (agentStatusUnsub) {
    agentStatusUnsub();
    agentStatusUnsub = null;
  }
}
