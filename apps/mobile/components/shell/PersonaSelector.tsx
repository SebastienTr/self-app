/**
 * PersonaSelector — three tappable persona cards (Flame / Tree / Star).
 *
 * Story 2.3: Persona Preset Selection (AC: #8).
 * Shell component — pure presentational, receives props from SettingsScreen bridge.
 *
 * Props:
 *   currentPersona — the active persona ('flame' | 'tree' | 'star' | null)
 *   onSelect       — callback when user taps a persona card
 */

import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { PersonaType } from '@/types/ws';
import { tokens } from '@/constants/tokens';

interface PersonaOption {
  type: PersonaType;
  name: string;
  description: string;
}

const PERSONA_OPTIONS: PersonaOption[] = [
  { type: 'flame', name: 'Flame', description: 'Autonomous, concise, acts first' },
  { type: 'tree', name: 'Tree', description: 'Collaborative, warm, always asks' },
  { type: 'star', name: 'Star', description: 'Balanced, adaptive autonomy' },
];

interface PersonaSelectorProps {
  currentPersona: PersonaType | null;
  onSelect: (persona: PersonaType) => void;
}

export function PersonaSelector({ currentPersona, onSelect }: PersonaSelectorProps) {
  return (
    <View style={styles.container}>
      {PERSONA_OPTIONS.map((option) => {
        const isActive = currentPersona === option.type;
        return (
          <TouchableOpacity
            key={option.type}
            style={[styles.card, isActive && styles.cardActive]}
            onPress={() => onSelect(option.type)}
            accessibilityLabel={`Select ${option.name} persona`}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
          >
            <Text style={[styles.name, isActive && styles.nameActive]}>
              {option.name}
            </Text>
            <Text style={styles.description}>{option.description}</Text>
          </TouchableOpacity>
        );
      })}
      {currentPersona === null && (
        <Text style={styles.hint}>No persona selected</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: tokens.spacing.sm,
  },
  card: {
    backgroundColor: tokens.colors.surface,
    borderColor: tokens.colors.border,
    borderWidth: 1,
    borderRadius: tokens.radii.lg,
    padding: tokens.spacing.md,
  },
  cardActive: {
    borderColor: tokens.colors.accent,
    borderWidth: 2,
  },
  name: {
    ...tokens.typography.subtitle,
    color: tokens.colors.text,
    marginBottom: tokens.spacing.xs,
  },
  nameActive: {
    color: tokens.colors.accent,
  },
  description: {
    ...tokens.typography.caption,
    color: tokens.colors.textSecondary,
  },
  hint: {
    ...tokens.typography.caption,
    color: tokens.colors.textSecondary,
    textAlign: 'center',
    marginTop: tokens.spacing.xs,
  },
});
