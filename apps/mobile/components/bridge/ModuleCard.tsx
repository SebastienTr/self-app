/**
 * ModuleCard — minimal card placeholder for cached module display.
 *
 * This is a PLACEHOLDER — full SDUI rendering comes in Epic 3.
 * Shows module name + FreshnessIndicator only.
 * Wrapped in ErrorBoundary per architecture requirement.
 *
 * Touch targets meet minimum size: 44x44pt iOS / 48x48dp Android (NFR33).
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { ModuleState } from '@/types/module';
import { tokens } from '@/constants/tokens';
import { FreshnessIndicator } from './FreshnessIndicator';
import { ErrorBoundary } from './ErrorBoundary';

export interface ModuleCardProps {
  module: ModuleState;
}

function ModuleCardContent({ module }: ModuleCardProps) {
  const moduleName = (module.spec as Record<string, unknown>).name as string
    || module.spec.moduleId;

  return (
    <View style={styles.card}>
      <Text style={styles.title} numberOfLines={1}>
        {moduleName}
      </Text>
      <FreshnessIndicator
        updatedAt={module.updatedAt}
        dataStatus={module.dataStatus}
      />
    </View>
  );
}

export function ModuleCard({ module }: ModuleCardProps) {
  return (
    <ErrorBoundary moduleId={module.spec.moduleId}>
      <ModuleCardContent module={module} />
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.colors.surface,
    borderColor: tokens.colors.border,
    borderWidth: 1,
    borderRadius: tokens.radii.lg,
    padding: tokens.spacing.md,
    marginVertical: tokens.spacing.sm,
    minHeight: 48, // NFR33: minimum touch target 48dp Android
  },
  title: {
    ...tokens.typography.subtitle,
    color: tokens.colors.text,
    marginBottom: tokens.spacing.xs,
  },
});
