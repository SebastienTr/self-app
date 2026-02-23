/**
 * Tests for wsClient authentication integration (Story 1-6).
 *
 * Covers:
 *   - sendAuthMessage() behavior with/without session token
 *   - Auth error handling (AUTH_INVALID_TOKEN, AUTH_REQUIRED, AUTH_PAIRING_FAILED)
 *   - Auth success inference from non-error messages
 *   - Pairing token flow (connect with pairingToken parameter)
 *   - Auth message ordering (auth first, then flush, then sync on reconnect)
 *
 * These tests specifically exercise the auth layer added in 1-6 that
 * the original wsClient.test.ts does not cover (auth returns early
 * in those tests because authStore has no token by default).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  url: string;
  readyState: number = MockWebSocket.CONNECTING;
  onopen: ((ev: Event) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;

  sentMessages: string[] = [];
  closeCalled = false;

  constructor(url: string) {
    this.url = url;
    mockWsInstances.push(this);
  }

  send(data: string): void {
    this.sentMessages.push(data);
  }

  close(): void {
    this.closeCalled = true;
    this.readyState = MockWebSocket.CLOSED;
  }

  simulateOpen(): void {
    this.readyState = MockWebSocket.OPEN;
    if (this.onopen) this.onopen(new Event('open'));
  }

  simulateClose(code = 1000): void {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) this.onclose({ code } as CloseEvent);
  }

  simulateMessage(data: unknown): void {
    if (this.onmessage) {
      this.onmessage({ data: JSON.stringify(data) } as MessageEvent);
    }
  }
}

let mockWsInstances: MockWebSocket[] = [];
(globalThis as any).WebSocket = MockWebSocket;

// Suppress console output during tests
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});

// Fresh modules for each test
let wsClient: typeof import('./wsClient');
let useConnectionStore: typeof import('@/stores/connectionStore').useConnectionStore;
let useAuthStore: typeof import('@/stores/authStore').useAuthStore;

beforeEach(() => {
  mockWsInstances = [];
  jest.resetModules();
  jest.useFakeTimers();
  wsClient = require('./wsClient');
  useConnectionStore = require('@/stores/connectionStore').useConnectionStore;
  useAuthStore = require('@/stores/authStore').useAuthStore;
  useConnectionStore.setState({
    status: 'disconnected',
    reconnectAttempts: 0,
    lastSync: null,
    backendUrl: 'ws://localhost:8000/ws',
  });
});

afterEach(() => {
  wsClient.disconnect();
  jest.useRealTimers();
});

describe('wsClient auth integration', () => {
  describe('sendAuthMessage on connect', () => {
    it('sends auth message with session token on open when token is set', () => {
      useAuthStore.getState().setSessionToken('my-session-token');
      useAuthStore.getState().setBackendUrl('ws://localhost:8000/ws');

      wsClient.connect('ws://localhost:8000/ws');
      mockWsInstances[0].simulateOpen();

      const sent = mockWsInstances[0].sentMessages.map((m) => JSON.parse(m));
      const authMsg = sent.find((m: any) => m.type === 'auth');
      expect(authMsg).toBeDefined();
      expect(authMsg.payload.token).toBe('my-session-token');
    });

    it('does not send auth message when no session token is set', () => {
      // authStore starts with null sessionToken by default
      wsClient.connect('ws://localhost:8000/ws');
      mockWsInstances[0].simulateOpen();

      const sent = mockWsInstances[0].sentMessages.map((m) => JSON.parse(m));
      const authMsg = sent.find((m: any) => m.type === 'auth');
      expect(authMsg).toBeUndefined();
    });

    it('sends auth message as the FIRST message on connect', () => {
      useAuthStore.getState().setSessionToken('token-first');

      // Queue a pending message before connecting
      wsClient.send({ type: 'chat', payload: { message: 'queued' } });

      wsClient.connect('ws://localhost:8000/ws');
      mockWsInstances[0].simulateOpen();

      const sent = mockWsInstances[0].sentMessages.map((m) => JSON.parse(m));
      expect(sent.length).toBeGreaterThanOrEqual(2);
      expect(sent[0].type).toBe('auth');
      expect(sent[1].type).toBe('chat');
    });

    it('sends auth before sync on reconnect', () => {
      useAuthStore.getState().setSessionToken('reconnect-token');
      useConnectionStore.getState().setLastSync('2024-01-01T00:00:00Z');

      wsClient.connect('ws://localhost:8000/ws');
      mockWsInstances[0].simulateOpen();
      mockWsInstances[0].simulateClose(1006);

      jest.advanceTimersByTime(1000);
      mockWsInstances[1].simulateOpen();

      const sent = mockWsInstances[1].sentMessages.map((m) => JSON.parse(m));
      const authIndex = sent.findIndex((m: any) => m.type === 'auth');
      const syncIndex = sent.findIndex((m: any) => m.type === 'sync');
      expect(authIndex).toBeDefined();
      expect(syncIndex).toBeDefined();
      expect(authIndex).toBeLessThan(syncIndex);
    });
  });

  describe('pairing token flow', () => {
    it('includes pairing_token in auth message when provided to connect()', () => {
      useAuthStore.getState().setSessionToken('new-session-uuid');

      wsClient.connect('ws://localhost:8000/ws', 'my-pairing-token');
      mockWsInstances[0].simulateOpen();

      const sent = mockWsInstances[0].sentMessages.map((m) => JSON.parse(m));
      const authMsg = sent.find((m: any) => m.type === 'auth');
      expect(authMsg).toBeDefined();
      expect(authMsg.payload.token).toBe('new-session-uuid');
      expect(authMsg.payload.pairing_token).toBe('my-pairing-token');
    });

    it('consumes pairing token after first use (not sent on reconnect)', () => {
      useAuthStore.getState().setSessionToken('session-token');

      wsClient.connect('ws://localhost:8000/ws', 'one-time-pairing');
      mockWsInstances[0].simulateOpen();

      // First auth should have pairing_token
      const sent1 = mockWsInstances[0].sentMessages.map((m) => JSON.parse(m));
      const auth1 = sent1.find((m: any) => m.type === 'auth');
      expect(auth1.payload.pairing_token).toBe('one-time-pairing');

      // Simulate disconnect + reconnect
      mockWsInstances[0].simulateClose(1006);
      jest.advanceTimersByTime(1000);
      mockWsInstances[1].simulateOpen();

      // Second auth should NOT have pairing_token
      const sent2 = mockWsInstances[1].sentMessages.map((m) => JSON.parse(m));
      const auth2 = sent2.find((m: any) => m.type === 'auth');
      expect(auth2).toBeDefined();
      expect(auth2.payload.pairing_token).toBeUndefined();
    });

    it('does not include pairing_token when not provided to connect()', () => {
      useAuthStore.getState().setSessionToken('session-only');

      wsClient.connect('ws://localhost:8000/ws');
      mockWsInstances[0].simulateOpen();

      const sent = mockWsInstances[0].sentMessages.map((m) => JSON.parse(m));
      const authMsg = sent.find((m: any) => m.type === 'auth');
      expect(authMsg).toBeDefined();
      expect(authMsg.payload.pairing_token).toBeUndefined();
    });
  });

  describe('auth error handling', () => {
    it('sets authStatus to auth_failed on AUTH_INVALID_TOKEN error', () => {
      useAuthStore.getState().setSessionToken('bad-token');
      useAuthStore.getState().setAuthStatus('authenticating');

      wsClient.connect('ws://localhost:8000/ws');
      mockWsInstances[0].simulateOpen();

      mockWsInstances[0].simulateMessage({
        type: 'error',
        payload: {
          code: 'AUTH_INVALID_TOKEN',
          message: 'Invalid session token. Re-pair with backend.',
        },
      });

      expect(useAuthStore.getState().authStatus).toBe('auth_failed');
    });

    it('sets pairingError on AUTH_INVALID_TOKEN error', () => {
      useAuthStore.getState().setSessionToken('token');
      useAuthStore.getState().setAuthStatus('authenticating');

      wsClient.connect('ws://localhost:8000/ws');
      mockWsInstances[0].simulateOpen();

      mockWsInstances[0].simulateMessage({
        type: 'error',
        payload: {
          code: 'AUTH_INVALID_TOKEN',
          message: 'Invalid session token. Re-pair with backend.',
        },
      });

      expect(useAuthStore.getState().pairingError).toBe(
        'Invalid session token. Re-pair with backend.'
      );
    });

    it('sets authStatus to auth_failed on AUTH_REQUIRED error', () => {
      useAuthStore.getState().setAuthStatus('authenticating');

      wsClient.connect('ws://localhost:8000/ws');
      mockWsInstances[0].simulateOpen();

      mockWsInstances[0].simulateMessage({
        type: 'error',
        payload: {
          code: 'AUTH_REQUIRED',
          message: 'Authentication required. Send auth message first.',
        },
      });

      expect(useAuthStore.getState().authStatus).toBe('auth_failed');
    });

    it('sets authStatus to auth_failed on AUTH_PAIRING_FAILED error', () => {
      useAuthStore.getState().setSessionToken('token');
      useAuthStore.getState().setAuthStatus('pairing');

      wsClient.connect('ws://localhost:8000/ws');
      mockWsInstances[0].simulateOpen();

      mockWsInstances[0].simulateMessage({
        type: 'error',
        payload: {
          code: 'AUTH_PAIRING_FAILED',
          message: 'Pairing token is invalid or has already been used.',
        },
      });

      expect(useAuthStore.getState().authStatus).toBe('auth_failed');
      expect(useAuthStore.getState().pairingError).toBe(
        'Pairing token is invalid or has already been used.'
      );
    });

    it('uses fallback message when error payload has no message field', () => {
      useAuthStore.getState().setAuthStatus('authenticating');

      wsClient.connect('ws://localhost:8000/ws');
      mockWsInstances[0].simulateOpen();

      mockWsInstances[0].simulateMessage({
        type: 'error',
        payload: {
          code: 'AUTH_INVALID_TOKEN',
          // No message field
        },
      });

      expect(useAuthStore.getState().authStatus).toBe('auth_failed');
      expect(useAuthStore.getState().pairingError).toBe('Authentication failed');
    });

    it('uses fallback message for AUTH_PAIRING_FAILED without message field', () => {
      useAuthStore.getState().setAuthStatus('pairing');

      wsClient.connect('ws://localhost:8000/ws');
      mockWsInstances[0].simulateOpen();

      mockWsInstances[0].simulateMessage({
        type: 'error',
        payload: {
          code: 'AUTH_PAIRING_FAILED',
        },
      });

      expect(useAuthStore.getState().pairingError).toBe('Pairing failed');
    });

    it('does not change auth status for non-auth error codes', () => {
      useAuthStore.getState().setAuthStatus('authenticated');

      wsClient.connect('ws://localhost:8000/ws');
      mockWsInstances[0].simulateOpen();

      mockWsInstances[0].simulateMessage({
        type: 'error',
        payload: {
          code: 'WS_UNKNOWN_TYPE',
          message: 'Unknown message type: foo',
        },
      });

      // Should remain authenticated — non-auth errors don't affect auth status
      expect(useAuthStore.getState().authStatus).toBe('authenticated');
    });
  });

  describe('auth success inference', () => {
    it('transitions from pairing to authenticated on non-error message', () => {
      useAuthStore.getState().setSessionToken('token');
      useAuthStore.getState().setAuthStatus('pairing');

      wsClient.connect('ws://localhost:8000/ws');
      mockWsInstances[0].simulateOpen();

      // Receive a non-error message (e.g. module_list from sync)
      mockWsInstances[0].simulateMessage({
        type: 'module_list',
        payload: { modules: [] },
      });

      expect(useAuthStore.getState().authStatus).toBe('authenticated');
    });

    it('transitions from authenticating to authenticated on non-error message', () => {
      useAuthStore.getState().setSessionToken('existing-token');
      useAuthStore.getState().setAuthStatus('authenticating');

      wsClient.connect('ws://localhost:8000/ws');
      mockWsInstances[0].simulateOpen();

      mockWsInstances[0].simulateMessage({
        type: 'chat_stream',
        payload: { delta: 'Hello', done: true },
      });

      expect(useAuthStore.getState().authStatus).toBe('authenticated');
    });

    it('does not re-infer auth when already authenticated', () => {
      useAuthStore.getState().setAuthStatus('authenticated');

      wsClient.connect('ws://localhost:8000/ws');
      mockWsInstances[0].simulateOpen();

      // This should not change anything (already authenticated)
      mockWsInstances[0].simulateMessage({
        type: 'status',
        payload: { state: 'idle' },
      });

      expect(useAuthStore.getState().authStatus).toBe('authenticated');
    });

    it('does not infer auth success from error messages even in pairing state', () => {
      useAuthStore.getState().setAuthStatus('pairing');

      wsClient.connect('ws://localhost:8000/ws');
      mockWsInstances[0].simulateOpen();

      mockWsInstances[0].simulateMessage({
        type: 'error',
        payload: {
          code: 'AUTH_PAIRING_FAILED',
          message: 'Bad pairing token',
        },
      });

      // Should not transition to authenticated
      expect(useAuthStore.getState().authStatus).toBe('auth_failed');
    });

    it('does not infer auth when status is unconfigured', () => {
      useAuthStore.getState().setAuthStatus('unconfigured');

      wsClient.connect('ws://localhost:8000/ws');
      mockWsInstances[0].simulateOpen();

      mockWsInstances[0].simulateMessage({
        type: 'status',
        payload: { state: 'idle' },
      });

      // Should remain unconfigured — only pairing/authenticating triggers inference
      expect(useAuthStore.getState().authStatus).toBe('unconfigured');
    });

    it('does not infer auth when status is auth_failed', () => {
      useAuthStore.getState().setAuthStatus('auth_failed');

      wsClient.connect('ws://localhost:8000/ws');
      mockWsInstances[0].simulateOpen();

      mockWsInstances[0].simulateMessage({
        type: 'status',
        payload: { state: 'idle' },
      });

      expect(useAuthStore.getState().authStatus).toBe('auth_failed');
    });
  });

  describe('auth + queue + reconnect ordering', () => {
    it('sends auth, then pending messages, then sync on reconnect', () => {
      useAuthStore.getState().setSessionToken('full-flow-token');
      useConnectionStore.getState().setLastSync('2024-06-01T00:00:00Z');

      wsClient.connect('ws://localhost:8000/ws');
      mockWsInstances[0].simulateOpen();
      mockWsInstances[0].simulateClose(1006);

      // Queue a message during disconnect
      wsClient.send({ type: 'chat', payload: { message: 'offline-msg' } });

      jest.advanceTimersByTime(1000);
      mockWsInstances[1].simulateOpen();

      const sent = mockWsInstances[1].sentMessages.map((m) => JSON.parse(m));
      expect(sent[0].type).toBe('auth');
      expect(sent[0].payload.token).toBe('full-flow-token');
      expect(sent[1].type).toBe('chat');
      expect(sent[1].payload.message).toBe('offline-msg');
      expect(sent[2].type).toBe('sync');
    });

    it('sends only auth + pending on first connect (no sync)', () => {
      useAuthStore.getState().setSessionToken('first-connect-token');

      wsClient.send({ type: 'chat', payload: { message: 'pre-connect' } });

      wsClient.connect('ws://localhost:8000/ws');
      mockWsInstances[0].simulateOpen();

      const sent = mockWsInstances[0].sentMessages.map((m) => JSON.parse(m));
      expect(sent[0].type).toBe('auth');
      expect(sent[1].type).toBe('chat');
      // No sync on first connect
      expect(sent.find((m: any) => m.type === 'sync')).toBeUndefined();
    });
  });

  describe('connect replaces pairingToken state', () => {
    it('new connect() call replaces the pairing token', () => {
      useAuthStore.getState().setSessionToken('token');

      // First connect with pairing token
      wsClient.connect('ws://localhost:8000/ws', 'first-pairing');
      // Before opening, connect again with different pairing token
      wsClient.connect('ws://localhost:8000/ws', 'second-pairing');
      mockWsInstances[1].simulateOpen();

      const sent = mockWsInstances[1].sentMessages.map((m) => JSON.parse(m));
      const authMsg = sent.find((m: any) => m.type === 'auth');
      expect(authMsg.payload.pairing_token).toBe('second-pairing');
    });

    it('connect() without pairing token clears previous pairing token', () => {
      useAuthStore.getState().setSessionToken('token');

      wsClient.connect('ws://localhost:8000/ws', 'will-be-cleared');
      wsClient.connect('ws://localhost:8000/ws');
      mockWsInstances[1].simulateOpen();

      const sent = mockWsInstances[1].sentMessages.map((m) => JSON.parse(m));
      const authMsg = sent.find((m: any) => m.type === 'auth');
      expect(authMsg.payload.pairing_token).toBeUndefined();
    });
  });
});
