/**
 * ChatScreen — Chat tab with message thread and input.
 *
 * Architecture layer: Screen (bridge between navigation and components).
 * - Renders ChatThread + ChatInput
 * - Shows PromptChips before the first message (contextual empty state)
 * - Handles message sending via chatStore + wsClient
 * - Handles ModuleLink press → navigate to Home tab with highlight
 * - Manual keyboard padding (KAV broken with Android edgeToEdgeEnabled)
 */

import { useCallback, useRef } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { TabParamList } from '@/navigation/TabNavigator';
import { useChatStore } from '@/stores/chatStore';
import { useConnectionStore } from '@/stores/connectionStore';
import { send } from '@/services/wsClient';
import { ChatThread } from '@/components/bridge';
import { ChatInput, PromptChips } from '@/components/shell';
import { tokens } from '@/constants/tokens';
import { useKeyboardVisible } from '@/hooks/useKeyboardVisible';

type Nav = BottomTabNavigationProp<TabParamList, 'Chat'>;

export function ChatScreen() {
  const navigation = useNavigation<Nav>();
  const agentStatus = useChatStore((s) => s.agentStatus);
  const messageCount = useChatStore((s) => s.messages.length);
  const connectionStatus = useConnectionStore((s) => s.status);
  const persona = useConnectionStore((s) => s.persona);
  const isInputDisabled = agentStatus !== 'idle' || connectionStatus !== 'connected';
  const { keyboardHeight } = useKeyboardVisible();
  const insets = useSafeAreaInsets();
  const chipPressedRef = useRef(false);

  function handleSend(message: string) {
    useChatStore.getState().addUserMessage(message);
    send({ type: 'chat', payload: { message } });
  }

  const handleChipPress = useCallback((chipText: string) => {
    if (chipPressedRef.current) return;
    chipPressedRef.current = true;
    handleSend(chipText);
  }, []);

  const handleModuleLinkPress = useCallback((moduleId: string) => {
    navigation.navigate('Home', { highlightModuleId: moduleId });
  }, [navigation]);

  const showChips = messageCount === 0 && !chipPressedRef.current;

  const chatContent = (
    <>
      <ChatThread onModuleLinkPress={handleModuleLinkPress} />
      {showChips && (
        <View style={styles.chipsArea}>
          <PromptChips onChipPress={handleChipPress} persona={persona} visible />
        </View>
      )}
      <ChatInput onSend={handleSend} disabled={isInputDisabled} />
    </>
  );

  // iOS: KAV with padding behavior works fine.
  // Android: edgeToEdgeEnabled breaks adjustResize — use manual paddingBottom.
  // Subtract insets.bottom because keyboardHeight includes the nav bar area.
  if (Platform.OS === 'ios') {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior="padding"
        keyboardVerticalOffset={100}
      >
        {chatContent}
      </KeyboardAvoidingView>
    );
  }

  const androidPadding = keyboardHeight > 0
    ? Math.max(0, keyboardHeight - insets.bottom)
    : 0;

  return (
    <View style={[styles.container, { paddingBottom: androidPadding }]}>
      {chatContent}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  chipsArea: {
    paddingBottom: tokens.spacing.sm,
  },
});
