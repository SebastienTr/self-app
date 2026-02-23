/**
 * MetricPrimitive — metric display SDUI primitive.
 *
 * Renders a value with optional label, unit, and trend indicator.
 * Trend indicators: up (green arrow), down (red arrow), flat (dash).
 *
 * Pure component: props in, JSX out — no state, no side effects.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { tokens } from '@/constants/tokens';

export type TrendDirection = 'up' | 'down' | 'flat';

export interface MetricPrimitiveProps {
  value: string | number;
  label: string;
  unit?: string;
  trend?: TrendDirection;
  accessibleLabel?: string;
  accessibleRole?: string;
}

const TREND_CONFIG: Record<
  TrendDirection,
  { symbol: string; color: string }
> = {
  up: { symbol: '▲', color: tokens.colors.success },
  down: { symbol: '▼', color: tokens.colors.error },
  flat: { symbol: '—', color: tokens.colors.textSecondary },
};

export function MetricPrimitive({
  value,
  label,
  unit,
  trend,
  accessibleLabel,
  accessibleRole,
}: MetricPrimitiveProps) {
  const displayValue = value != null ? String(value) : '';
  const displayLabel = label ?? '';
  const displayUnit = unit ?? '';

  const generatedLabel = displayUnit
    ? `${displayLabel}: ${displayValue} ${displayUnit}`
    : `${displayLabel}: ${displayValue}`;

  const trendConfig = trend ? TREND_CONFIG[trend] : null;

  return (
    <View
      style={styles.container}
      accessibilityLabel={accessibleLabel || generatedLabel}
      accessibilityRole={accessibleRole as any}
    >
      <View style={styles.valueRow}>
        <Text style={[styles.value, tokens.typography.metric]}>
          {displayValue}
        </Text>
        {displayUnit ? (
          <Text style={[styles.unit, tokens.typography.metricUnit]}>
            {displayUnit}
          </Text>
        ) : null}
        {trendConfig ? (
          <Text style={[styles.trend, { color: trendConfig.color }]}>
            {trendConfig.symbol}
          </Text>
        ) : null}
      </View>
      <Text style={[styles.label, tokens.typography.caption]}>
        {displayLabel}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    // No explicit background — inherits from card container
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  value: {
    color: tokens.colors.text,
    writingDirection: 'auto',
  },
  unit: {
    color: tokens.colors.textSecondary,
    marginLeft: tokens.spacing.xs,
    writingDirection: 'auto',
  },
  trend: {
    marginLeft: tokens.spacing.sm,
    fontSize: tokens.typography.caption.fontSize,
    writingDirection: 'auto',
  },
  label: {
    color: tokens.colors.textSecondary,
    marginTop: tokens.spacing.xs,
    writingDirection: 'auto',
  },
});
