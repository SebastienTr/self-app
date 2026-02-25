/**
 * HomeScreen — Home tab showing module list with contextual empty state.
 *
 * Architecture layer: Screen (bridge between navigation and components).
 * - Renders ModuleList (existing bridge component) when modules exist
 * - Shows contextual empty state when no modules exist:
 *   - AmbientBackground (breathing gradient)
 *   - Orb + "No modules yet" + CTA link
 *   - NudgePrompt (15s inactivity nudge)
 *   - PromptChips (suggestion chips, persona-aware)
 * - Handles highlightModuleId route param for module focus animation
 * - Resets newModulesSinceLastHomeVisit on focus
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

import type { TabParamList } from '@/navigation/TabNavigator';
import { useModuleStore } from '@/stores/moduleStore';
import { useChatStore } from '@/stores/chatStore';
import { useConnectionStore } from '@/stores/connectionStore';
import { ModuleList } from '@/components/bridge';
import { AmbientBackground, NudgePrompt, Orb, PromptChips } from '@/components/shell';
import { send } from '@/services/wsClient';
import { tokens } from '@/constants/tokens';

type Props = BottomTabScreenProps<TabParamList, 'Home'>;

const NUDGE_DELAY_MS = 15_000;

export function HomeScreen({ navigation, route }: Props) {
  const moduleCount = useModuleStore((s) => s.modules.size);
  const resetBadge = useModuleStore((s) => s.resetNewModuleCount);
  const messageCount = useChatStore((s) => s.messages.length);
  const persona = useConnectionStore((s) => s.persona);

  const [showNudge, setShowNudge] = useState(false);
  const nudgeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chipPressedRef = useRef(false);

  // Reset badge when Home tab gains focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      resetBadge();
    });
    return unsubscribe;
  }, [navigation, resetBadge]);

  // Handle highlightModuleId param (for "voir" navigation from ModuleLink)
  const highlightModuleId = route.params?.highlightModuleId;
  useEffect(() => {
    if (highlightModuleId) {
      // Clear param to prevent re-highlight on tab focus
      navigation.setParams({ highlightModuleId: undefined });
    }
  }, [highlightModuleId, navigation]);

  // Nudge timer: show after 15s of inactivity on empty state
  useEffect(() => {
    if (moduleCount > 0 || messageCount > 0) return;

    const startNudgeTimer = () => {
      nudgeTimerRef.current = setTimeout(() => {
        setShowNudge(true);
      }, NUDGE_DELAY_MS);
    };

    startNudgeTimer();

    // Reset on blur, restart on focus
    const unsubBlur = navigation.addListener('blur', () => {
      if (nudgeTimerRef.current) {
        clearTimeout(nudgeTimerRef.current);
        nudgeTimerRef.current = null;
      }
      setShowNudge(false);
    });

    const unsubFocus = navigation.addListener('focus', () => {
      if (messageCount === 0 && moduleCount === 0) {
        setShowNudge(false);
        startNudgeTimer();
      }
    });

    return () => {
      if (nudgeTimerRef.current) {
        clearTimeout(nudgeTimerRef.current);
        nudgeTimerRef.current = null;
      }
      unsubBlur();
      unsubFocus();
    };
  }, [navigation, moduleCount, messageCount]);

  const goToChat = useCallback(() => {
    navigation.navigate('Chat');
  }, [navigation]);

  const handleChipPress = useCallback(
    (chipText: string) => {
      if (chipPressedRef.current) return;
      chipPressedRef.current = true;

      useChatStore.getState().addUserMessage(chipText);
      send({ type: 'chat', payload: { message: chipText } });
      navigation.navigate('Chat');
    },
    [navigation],
  );

  if (moduleCount === 0) {
    const chipsVisible = messageCount === 0 && !chipPressedRef.current;

    return (
      <View style={styles.emptyContainer}>
        <AmbientBackground />
        <View style={styles.emptyContent}>
          <Orb size={64} />
          <Text style={styles.emptyTitle}>No modules yet</Text>
          <TouchableOpacity onPress={goToChat} accessibilityRole="link">
            <Text style={styles.emptyLink}>Ask Self to create one {'\u2192'}</Text>
          </TouchableOpacity>
        </View>
        <NudgePrompt visible={showNudge} />
        <View style={styles.chipsArea}>
          <PromptChips
            onChipPress={handleChipPress}
            persona={persona}
            visible={chipsVisible}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ModuleList highlightModuleId={highlightModuleId} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  emptyContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing.lg,
    gap: tokens.spacing.md,
  },
  emptyTitle: {
    ...tokens.typography.subtitle,
    color: tokens.colors.textSecondary,
  },
  emptyLink: {
    ...tokens.typography.body,
    color: tokens.colors.accent,
  },
  chipsArea: {
    paddingBottom: tokens.spacing.lg,
  },
});
