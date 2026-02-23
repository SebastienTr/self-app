/**
 * FreshnessIndicator — displays data age relative to updatedAt.
 *
 * Freshness thresholds (from architecture):
 *   - < 1 hour:         No indicator (implicitly fresh)
 *   - 1h - 24h:         Caption "Updated Xh ago" in textSecondary
 *   - > 24h:            Warning badge "Stale" in warning color
 *   - dataStatus error: Badge "Offline" in textSecondary
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { DataStatus } from '@/types/module';
import { tokens } from '@/constants/tokens';

export interface FreshnessIndicatorProps {
  updatedAt: string;
  dataStatus: DataStatus;
}

function getHoursAgo(updatedAt: string): number {
  const updated = new Date(updatedAt).getTime();
  const now = Date.now();
  return Math.floor((now - updated) / (1000 * 60 * 60));
}

export function FreshnessIndicator({ updatedAt, dataStatus }: FreshnessIndicatorProps) {
  // Offline state takes priority
  if (dataStatus === 'error') {
    return (
      <View
        style={styles.badgeContainer}
        accessibilityLabel="Offline — showing last known data"
      >
        <Text style={[styles.badge, styles.offlineBadge]}>Offline</Text>
      </View>
    );
  }

  const hoursAgo = getHoursAgo(updatedAt);

  // < 1 hour: no indicator
  if (hoursAgo < 1) {
    return null;
  }

  // > 24h: stale badge
  if (hoursAgo >= 24) {
    return (
      <View
        style={styles.badgeContainer}
        accessibilityLabel={`Data last updated ${hoursAgo} hours ago`}
      >
        <Text style={[styles.badge, styles.staleBadge]}>Stale</Text>
      </View>
    );
  }

  // 1h - 24h: caption
  return (
    <Text
      style={styles.caption}
      accessibilityLabel={`Data last updated ${hoursAgo} hours ago`}
    >
      Updated {hoursAgo}h ago
    </Text>
  );
}

const styles = StyleSheet.create({
  caption: {
    ...tokens.typography.caption,
    color: tokens.colors.textSecondary,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    ...tokens.typography.caption,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: 2,
    borderRadius: tokens.radii.sm,
    overflow: 'hidden',
  },
  staleBadge: {
    backgroundColor: tokens.colors.warning,
    color: tokens.colors.background,
  },
  offlineBadge: {
    backgroundColor: tokens.colors.textSecondary,
    color: tokens.colors.background,
  },
});
