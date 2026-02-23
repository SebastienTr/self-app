/**
 * WebSocket client service — the core connection manager.
 *
 * Handles:
 *   - Connection lifecycle (connect, disconnect)
 *   - Message send with snake_case conversion
 *   - Message receive with camelCase conversion
 *   - Exponential backoff reconnection (1s, 2s, 4s, 8s, 16s, max 30s)
 *   - Offline message queue (zero message loss — NFR19)
 *   - Type-based message routing via onMessage handlers
 *
 * Architecture boundary: wsClient is the ONLY module that touches WebSocket.
 */

import { useConnectionStore } from '@/stores/connectionStore';
import type { WSMessage, WSMessageType } from '@/types/ws';
import { toCamel } from '@/utils/toCamel';
import { toSnake } from '@/utils/toSnake';
import { logger } from './logger';

// --- Constants ---

const MAX_BACKOFF_MS = 30_000;
const BASE_BACKOFF_MS = 1_000;
const MAX_PENDING_MESSAGES = 200;

// --- Internal state ---

let ws: WebSocket | null = null;
let pendingMessages: WSMessage[] = [];
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let intentionalDisconnect = false;
let currentUrl = '';
let isReconnect = false;

type MessageHandler = (msg: WSMessage) => void;
const handlers = new Map<WSMessageType, Set<MessageHandler>>();

// --- Backoff calculation ---

function getBackoffDelay(attempt: number): number {
  const delay = BASE_BACKOFF_MS * Math.pow(2, attempt);
  return Math.min(delay, MAX_BACKOFF_MS);
}

// --- Flush pending messages ---

function flushPendingMessages(): void {
  if (!ws || useConnectionStore.getState().status !== 'connected') return;

  const messages = pendingMessages.splice(0);
  for (const msg of messages) {
    sendImmediate(msg);
  }
  if (messages.length > 0) {
    logger.info('ws', 'queue_flushed', { count: messages.length });
  }
}

// --- Send a message immediately (no queue check) ---

function sendImmediate(msg: WSMessage): void {
  if (!ws) return;
  const wireMsg = { type: msg.type, payload: toSnake(msg.payload) };
  ws.send(JSON.stringify(wireMsg));
  logger.debug('ws', 'message_sent', { type: msg.type });
}

// --- Send a sync message on reconnection ---

function sendSyncOnReconnect(): void {
  const { lastSync } = useConnectionStore.getState();
  const syncMsg: WSMessage = {
    type: 'sync',
    payload: { lastSync: lastSync ?? new Date().toISOString() },
  };
  sendImmediate(syncMsg);
}

// --- Reconnect with exponential backoff ---

function scheduleReconnect(): void {
  if (intentionalDisconnect) return;

  const store = useConnectionStore.getState();
  const attempts = store.reconnectAttempts;
  const delay = getBackoffDelay(attempts);

  logger.info('ws', 'reconnect_scheduled', {
    attempt: attempts + 1,
    delay_ms: delay,
  });

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    doConnect(currentUrl);
  }, delay);
}

// --- Internal connect ---

function doConnect(url: string): void {
  const store = useConnectionStore.getState();

  ws = new WebSocket(url);

  ws.onopen = () => {
    store.setStatus('connected');
    store.resetReconnectAttempts();
    logger.info('ws', 'connect', { url, reconnect: isReconnect });

    // Flush pending messages first (FIFO order)
    flushPendingMessages();

    // Send sync message only on reconnect (not first connect)
    if (isReconnect) {
      sendSyncOnReconnect();
    }

    // After first successful connect, all subsequent connects are reconnects
    isReconnect = true;
  };

  ws.onclose = (event) => {
    logger.info('ws', 'disconnect', { code: (event as CloseEvent).code });

    if (!intentionalDisconnect) {
      store.setStatus('reconnecting');
      // Schedule reconnect BEFORE incrementing so backoff uses current attempt count
      // Attempt 0 → 1s, Attempt 1 → 2s, Attempt 2 → 4s, etc.
      scheduleReconnect();
      store.incrementReconnectAttempts();
    }
  };

  ws.onerror = () => {
    logger.error('ws', 'connection_error', {
      url,
      agent_action: 'Check if backend is running and WebSocket URL is correct',
    });
  };

  ws.onmessage = (event) => {
    try {
      const raw = JSON.parse((event as MessageEvent).data);
      const msgType = raw.type as WSMessageType;
      const payload = toCamel(raw.payload);

      const msg = { type: msgType, payload } as WSMessage;

      logger.debug('ws', 'message_received', { type: msgType });

      // Route to registered handlers
      const typeHandlers = handlers.get(msgType);
      if (typeHandlers) {
        for (const handler of typeHandlers) {
          handler(msg);
        }
      }
    } catch (err) {
      logger.error('ws', 'message_parse_error', {
        error: String(err),
        agent_action: 'Check incoming message format from backend',
      });
    }
  };
}

// --- Public API ---

/**
 * Open a WebSocket connection to the given URL.
 */
export function connect(url: string): void {
  // Clean up any existing connection before opening a new one
  if (ws) {
    ws.onclose = null;
    ws.onerror = null;
    ws.onmessage = null;
    ws.onopen = null;
    ws.close();
    ws = null;
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  intentionalDisconnect = false;
  isReconnect = false;
  currentUrl = url;
  useConnectionStore.getState().setStatus('connecting');
  doConnect(url);
}

/**
 * Cleanly close the WebSocket connection.
 * Prevents automatic reconnection.
 */
export function disconnect(): void {
  intentionalDisconnect = true;

  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  if (ws) {
    // Remove handlers to prevent reconnection
    ws.onclose = null;
    ws.onerror = null;
    ws.onmessage = null;
    ws.onopen = null;
    ws.close();
    ws = null;
  }

  useConnectionStore.getState().setStatus('disconnected');
}

/**
 * Send a WSMessage. If connected, sends immediately with snake_case conversion.
 * If not connected, queues the message for later delivery (zero loss guarantee).
 */
export function send(msg: WSMessage): void {
  if (useConnectionStore.getState().status === 'connected' && ws) {
    sendImmediate(msg);
  } else {
    if (pendingMessages.length >= MAX_PENDING_MESSAGES) {
      logger.warning('ws', 'queue_overflow', {
        dropped_type: pendingMessages[0].type,
        queue_length: pendingMessages.length,
        agent_action: 'Pending message queue is full; oldest message dropped',
      });
      pendingMessages.shift();
    }
    pendingMessages.push(msg);
    logger.info('ws', 'message_queued', {
      type: msg.type,
      queue_length: pendingMessages.length,
    });
  }
}

/**
 * Register a handler for a specific WS message type.
 * Returns an unsubscribe function.
 */
export function onMessage(
  type: WSMessageType,
  handler: MessageHandler,
): () => void {
  if (!handlers.has(type)) {
    handlers.set(type, new Set());
  }
  handlers.get(type)!.add(handler);

  return () => {
    const set = handlers.get(type);
    if (set) {
      set.delete(handler);
      if (set.size === 0) {
        handlers.delete(type);
      }
    }
  };
}

/**
 * Get the number of pending messages in the offline queue.
 */
export function getPendingMessageCount(): number {
  return pendingMessages.length;
}
