/**
 * ListPrimitive -- composite SDUI primitive for list display.
 *
 * Renders a scrollable list of structured items with title,
 * subtitle, and trailing value. Items are flat data (not nested
 * primitives). Meets NFR33 touch target minimum of 48dp.
 *
 * Pure component: props in, JSX out -- no state, no side effects.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { tokens } from '@/constants/tokens';

/** Shape of a single list item. */
export interface ListItem {
  id?: string;
  title?: string;
  subtitle?: string;
  trailing?: string;
}

export interface ListPrimitiveProps {
  items: ListItem[];
  title?: string;
  accessibleLabel?: string;
  accessibleRole?: string;
}

export function ListPrimitive({
  items,
  title,
  accessibleLabel,
  accessibleRole,
}: ListPrimitiveProps) {
  const safeItems = Array.isArray(items) ? items : [];

  const generatedLabel = title
    ? `${title}, ${safeItems.length} ${safeItems.length === 1 ? 'item' : 'items'}`
    : undefined;
  const label = accessibleLabel || generatedLabel || undefined;

  return (
    <View
      style={styles.container}
      accessibilityLabel={label}
      accessibilityRole={accessibleRole as any}
    >
      {title != null && title !== '' ? (
        <Text style={styles.listTitle}>{title}</Text>
      ) : null}
      {safeItems.length === 0 ? (
        <Text style={styles.emptyState}>No items</Text>
      ) : (
        safeItems.map((item, index) => {
          const itemTitle = item?.title ?? '';
          const itemLabel = itemTitle || `Item ${index + 1}`;

          return (
            <React.Fragment key={item?.id ?? String(index)}>
              <View
                style={styles.item}
                testID={`list-item-${index}`}
                accessibilityLabel={itemLabel}
              >
                <View style={styles.itemContent}>
                  {itemTitle ? (
                    <Text style={styles.itemTitle}>{itemTitle}</Text>
                  ) : null}
                  {item?.subtitle ? (
                    <Text style={styles.itemSubtitle}>{item.subtitle}</Text>
                  ) : null}
                </View>
                {item?.trailing ? (
                  <Text style={styles.itemTrailing}>{item.trailing}</Text>
                ) : null}
              </View>
              {index < safeItems.length - 1 ? (
                <View style={styles.separator} testID="list-separator" />
              ) : null}
            </React.Fragment>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    // Minimal base -- inherits from parent container
  },
  listTitle: {
    ...tokens.typography.subtitle,
    color: tokens.colors.text,
    writingDirection: 'auto',
    marginBottom: tokens.spacing.sm,
  },
  emptyState: {
    ...tokens.typography.body,
    color: tokens.colors.textSecondary,
    writingDirection: 'auto',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingVertical: tokens.spacing.sm,
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    ...tokens.typography.body,
    color: tokens.colors.text,
    writingDirection: 'auto',
  },
  itemSubtitle: {
    ...tokens.typography.caption,
    color: tokens.colors.textSecondary,
    writingDirection: 'auto',
    marginTop: tokens.spacing.xs,
  },
  itemTrailing: {
    ...tokens.typography.body,
    color: tokens.colors.text,
    writingDirection: 'auto',
    marginLeft: tokens.spacing.sm,
  },
  separator: {
    height: 1,
    backgroundColor: tokens.colors.border,
  },
});
