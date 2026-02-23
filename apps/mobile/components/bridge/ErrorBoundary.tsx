/**
 * ErrorBoundary — catches render errors in module components.
 *
 * Per architecture: every module renders inside an ErrorBoundary.
 * On render error: shows fallback card with diagnostic info.
 * React class component is required for error boundaries.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { tokens } from '@/constants/tokens';
import { logger } from '@/services/logger';

interface Props {
  moduleId: string;
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    logger.error('bridge', 'module_render_error', {
      module_id: this.props.moduleId,
      error: error.message,
      component_stack: errorInfo.componentStack || '',
      agent_action: 'Module render failed — showing fallback card. Check module spec for issues.',
    });
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <View style={styles.fallback}>
          <Text style={styles.fallbackTitle}>Module Error</Text>
          <Text style={styles.fallbackMessage}>
            {this.state.error?.message || 'Unknown error'}
          </Text>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: tokens.colors.surface,
    borderColor: tokens.colors.error,
    borderWidth: 1,
    borderRadius: tokens.radii.lg,
    padding: tokens.spacing.md,
    marginVertical: tokens.spacing.sm,
  },
  fallbackTitle: {
    ...tokens.typography.subtitle,
    color: tokens.colors.error,
    marginBottom: tokens.spacing.xs,
  },
  fallbackMessage: {
    ...tokens.typography.caption,
    color: tokens.colors.textSecondary,
  },
});
