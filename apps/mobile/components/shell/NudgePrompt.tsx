/**
 * NudgePrompt — gentle prompt encouraging the user to start typing.
 *
 * Story 2.4: Contextual Empty State (AC: #4).
 * Shell component — pure presentational.
 *
 * Displays "Try tapping a suggestion or type anything" with a fade-in animation
 * (400ms) when visible is true. Returns null when visible is false.
 */

import { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';

import { tokens } from '@/constants/tokens';

interface NudgePromptProps {
  visible: boolean;
}

export function NudgePrompt({ visible }: NudgePromptProps) {
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: tokens.animation.fadeIn.duration,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, opacityAnim]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.container, { opacity: opacityAnim }]}>
      <Animated.Text style={styles.text}>
        Try tapping a suggestion or type anything
      </Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.lg,
  },
  text: {
    ...tokens.typography.caption,
    color: tokens.colors.textSecondary,
    textAlign: 'center',
  },
});
