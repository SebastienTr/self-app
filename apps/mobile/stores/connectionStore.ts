/**
 * Zustand store for WebSocket connection state.
 *
 * Conventions:
 *   - State  = nouns
 *   - Actions = imperative verbs (set, increment, reset)
 *   - Selectors = get + descriptive noun
 *   - NEVER use isLoading: boolean — always use ConnectionStatus enum
 *
 * One store per domain: connectionStore manages WS state only.
 */

import { create } from 'zustand';

import type { ConnectionStatus, PersonaType } from '@/types/ws';
import { getBackendUrl } from '@/utils/getBackendUrl';

interface ConnectionStore {
  // State (nouns)
  status: ConnectionStatus;
  reconnectAttempts: number;
  lastSync: string | null;
  lastSeq: number;
  backendUrl: string;
  persona: PersonaType | null;

  // Actions (imperative verbs)
  setStatus: (status: ConnectionStatus) => void;
  setBackendUrl: (url: string) => void;
  incrementReconnectAttempts: () => void;
  resetReconnectAttempts: () => void;
  setLastSync: (timestamp: string) => void;
  setLastSeq: (seq: number) => void;
  setPersona: (persona: PersonaType | null) => void;

  // Selectors (get + descriptive noun)
  getIsConnected: () => boolean;
  getStatus: () => ConnectionStatus;
}

export const useConnectionStore = create<ConnectionStore>((set, get) => ({
  // Initial state
  status: 'disconnected',
  reconnectAttempts: 0,
  lastSync: null,
  lastSeq: 0,
  backendUrl: getBackendUrl(),
  persona: null,

  // Actions
  setStatus: (status) => set({ status }),
  setBackendUrl: (url) => set({ backendUrl: url }),
  incrementReconnectAttempts: () =>
    set((state) => ({ reconnectAttempts: state.reconnectAttempts + 1 })),
  resetReconnectAttempts: () => set({ reconnectAttempts: 0 }),
  setLastSync: (timestamp) => set({ lastSync: timestamp }),
  setLastSeq: (seq) => set({ lastSeq: seq }),
  setPersona: (persona) => set({ persona }),

  // Selectors
  getIsConnected: () => get().status === 'connected',
  getStatus: () => get().status,
}));
