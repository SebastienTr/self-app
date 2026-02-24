/**
 * Orb — ambient animated circle communicating agent state.
 *
 * Architecture layer: Shell (reads from stores per architecture doc — exception to
 * pure Shell rule, explicitly documented in architecture).
 * Design tokens: Twilight theme from constants/tokens.ts.
 *
 * States:
 *   idle        — slow 4s pulse cycle
 *   thinking /
 *   discovering /
 *   composing   — fast 1.5s pulse cycle
 *
 * Reduced motion: renders static amber circle if AccessibilityInfo.isReduceMotionEnabled().
 *
 * Note: Using React Native built-in Animated API (react-native-reanimated not yet installed).
 * Migration to react-native-reanimated v4 is deferred until the dependency is added.
 */

import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, View } from 'react-native';

import { tokens } from '@/constants/tokens';
import { useChatStore } from '@/stores/chatStore';
import { useConnectionStore } from '@/stores/connectionStore';

const DEFAULT_SIZE = 60;

export interface OrbProps {
  size?: number;
}

export function Orb({ size = DEFAULT_SIZE }: OrbProps) {
  const agentStatus = useChatStore((s) => s.agentStatus);
  const connectionStatus = useConnectionStore((s) => s.status);
  const [reduceMotion, setReduceMotion] = useState(false);

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);

  // Check for reduced motion preference on mount
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      setReduceMotion(enabled);
    });
  }, []);

  // Animate based on agent status
  useEffect(() => {
    if (reduceMotion) {
      // Stop any running animation and reset to static
      if (animationRef.current) {
        animationRef.current.stop();
        animationRef.current = null;
      }
      scaleAnim.setValue(1);
      return;
    }

    const isActive =
      agentStatus === 'thinking' ||
      agentStatus === 'discovering' ||
      agentStatus === 'composing';

    const halfCycle = isActive
      ? tokens.animation.orbCreating.duration / 2
      : tokens.animation.orbIdle.duration / 2;

    // Stop any running animation
    if (animationRef.current) {
      animationRef.current.stop();
    }

    // Create a ping-pong pulse animation
    animationRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.12,
          duration: halfCycle,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: halfCycle,
          useNativeDriver: true,
        }),
      ]),
    );

    animationRef.current.start();

    return () => {
      if (animationRef.current) {
        animationRef.current.stop();
        animationRef.current = null;
      }
    };
  }, [agentStatus, reduceMotion, scaleAnim]);

  const accessibilityLabel =
    connectionStatus !== 'connected'
      ? `Agent status: idle (${connectionStatus})`
      : agentStatus === 'idle'
        ? 'Agent status: idle'
        : `Agent status: ${agentStatus}`;

  const orbStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: tokens.colors.accent,
  };

  if (reduceMotion) {
    return (
      <View
        style={orbStyle}
        accessibilityLabel={accessibilityLabel}
      />
    );
  }

  return (
    <Animated.View
      style={[orbStyle, { transform: [{ scale: scaleAnim }] }]}
      accessibilityLabel={accessibilityLabel}
    />
  );
}
