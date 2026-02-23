/**
 * UnknownPrimitive — fallback component for unregistered SDUI types.
 *
 * Rendered when getPrimitive() cannot find a matching component for
 * the requested type. Displays the type name with an "unsupported"
 * message and logs a structured error for agent debugging.
 *
 * Pure component: no state, no side effects beyond the initial error log.
 */

import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { tokens } from '@/constants/tokens';
import { logger } from '@/services/logger';

export interface UnknownPrimitiveProps {
  type: string;
  accessibleLabel?: string;
  accessibleRole?: string;
}

export function UnknownPrimitive({
  type,
  accessibleLabel,
  accessibleRole,
}: UnknownPrimitiveProps) {
  const displayType = type || 'unknown';
  const hasLogged = useRef(false);

  useEffect(() => {
    if (!hasLogged.current) {
      hasLogged.current = true;
      logger.error('sdui', 'unknown_primitive', {
        type: displayType,
        agent_action: `Primitive type '${displayType}' not found in registry. Check components/sdui/registry.ts`,
      });
    }
  }, [displayType]);

  const label =
    accessibleLabel || `Unsupported module type: ${displayType}`;

  return (
    <View
      style={styles.container}
      accessibilityLabel={label}
      accessibilityRole={accessibleRole as any}
    >
      <Text style={styles.message}>Unsupported module type</Text>
      <Text style={styles.typeName}>{displayType}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: tokens.colors.surface,
    borderColor: tokens.colors.error,
    borderWidth: 1,
    borderRadius: tokens.radii.md,
    padding: tokens.spacing.md,
  },
  message: {
    ...tokens.typography.body,
    color: tokens.colors.textSecondary,
    writingDirection: 'auto',
  },
  typeName: {
    ...tokens.typography.caption,
    color: tokens.colors.textSecondary,
    marginTop: tokens.spacing.xs,
    writingDirection: 'auto',
  },
});
