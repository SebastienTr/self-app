/**
 * ModuleLink — compact module reference card for inline chat display.
 *
 * Architecture layer: Bridge (reads from moduleStore, navigates via callback).
 * Replaces full ModuleCard rendering inside ChatThread for module_card messages.
 *
 * Renders: [emoji title] [voir ->]
 */

import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { tokens } from '@/constants/tokens';

export interface ModuleLinkProps {
  moduleId: string;
  title: string;
  emoji?: string;
  onPress?: (moduleId: string) => void;
}

export function ModuleLink({ moduleId, title, emoji, onPress }: ModuleLinkProps) {
  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => onPress?.(moduleId)}
      accessibilityRole="link"
      accessibilityLabel={`View module: ${title}`}
      activeOpacity={0.7}
    >
      <View style={styles.titleRow}>
        {emoji ? <Text style={styles.emoji}>{emoji}</Text> : null}
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
      </View>
      <Text style={styles.action}>voir {'\u2192'}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: tokens.colors.surface,
    borderColor: tokens.colors.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    flex: 1,
    marginRight: tokens.spacing.sm,
  },
  emoji: {
    fontSize: 18,
  },
  title: {
    ...tokens.typography.body,
    color: tokens.colors.text,
    flex: 1,
  },
  action: {
    ...tokens.typography.body,
    color: tokens.colors.accent,
  },
});
