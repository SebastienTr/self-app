/**
 * ChatScreen — Chat tab with message thread and input.
 *
 * Architecture layer: Screen (bridge between navigation and components).
 * - Renders ChatThread + ChatInput
 * - Handles message sending via chatStore + wsClient
 * - Handles ModuleLink press → navigate to Home tab with highlight
 * - Manual keyboard padding (KAV broken with Android edgeToEdgeEnabled)
 */

import { useCallback } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { TabParamList } from '@/navigation/TabNavigator';
import { useChatStore } from '@/stores/chatStore';
import { useConnectionStore } from '@/stores/connectionStore';
import { send } from '@/services/wsClient';
import { ChatThread } from '@/components/bridge';
import { ChatInput } from '@/components/shell';
import { tokens } from '@/constants/tokens';
import { useKeyboardVisible } from '@/hooks/useKeyboardVisible';

type Nav = BottomTabNavigationProp<TabParamList, 'Chat'>;

export function ChatScreen() {
  const navigation = useNavigation<Nav>();
  const agentStatus = useChatStore((s) => s.agentStatus);
  const connectionStatus = useConnectionStore((s) => s.status);
  const isInputDisabled = agentStatus !== 'idle' || connectionStatus !== 'connected';
  const { keyboardHeight } = useKeyboardVisible();
  const insets = useSafeAreaInsets();

  function handleSend(message: string) {
    useChatStore.getState().addUserMessage(message);
    send({ type: 'chat', payload: { message } });
  }

  const handleModuleLinkPress = useCallback((moduleId: string) => {
    navigation.navigate('Home', { highlightModuleId: moduleId });
  }, [navigation]);

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
        <ChatThread onModuleLinkPress={handleModuleLinkPress} />
        <ChatInput onSend={handleSend} disabled={isInputDisabled} />
      </KeyboardAvoidingView>
    );
  }

  const androidPadding = keyboardHeight > 0
    ? Math.max(0, keyboardHeight - insets.bottom)
    : 0;

  return (
    <View style={[styles.container, { paddingBottom: androidPadding }]}>
      <ChatThread onModuleLinkPress={handleModuleLinkPress} />
      <ChatInput onSend={handleSend} disabled={isInputDisabled} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
});
