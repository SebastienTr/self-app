/**
 * LayoutPrimitive — stack/grid container SDUI primitive.
 *
 * Renders children in a vertical stack (default), horizontal row,
 * or grid layout when columns are specified.
 *
 * Pure component: props in, JSX out — no state, no side effects.
 */

import React from 'react';
import { StyleSheet, View, type DimensionValue, type ViewStyle } from 'react-native';

import { tokens } from '@/constants/tokens';

export type LayoutDirection = 'vertical' | 'horizontal';

export interface LayoutPrimitiveProps {
  direction?: LayoutDirection;
  columns?: number;
  gap?: number;
  children?: React.ReactNode;
  accessibleLabel?: string;
  accessibleRole?: string;
  testID?: string;
}

export function LayoutPrimitive({
  direction = 'vertical',
  columns,
  gap,
  children,
  accessibleLabel,
  accessibleRole,
  testID,
}: LayoutPrimitiveProps) {
  const isGrid = columns != null && columns > 0;
  const resolvedGap = gap ?? tokens.spacing.md;

  const layoutStyle: ViewStyle = {
    flexDirection: isGrid ? 'row' : direction === 'horizontal' ? 'row' : 'column',
    gap: resolvedGap,
    ...(isGrid ? { flexWrap: 'wrap' } : {}),
  };

  const columnWidth: DimensionValue | undefined = isGrid
    ? (`${100 / columns!}%` as DimensionValue)
    : undefined;

  const renderedChildren = isGrid
    ? React.Children.map(children, (child) => (
        <View style={{ width: columnWidth }}>
          {child}
        </View>
      ))
    : children;

  return (
    <View
      style={[styles.container, layoutStyle]}
      accessibilityLabel={accessibleLabel}
      accessibilityRole={accessibleRole as any}
      testID={testID}
    >
      {renderedChildren}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    // Minimal base — layout properties applied dynamically
  },
});
