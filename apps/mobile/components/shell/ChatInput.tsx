/**
 * ChatInput — text input + send button for chat interface.
 *
 * Architecture layer: Shell (pure component, no store access).
 * Design tokens: Twilight theme from constants/tokens.ts.
 *
 * Props:
 *   onSend        — called with trimmed message text when user sends
 *   disabled      — disables input and send button (e.g., when agent is processing)
 */

import { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tokens } from '@/constants/tokens';
import { useKeyboardVisible } from '@/hooks/useKeyboardVisible';

/**
 * Keyboard avoidance is handled at the App.tsx level with a KeyboardAvoidingView
 * wrapping the entire screen. ChatInput is a pure presentational component.
 */

export interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState('');
  const { keyboardVisible } = useKeyboardVisible();
  const insets = useSafeAreaInsets();

  const canSend = value.trim().length > 0 && !disabled;
  // Tab bar handles safe area bottom — use small fixed margin.
  const bottomMargin = tokens.spacing.sm;

  function handleSend() {
    if (!canSend) return;
    onSend(value.trim());
    setValue('');
  }

  return (
    <View style={[styles.container, { marginBottom: bottomMargin }]}>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={setValue}
        placeholder="Message..."
        placeholderTextColor={tokens.colors.textSecondary}
        editable={!disabled}
        accessibilityLabel="Message input"
        multiline={false}
        returnKeyType="send"
        onSubmitEditing={handleSend}
      />
      <TouchableOpacity
        style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
        onPress={handleSend}
        disabled={!canSend}
        accessibilityLabel="Send message"
        accessibilityState={{ disabled: !canSend }}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={[styles.sendIcon, !canSend && styles.sendIconDisabled]}>
          {'\u25B6'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.surfaceElevated,
    borderColor: tokens.colors.border,
    borderWidth: 1,
    borderRadius: tokens.radii.lg,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    marginHorizontal: tokens.spacing.md,
  },
  input: {
    flex: 1,
    ...tokens.typography.body,
    color: tokens.colors.text,
    minHeight: 44, // NFR33: minimum 44pt touch target
    paddingVertical: 0,
  },
  sendButton: {
    width: 44, // NFR33: minimum 44pt touch target
    height: 44,
    borderRadius: tokens.radii.md,
    backgroundColor: tokens.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: tokens.spacing.sm,
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  sendIcon: {
    color: tokens.colors.background,
    fontSize: 16,
    fontWeight: '700',
  },
  sendIconDisabled: {
    color: tokens.colors.background,
  },
});
