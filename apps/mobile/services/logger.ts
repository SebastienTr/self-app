/**
 * Structured JSON logging service for the mobile app.
 *
 * Matches the architecture's AI-First Observability pattern:
 *   { ts, layer: "mobile:${layer}", event, severity, context: { ...context, agent_action } }
 *
 * Logs to console for React Native Debugger and queues entries for
 * WS forwarding to the backend (unified 3-stream logging architecture).
 */

export type Severity = 'debug' | 'info' | 'warning' | 'error';

export interface LogEntry {
  ts: string;
  layer: string;
  event: string;
  severity: Severity;
  context: Record<string, unknown> & { agent_action: string | null };
}

/** Maximum number of log entries to queue before dropping oldest. */
const MAX_LOG_QUEUE_SIZE = 500;

/** Queued log entries awaiting WS forwarding. */
let logQueue: LogEntry[] = [];

/**
 * Callback to actually send a log entry over WS.
 * Set by wsClient once connected. Null if WS not yet wired.
 */
let sendCallback: ((entry: LogEntry) => void) | null = null;

/**
 * Register the WS send callback for log forwarding.
 * Called once by wsClient after initialization.
 */
export function registerLogSender(
  callback: (entry: LogEntry) => void,
): void {
  sendCallback = callback;
  // Flush any queued entries
  const pending = logQueue.splice(0);
  for (const entry of pending) {
    callback(entry);
  }
}

/**
 * Unregister the WS send callback (e.g., on disconnect cleanup).
 */
export function unregisterLogSender(): void {
  sendCallback = null;
}

/**
 * Queue a log entry for WS forwarding.
 * If a sender is registered, sends immediately; otherwise queues.
 */
function sendToBackend(entry: LogEntry): void {
  if (sendCallback) {
    sendCallback(entry);
  } else {
    logQueue.push(entry);
    // Drop oldest entries if queue exceeds max size
    if (logQueue.length > MAX_LOG_QUEUE_SIZE) {
      logQueue = logQueue.slice(-MAX_LOG_QUEUE_SIZE);
    }
  }
}

/**
 * Emit a structured log entry.
 *
 * @param layer - Sub-layer name (prefixed with "mobile:")
 * @param event - Event identifier (e.g., "ws_connected")
 * @param context - Additional context data
 * @param severity - Log severity (default: "info")
 */
export function log(
  layer: string,
  event: string,
  context: Record<string, unknown> = {},
  severity: Severity = 'info',
): void {
  const entry: LogEntry = {
    ts: new Date().toISOString(),
    layer: `mobile:${layer}`,
    event,
    severity,
    context: {
      ...context,
      agent_action: (context.agent_action as string) ?? null,
    },
  };

  // Log to console for React Native Debugger
  if (severity === 'error') {
    console.error(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }

  // Queue for WS forwarding
  sendToBackend(entry);
}

/**
 * Get the current log queue length (for testing/debugging).
 */
export function getLogQueueLength(): number {
  return logQueue.length;
}

/**
 * Clear the log queue (for testing).
 */
export function clearLogQueue(): void {
  logQueue = [];
}

/** Logger singleton with convenience methods. */
export const logger = {
  log,
  debug: (layer: string, event: string, context?: Record<string, unknown>) =>
    log(layer, event, context, 'debug'),
  info: (layer: string, event: string, context?: Record<string, unknown>) =>
    log(layer, event, context, 'info'),
  warning: (layer: string, event: string, context?: Record<string, unknown>) =>
    log(layer, event, context, 'warning'),
  error: (layer: string, event: string, context?: Record<string, unknown>) =>
    log(layer, event, context, 'error'),
  registerLogSender,
  unregisterLogSender,
  getLogQueueLength,
  clearLogQueue,
};
