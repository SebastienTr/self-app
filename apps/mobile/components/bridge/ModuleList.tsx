/**
 * ModuleList — renders a scrollable list of ModuleCard components.
 *
 * Subscribes to moduleStore for reactive rendering.
 * Shows empty state when no modules exist.
 * Shows offline indicator when disconnected and showing cached data.
 * Uses FlatList for efficient virtualized list rendering.
 */

import React, { useMemo } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import type { ModuleState } from '@/types/module';
import { useModuleStore } from '@/stores/moduleStore';
import { useConnectionStore } from '@/stores/connectionStore';
import { tokens } from '@/constants/tokens';
import { ModuleCard } from './ModuleCard';

interface ModuleListProps {
  highlightModuleId?: string;
}

export function ModuleList({ highlightModuleId }: ModuleListProps = {}) {
  const modules = useModuleStore((s) => s.modules);
  const allModules = useMemo(() => Array.from(modules.values()), [modules]);
  const status = useConnectionStore((s) => s.status);

  const isOffline = status !== 'connected';
  const hasModules = allModules.length > 0;

  const renderItem = ({ item }: { item: ModuleState }) => (
    <ModuleCard module={item} />
  );

  const keyExtractor = (item: ModuleState) => item.spec.moduleId;

  return (
    <View style={styles.container}>
      {isOffline && hasModules && (
        <Text style={styles.offlineIndicator}>Showing cached data</Text>
      )}

      {!hasModules ? (
        <Text style={styles.emptyState}>No modules yet</Text>
      ) : (
        <FlatList
          data={allModules}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    paddingHorizontal: tokens.spacing.md,
  },
  listContent: {
    paddingBottom: tokens.spacing.xl,
  },
  emptyState: {
    ...tokens.typography.body,
    color: tokens.colors.textSecondary,
    textAlign: 'center',
    marginTop: tokens.spacing.xl,
  },
  offlineIndicator: {
    ...tokens.typography.caption,
    color: tokens.colors.textSecondary,
    textAlign: 'center',
    paddingVertical: tokens.spacing.sm,
  },
});
