/**
 * Twilight design tokens — the single source of truth for visual styling.
 *
 * All UI components MUST reference these tokens instead of hardcoding values.
 * Matches the architecture spec exactly (V1 Twilight theme).
 */

export const tokens = {
  colors: {
    background: '#0C1420',
    surface: '#101C2C',
    surfaceElevated: '#162436',
    border: '#1E2E44',
    text: '#E4ECF4',
    textSecondary: '#7899BB',
    accent: '#E8A84C',
    accentSubtle: '#12203A',
    success: '#5CB8A0',
    warning: '#E8C84C',
    error: '#CC5F5F',
    info: '#6B8ECC',
    agentGlow: 'rgba(232, 168, 76, 0.15)',
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  typography: {
    title: { fontSize: 22, fontWeight: '700' as const },
    subtitle: { fontSize: 17, fontWeight: '600' as const },
    body: { fontSize: 15, fontWeight: '400' as const },
    caption: { fontSize: 13, fontWeight: '400' as const },
    metric: { fontSize: 28, fontWeight: '700' as const },
    metricUnit: { fontSize: 15, fontWeight: '400' as const },
  },
  radii: { sm: 4, md: 8, lg: 16 },
  shadows: {
    card: { shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
    elevated: { shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  },
  animation: {
    orbIdle: { duration: 4000 },
    orbCreating: { duration: 1500 },
    breathe: { duration: 6000 },
    fadeIn: { duration: 400 },
    shimmer: { duration: 2000 },
    chipDismiss: { duration: 300 },
  },
} as const;
