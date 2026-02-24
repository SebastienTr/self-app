/**
 * Edge-case tests for chatStore module_card type (story 2-5).
 *
 * Covers:
 *   - Empty string moduleId
 *   - Rapid sequential addModuleCard calls
 *   - addModuleCard during active stream
 *   - Type narrowing safety on discriminated union
 *   - Message ordering with interleaved types
 */

import { useChatStore } from './chatStore';
import type { ChatMessageModuleCard, ChatMessageChat } from './chatStore';

describe('chatStore module_card edge cases', () => {
  beforeEach(() => {
    useChatStore.setState({
      messages: [],
      streamingMessage: null,
      agentStatus: 'idle',
    });
  });

  describe('boundary moduleId values', () => {
    it('accepts empty string moduleId', () => {
      useChatStore.getState().addModuleCard('');
      const msg = useChatStore.getState().messages[0];
      expect(msg.type).toBe('module_card');
      if (msg.type === 'module_card') {
        expect(msg.moduleId).toBe('');
      }
    });

    it('accepts very long moduleId', () => {
      const longId = 'x'.repeat(1000);
      useChatStore.getState().addModuleCard(longId);
      const msg = useChatStore.getState().messages[0];
      if (msg.type === 'module_card') {
        expect(msg.moduleId).toBe(longId);
      }
    });
  });

  describe('rapid sequential adds', () => {
    it('handles 50 rapid addModuleCard calls', () => {
      for (let i = 0; i < 50; i++) {
        useChatStore.getState().addModuleCard(`mod-${i}`);
      }
      const messages = useChatStore.getState().messages;
      expect(messages).toHaveLength(50);
      expect(new Set(messages.map((m) => m.id)).size).toBe(50);
    });

    it('preserves insertion order', () => {
      useChatStore.getState().addModuleCard('first');
      useChatStore.getState().addModuleCard('second');
      useChatStore.getState().addModuleCard('third');
      const msgs = useChatStore.getState().messages as ChatMessageModuleCard[];
      expect(msgs[0].moduleId).toBe('first');
      expect(msgs[1].moduleId).toBe('second');
      expect(msgs[2].moduleId).toBe('third');
    });
  });

  describe('addModuleCard during active stream', () => {
    it('coexists with active streamingMessage', () => {
      useChatStore.getState().startAgentStream();
      useChatStore.getState().appendStreamDelta('partial');
      useChatStore.getState().addModuleCard('mod-1');

      expect(useChatStore.getState().streamingMessage).toBe('partial');
      expect(useChatStore.getState().messages).toHaveLength(1);
      expect(useChatStore.getState().messages[0].type).toBe('module_card');
    });

    it('module_card persists after stream finalization', () => {
      useChatStore.getState().startAgentStream();
      useChatStore.getState().appendStreamDelta('response');
      useChatStore.getState().addModuleCard('mod-1');
      useChatStore.getState().finalizeAgentMessage();

      const msgs = useChatStore.getState().messages;
      expect(msgs).toHaveLength(2);
      expect(msgs[0].type).toBe('module_card');
      expect(msgs[1].type).toBe('chat');
    });
  });

  describe('interleaved message types', () => {
    it('maintains correct order with mixed chat and module_card', () => {
      useChatStore.getState().addUserMessage('hello');
      useChatStore.getState().addModuleCard('mod-1');
      useChatStore.getState().addUserMessage('nice');
      useChatStore.getState().addModuleCard('mod-2');
      useChatStore.getState().addErrorMessage('oops');

      const msgs = useChatStore.getState().messages;
      expect(msgs.map((m) => m.type)).toEqual([
        'chat', 'module_card', 'chat', 'module_card', 'chat',
      ]);
    });
  });

  describe('type narrowing safety', () => {
    it('chat messages have role and content', () => {
      useChatStore.getState().addUserMessage('test');
      const msg = useChatStore.getState().messages[0];
      if (msg.type === 'chat') {
        expect(msg.role).toBeDefined();
        expect(msg.content).toBeDefined();
      } else {
        fail('Expected chat type');
      }
    });

    it('module_card messages have moduleId but no role/content', () => {
      useChatStore.getState().addModuleCard('mod-1');
      const msg = useChatStore.getState().messages[0];
      if (msg.type === 'module_card') {
        expect(msg.moduleId).toBeDefined();
        expect((msg as any).role).toBeUndefined();
        expect((msg as any).content).toBeUndefined();
      } else {
        fail('Expected module_card type');
      }
    });
  });
});
