/**
 * Zustand store for authentication state management.
 *
 * Conventions (from architecture):
 *   - State  = nouns (sessionToken, backendUrl, authStatus, pairingError)
 *   - Actions = imperative verbs (setSessionToken, clearAuth)
 *   - Selectors = get + descriptive noun (getIsAuthenticated, getIsPaired)
 *   - NEVER use isLoading: boolean — always use AuthStatus enum
 *
 * One store per domain: authStore manages auth state only.
 */

import { create } from 'zustand';

import type { AuthStatus } from '@/types/auth';

interface AuthStore {
  // State (nouns)
  sessionToken: string | null;
  backendUrl: string | null;
  authStatus: AuthStatus;
  pairingError: string | null;

  // Actions (imperative verbs)
  setSessionToken: (token: string | null) => void;
  setBackendUrl: (url: string | null) => void;
  setAuthStatus: (status: AuthStatus) => void;
  setPairingError: (error: string | null) => void;
  clearAuth: () => void;

  // Selectors (get + descriptive noun)
  getIsAuthenticated: () => boolean;
  getIsPaired: () => boolean;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  // Initial state
  sessionToken: null,
  backendUrl: null,
  authStatus: 'unconfigured',
  pairingError: null,

  // Actions
  setSessionToken: (token) => set({ sessionToken: token }),
  setBackendUrl: (url) => set({ backendUrl: url }),
  setAuthStatus: (status) => set({ authStatus: status }),
  setPairingError: (error) => set({ pairingError: error }),
  clearAuth: () =>
    set({
      sessionToken: null,
      backendUrl: null,
      authStatus: 'unconfigured',
      pairingError: null,
    }),

  // Selectors
  getIsAuthenticated: () => get().authStatus === 'authenticated',
  getIsPaired: () => get().sessionToken !== null && get().backendUrl !== null,
}));
