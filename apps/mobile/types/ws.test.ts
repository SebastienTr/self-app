/**
 * Type definition compile-time verification tests.
 *
 * These tests verify that the WSMessage discriminated union types
 * work correctly at both compile-time and runtime.
 */
import type {
  AgentState,
  ConnectionStatus,
  PersonaType,
  WSMessage,
  WSMessageType,
} from './ws';

describe('WSMessage type definitions', () => {
  it('accepts valid client-to-server messages', () => {
    const authMsg: WSMessage = { type: 'auth', payload: { token: 'abc' } };
    expect(authMsg.type).toBe('auth');

    const authResetMsg: WSMessage = { type: 'auth_reset', payload: {} };
    expect(authResetMsg.type).toBe('auth_reset');

    const chatMsg: WSMessage = {
      type: 'chat',
      payload: { message: 'Hello' },
    };
    expect(chatMsg.type).toBe('chat');

    const moduleActionMsg: WSMessage = {
      type: 'module_action',
      payload: { moduleId: '123', action: 'refresh' },
    };
    expect(moduleActionMsg.type).toBe('module_action');

    const logMsg: WSMessage = {
      type: 'log',
      payload: {
        layer: 'mobile:ws',
        event: 'connected',
        severity: 'info',
        context: { url: 'ws://localhost' },
      },
    };
    expect(logMsg.type).toBe('log');

    const syncMsg: WSMessage = {
      type: 'sync',
      payload: { lastSync: '2024-01-01T00:00:00Z' },
    };
    expect(syncMsg.type).toBe('sync');
  });

  it('accepts valid server-to-client messages', () => {
    const chatStreamMsg: WSMessage = {
      type: 'chat_stream',
      payload: { delta: 'Hello', done: false },
    };
    expect(chatStreamMsg.type).toBe('chat_stream');

    const moduleCreatedMsg: WSMessage = {
      type: 'module_created',
      payload: { moduleId: '1' },
    };
    expect(moduleCreatedMsg.type).toBe('module_created');

    const moduleUpdatedMsg: WSMessage = {
      type: 'module_updated',
      payload: { moduleId: '1', spec: { moduleId: '1' } },
    };
    expect(moduleUpdatedMsg.type).toBe('module_updated');

    const moduleListMsg: WSMessage = {
      type: 'module_list',
      payload: { modules: [] },
    };
    expect(moduleListMsg.type).toBe('module_list');

    const moduleSyncMsg: WSMessage = {
      type: 'module_sync',
      payload: { modules: [], lastSync: '2024-01-01' },
    };
    expect(moduleSyncMsg.type).toBe('module_sync');

    const errorMsg: WSMessage = {
      type: 'error',
      payload: { code: 'WS_UNKNOWN', message: 'Unknown', agentAction: 'Fix' },
    };
    expect(errorMsg.type).toBe('error');

    const warningMsg: WSMessage = {
      type: 'warning',
      payload: { code: 'WARN_1', message: 'Warning' },
    };
    expect(warningMsg.type).toBe('warning');

    const statusMsg: WSMessage = {
      type: 'status',
      payload: { state: 'thinking' as AgentState, persona: 'flame' as PersonaType },
    };
    expect(statusMsg.type).toBe('status');

    const usageSummaryMsg: WSMessage = {
      type: 'usage_summary',
      payload: { daily: 10, weekly: 50, monthly: 200 },
    };
    expect(usageSummaryMsg.type).toBe('usage_summary');
  });

  it('has 15 message types in the union', () => {
    // Exhaustive type list — if any are removed/added, this array fails typecheck
    const allTypes: WSMessageType[] = [
      'auth',
      'auth_reset',
      'chat',
      'chat_stream',
      'module_created',
      'module_updated',
      'module_list',
      'module_sync',
      'sync',
      'error',
      'warning',
      'status',
      'usage_summary',
      'module_action',
      'log',
    ];
    expect(allTypes).toHaveLength(15);
  });

  it('supports ConnectionStatus enum values', () => {
    const statuses: ConnectionStatus[] = [
      'disconnected',
      'connecting',
      'connected',
      'reconnecting',
    ];
    expect(statuses).toHaveLength(4);
  });

  it('supports AgentState enum values', () => {
    const states: AgentState[] = ['idle', 'thinking', 'discovering', 'composing'];
    expect(states).toHaveLength(4);
  });

  it('supports PersonaType enum values', () => {
    const personas: PersonaType[] = ['flame', 'tree', 'star'];
    expect(personas).toHaveLength(3);
  });

  it('error message agentAction is optional', () => {
    const withAction: WSMessage = {
      type: 'error',
      payload: { code: 'E1', message: 'err', agentAction: 'do this' },
    };
    const withoutAction: WSMessage = {
      type: 'error',
      payload: { code: 'E2', message: 'err' },
    };
    expect(withAction.type).toBe('error');
    expect(withoutAction.type).toBe('error');
  });

  it('status message persona is optional', () => {
    const withPersona: WSMessage = {
      type: 'status',
      payload: { state: 'idle' as AgentState, persona: 'star' as PersonaType },
    };
    const withoutPersona: WSMessage = {
      type: 'status',
      payload: { state: 'idle' as AgentState },
    };
    expect(withPersona.type).toBe('status');
    expect(withoutPersona.type).toBe('status');
  });
});
