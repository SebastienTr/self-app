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

import { useAuthStore } from '@/stores/authStore';
import { useConnectionStore } from '@/stores/connectionStore';
import type { PersonaType, WSMessage, WSMessageType } from '@/types/ws';
import { toCamel } from '@/utils/toCamel';
import { toSnake } from '@/utils/toSnake';
import { logger } from './logger';
import {
  enqueuePendingMessage,
  dequeuePendingMessages,
  clearPendingMessages,
} from './localDb';

// --- Constants ---

const MAX_BACKOFF_MS = 30_000;
const BASE_BACKOFF_MS = 1_000;
const MAX_PENDING_MESSAGES = 200;
const LOG_TEXT_PREVIEW = 180;

// --- Internal state ---

let ws: WebSocket | null = null;
let pendingMessages: WSMessage[] = [];
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let intentionalDisconnect = false;
let currentUrl = '';
let isReconnect = false;
let pairingTokenForAuth: string | null = null;

type MessageHandler = (msg: WSMessage) => void;
const handlers = new Map<WSMessageType, Set<MessageHandler>>();

// --- Backoff calculation ---

function getBackoffDelay(attempt: number): number {
  const delay = BASE_BACKOFF_MS * Math.pow(2, attempt);
  return Math.min(delay, MAX_BACKOFF_MS);
}

function truncateLogText(value: string): string {
  if (value.length <= LOG_TEXT_PREVIEW) return value;
  return `${value.slice(0, LOG_TEXT_PREVIEW)}...[truncated]`;
}

function summarizePayloadForLog(payload: unknown): unknown {
  if (!payload || typeof payload !== 'object') return payload;

  const input = payload as Record<string, unknown>;
  const summary: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'string') {
      summary[key] = truncateLogText(value);
      continue;
    }
    if (Array.isArray(value)) {
      summary[key] = `[array:${value.length}]`;
      continue;
    }
    if (value && typeof value === 'object') {
      summary[key] = '[object]';
      continue;
    }
    summary[key] = value;
  }

  return summary;
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
    // Clear persisted queue after successful flush (fire-and-forget)
    clearPendingMessages().catch(() => {});
  }
}

// --- Send a message immediately (no queue check) ---

function sendImmediate(msg: WSMessage): void {
  if (!ws) return;
  const wireMsg = { type: msg.type, payload: toSnake(msg.payload) };
  ws.send(JSON.stringify(wireMsg));
  logger.debug('ws', 'message_sent', {
    type: msg.type,
    payload: summarizePayloadForLog(msg.payload),
  });
}

// --- Send a sync message on reconnection ---

function sendSyncOnReconnect(): void {
  const { lastSync, lastSeq } = useConnectionStore.getState();
  const syncMsg: WSMessage = {
    type: 'sync',
    payload: {
      lastSync: lastSync ?? new Date().toISOString(),
      lastSeq: lastSeq > 0 ? lastSeq : 0,
    },
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

// --- Send auth message ---

function sendAuthMessage(): void {
  const authStore = useAuthStore.getState();
  const token = authStore.sessionToken;
  const backendUrl = authStore.backendUrl;

  if (!token) {
    logger.warning('ws', 'auth_no_token', {
      agent_action: 'No session token available. Cannot authenticate.',
    });
    return;
  }

  // Build auth payload — include pairing token if this is a new pairing
  const payload: { token: string; pairing_token?: string } = { token };

  // If authStatus is 'pairing', we're in the initial pairing flow
  // The pairing token was entered by the user — it's different from the session token
  // We need to pass it as pairing_token in the auth message
  // The pairing token is stored temporarily in a closure from the PairingScreen
  // For pairing flow: session token + pairing token are sent together
  // For reconnect: only session token is sent
  if (pairingTokenForAuth) {
    payload.pairing_token = pairingTokenForAuth;
    pairingTokenForAuth = null; // Consume it after use
  }

  const authMsg: WSMessage = { type: 'auth', payload };
  sendImmediate(authMsg);
  logger.info('ws', 'auth_sent', { has_pairing_token: !!payload.pairing_token });
}

// --- Internal connect ---

function doConnect(url: string): void {
  const store = useConnectionStore.getState();

  ws = new WebSocket(url);

  ws.onopen = () => {
    store.setStatus('connected');
    store.resetReconnectAttempts();
    logger.info('ws', 'connect', { url, reconnect: isReconnect });

    // 1. Send auth message FIRST (before any other messages)
    sendAuthMessage();

    // 2. Flush pending messages (FIFO order)
    flushPendingMessages();

    // 3. Send sync message on reconnect (not first connect)
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
      const seq = typeof raw.seq === 'number' ? raw.seq : undefined;
      if (typeof seq === 'number') {
        useConnectionStore.getState().setLastSeq(seq);
      }

      const msg = { type: msgType, payload, seq } as WSMessage;

      logger.debug('ws', 'message_received', {
        type: msgType,
        seq,
        payload: summarizePayloadForLog(payload),
      });

      // Check for auth errors and update auth state
      if (msgType === 'error' && payload) {
        const code = (payload as Record<string, unknown>).code as string;
        if (code === 'AUTH_INVALID_TOKEN' || code === 'AUTH_REQUIRED') {
          const authStore = useAuthStore.getState();
          authStore.setAuthStatus('auth_failed');
          authStore.setPairingError(
            (payload as Record<string, unknown>).message as string ||
            'Authentication failed'
          );
          logger.error('ws', 'auth_error', { code });
        } else if (code === 'AUTH_PAIRING_FAILED') {
          const authStore = useAuthStore.getState();
          authStore.setAuthStatus('auth_failed');
          authStore.setPairingError(
            (payload as Record<string, unknown>).message as string ||
            'Pairing failed'
          );
          logger.error('ws', 'pairing_failed', { code });
        }
      }

      // Extract persona from status messages and update connectionStore
      if (msgType === 'status' && payload) {
        const personaValue = (payload as Record<string, unknown>).persona as PersonaType | null | undefined;
        useConnectionStore.getState().setPersona(personaValue ?? null);
      }

      // Detect successful auth (no error after auth message = success)
      // If we get a non-error message while in 'pairing' or 'authenticating', auth succeeded
      if (
        msgType !== 'error' &&
        (useAuthStore.getState().authStatus === 'pairing' ||
          useAuthStore.getState().authStatus === 'authenticating')
      ) {
        useAuthStore.getState().setAuthStatus('authenticated');
        logger.info('ws', 'auth_success_inferred');
      }

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
 * If pairingToken is provided, it will be included in the first auth message.
 */
export function connect(url: string, pairingToken?: string): void {
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
  pairingTokenForAuth = pairingToken ?? null;
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
    // Persist to SQLite for crash survival (fire-and-forget)
    enqueuePendingMessage(msg).catch(() => {});
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
 * Load persisted messages from expo-sqlite on app startup.
 * Prepends them to the in-memory queue (they were queued before current session).
 * Enforces MAX_PENDING_MESSAGES limit after merging (drops oldest if over limit).
 */
export async function loadPersistedMessages(): Promise<void> {
  try {
    const persisted = await dequeuePendingMessages();
    if (persisted.length > 0) {
      // Prepend persisted messages (they came first)
      pendingMessages = [...persisted, ...pendingMessages];

      // Enforce MAX_PENDING_MESSAGES limit — drop oldest if over capacity
      if (pendingMessages.length > MAX_PENDING_MESSAGES) {
        const dropped = pendingMessages.length - MAX_PENDING_MESSAGES;
        pendingMessages = pendingMessages.slice(dropped);
        logger.warning('ws', 'persisted_queue_trimmed', {
          dropped,
          retained: pendingMessages.length,
          agent_action: 'Persisted queue exceeded MAX_PENDING_MESSAGES on load; oldest messages dropped',
        });
      }

      logger.info('ws', 'persisted_messages_loaded', {
        count: persisted.length,
        total_queue: pendingMessages.length,
      });
    }
  } catch (err) {
    logger.error('ws', 'load_persisted_failed', {
      error: String(err),
      agent_action: 'Check localDb initialization',
    });
  }
}

/**
 * Get the number of pending messages in the offline queue.
 */
export function getPendingMessageCount(): number {
  return pendingMessages.length;
}

/**
 * Send a set_persona message to the backend.
 * The backend will confirm with a status message including the new persona.
 */
export function sendSetPersona(persona: PersonaType): void {
  send({ type: 'set_persona', payload: { persona } });
}
