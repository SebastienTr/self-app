/**
 * Unit tests for authStore (Zustand).
 *
 * Tests all actions, selectors, and state transitions.
 */

// Suppress console output
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});

import { useAuthStore } from './authStore';

describe('authStore', () => {
  beforeEach(() => {
    // Reset store state between tests
    useAuthStore.setState({
      sessionToken: null,
      backendUrl: null,
      authStatus: 'unconfigured',
      pairingError: null,
    });
  });

  describe('initial state', () => {
    it('starts with null sessionToken', () => {
      expect(useAuthStore.getState().sessionToken).toBeNull();
    });

    it('starts with null backendUrl', () => {
      expect(useAuthStore.getState().backendUrl).toBeNull();
    });

    it('starts with unconfigured authStatus', () => {
      expect(useAuthStore.getState().authStatus).toBe('unconfigured');
    });

    it('starts with null pairingError', () => {
      expect(useAuthStore.getState().pairingError).toBeNull();
    });
  });

  describe('setSessionToken', () => {
    it('sets the session token', () => {
      useAuthStore.getState().setSessionToken('test-token');
      expect(useAuthStore.getState().sessionToken).toBe('test-token');
    });

    it('can set token to null', () => {
      useAuthStore.getState().setSessionToken('test-token');
      useAuthStore.getState().setSessionToken(null);
      expect(useAuthStore.getState().sessionToken).toBeNull();
    });
  });

  describe('setBackendUrl', () => {
    it('sets the backend URL', () => {
      useAuthStore.getState().setBackendUrl('ws://localhost:8000/ws');
      expect(useAuthStore.getState().backendUrl).toBe('ws://localhost:8000/ws');
    });

    it('can set URL to null', () => {
      useAuthStore.getState().setBackendUrl('ws://localhost:8000/ws');
      useAuthStore.getState().setBackendUrl(null);
      expect(useAuthStore.getState().backendUrl).toBeNull();
    });
  });

  describe('setAuthStatus', () => {
    it('sets auth status to pairing', () => {
      useAuthStore.getState().setAuthStatus('pairing');
      expect(useAuthStore.getState().authStatus).toBe('pairing');
    });

    it('sets auth status to authenticating', () => {
      useAuthStore.getState().setAuthStatus('authenticating');
      expect(useAuthStore.getState().authStatus).toBe('authenticating');
    });

    it('sets auth status to authenticated', () => {
      useAuthStore.getState().setAuthStatus('authenticated');
      expect(useAuthStore.getState().authStatus).toBe('authenticated');
    });

    it('sets auth status to auth_failed', () => {
      useAuthStore.getState().setAuthStatus('auth_failed');
      expect(useAuthStore.getState().authStatus).toBe('auth_failed');
    });

    it('sets auth status to unconfigured', () => {
      useAuthStore.getState().setAuthStatus('authenticated');
      useAuthStore.getState().setAuthStatus('unconfigured');
      expect(useAuthStore.getState().authStatus).toBe('unconfigured');
    });
  });

  describe('setPairingError', () => {
    it('sets a pairing error message', () => {
      useAuthStore.getState().setPairingError('Invalid token');
      expect(useAuthStore.getState().pairingError).toBe('Invalid token');
    });

    it('can clear the pairing error', () => {
      useAuthStore.getState().setPairingError('Some error');
      useAuthStore.getState().setPairingError(null);
      expect(useAuthStore.getState().pairingError).toBeNull();
    });
  });

  describe('clearAuth', () => {
    it('resets sessionToken to null', () => {
      useAuthStore.getState().setSessionToken('token');
      useAuthStore.getState().clearAuth();
      expect(useAuthStore.getState().sessionToken).toBeNull();
    });

    it('resets backendUrl to null', () => {
      useAuthStore.getState().setBackendUrl('ws://host/ws');
      useAuthStore.getState().clearAuth();
      expect(useAuthStore.getState().backendUrl).toBeNull();
    });

    it('resets authStatus to unconfigured', () => {
      useAuthStore.getState().setAuthStatus('authenticated');
      useAuthStore.getState().clearAuth();
      expect(useAuthStore.getState().authStatus).toBe('unconfigured');
    });

    it('resets pairingError to null', () => {
      useAuthStore.getState().setPairingError('error');
      useAuthStore.getState().clearAuth();
      expect(useAuthStore.getState().pairingError).toBeNull();
    });

    it('resets all state fields at once', () => {
      const store = useAuthStore.getState();
      store.setSessionToken('token');
      store.setBackendUrl('ws://host/ws');
      store.setAuthStatus('authenticated');
      store.setPairingError('error');

      useAuthStore.getState().clearAuth();

      const state = useAuthStore.getState();
      expect(state.sessionToken).toBeNull();
      expect(state.backendUrl).toBeNull();
      expect(state.authStatus).toBe('unconfigured');
      expect(state.pairingError).toBeNull();
    });
  });

  describe('getIsAuthenticated selector', () => {
    it('returns false when unconfigured', () => {
      expect(useAuthStore.getState().getIsAuthenticated()).toBe(false);
    });

    it('returns false when pairing', () => {
      useAuthStore.getState().setAuthStatus('pairing');
      expect(useAuthStore.getState().getIsAuthenticated()).toBe(false);
    });

    it('returns false when authenticating', () => {
      useAuthStore.getState().setAuthStatus('authenticating');
      expect(useAuthStore.getState().getIsAuthenticated()).toBe(false);
    });

    it('returns true when authenticated', () => {
      useAuthStore.getState().setAuthStatus('authenticated');
      expect(useAuthStore.getState().getIsAuthenticated()).toBe(true);
    });

    it('returns false when auth_failed', () => {
      useAuthStore.getState().setAuthStatus('auth_failed');
      expect(useAuthStore.getState().getIsAuthenticated()).toBe(false);
    });
  });

  describe('getIsPaired selector', () => {
    it('returns false when neither token nor URL exist', () => {
      expect(useAuthStore.getState().getIsPaired()).toBe(false);
    });

    it('returns false when only token exists', () => {
      useAuthStore.getState().setSessionToken('token');
      expect(useAuthStore.getState().getIsPaired()).toBe(false);
    });

    it('returns false when only URL exists', () => {
      useAuthStore.getState().setBackendUrl('ws://host/ws');
      expect(useAuthStore.getState().getIsPaired()).toBe(false);
    });

    it('returns true when both token and URL exist', () => {
      useAuthStore.getState().setSessionToken('token');
      useAuthStore.getState().setBackendUrl('ws://host/ws');
      expect(useAuthStore.getState().getIsPaired()).toBe(true);
    });

    it('returns false after clearAuth', () => {
      useAuthStore.getState().setSessionToken('token');
      useAuthStore.getState().setBackendUrl('ws://host/ws');
      useAuthStore.getState().clearAuth();
      expect(useAuthStore.getState().getIsPaired()).toBe(false);
    });
  });
});
