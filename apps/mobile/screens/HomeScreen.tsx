/**
 * HomeScreen — Home tab showing module list with empty state and highlight support.
 *
 * Architecture layer: Screen (bridge between navigation and components).
 * - Renders ModuleList (existing bridge component)
 * - Handles highlightModuleId route param for module focus animation
 * - Resets newModulesSinceLastHomeVisit on focus
 * - Shows empty state when no modules exist
 */

import { useCallback, useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

import type { TabParamList } from '@/navigation/TabNavigator';
import { useModuleStore } from '@/stores/moduleStore';
import { ModuleList } from '@/components/bridge';
import { Orb } from '@/components/shell';
import { tokens } from '@/constants/tokens';

type Props = BottomTabScreenProps<TabParamList, 'Home'>;

export function HomeScreen({ navigation, route }: Props) {
  const moduleCount = useModuleStore((s) => s.modules.size);
  const resetBadge = useModuleStore((s) => s.resetNewModuleCount);

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

  const goToChat = useCallback(() => {
    navigation.navigate('Chat');
  }, [navigation]);

  if (moduleCount === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Orb size={64} />
        <Text style={styles.emptyTitle}>No modules yet</Text>
        <TouchableOpacity onPress={goToChat} accessibilityRole="link">
          <Text style={styles.emptyLink}>Ask Self to create one {'\u2192'}</Text>
        </TouchableOpacity>
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
});
