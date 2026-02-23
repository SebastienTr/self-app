/**
 * ChatBubble — displays a single chat message (user or agent).
 *
 * Architecture layer: Shell (pure component, no store access).
 * Design tokens: Twilight theme from constants/tokens.ts.
 *
 * Props:
 *   role        — 'user' | 'agent'
 *   content     — message text
 *   isStreaming — show animated streaming indicator (agent only)
 *   isError     — render with error styling (agent only)
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { tokens } from '@/constants/tokens';
import { StreamingIndicator } from './StreamingIndicator';

export interface ChatBubbleProps {
  role: 'user' | 'agent';
  content: string;
  isStreaming?: boolean;
  isError?: boolean;
}

export function ChatBubble({ role, content, isStreaming, isError }: ChatBubbleProps) {
  const isUser = role === 'user';
  const accessibilityLabel = isUser ? `You: ${content}` : `Agent: ${content}`;

  return (
    <View
      style={[
        styles.bubble,
        isUser ? styles.userBubble : styles.agentBubble,
        isError && styles.errorBubble,
      ]}
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel}
    >
      <Text
        style={[
          styles.text,
          isError && styles.errorText,
        ]}
      >
        {content}
      </Text>
      {isStreaming && !isUser && <StreamingIndicator />}
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    maxWidth: '80%',
    borderRadius: tokens.radii.lg,
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.md,
    marginVertical: tokens.spacing.xs,
    flexDirection: 'row',
    alignItems: 'flex-end',
    flexWrap: 'wrap',
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#1A3050', // UX spec: user bubble specific color, NOT in tokens
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  agentBubble: {
    alignSelf: 'flex-start',
    backgroundColor: tokens.colors.surfaceElevated,
  },
  errorBubble: {
    borderWidth: 1,
    borderColor: tokens.colors.error,
  },
  text: {
    ...tokens.typography.body,
    color: tokens.colors.text,
    flexShrink: 1,
  },
  errorText: {
    opacity: 0.85,
  },
});
