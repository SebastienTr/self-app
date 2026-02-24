/**
 * Tests for moduleSync inline module card scheduling (story 2-5).
 *
 * Verifies:
 *   - module_created when agent idle → module_card appended immediately
 *   - module_created when agent streaming → module_card deferred until idle
 *   - Multiple deferred cards flushed in order when agent goes idle
 *   - cleanupModuleSync clears pending cards
 */

jest.mock('@/services/wsClient', () => ({
  onMessage: jest.fn(),
}));

jest.mock('@/services/localDb', () => ({
  cacheModule: jest.fn(async () => {}),
  removeCachedModule: jest.fn(async () => {}),
}));

jest.mock('./logger', () => ({
  logger: {
    info: jest.fn(),
    warning: jest.fn(),
    error: jest.fn(),
  },
}));

import { onMessage } from '@/services/wsClient';
import { useModuleStore } from '@/stores/moduleStore';
import { useChatStore } from '@/stores/chatStore';
import { initModuleSync, cleanupModuleSync } from './moduleSync';

const mockOnMessage = onMessage as jest.MockedFunction<typeof onMessage>;

describe('moduleSync module_card scheduling', () => {
  let moduleCreatedHandler: ((msg: unknown) => void) | undefined;

  beforeEach(() => {
    // Reset stores
    useModuleStore.setState({ modules: new Map() });
    useChatStore.setState({
      messages: [],
      streamingMessage: null,
      agentStatus: 'idle',
    });

    // Capture handlers
    mockOnMessage.mockImplementation((type: any, handler: any) => {
      if (type === 'module_created') moduleCreatedHandler = handler;
      return jest.fn();
    });

    initModuleSync();
  });

  afterEach(() => {
    cleanupModuleSync();
    jest.clearAllMocks();
  });

  it('appends module_card immediately when agent is idle', () => {
    useChatStore.setState({ agentStatus: 'idle' });

    moduleCreatedHandler?.({
      type: 'module_created',
      payload: { moduleId: 'mod-1' },
    });

    const messages = useChatStore.getState().messages;
    expect(messages).toHaveLength(1);
    expect(messages[0].type).toBe('module_card');
    if (messages[0].type === 'module_card') {
      expect(messages[0].moduleId).toBe('mod-1');
    }
  });

  it('defers module_card when agent is streaming', () => {
    useChatStore.setState({ agentStatus: 'thinking', streamingMessage: '' });

    moduleCreatedHandler?.({
      type: 'module_created',
      payload: { moduleId: 'mod-1' },
    });

    // No module_card yet
    expect(useChatStore.getState().messages).toHaveLength(0);
  });

  it('flushes deferred module_card when agent becomes idle', () => {
    useChatStore.setState({ agentStatus: 'thinking', streamingMessage: '' });

    moduleCreatedHandler?.({
      type: 'module_created',
      payload: { moduleId: 'mod-1' },
    });

    expect(useChatStore.getState().messages).toHaveLength(0);

    // Simulate agent finishing
    useChatStore.setState({ agentStatus: 'idle', streamingMessage: null });

    const messages = useChatStore.getState().messages;
    expect(messages).toHaveLength(1);
    expect(messages[0].type).toBe('module_card');
  });

  it('flushes multiple deferred cards in order', () => {
    useChatStore.setState({ agentStatus: 'thinking', streamingMessage: '' });

    moduleCreatedHandler?.({
      type: 'module_created',
      payload: { moduleId: 'mod-1' },
    });
    moduleCreatedHandler?.({
      type: 'module_created',
      payload: { moduleId: 'mod-2' },
    });

    expect(useChatStore.getState().messages).toHaveLength(0);

    // Agent finishes
    useChatStore.setState({ agentStatus: 'idle', streamingMessage: null });

    const messages = useChatStore.getState().messages;
    expect(messages).toHaveLength(2);
    if (messages[0].type === 'module_card' && messages[1].type === 'module_card') {
      expect(messages[0].moduleId).toBe('mod-1');
      expect(messages[1].moduleId).toBe('mod-2');
    }
  });

  it('cleanupModuleSync clears pending cards', () => {
    useChatStore.setState({ agentStatus: 'thinking', streamingMessage: '' });

    moduleCreatedHandler?.({
      type: 'module_created',
      payload: { moduleId: 'mod-1' },
    });

    cleanupModuleSync();

    // Now simulate idle — should NOT flush since cleanup was called
    useChatStore.setState({ agentStatus: 'idle', streamingMessage: null });

    expect(useChatStore.getState().messages).toHaveLength(0);
  });

  it('also adds module to moduleStore (existing behavior preserved)', () => {
    moduleCreatedHandler?.({
      type: 'module_created',
      payload: { moduleId: 'mod-1' },
    });

    expect(useModuleStore.getState().modules.has('mod-1')).toBe(true);
  });
});
