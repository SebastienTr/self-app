/**
 * PromptChips — suggestion chips for the contextual empty state.
 *
 * Story 2.4: Contextual Empty State (AC: #2, #5, #6, #7, #8).
 * Shell component — pure presentational, receives all data via props.
 *
 * Renders 3 universal chips plus an optional persona-specific chip (dashed border).
 * Fades out with 300ms animation when `visible` transitions to false.
 */

import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, TouchableOpacity, Text, View } from 'react-native';

import type { PersonaType } from '@/types/ws';
import { tokens } from '@/constants/tokens';

const UNIVERSAL_CHIPS = [
  "What's the weather like?",
  'Track something for me',
  'Help me organize my week',
];

const PERSONA_CHIPS: Record<PersonaType, string> = {
  flame: 'Automate something',
  tree: "Let's chat first",
  star: 'Surprise me',
};

interface PromptChipsProps {
  onChipPress: (text: string) => void;
  persona: PersonaType | null;
  visible: boolean;
}

export function PromptChips({ onChipPress, persona, visible }: PromptChipsProps) {
  const opacityAnim = useRef(new Animated.Value(visible ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(opacityAnim, {
      toValue: visible ? 1 : 0,
      duration: tokens.animation.chipDismiss.duration,
      useNativeDriver: true,
    }).start();
  }, [visible, opacityAnim]);

  const personaChipText = persona ? PERSONA_CHIPS[persona] : null;

  return (
    <Animated.View style={[styles.container, { opacity: opacityAnim }]}>
      {UNIVERSAL_CHIPS.map((text) => (
        <TouchableOpacity
          key={text}
          style={styles.chip}
          onPress={() => onChipPress(text)}
          accessibilityLabel={text}
          accessibilityRole="button"
        >
          <Text style={styles.chipText}>{text}</Text>
        </TouchableOpacity>
      ))}
      {personaChipText && (
        <TouchableOpacity
          style={[styles.chip, styles.personaChip]}
          onPress={() => onChipPress(personaChipText)}
          accessibilityLabel={personaChipText}
          accessibilityRole="button"
        >
          <Text style={styles.chipText}>{personaChipText}</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 14,
  },
  chip: {
    backgroundColor: tokens.colors.accentSubtle,
    borderColor: tokens.colors.accent,
    borderWidth: 1,
    borderRadius: tokens.radii.lg,
    paddingVertical: 7,
    paddingHorizontal: 14,
    minHeight: 44,
    justifyContent: 'center',
  },
  personaChip: {
    borderStyle: 'dashed' as const,
  },
  chipText: {
    ...tokens.typography.body,
    color: tokens.colors.accent,
  },
});
