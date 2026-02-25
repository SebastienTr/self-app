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
import { SvgXml } from 'react-native-svg';

import type { PersonaType } from '@/types/ws';
import { tokens } from '@/constants/tokens';

const PERSONA_SVGS: Record<PersonaType, string> = {
  flame: `<svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="fg" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(60 60) rotate(90) scale(55)"><stop offset="0%" stop-color="#F0C060"/><stop offset="55%" stop-color="#E8A84C"/><stop offset="100%" stop-color="#D4943C"/></radialGradient><radialGradient id="fg2" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(60 95) scale(45 25)"><stop offset="0%" stop-color="#E8A84C" stop-opacity="0.3"/><stop offset="100%" stop-color="#E8A84C" stop-opacity="0"/></radialGradient></defs><ellipse cx="60" cy="95" rx="45" ry="25" fill="url(#fg2)"/><g opacity="0.6"><circle cx="35" cy="45" r="1.5" fill="#E8A84C" fill-opacity="0.3"/><circle cx="85" cy="45" r="1.5" fill="#E8A84C" fill-opacity="0.3"/><circle cx="60" cy="15" r="2" fill="#E8A84C" fill-opacity="0.3"/><path d="M30 70 Q 25 60 32 50" stroke="#E8A84C" stroke-opacity="0.15" stroke-width="2" stroke-linecap="round"/><path d="M90 70 Q 95 60 88 50" stroke="#E8A84C" stroke-opacity="0.15" stroke-width="2" stroke-linecap="round"/></g><path d="M60 20C60 20 85 55 85 78C85 94.5685 73.8071 105 60 105C46.1929 105 35 94.5685 35 78C35 55 60 20 60 20Z" fill="url(#fg)"/><g fill="#0C1420"><circle cx="51" cy="72" r="2.5"/><circle cx="69" cy="72" r="2.5"/><path d="M54 80 Q 60 84 66 80" stroke="#0C1420" stroke-width="2" stroke-linecap="round" fill="none"/></g><circle cx="60" cy="18" r="1" fill="#F0C060" fill-opacity="0.8"/></svg>`,
  tree: `<svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="tg" cx="0.5" cy="0.5" r="0.5"><stop offset="0%" stop-color="#7ABF8E"/><stop offset="100%" stop-color="#5CB8A0"/></radialGradient><radialGradient id="tg2" cx="0.5" cy="0.5" r="0.5"><stop offset="0%" stop-color="#5CB8A0" stop-opacity="0.2"/><stop offset="100%" stop-color="#5CB8A0" stop-opacity="0"/></radialGradient></defs><ellipse cx="60" cy="95" rx="40" ry="15" fill="url(#tg2)"/><path d="M54 92C54 88 56 85 60 85C64 85 66 88 66 92C66 96 64 100 60 100C56 100 54 96 54 92Z" fill="#2A4A3A"/><circle cx="60" cy="60" r="35" fill="url(#tg)"/><circle cx="45" cy="78" r="12" fill="url(#tg)"/><circle cx="75" cy="78" r="12" fill="url(#tg)"/><circle cx="60" cy="82" r="10" fill="url(#tg)"/><g fill="none" stroke="#142A1E" stroke-width="2.5" stroke-linecap="round"><path d="M48 60Q52 64 56 60"/><path d="M64 60Q68 64 72 60"/><path d="M53 70Q60 75 67 70"/></g><g fill="#7ABF8E"><path d="M25 40 C20 35, 20 25, 25 20 C30 25, 30 35, 25 40 Z" opacity="0.6"/><path d="M95 35 C90 30, 90 20, 95 15 C100 20, 100 30, 95 35 Z" opacity="0.8"/><path d="M85 90 C82 86, 82 78, 85 75 C88 78, 88 86, 85 90 Z" opacity="0.4"/></g><path d="M60 15L62 19L66 20L62 21L60 25L58 21L54 20L58 19Z" fill="#E8A84C"/></svg>`,
  star: `<svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="sg" cx="0.5" cy="0.5" r="0.5"><stop offset="0%" stop-color="#E4ECF4"/><stop offset="60%" stop-color="#6B8ECC"/><stop offset="100%" stop-color="#4A6EA0"/></radialGradient><radialGradient id="sg2" cx="0.5" cy="0.5" r="0.5"><stop offset="0%" stop-color="#E4ECF4" stop-opacity="0.6"/><stop offset="100%" stop-color="#E4ECF4" stop-opacity="0"/></radialGradient><radialGradient id="sg3" cx="0.5" cy="0.5" r="0.5"><stop offset="0%" stop-color="#6B8ECC" stop-opacity="0.2"/><stop offset="100%" stop-color="#6B8ECC" stop-opacity="0"/></radialGradient></defs><ellipse cx="60" cy="80" rx="45" ry="20" fill="url(#sg3)"/><path d="M60 20C65 35, 80 45, 100 48C80 55, 65 65, 60 90C55 65, 40 55, 20 48C40 45, 55 35, 60 20Z" fill="url(#sg)" stroke-linejoin="round" stroke-width="15" stroke="url(#sg)"/><circle cx="60" cy="54" r="20" fill="url(#sg2)"/><g fill="#0C1420"><circle cx="52" cy="50" r="2"/><circle cx="68" cy="50" r="2"/><path d="M54 60 Q60 64, 66 60" stroke="#0C1420" stroke-width="2" stroke-linecap="round" fill="none"/></g><g><circle cx="30" cy="30" r="3" fill="#E4ECF4" opacity="0.8"/><circle cx="95" cy="40" r="2" fill="#E4ECF4" opacity="0.6"/><circle cx="85" cy="75" r="2.5" fill="#7899BB" opacity="0.5"/><path d="M25 70 L27 73 L30 74 L27 75 L25 78 L23 75 L20 74 L23 73 Z" fill="#E8A84C" opacity="0.9"/></g></svg>`,
};

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
            <View style={styles.cardContent}>
              <SvgXml xml={PERSONA_SVGS[option.type]} width={56} height={56} />
              <View style={styles.cardText}>
                <Text style={[styles.name, isActive && styles.nameActive]}>
                  {option.name}
                </Text>
                <Text style={styles.description}>{option.description}</Text>
              </View>
            </View>
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
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.md,
  },
  cardText: {
    flex: 1,
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
