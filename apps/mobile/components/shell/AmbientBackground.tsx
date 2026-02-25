/**
 * AmbientBackground — breathing gradient background for the empty state.
 *
 * Story 2.4: Contextual Empty State (AC: #1, #3).
 * Shell component — pure presentational, no store access.
 *
 * Uses overlapping Views with solid background colors and varying opacity
 * to approximate a radial gradient effect. Since expo-linear-gradient is not
 * in the project dependencies, we use plain View layers instead.
 *
 * Breathing animation: opacity oscillates 0.3 to 0.55 over 6s cycle.
 * Reduce Motion: static opacity at 0.42 (midpoint).
 */

import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, View } from 'react-native';

import { tokens } from '@/constants/tokens';

export function AmbientBackground() {
  const [reduceMotion, setReduceMotion] = useState(false);
  const opacityAnim = useRef(new Animated.Value(0.42)).current;
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);

  // Check for reduced motion preference on mount
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      setReduceMotion(enabled);
    });
  }, []);

  // Animate breathing when reduce motion is not enabled
  useEffect(() => {
    if (reduceMotion) {
      if (animationRef.current) {
        animationRef.current.stop();
        animationRef.current = null;
      }
      opacityAnim.setValue(0.42);
      return;
    }

    const halfCycle = tokens.animation.breathe.duration / 2;

    animationRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(opacityAnim, {
          toValue: 0.55,
          duration: halfCycle,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0.3,
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
  }, [reduceMotion, opacityAnim]);

  if (reduceMotion) {
    return (
      <View style={[styles.container, { opacity: 0.42 }]} pointerEvents="none">
        <View style={styles.topLayer} />
        <View style={styles.amberLayer} />
      </View>
    );
  }

  return (
    <Animated.View
      style={[styles.container, { opacity: opacityAnim }]}
      pointerEvents="none"
    >
      <View style={styles.topLayer} />
      <View style={styles.amberLayer} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  topLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: '50%' as any,
    backgroundColor: '#1A2844',
  },
  amberLayer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: '60%' as any,
    height: '40%' as any,
    backgroundColor: 'rgba(232,168,76,0.08)',
  },
});
