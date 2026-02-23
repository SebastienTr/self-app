/**
 * CardPrimitive -- composite SDUI primitive for card containers.
 *
 * Composes inner primitives (Text, Metric, etc.) within a styled card.
 * Uses getPrimitive() to dynamically resolve child components,
 * falling back to UnknownPrimitive for unrecognized types.
 *
 * Pure component: props in, JSX out -- no state, no side effects.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { tokens } from '@/constants/tokens';
import { getPrimitive } from './registry';

/** Shape of a child primitive within a card spec. */
export interface PrimitiveChild {
  type: string;
  [key: string]: unknown;
}

export interface CardPrimitiveProps {
  title?: string;
  children?: PrimitiveChild[];
  accessibleLabel?: string;
  accessibleRole?: string;
}

export function CardPrimitive({
  title,
  children,
  accessibleLabel,
  accessibleRole,
}: CardPrimitiveProps) {
  const label = accessibleLabel || title || undefined;
  const safeChildren = Array.isArray(children) ? children : [];

  return (
    <View
      style={styles.container}
      accessibilityLabel={label}
      accessibilityRole={accessibleRole as any}
    >
      {title != null && title !== '' ? (
        <Text
          style={styles.title}
          testID="card-title"
        >
          {title}
        </Text>
      ) : null}
      {safeChildren.map((child, index) => {
        const childType = child?.type ?? '';
        const Component = getPrimitive(childType);
        return <Component key={index} {...child} />;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: tokens.colors.surface,
    borderColor: tokens.colors.border,
    borderWidth: 1,
    borderRadius: tokens.radii.lg,
    padding: tokens.spacing.md,
    overflow: 'hidden',
  },
  title: {
    ...tokens.typography.subtitle,
    color: tokens.colors.text,
    writingDirection: 'auto',
    marginBottom: tokens.spacing.sm,
  },
});
