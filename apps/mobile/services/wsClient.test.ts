/* eslint-disable @typescript-eslint/no-explicit-any */
import type { WSMessage } from '@/types/ws';

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

  // Test helpers
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

  simulateError(): void {
    if (this.onerror) this.onerror(new Event('error'));
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

beforeEach(() => {
  mockWsInstances = [];
  jest.resetModules();
  jest.useFakeTimers();
  // Re-import to get fresh module state
  wsClient = require('./wsClient');
  useConnectionStore = require('@/stores/connectionStore').useConnectionStore;
  // Reset the store
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

describe('wsClient', () => {
  describe('connect', () => {
    it('creates a WebSocket connection to the given URL', () => {
      wsClient.connect('ws://localhost:8000/ws');
      expect(mockWsInstances).toHaveLength(1);
      expect(mockWsInstances[0].url).toBe('ws://localhost:8000/ws');
    });

    it('sets status to connecting when connect is called', () => {
      wsClient.connect('ws://localhost:8000/ws');
      expect(useConnectionStore.getState().status).toBe('connecting');
    });

    it('sets status to connected on WebSocket open', () => {
      wsClient.connect('ws://localhost:8000/ws');
      mockWsInstances[0].simulateOpen();
      expect(useConnectionStore.getState().status).toBe('connected');
    });

    it('resets reconnect attempts on successful connection', () => {
      useConnectionStore.getState().incrementReconnectAttempts();
      useConnectionStore.getState().incrementReconnectAttempts();
      wsClient.connect('ws://localhost:8000/ws');
      mockWsInstances[0].simulateOpen();
      expect(useConnectionStore.getState().reconnectAttempts).toBe(0);
    });
  });

  describe('disconnect', () => {
    it('closes the WebSocket connection', () => {
      wsClient.connect('ws://localhost:8000/ws');
      const ws = mockWsInstances[0];
      ws.simulateOpen();
      wsClient.disconnect();
      expect(ws.closeCalled).toBe(true);
    });

    it('sets status to disconnected', () => {
      wsClient.connect('ws://localhost:8000/ws');
      mockWsInstances[0].simulateOpen();
      wsClient.disconnect();
      expect(useConnectionStore.getState().status).toBe('disconnected');
    });
  });

  describe('send', () => {
    it('sends serialized message when connected', () => {
      wsClient.connect('ws://localhost:8000/ws');
      mockWsInstances[0].simulateOpen();

      // First connect should NOT auto-send sync; sentMessages should be empty
      expect(mockWsInstances[0].sentMessages).toHaveLength(0);

      const msg: WSMessage = {
        type: 'chat',
        payload: { message: 'Hello' },
      };
      wsClient.send(msg);

      expect(mockWsInstances[0].sentMessages).toHaveLength(1);
      const sent = JSON.parse(mockWsInstances[0].sentMessages[0]);
      expect(sent.type).toBe('chat');
      expect(sent.payload.message).toBe('Hello');
    });

    it('converts payload keys to snake_case for the wire', () => {
      wsClient.connect('ws://localhost:8000/ws');
      mockWsInstances[0].simulateOpen();

      const msg: WSMessage = {
        type: 'sync',
        payload: { lastSync: '2024-01-01T00:00:00Z' },
      };
      wsClient.send(msg);

      // First message should be the sync we just sent
      const sent = JSON.parse(mockWsInstances[0].sentMessages[0]);
      expect(sent.type).toBe('sync');
      expect(sent.payload.last_sync).toBe('2024-01-01T00:00:00Z');
      expect(sent.payload.lastSync).toBeUndefined();
    });

    it('preserves the type field as snake_case (not converted)', () => {
      wsClient.connect('ws://localhost:8000/ws');
      mockWsInstances[0].simulateOpen();

      const msg: WSMessage = {
        type: 'module_action',
        payload: { moduleId: '123', action: 'refresh' },
      };
      wsClient.send(msg);

      const sent = JSON.parse(mockWsInstances[0].sentMessages[0]);
      expect(sent.type).toBe('module_action');
      expect(sent.payload.module_id).toBe('123');
    });

    it('queues messages when not connected', () => {
      wsClient.connect('ws://localhost:8000/ws');
      // Don't simulate open — still connecting

      const msg: WSMessage = {
        type: 'chat',
        payload: { message: 'Hello' },
      };
      wsClient.send(msg);

      expect(mockWsInstances[0].sentMessages).toHaveLength(0);
      expect(wsClient.getPendingMessageCount()).toBe(1);
    });
  });

  describe('message reception', () => {
    it('parses incoming messages and converts payload to camelCase', () => {
      const received: WSMessage[] = [];
      wsClient.onMessage('chat_stream', (msg) => {
        received.push(msg as WSMessage);
      });

      wsClient.connect('ws://localhost:8000/ws');
      mockWsInstances[0].simulateOpen();
      mockWsInstances[0].simulateMessage({
        type: 'chat_stream',
        payload: { delta: 'Hello', done: true },
      });

      expect(received).toHaveLength(1);
      expect(received[0].type).toBe('chat_stream');
      expect((received[0] as any).payload.delta).toBe('Hello');
    });

    it('routes messages to correct type handlers', () => {
      const chatReceived: unknown[] = [];
      const errorReceived: unknown[] = [];

      wsClient.onMessage('chat_stream', (msg) => chatReceived.push(msg));
      wsClient.onMessage('error', (msg) => errorReceived.push(msg));

      wsClient.connect('ws://localhost:8000/ws');
      mockWsInstances[0].simulateOpen();

      mockWsInstances[0].simulateMessage({
        type: 'chat_stream',
        payload: { delta: 'Hi', done: false },
      });
      mockWsInstances[0].simulateMessage({
        type: 'error',
        payload: { code: 'TEST', message: 'test error' },
      });

      expect(chatReceived).toHaveLength(1);
      expect(errorReceived).toHaveLength(1);
    });

    it('converts payload keys from snake_case to camelCase', () => {
      const received: WSMessage[] = [];
      wsClient.onMessage('module_updated', (msg) => received.push(msg));

      wsClient.connect('ws://localhost:8000/ws');
      mockWsInstances[0].simulateOpen();

      mockWsInstances[0].simulateMessage({
        type: 'module_updated',
        payload: { module_id: 'abc', spec: { module_id: 'abc', display_name: 'Test' } },
      });

      expect(received).toHaveLength(1);
      const payload = (received[0] as any).payload;
      expect(payload.moduleId).toBe('abc');
      expect(payload.spec.displayName).toBe('Test');
    });
  });

  describe('offline message queue', () => {
    it('queues messages sent while disconnected', () => {
      const msg: WSMessage = {
        type: 'chat',
        payload: { message: 'queued' },
      };
      wsClient.send(msg);
      expect(wsClient.getPendingMessageCount()).toBe(1);
    });

    it('flushes pending messages on connect in FIFO order', () => {
      wsClient.send({ type: 'chat', payload: { message: 'first' } });
      wsClient.send({ type: 'chat', payload: { message: 'second' } });

      expect(wsClient.getPendingMessageCount()).toBe(2);

      wsClient.connect('ws://localhost:8000/ws');
      mockWsInstances[0].simulateOpen();

      // Pending messages should be flushed
      expect(wsClient.getPendingMessageCount()).toBe(0);

      // Verify FIFO order: first connect does NOT auto-send sync
      const sent = mockWsInstances[0].sentMessages.map((m) => JSON.parse(m));
      expect(sent[0].payload.message).toBe('first');
      expect(sent[1].payload.message).toBe('second');
      expect(sent).toHaveLength(2); // no auto sync on first connect
    });

    it('zero message loss — messages are never dropped', () => {
      wsClient.send({ type: 'chat', payload: { message: 'a' } });
      wsClient.send({ type: 'chat', payload: { message: 'b' } });
      wsClient.send({ type: 'chat', payload: { message: 'c' } });
      expect(wsClient.getPendingMessageCount()).toBe(3);
    });
  });

  describe('reconnection', () => {
    it('starts reconnection on unexpected close', () => {
      wsClient.connect('ws://localhost:8000/ws');
      mockWsInstances[0].simulateOpen();
      mockWsInstances[0].simulateClose(1006);

      expect(useConnectionStore.getState().status).toBe('reconnecting');
    });

    it('increments reconnect attempts on each failure', () => {
      wsClient.connect('ws://localhost:8000/ws');
      mockWsInstances[0].simulateOpen();
      mockWsInstances[0].simulateClose(1006);

      expect(useConnectionStore.getState().reconnectAttempts).toBe(1);
    });

    it('uses exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s (capped)', () => {
      wsClient.connect('ws://localhost:8000/ws');
      mockWsInstances[0].simulateOpen();

      // First disconnect — should reconnect after 1s
      mockWsInstances[0].simulateClose(1006);
      expect(mockWsInstances).toHaveLength(1);
      jest.advanceTimersByTime(1000);
      expect(mockWsInstances).toHaveLength(2);

      // Second disconnect — should reconnect after 2s
      mockWsInstances[1].simulateClose(1006);
      jest.advanceTimersByTime(1999);
      expect(mockWsInstances).toHaveLength(2);
      jest.advanceTimersByTime(1);
      expect(mockWsInstances).toHaveLength(3);

      // Third disconnect — should reconnect after 4s
      mockWsInstances[2].simulateClose(1006);
      jest.advanceTimersByTime(3999);
      expect(mockWsInstances).toHaveLength(3);
      jest.advanceTimersByTime(1);
      expect(mockWsInstances).toHaveLength(4);

      // Fourth disconnect — should reconnect after 8s
      mockWsInstances[3].simulateClose(1006);
      jest.advanceTimersByTime(7999);
      expect(mockWsInstances).toHaveLength(4);
      jest.advanceTimersByTime(1);
      expect(mockWsInstances).toHaveLength(5);

      // Fifth disconnect — should reconnect after 16s
      mockWsInstances[4].simulateClose(1006);
      jest.advanceTimersByTime(15999);
      expect(mockWsInstances).toHaveLength(5);
      jest.advanceTimersByTime(1);
      expect(mockWsInstances).toHaveLength(6);

      // Sixth disconnect — should cap at 30s
      mockWsInstances[5].simulateClose(1006);
      jest.advanceTimersByTime(29999);
      expect(mockWsInstances).toHaveLength(6);
      jest.advanceTimersByTime(1);
      expect(mockWsInstances).toHaveLength(7);
    });

    it('sends sync message on reconnect with lastSync', () => {
      useConnectionStore.getState().setLastSync('2024-01-01T00:00:00Z');

      wsClient.connect('ws://localhost:8000/ws');
      mockWsInstances[0].simulateOpen();
      mockWsInstances[0].simulateClose(1006);

      jest.advanceTimersByTime(1000);
      mockWsInstances[1].simulateOpen();

      // Find the sync message in the reconnected WS sent messages
      const syncMsg = mockWsInstances[1].sentMessages.find((m) => {
        const parsed = JSON.parse(m);
        return parsed.type === 'sync';
      });
      expect(syncMsg).toBeDefined();
      const parsed = JSON.parse(syncMsg!);
      expect(parsed.payload.last_sync).toBe('2024-01-01T00:00:00Z');
    });

    it('does not reconnect after manual disconnect', () => {
      wsClient.connect('ws://localhost:8000/ws');
      mockWsInstances[0].simulateOpen();
      wsClient.disconnect();

      jest.advanceTimersByTime(60000);
      expect(mockWsInstances).toHaveLength(1);
    });

    it('resets reconnect attempts on successful reconnect', () => {
      wsClient.connect('ws://localhost:8000/ws');
      mockWsInstances[0].simulateOpen();
      mockWsInstances[0].simulateClose(1006);

      expect(useConnectionStore.getState().reconnectAttempts).toBe(1);

      jest.advanceTimersByTime(1000);
      mockWsInstances[1].simulateOpen();

      expect(useConnectionStore.getState().reconnectAttempts).toBe(0);
      expect(useConnectionStore.getState().status).toBe('connected');
    });
  });

  describe('onMessage handler', () => {
    it('allows subscribing and unsubscribing from message types', () => {
      const received: unknown[] = [];
      const handler = (msg: unknown) => received.push(msg);

      const unsubscribe = wsClient.onMessage('error', handler);

      wsClient.connect('ws://localhost:8000/ws');
      mockWsInstances[0].simulateOpen();

      mockWsInstances[0].simulateMessage({
        type: 'error',
        payload: { code: 'TEST', message: 'test' },
      });
      expect(received).toHaveLength(1);

      unsubscribe();

      mockWsInstances[0].simulateMessage({
        type: 'error',
        payload: { code: 'TEST2', message: 'test2' },
      });
      expect(received).toHaveLength(1);
    });

    it('supports multiple handlers for the same message type', () => {
      const received1: unknown[] = [];
      const received2: unknown[] = [];

      wsClient.onMessage('status', (msg) => received1.push(msg));
      wsClient.onMessage('status', (msg) => received2.push(msg));

      wsClient.connect('ws://localhost:8000/ws');
      mockWsInstances[0].simulateOpen();

      mockWsInstances[0].simulateMessage({
        type: 'status',
        payload: { state: 'thinking' },
      });

      expect(received1).toHaveLength(1);
      expect(received2).toHaveLength(1);
    });
  });

  // --- Additional edge case tests ---

  describe('error handling edge cases', () => {
    it('handles malformed incoming JSON gracefully (does not crash)', () => {
      wsClient.connect('ws://localhost:8000/ws');
      mockWsInstances[0].simulateOpen();

      // Simulate a message with invalid JSON string
      if (mockWsInstances[0].onmessage) {
        mockWsInstances[0].onmessage({
          data: 'not valid json {{{{',
        } as MessageEvent);
      }

      // Should not crash — status should remain connected
      expect(useConnectionStore.getState().status).toBe('connected');
    });

    it('handles incoming message with missing payload', () => {
      const received: unknown[] = [];
      wsClient.onMessage('status', (msg) => received.push(msg));

      wsClient.connect('ws://localhost:8000/ws');
      mockWsInstances[0].simulateOpen();

      // Message with type but no payload
      mockWsInstances[0].simulateMessage({ type: 'status' });

      // Should still deliver the message (payload will be undefined after toCamel)
      expect(received).toHaveLength(1);
    });

    it('handles incoming message with null payload', () => {
      const received: unknown[] = [];
      wsClient.onMessage('error', (msg) => received.push(msg));

      wsClient.connect('ws://localhost:8000/ws');
      mockWsInstances[0].simulateOpen();

      mockWsInstances[0].simulateMessage({
        type: 'error',
        payload: null,
      });

      expect(received).toHaveLength(1);
    });

    it('continues working after receiving malformed message', () => {
      const received: unknown[] = [];
      wsClient.onMessage('chat_stream', (msg) => received.push(msg));

      wsClient.connect('ws://localhost:8000/ws');
      mockWsInstances[0].simulateOpen();

      // Bad message
      if (mockWsInstances[0].onmessage) {
        mockWsInstances[0].onmessage({ data: '{bad' } as MessageEvent);
      }

      // Good message after
      mockWsInstances[0].simulateMessage({
        type: 'chat_stream',
        payload: { delta: 'Hello', done: true },
      });

      // The good message should still be received
      expect(received).toHaveLength(1);
    });
  });

  describe('connect edge cases', () => {
    it('connect while already connected creates a new WebSocket', () => {
      wsClient.connect('ws://localhost:8000/ws');
      mockWsInstances[0].simulateOpen();
      expect(useConnectionStore.getState().status).toBe('connected');

      // Connect again without disconnecting first
      wsClient.connect('ws://other:8000/ws');
      expect(mockWsInstances).toHaveLength(2);
      expect(mockWsInstances[1].url).toBe('ws://other:8000/ws');
    });

    it('connect resets intentionalDisconnect flag', () => {
      wsClient.connect('ws://localhost:8000/ws');
      mockWsInstances[0].simulateOpen();
      wsClient.disconnect();

      // After disconnect + reconnect, reconnection should work again
      wsClient.connect('ws://localhost:8000/ws');
      mockWsInstances[1].simulateOpen();
      mockWsInstances[1].simulateClose(1006);

      expect(useConnectionStore.getState().status).toBe('reconnecting');
    });
  });

  describe('disconnect edge cases', () => {
    it('disconnect when not connected does not throw', () => {
      expect(() => wsClient.disconnect()).not.toThrow();
      expect(useConnectionStore.getState().status).toBe('disconnected');
    });

    it('disconnect cancels pending reconnect timer', () => {
      wsClient.connect('ws://localhost:8000/ws');
      mockWsInstances[0].simulateOpen();
      mockWsInstances[0].simulateClose(1006);

      // Reconnect is scheduled — now disconnect
      wsClient.disconnect();

      // Advance past the reconnect delay
      jest.advanceTimersByTime(60000);

      // Should not have created a new WS instance
      expect(mockWsInstances).toHaveLength(1);
    });

    it('disconnect clears all WS event handlers', () => {
      wsClient.connect('ws://localhost:8000/ws');
      const ws = mockWsInstances[0];
      ws.simulateOpen();
      wsClient.disconnect();

      // After disconnect, the original WS handlers should be nulled out
      expect(ws.onopen).toBeNull();
      expect(ws.onclose).toBeNull();
      expect(ws.onerror).toBeNull();
      expect(ws.onmessage).toBeNull();
    });
  });

  describe('send edge cases', () => {
    it('queues messages when status is connecting (not yet open)', () => {
      wsClient.connect('ws://localhost:8000/ws');
      // Status is 'connecting' but not yet 'connected'

      wsClient.send({ type: 'chat', payload: { message: 'eager' } });
      expect(wsClient.getPendingMessageCount()).toBe(1);
      expect(mockWsInstances[0].sentMessages).toHaveLength(0);
    });

    it('queues messages when status is reconnecting', () => {
      wsClient.connect('ws://localhost:8000/ws');
      mockWsInstances[0].simulateOpen();
      mockWsInstances[0].simulateClose(1006);

      expect(useConnectionStore.getState().status).toBe('reconnecting');

      wsClient.send({ type: 'chat', payload: { message: 'during reconnect' } });
      expect(wsClient.getPendingMessageCount()).toBe(1);
    });

    it('flushes messages queued during reconnect when reconnection succeeds', () => {
      wsClient.connect('ws://localhost:8000/ws');
      mockWsInstances[0].simulateOpen();
      mockWsInstances[0].simulateClose(1006);

      wsClient.send({ type: 'chat', payload: { message: 'queued during reconnect' } });
      expect(wsClient.getPendingMessageCount()).toBe(1);

      jest.advanceTimersByTime(1000);
      mockWsInstances[1].simulateOpen();

      // Pending message flushed + sync message (reconnect DOES send sync)
      expect(wsClient.getPendingMessageCount()).toBe(0);
      const sent = mockWsInstances[1].sentMessages.map((m: string) => JSON.parse(m));
      expect(sent[0].payload.message).toBe('queued during reconnect');
      expect(sent[1].type).toBe('sync');
    });

    it('sends mixed message types from queue in order', () => {
      wsClient.send({ type: 'chat', payload: { message: 'msg1' } });
      wsClient.send({ type: 'log', payload: { layer: 'ws', event: 'test', severity: 'info', context: {} } });
      wsClient.send({ type: 'sync', payload: { lastSync: '2024-01-01' } });

      expect(wsClient.getPendingMessageCount()).toBe(3);

      wsClient.connect('ws://localhost:8000/ws');
      mockWsInstances[0].simulateOpen();

      expect(wsClient.getPendingMessageCount()).toBe(0);
      const sent = mockWsInstances[0].sentMessages.map((m: string) => JSON.parse(m));
      expect(sent[0].type).toBe('chat');
      expect(sent[1].type).toBe('log');
      expect(sent[2].type).toBe('sync');
      // No auto sync on first connect — only 3 messages
      expect(sent).toHaveLength(3);
    });
  });

  describe('reconnection edge cases', () => {
    it('backoff caps at 30 seconds even after many attempts', () => {
      wsClient.connect('ws://localhost:8000/ws');
      mockWsInstances[0].simulateOpen();

      // Simulate 10 consecutive failures
      for (let i = 0; i < 10; i++) {
        mockWsInstances[i].simulateClose(1006);
        // After attempt 5, delay should be capped at 30s
        const delay = i >= 5 ? 30000 : 1000 * Math.pow(2, i);
        jest.advanceTimersByTime(delay);
        expect(mockWsInstances).toHaveLength(i + 2);
      }
    });

    it('does not send sync on first connect', () => {
      wsClient.connect('ws://localhost:8000/ws');
      mockWsInstances[0].simulateOpen();

      const sent = mockWsInstances[0].sentMessages.map((m: string) => JSON.parse(m));
      const syncMsg = sent.find((m: any) => m.type === 'sync');
      // First connect should NOT send sync
      expect(syncMsg).toBeUndefined();
    });

    it('reconnection sends sync with current timestamp when lastSync is null', () => {
      // lastSync is null by default
      wsClient.connect('ws://localhost:8000/ws');
      mockWsInstances[0].simulateOpen();
      mockWsInstances[0].simulateClose(1006);

      jest.advanceTimersByTime(1000);
      mockWsInstances[1].simulateOpen();

      const sent = mockWsInstances[1].sentMessages.map((m: string) => JSON.parse(m));
      const syncMsg = sent.find((m: any) => m.type === 'sync');
      expect(syncMsg).toBeDefined();
      // When lastSync is null, it should use current time (an ISO string)
      expect(syncMsg.payload.last_sync).toBeDefined();
      expect(typeof syncMsg.payload.last_sync).toBe('string');
    });

    it('on error event does not trigger reconnection (only close does)', () => {
      wsClient.connect('ws://localhost:8000/ws');
      mockWsInstances[0].simulateOpen();
      mockWsInstances[0].simulateError();

      // Error alone should not change status or trigger reconnect
      // (The error is just logged; close event handles reconnection)
      expect(useConnectionStore.getState().status).toBe('connected');
      expect(mockWsInstances).toHaveLength(1);
    });
  });

  describe('onMessage edge cases', () => {
    it('unsubscribe is idempotent (can call multiple times)', () => {
      const handler = jest.fn();
      const unsub = wsClient.onMessage('error', handler);

      unsub();
      unsub(); // should not throw
      unsub(); // should not throw

      wsClient.connect('ws://localhost:8000/ws');
      mockWsInstances[0].simulateOpen();
      mockWsInstances[0].simulateMessage({
        type: 'error',
        payload: { code: 'T', message: 'test' },
      });

      expect(handler).not.toHaveBeenCalled();
    });

    it('unsubscribing one handler does not affect others for same type', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      const unsub1 = wsClient.onMessage('status', handler1);
      wsClient.onMessage('status', handler2);

      unsub1();

      wsClient.connect('ws://localhost:8000/ws');
      mockWsInstances[0].simulateOpen();
      mockWsInstances[0].simulateMessage({
        type: 'status',
        payload: { state: 'idle' },
      });

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('messages with no registered handlers are silently ignored', () => {
      wsClient.connect('ws://localhost:8000/ws');
      mockWsInstances[0].simulateOpen();

      // No handler registered for 'warning'
      expect(() => {
        mockWsInstances[0].simulateMessage({
          type: 'warning',
          payload: { code: 'W', message: 'test' },
        });
      }).not.toThrow();
    });

    it('handler registered after connect still receives messages', () => {
      wsClient.connect('ws://localhost:8000/ws');
      mockWsInstances[0].simulateOpen();

      const received: unknown[] = [];
      wsClient.onMessage('chat_stream', (msg) => received.push(msg));

      mockWsInstances[0].simulateMessage({
        type: 'chat_stream',
        payload: { delta: 'late handler', done: true },
      });

      expect(received).toHaveLength(1);
    });
  });

  describe('getPendingMessageCount', () => {
    it('returns 0 initially', () => {
      expect(wsClient.getPendingMessageCount()).toBe(0);
    });

    it('accurately tracks queue size', () => {
      wsClient.send({ type: 'chat', payload: { message: 'a' } });
      expect(wsClient.getPendingMessageCount()).toBe(1);

      wsClient.send({ type: 'chat', payload: { message: 'b' } });
      expect(wsClient.getPendingMessageCount()).toBe(2);

      wsClient.send({ type: 'chat', payload: { message: 'c' } });
      expect(wsClient.getPendingMessageCount()).toBe(3);
    });

    it('returns 0 after messages are flushed on connect', () => {
      wsClient.send({ type: 'chat', payload: { message: 'queued' } });
      expect(wsClient.getPendingMessageCount()).toBe(1);

      wsClient.connect('ws://localhost:8000/ws');
      mockWsInstances[0].simulateOpen();

      expect(wsClient.getPendingMessageCount()).toBe(0);
    });
  });
});
