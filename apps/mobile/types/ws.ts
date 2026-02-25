/**
 * WebSocket protocol type definitions.
 *
 * All WS messages follow the discriminated union pattern:
 *   { type: string, payload: object }
 *
 * The `type` field uses snake_case on the wire and is NOT converted.
 * Payload fields are snake_case on the wire and converted to camelCase in TS
 * via toCamel().
 */

// --- Supporting types ---

export type AgentState =
  | 'idle'
  | 'thinking'
  | 'streaming'
  | 'discovering'
  | 'composing'
  | 'saving';

export type PersonaType = 'flame' | 'tree' | 'star';

export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting';

/**
 * Minimal ModuleSpec placeholder.
 * Full definition lives in @self/module-schema; this is enough for WS typing.
 */
export interface ModuleSpec {
  moduleId: string;
  [key: string]: unknown;
}

// --- Client-to-server message types ---

export interface AuthMessage {
  type: 'auth';
  payload: { token: string };
}

export interface AuthResetMessage {
  type: 'auth_reset';
  payload: Record<string, never>;
}

export interface ChatMessage {
  type: 'chat';
  payload: { message: string };
}

export interface ModuleActionMessage {
  type: 'module_action';
  payload: { moduleId: string; action: string };
}

export interface LogMessage {
  type: 'log';
  payload: {
    layer: string;
    event: string;
    severity: string;
    context: Record<string, unknown>;
  };
}

export interface SyncMessage {
  type: 'sync';
  payload: { lastSync: string; lastSeq?: number };
}

export interface SetPersonaMessage {
  type: 'set_persona';
  payload: { persona: PersonaType };
}

// --- Server-to-client message types ---

export interface ChatStreamMessage {
  type: 'chat_stream';
  payload: { delta: string; done: boolean };
}

export interface ModuleCreatedMessage {
  type: 'module_created';
  payload: ModuleSpec;
}

export interface ModuleUpdatedMessage {
  type: 'module_updated';
  payload: { moduleId: string; spec: ModuleSpec };
}

export interface ModuleListMessage {
  type: 'module_list';
  payload: { modules: ModuleSpec[] };
}

export interface ModuleSyncMessage {
  type: 'module_sync';
  payload: { modules: ModuleSpec[]; lastSync: string };
}

export interface ErrorMessage {
  type: 'error';
  payload: { code: string; message: string; agentAction?: string };
}

export interface WarningMessage {
  type: 'warning';
  payload: { code: string; message: string };
}

export interface StatusMessage {
  type: 'status';
  payload: { state: AgentState; persona?: PersonaType };
}

export interface UsageSummaryMessage {
  type: 'usage_summary';
  payload: { daily: number; weekly: number; monthly: number };
}

export interface ModuleRefreshFailedMessage {
  type: 'module_refresh_failed';
  payload: { moduleId: string; error?: string };
}

// --- Discriminated union ---

export type WSMessage = (
  | AuthMessage
  | AuthResetMessage
  | ChatMessage
  | ChatStreamMessage
  | ModuleCreatedMessage
  | ModuleUpdatedMessage
  | ModuleListMessage
  | ModuleSyncMessage
  | SyncMessage
  | SetPersonaMessage
  | ErrorMessage
  | WarningMessage
  | StatusMessage
  | UsageSummaryMessage
  | ModuleActionMessage
  | LogMessage
  | ModuleRefreshFailedMessage
) & { seq?: number };

/** All valid WS message type discriminators. */
export type WSMessageType = WSMessage['type'];
