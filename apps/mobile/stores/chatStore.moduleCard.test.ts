/**
 * Tests for chatStore module_card message type (story 2-5).
 *
 * Verifies:
 *   - addModuleCard creates a module_card entry in messages
 *   - Regular messages have type: 'chat'
 *   - module_card and chat messages coexist in messages array
 *   - clearMessages clears module_card entries too
 */

import { useChatStore } from './chatStore';

describe('chatStore module_card', () => {
  beforeEach(() => {
    useChatStore.setState({
      messages: [],
      streamingMessage: null,
      agentStatus: 'idle',
    });
  });

  describe('addModuleCard', () => {
    it('adds a module_card message to messages array', () => {
      useChatStore.getState().addModuleCard('mod-123');
      const messages = useChatStore.getState().messages;
      expect(messages).toHaveLength(1);
      expect(messages[0].type).toBe('module_card');
    });

    it('sets moduleId on the module_card message', () => {
      useChatStore.getState().addModuleCard('mod-123');
      const msg = useChatStore.getState().messages[0];
      expect(msg.type).toBe('module_card');
      if (msg.type === 'module_card') {
        expect(msg.moduleId).toBe('mod-123');
      }
    });

    it('generates a unique id', () => {
      useChatStore.getState().addModuleCard('mod-1');
      useChatStore.getState().addModuleCard('mod-2');
      const messages = useChatStore.getState().messages;
      expect(messages[0].id).not.toBe(messages[1].id);
    });

    it('sets ISO timestamp', () => {
      useChatStore.getState().addModuleCard('mod-1');
      const msg = useChatStore.getState().messages[0];
      expect(msg.timestamp).toBeTruthy();
      expect(new Date(msg.timestamp).toISOString()).toBe(msg.timestamp);
    });

    it('does not have role or content fields', () => {
      useChatStore.getState().addModuleCard('mod-1');
      const msg = useChatStore.getState().messages[0] as any;
      expect(msg.role).toBeUndefined();
      expect(msg.content).toBeUndefined();
    });
  });

  describe('discriminated union type field', () => {
    it('user messages have type chat', () => {
      useChatStore.getState().addUserMessage('Hello');
      expect(useChatStore.getState().messages[0].type).toBe('chat');
    });

    it('agent messages from finalize have type chat', () => {
      useChatStore.getState().startAgentStream();
      useChatStore.getState().appendStreamDelta('Response');
      useChatStore.getState().finalizeAgentMessage();
      expect(useChatStore.getState().messages[0].type).toBe('chat');
    });

    it('error messages have type chat', () => {
      useChatStore.getState().addErrorMessage('Error');
      expect(useChatStore.getState().messages[0].type).toBe('chat');
    });
  });

  describe('mixed messages', () => {
    it('module_card and chat messages coexist in order', () => {
      useChatStore.getState().addUserMessage('Create a weather module');
      useChatStore.getState().startAgentStream();
      useChatStore.getState().appendStreamDelta('Created weather module!');
      useChatStore.getState().finalizeAgentMessage();
      useChatStore.getState().addModuleCard('weather-mod-1');

      const messages = useChatStore.getState().messages;
      expect(messages).toHaveLength(3);
      expect(messages[0].type).toBe('chat');
      expect(messages[1].type).toBe('chat');
      expect(messages[2].type).toBe('module_card');
    });

    it('clearMessages removes module_card entries too', () => {
      useChatStore.getState().addModuleCard('mod-1');
      useChatStore.getState().addUserMessage('Hello');
      useChatStore.getState().clearMessages();
      expect(useChatStore.getState().messages).toHaveLength(0);
    });
  });
});
