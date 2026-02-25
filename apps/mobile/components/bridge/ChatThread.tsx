/**
 * ChatThread — scrollable list of chat messages.
 *
 * Architecture layer: Bridge (reads from chatStore, delegates rendering to Shell).
 * Owns lifecycle logic: reads store, renders ChatBubble primitives.
 *
 * Renders:
 *   - All finalized messages from chatStore.messages
 *   - A streaming ChatBubble if chatStore.streamingMessage !== null
 *   - Inline ModuleCard for module_card messages (story 2-5)
 *
 * Auto-scrolls to bottom on new messages or streaming deltas.
 */

import { useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useChatStore } from '@/stores/chatStore';
import { useModuleStore } from '@/stores/moduleStore';
import type { ChatMessage } from '@/stores/chatStore';
import { ChatBubble } from '@/components/shell/ChatBubble';
import { ModuleLink } from '@/components/bridge/ModuleLink';
import { tokens } from '@/constants/tokens';

interface ChatThreadProps {
  onModuleLinkPress?: (moduleId: string) => void;
}

function renderMessage(msg: ChatMessage, onModuleLinkPress?: (moduleId: string) => void) {
  if (msg.type === 'module_card') {
    const module = useModuleStore.getState().modules.get(msg.moduleId);
    if (!module) return null;
    return (
      <View key={msg.id} style={styles.inlineModuleCard}>
        <ModuleLink
          moduleId={msg.moduleId}
          title={(module.spec.title as string) ?? module.spec.moduleId}
          emoji={module.spec.emoji as string | undefined}
          onPress={onModuleLinkPress}
        />
      </View>
    );
  }

  // type === 'chat'
  return (
    <ChatBubble
      key={msg.id}
      role={msg.role}
      content={msg.content}
      isError={msg.isError}
    />
  );
}

export function ChatThread({ onModuleLinkPress }: ChatThreadProps = {}) {
  const messages = useChatStore((s) => s.messages);
  const streamingMessage = useChatStore((s) => s.streamingMessage);
  const agentStatus = useChatStore((s) => s.agentStatus);

  const scrollRef = useRef<ScrollView>(null);

  // Auto-scroll to bottom whenever messages or streamingMessage changes
  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages, streamingMessage]);

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.scrollView}
      contentContainerStyle={styles.contentContainer}
      accessibilityLabel="Conversation thread"
      onContentSizeChange={() => {
        scrollRef.current?.scrollToEnd({ animated: false });
      }}
    >
      <View>
        {messages.map((msg: ChatMessage) => renderMessage(msg, onModuleLinkPress))}
        {streamingMessage !== null && (
          <ChatBubble
            role="agent"
            content={streamingMessage}
            isStreaming={agentStatus === 'streaming'}
          />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    width: '100%',
  },
  contentContainer: {
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.md,
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  inlineModuleCard: {
    marginHorizontal: 0,
    marginVertical: tokens.spacing.xs,
  },
});
