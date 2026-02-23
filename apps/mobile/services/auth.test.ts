/**
 * Unit tests for auth service (expo-secure-store wrapper).
 *
 * Tests session token and backend URL persistence using SecureStore mock.
 */

// Suppress console output
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});

import { __resetStore } from 'expo-secure-store';

import {
  getSessionToken,
  setSessionToken,
  clearSessionToken,
  getStoredBackendUrl,
  setStoredBackendUrl,
  generateSessionToken,
  isSessionConfigured,
  resetSession,
} from './auth';

// Mock wsClient
jest.mock('./wsClient', () => ({
  send: jest.fn(),
}));

// Mock authStore (use actual zustand store but reset between tests)
const mockClearAuth = jest.fn();
jest.mock('@/stores/authStore', () => ({
  useAuthStore: {
    getState: () => ({
      clearAuth: mockClearAuth,
    }),
  },
}));

beforeEach(() => {
  __resetStore();
});

describe('auth service', () => {
  describe('getSessionToken', () => {
    it('returns null when no token is stored', async () => {
      const token = await getSessionToken();
      expect(token).toBeNull();
    });

    it('returns stored token', async () => {
      await setSessionToken('test-token-123');
      const token = await getSessionToken();
      expect(token).toBe('test-token-123');
    });
  });

  describe('setSessionToken', () => {
    it('stores a token that can be retrieved', async () => {
      await setSessionToken('my-uuid-token');
      const token = await getSessionToken();
      expect(token).toBe('my-uuid-token');
    });

    it('overwrites an existing token', async () => {
      await setSessionToken('first-token');
      await setSessionToken('second-token');
      const token = await getSessionToken();
      expect(token).toBe('second-token');
    });
  });

  describe('clearSessionToken', () => {
    it('removes the stored token', async () => {
      await setSessionToken('token-to-clear');
      await clearSessionToken();
      const token = await getSessionToken();
      expect(token).toBeNull();
    });

    it('does not throw when no token exists', async () => {
      await expect(clearSessionToken()).resolves.not.toThrow();
    });
  });

  describe('getStoredBackendUrl', () => {
    it('returns null when no URL is stored', async () => {
      const url = await getStoredBackendUrl();
      expect(url).toBeNull();
    });

    it('returns stored URL', async () => {
      await setStoredBackendUrl('ws://192.168.1.42:8000/ws');
      const url = await getStoredBackendUrl();
      expect(url).toBe('ws://192.168.1.42:8000/ws');
    });
  });

  describe('setStoredBackendUrl', () => {
    it('stores a URL that can be retrieved', async () => {
      await setStoredBackendUrl('ws://myserver.local:8000/ws');
      const url = await getStoredBackendUrl();
      expect(url).toBe('ws://myserver.local:8000/ws');
    });

    it('overwrites an existing URL', async () => {
      await setStoredBackendUrl('ws://first:8000/ws');
      await setStoredBackendUrl('ws://second:8000/ws');
      const url = await getStoredBackendUrl();
      expect(url).toBe('ws://second:8000/ws');
    });
  });

  describe('generateSessionToken', () => {
    it('returns a string', () => {
      const token = generateSessionToken();
      expect(typeof token).toBe('string');
    });

    it('returns a valid UUID v4 format', () => {
      const token = generateSessionToken();
      // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(token).toMatch(uuidV4Regex);
    });

    it('generates unique tokens on each call', () => {
      const tokens = new Set<string>();
      for (let i = 0; i < 100; i++) {
        tokens.add(generateSessionToken());
      }
      expect(tokens.size).toBe(100);
    });
  });

  describe('resetSession', () => {
    beforeEach(() => {
      mockClearAuth.mockClear();
    });

    it('sends auth_reset message via wsClient', async () => {
      const { send } = require('./wsClient');
      await resetSession();
      expect(send).toHaveBeenCalledWith({ type: 'auth_reset', payload: {} });
    });

    it('clears session token from SecureStore', async () => {
      await setSessionToken('token-to-reset');
      await resetSession();
      const token = await getSessionToken();
      expect(token).toBeNull();
    });

    it('calls clearAuth on authStore', async () => {
      await resetSession();
      expect(mockClearAuth).toHaveBeenCalled();
    });
  });

  describe('isSessionConfigured', () => {
    it('returns false when neither token nor URL exist', async () => {
      const configured = await isSessionConfigured();
      expect(configured).toBe(false);
    });

    it('returns false when only token exists', async () => {
      await setSessionToken('some-token');
      const configured = await isSessionConfigured();
      expect(configured).toBe(false);
    });

    it('returns false when only URL exists', async () => {
      await setStoredBackendUrl('ws://localhost:8000/ws');
      const configured = await isSessionConfigured();
      expect(configured).toBe(false);
    });

    it('returns true when both token and URL exist', async () => {
      await setSessionToken('some-token');
      await setStoredBackendUrl('ws://localhost:8000/ws');
      const configured = await isSessionConfigured();
      expect(configured).toBe(true);
    });

    it('returns false after clearing token', async () => {
      await setSessionToken('some-token');
      await setStoredBackendUrl('ws://localhost:8000/ws');
      await clearSessionToken();
      const configured = await isSessionConfigured();
      expect(configured).toBe(false);
    });
  });
});
