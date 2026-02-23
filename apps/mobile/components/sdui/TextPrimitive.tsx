/**
 * TextPrimitive — text display SDUI primitive.
 *
 * Renders text content with variant-based typography styling.
 * Supports RTL text via writingDirection: 'auto' and
 * Dynamic Type via default allowFontScaling.
 *
 * Pure component: props in, JSX out — no state, no side effects.
 */

import React from 'react';
import { StyleSheet, Text } from 'react-native';

import { tokens } from '@/constants/tokens';

export type TextVariant = 'title' | 'subtitle' | 'body' | 'caption';

export interface TextPrimitiveProps {
  text: string;
  variant?: TextVariant;
  accessibleLabel?: string;
  accessibleRole?: string;
}

const VALID_VARIANTS: ReadonlySet<string> = new Set([
  'title',
  'subtitle',
  'body',
  'caption',
]);

export function TextPrimitive({
  text,
  variant,
  accessibleLabel,
  accessibleRole,
}: TextPrimitiveProps) {
  const resolvedVariant =
    variant && VALID_VARIANTS.has(variant) ? variant : 'body';
  const displayText = text ?? '';

  const colorStyle =
    resolvedVariant === 'caption'
      ? { color: tokens.colors.textSecondary }
      : { color: tokens.colors.text };

  const typographyStyle = tokens.typography[resolvedVariant];

  return (
    <Text
      style={[styles.base, typographyStyle, colorStyle]}
      accessibilityLabel={accessibleLabel || displayText || undefined}
      accessibilityRole={accessibleRole as any}
    >
      {displayText}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: {
    writingDirection: 'auto',
  },
});
