/**
 * Zustand store for screen mode state management.
 *
 * Two modes:
 *   - chat: Full-screen conversation (ChatThread) above input bar
 *   - dashboard: Full-screen module gallery (ModuleList) above input bar
 *
 * Conventions (from architecture):
 *   - State  = nouns (mode)
 *   - Actions = imperative verbs (setMode, evaluateMode)
 *   - Selectors = useScreenMode hook
 *
 * This is a NEW store (per story 2-5 spec), not a modification of chatStore or moduleStore.
 * It reads from moduleStore + chatStore to determine initial/evaluated mode.
 */

import { create } from 'zustand';

import { useModuleStore } from '@/stores/moduleStore';
import { useChatStore } from '@/stores/chatStore';
import type { AgentState } from '@/types/ws';

export type ScreenMode = 'chat' | 'dashboard';

export interface ScreenModeStore {
  // State (nouns)
  mode: ScreenMode;

  // Actions (imperative verbs)
  setMode: (mode: ScreenMode) => void;

  /**
   * Evaluate what mode the app should be in based on module count and agent status.
   * Returns dashboard if modules > 0 AND agent is idle; otherwise chat.
   * Optionally accepts agentStatus override (for testing); defaults to chatStore value.
   */
  evaluateMode: (agentStatus?: AgentState) => ScreenMode;
}

export const useScreenModeStore = create<ScreenModeStore>((set, get) => ({
  // Initial state: always start in chat (App.tsx will call evaluateMode on startup)
  mode: 'chat',

  setMode: (mode) => {
    if (get().mode === mode) return;
    set({ mode });
  },

  evaluateMode: (agentStatus) => {
    const moduleCount = useModuleStore.getState().modules.size;
    const status = agentStatus ?? useChatStore.getState().agentStatus;
    if (moduleCount > 0 && status === 'idle') {
      return 'dashboard';
    }
    return 'chat';
  },
}));

/** Selector hook for consuming screen mode in components. */
export function useScreenMode(): ScreenMode {
  return useScreenModeStore((s) => s.mode);
}
