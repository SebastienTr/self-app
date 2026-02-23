/**
 * Edge case tests for authStore (Story 1-6).
 *
 * Covers:
 *   - Rapid state transitions (pairing -> auth_failed -> pairing)
 *   - State consistency after clearAuth during transitions
 *   - getIsPaired with empty string values
 *   - getIsAuthenticated never returns true for non-authenticated states
 *   - Multiple clearAuth calls are idempotent
 *   - State transitions that match the real auth flow lifecycle
 */

// Suppress console output
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});

import { useAuthStore } from './authStore';

describe('authStore edge cases', () => {
  beforeEach(() => {
    useAuthStore.setState({
      sessionToken: null,
      backendUrl: null,
      authStatus: 'unconfigured',
      pairingError: null,
    });
  });

  describe('state transition lifecycle: full pairing flow', () => {
    it('follows the correct state sequence for successful first pairing', () => {
      const store = useAuthStore.getState;

      // 1. Initial state
      expect(store().authStatus).toBe('unconfigured');
      expect(store().getIsPaired()).toBe(false);
      expect(store().getIsAuthenticated()).toBe(false);

      // 2. User enters URL and token, presses connect
      store().setBackendUrl('ws://192.168.1.42:8000/ws');
      store().setSessionToken('new-session-uuid');
      store().setAuthStatus('pairing');
      expect(store().getIsPaired()).toBe(true);
      expect(store().getIsAuthenticated()).toBe(false);

      // 3. WS connection succeeds, auth acknowledged
      store().setAuthStatus('authenticated');
      expect(store().getIsAuthenticated()).toBe(true);
    });

    it('follows the correct state sequence for subsequent launch', () => {
      const store = useAuthStore.getState;

      // 1. Load from SecureStore (simulated)
      store().setSessionToken('existing-token');
      store().setBackendUrl('ws://host/ws');
      store().setAuthStatus('authenticating');

      expect(store().getIsPaired()).toBe(true);
      expect(store().getIsAuthenticated()).toBe(false);

      // 2. Auth succeeds on reconnection
      store().setAuthStatus('authenticated');
      expect(store().getIsAuthenticated()).toBe(true);
    });

    it('follows the correct state sequence for auth failure', () => {
      const store = useAuthStore.getState;

      // 1. Load from SecureStore
      store().setSessionToken('old-token');
      store().setBackendUrl('ws://host/ws');
      store().setAuthStatus('authenticating');

      // 2. Backend rejects token
      store().setAuthStatus('auth_failed');
      store().setPairingError('Invalid session token.');

      expect(store().getIsAuthenticated()).toBe(false);
      expect(store().pairingError).toBe('Invalid session token.');

      // 3. User clears and re-pairs
      store().clearAuth();
      expect(store().authStatus).toBe('unconfigured');
      expect(store().pairingError).toBeNull();
      expect(store().sessionToken).toBeNull();
      expect(store().backendUrl).toBeNull();
    });
  });

  describe('rapid state transitions', () => {
    it('handles pairing -> auth_failed -> pairing -> authenticated', () => {
      const store = useAuthStore.getState;

      store().setAuthStatus('pairing');
      store().setAuthStatus('auth_failed');
      store().setPairingError('Failed');
      store().setPairingError(null);
      store().setAuthStatus('pairing');
      store().setAuthStatus('authenticated');

      expect(store().authStatus).toBe('authenticated');
      expect(store().pairingError).toBeNull();
    });

    it('handles multiple clearAuth calls without issues', () => {
      const store = useAuthStore.getState;

      store().setSessionToken('token');
      store().setBackendUrl('ws://host/ws');
      store().setAuthStatus('authenticated');

      store().clearAuth();
      store().clearAuth();
      store().clearAuth();

      expect(store().sessionToken).toBeNull();
      expect(store().backendUrl).toBeNull();
      expect(store().authStatus).toBe('unconfigured');
      expect(store().pairingError).toBeNull();
    });
  });

  describe('getIsPaired edge cases', () => {
    it('returns true with empty string token and URL (not null)', () => {
      useAuthStore.getState().setSessionToken('');
      useAuthStore.getState().setBackendUrl('');
      // Empty strings are not null, so getIsPaired returns true
      expect(useAuthStore.getState().getIsPaired()).toBe(true);
    });

    it('returns false after setting token to null', () => {
      useAuthStore.getState().setSessionToken('token');
      useAuthStore.getState().setBackendUrl('ws://host/ws');
      expect(useAuthStore.getState().getIsPaired()).toBe(true);

      useAuthStore.getState().setSessionToken(null);
      expect(useAuthStore.getState().getIsPaired()).toBe(false);
    });

    it('returns false after setting URL to null', () => {
      useAuthStore.getState().setSessionToken('token');
      useAuthStore.getState().setBackendUrl('ws://host/ws');
      expect(useAuthStore.getState().getIsPaired()).toBe(true);

      useAuthStore.getState().setBackendUrl(null);
      expect(useAuthStore.getState().getIsPaired()).toBe(false);
    });
  });

  describe('getIsAuthenticated exhaustive check', () => {
    it('returns false for every non-authenticated status', () => {
      const statuses = ['unconfigured', 'pairing', 'authenticating', 'auth_failed'] as const;
      for (const status of statuses) {
        useAuthStore.getState().setAuthStatus(status);
        expect(useAuthStore.getState().getIsAuthenticated()).toBe(false);
      }
    });

    it('returns true only for authenticated status', () => {
      useAuthStore.getState().setAuthStatus('authenticated');
      expect(useAuthStore.getState().getIsAuthenticated()).toBe(true);
    });
  });

  describe('error state management', () => {
    it('preserves pairingError across status changes', () => {
      useAuthStore.getState().setPairingError('Some error');
      useAuthStore.getState().setAuthStatus('auth_failed');

      expect(useAuthStore.getState().pairingError).toBe('Some error');
      expect(useAuthStore.getState().authStatus).toBe('auth_failed');
    });

    it('pairingError survives token changes', () => {
      useAuthStore.getState().setPairingError('Token error');
      useAuthStore.getState().setSessionToken('new-token');

      expect(useAuthStore.getState().pairingError).toBe('Token error');
    });

    it('clearAuth clears pairingError even when error is set', () => {
      useAuthStore.getState().setPairingError('Persistent error');
      useAuthStore.getState().setAuthStatus('auth_failed');

      useAuthStore.getState().clearAuth();

      expect(useAuthStore.getState().pairingError).toBeNull();
      expect(useAuthStore.getState().authStatus).toBe('unconfigured');
    });
  });

  describe('token and URL independence', () => {
    it('setSessionToken does not affect backendUrl', () => {
      useAuthStore.getState().setBackendUrl('ws://host/ws');
      useAuthStore.getState().setSessionToken('token');

      expect(useAuthStore.getState().backendUrl).toBe('ws://host/ws');
    });

    it('setBackendUrl does not affect sessionToken', () => {
      useAuthStore.getState().setSessionToken('token');
      useAuthStore.getState().setBackendUrl('ws://host/ws');

      expect(useAuthStore.getState().sessionToken).toBe('token');
    });

    it('setAuthStatus does not affect token or URL', () => {
      useAuthStore.getState().setSessionToken('token');
      useAuthStore.getState().setBackendUrl('ws://host/ws');
      useAuthStore.getState().setAuthStatus('authenticated');

      expect(useAuthStore.getState().sessionToken).toBe('token');
      expect(useAuthStore.getState().backendUrl).toBe('ws://host/ws');
    });
  });
});
