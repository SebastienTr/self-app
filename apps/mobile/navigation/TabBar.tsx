/**
 * CustomTabBar — bottom tab bar with Twilight design tokens + badge system.
 *
 * Architecture layer: Shell (presentational, reads store for badges only).
 * Design: background #0C1420, border 1px #1E2E44, active #E8A84C, inactive #5A7A9A.
 */

import { Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useModuleStore } from '@/stores/moduleStore';
import { useAuthStore } from '@/stores/authStore';
import { tokens } from '@/constants/tokens';

const TAB_ICONS: Record<string, string> = {
  Home: '\uD83D\uDCE6',
  Chat: '\uD83D\uDCAC',
  Settings: '\u2699\uFE0F',
};

const TAB_LABELS: Record<string, string> = {
  Home: 'Home',
  Chat: 'Chat',
  Settings: 'Settings',
};

export function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const newModuleCount = useModuleStore((s) => s.newModulesSinceLastHomeVisit);
  const authStatus = useAuthStore((s) => s.authStatus);
  const showSettingsBadge = authStatus !== 'authenticated';

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, tokens.spacing.xs) }]}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        const icon = TAB_ICONS[route.name] ?? '?';
        const label = TAB_LABELS[route.name] ?? route.name;
        const showBadge =
          (route.name === 'Home' && newModuleCount > 0) ||
          (route.name === 'Settings' && showSettingsBadge);
        const badgeText =
          route.name === 'Home' ? String(newModuleCount) :
          route.name === 'Settings' ? '!' : '';

        return (
          <TouchableOpacity
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
            onPress={onPress}
            style={styles.tab}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <View style={styles.iconContainer}>
              <Text style={styles.icon}>{icon}</Text>
              {showBadge && (
                <View style={[
                  styles.badge,
                  route.name === 'Settings' && styles.badgeError,
                ]}>
                  <Text style={styles.badgeText}>{badgeText}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.label, isFocused && styles.labelActive]}>
              {label}
            </Text>
            {isFocused && <View style={styles.activeIndicator} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: tokens.colors.background,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
    paddingTop: tokens.spacing.sm,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: tokens.spacing.xs,
    minHeight: 48,
  },
  iconContainer: {
    position: 'relative',
  },
  icon: {
    fontSize: 20,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
    backgroundColor: tokens.colors.accent,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeError: {
    backgroundColor: tokens.colors.error,
  },
  badgeText: {
    color: tokens.colors.background,
    fontSize: 10,
    fontWeight: '700',
  },
  label: {
    ...tokens.typography.caption,
    color: '#5A7A9A',
    marginTop: 2,
  },
  labelActive: {
    color: tokens.colors.accent,
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 0,
    width: 20,
    height: 2,
    backgroundColor: tokens.colors.accent,
    borderRadius: 1,
  },
});
