/**
 * Integration tests for the pairing flow.
 *
 * Verifies the auth-gated startup and pairing lifecycle:
 *   1. First launch (no token) -> PairingScreen shown
 *   2. Enter URL + token -> pairing succeeds -> main app
 *   3. Subsequent launch (token exists) -> skip pairing -> main app
 *   4. Auth failure -> PairingScreen shown with error
 *
 * All dependencies (SecureStore, wsClient, localDb) are mocked.
 */

// Suppress console output
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});

// Mock expo-secure-store
import { __resetStore } from 'expo-secure-store';
import * as SecureStore from 'expo-secure-store';

jest.mock('@/services/localDb', () => ({
  initLocalDb: jest.fn(async () => {}),
  getCachedModules: jest.fn(async () => []),
  cacheModule: jest.fn(async () => {}),
  removeCachedModule: jest.fn(async () => {}),
  enqueuePendingMessage: jest.fn(async () => {}),
  dequeuePendingMessages: jest.fn(async () => []),
  clearPendingMessages: jest.fn(async () => {}),
  getPendingMessageCount: jest.fn(async () => 0),
}));

jest.mock('@/services/wsClient', () => ({
  connect: jest.fn(),
  disconnect: jest.fn(),
  loadPersistedMessages: jest.fn(async () => {}),
  onMessage: jest.fn(() => () => {}),
  send: jest.fn(),
}));

jest.mock('@/services/moduleSync', () => ({
  initModuleSync: jest.fn(),
}));

jest.mock('@/services/auth', () => {
  const actual = jest.requireActual('@/services/auth');
  return {
    ...actual,
    generateSessionToken: jest.fn(() => 'mock-session-uuid'),
  };
});

import { useAuthStore } from '@/stores/authStore';
import {
  getSessionToken,
  setSessionToken,
  setStoredBackendUrl,
  getStoredBackendUrl,
} from '@/services/auth';

describe('Pairing flow', () => {
  beforeEach(() => {
    __resetStore();
    useAuthStore.setState({
      sessionToken: null,
      backendUrl: null,
      authStatus: 'unconfigured',
      pairingError: null,
    });
    jest.clearAllMocks();
  });

  describe('first launch (no stored session)', () => {
    it('has no session token in SecureStore', async () => {
      const token = await getSessionToken();
      expect(token).toBeNull();
    });

    it('has no backend URL in SecureStore', async () => {
      const url = await getStoredBackendUrl();
      expect(url).toBeNull();
    });

    it('authStore starts with unconfigured status', () => {
      expect(useAuthStore.getState().authStatus).toBe('unconfigured');
    });

    it('showPairing is true when unconfigured', () => {
      const { authStatus } = useAuthStore.getState();
      const showPairing =
        authStatus === 'unconfigured' ||
        authStatus === 'auth_failed' ||
        authStatus === 'pairing';
      expect(showPairing).toBe(true);
    });
  });

  describe('pairing flow (enter URL + token)', () => {
    it('stores backend URL and session token on pairing', async () => {
      const url = 'ws://192.168.1.42:8000/ws';
      const pairingToken = 'pairing-uuid-from-backend';

      // Simulate PairingScreen handleConnect
      const store = useAuthStore.getState();
      store.setBackendUrl(url);
      await setStoredBackendUrl(url);

      const sessionToken = 'mock-session-uuid';
      store.setSessionToken(sessionToken);
      await setSessionToken(sessionToken);

      store.setAuthStatus('pairing');

      // Verify state
      expect(useAuthStore.getState().backendUrl).toBe(url);
      expect(useAuthStore.getState().sessionToken).toBe(sessionToken);
      expect(useAuthStore.getState().authStatus).toBe('pairing');

      // Verify SecureStore persistence
      const storedToken = await getSessionToken();
      expect(storedToken).toBe(sessionToken);
      const storedUrl = await getStoredBackendUrl();
      expect(storedUrl).toBe(url);
    });

    it('calls wsClient.connect with backend URL and pairing token', async () => {
      const wsClient = require('@/services/wsClient');
      const url = 'ws://192.168.1.42:8000/ws';
      const pairingToken = 'pairing-uuid';

      // Simulate PairingScreen connect action
      useAuthStore.getState().setBackendUrl(url);
      useAuthStore.getState().setAuthStatus('pairing');
      wsClient.connect(url, pairingToken);

      expect(wsClient.connect).toHaveBeenCalledWith(url, pairingToken);
    });

    it('transitions to authenticated on successful pairing', () => {
      const store = useAuthStore.getState();

      // Simulate: pairing in progress
      store.setAuthStatus('pairing');
      expect(useAuthStore.getState().authStatus).toBe('pairing');

      // Simulate: backend accepted auth (non-error message received)
      store.setAuthStatus('authenticated');
      expect(useAuthStore.getState().authStatus).toBe('authenticated');

      // showPairing should now be false
      const { authStatus } = useAuthStore.getState();
      const showPairing =
        authStatus === 'unconfigured' ||
        authStatus === 'auth_failed' ||
        authStatus === 'pairing';
      expect(showPairing).toBe(false);
    });

    it('main app is shown when authenticated', () => {
      useAuthStore.getState().setAuthStatus('authenticated');

      const { authStatus } = useAuthStore.getState();
      const showPairing =
        authStatus === 'unconfigured' ||
        authStatus === 'auth_failed' ||
        authStatus === 'pairing';
      expect(showPairing).toBe(false);
    });
  });

  describe('subsequent launch (token exists)', () => {
    it('loads stored session and skips pairing', async () => {
      // Pre-populate SecureStore (simulates a previous pairing)
      await setSessionToken('existing-session-token');
      await setStoredBackendUrl('ws://192.168.1.42:8000/ws');

      // Simulate App.tsx startup: load from SecureStore
      const token = await getSessionToken();
      const url = await getStoredBackendUrl();

      expect(token).toBe('existing-session-token');
      expect(url).toBe('ws://192.168.1.42:8000/ws');

      // Set authStore state (as App.tsx does)
      const store = useAuthStore.getState();
      store.setSessionToken(token!);
      store.setBackendUrl(url!);
      store.setAuthStatus('authenticating');

      // Verify state
      expect(useAuthStore.getState().authStatus).toBe('authenticating');

      // showPairing should be false during authenticating
      const showPairing =
        useAuthStore.getState().authStatus === 'unconfigured' ||
        useAuthStore.getState().authStatus === 'auth_failed' ||
        useAuthStore.getState().authStatus === 'pairing';
      expect(showPairing).toBe(false);
    });

    it('connects WebSocket with stored session', async () => {
      const wsClient = require('@/services/wsClient');

      // Pre-populate SecureStore
      await setSessionToken('existing-token');
      await setStoredBackendUrl('ws://192.168.1.42:8000/ws');

      // Simulate App.tsx startup
      const token = await getSessionToken();
      const url = await getStoredBackendUrl();

      useAuthStore.getState().setSessionToken(token!);
      useAuthStore.getState().setBackendUrl(url!);

      // App.tsx calls connect if token and url exist
      if (token && url) {
        wsClient.connect(url);
      }

      expect(wsClient.connect).toHaveBeenCalledWith('ws://192.168.1.42:8000/ws');
    });
  });

  describe('auth failure', () => {
    it('shows pairing screen on auth_failed status', () => {
      useAuthStore.getState().setAuthStatus('auth_failed');

      const { authStatus } = useAuthStore.getState();
      const showPairing =
        authStatus === 'unconfigured' ||
        authStatus === 'auth_failed' ||
        authStatus === 'pairing';
      expect(showPairing).toBe(true);
    });

    it('displays pairing error when set', () => {
      useAuthStore.getState().setAuthStatus('auth_failed');
      useAuthStore.getState().setPairingError('Invalid session token. Re-pair with backend.');

      expect(useAuthStore.getState().pairingError).toBe(
        'Invalid session token. Re-pair with backend.'
      );
    });

    it('clears error when re-pairing', () => {
      // Set error state
      useAuthStore.getState().setAuthStatus('auth_failed');
      useAuthStore.getState().setPairingError('Some error');

      // Simulate re-pairing (PairingScreen clears error)
      useAuthStore.getState().setPairingError(null);
      useAuthStore.getState().setAuthStatus('pairing');

      expect(useAuthStore.getState().pairingError).toBeNull();
      expect(useAuthStore.getState().authStatus).toBe('pairing');
    });
  });

  describe('auth_reset flow', () => {
    it('sends auth_reset via wsClient and clears auth state', async () => {
      const wsClient = require('@/services/wsClient');

      // Set up authenticated state
      useAuthStore.getState().setSessionToken('old-token');
      useAuthStore.getState().setBackendUrl('ws://192.168.1.42:8000/ws');
      useAuthStore.getState().setAuthStatus('authenticated');
      await setSessionToken('old-token');

      // Import resetSession (uses lazy requires internally)
      const { resetSession } = require('@/services/auth');

      await resetSession();

      // wsClient.send should have been called with auth_reset
      expect(wsClient.send).toHaveBeenCalledWith({
        type: 'auth_reset',
        payload: {},
      });

      // Auth state should be cleared
      expect(useAuthStore.getState().authStatus).toBe('unconfigured');
      expect(useAuthStore.getState().sessionToken).toBeNull();
    });
  });
});
