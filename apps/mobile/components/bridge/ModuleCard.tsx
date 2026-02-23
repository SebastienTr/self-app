/**
 * ModuleCard — bridge wrapper that delegates rendering to SDUI primitives.
 *
 * Template-aware rendering pipeline:
 *   1. getTemplate(spec.template) → resolves layout + slot definitions
 *   2. LayoutPrimitive wraps content with template-driven layout
 *   3. getPrimitive(spec.type) → resolves the correct SDUI component
 *   4. extractPrimitiveProps scopes fields per primitive type (allowlist)
 *   5. accessibilityLabel from spec.accessibleLabel applied to root View
 *
 * Wrapped in ErrorBoundary per architecture requirement.
 * Touch targets meet minimum size: 44x44pt iOS / 48x48dp Android (NFR33).
 * Render timing is logged for NFR3 compliance (< 100ms target).
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { ModuleState } from '@/types/module';
import { tokens } from '@/constants/tokens';
import { getPrimitive, LayoutPrimitive } from '@/components/sdui';
import { getTemplate } from '@/components/sdui/templates';
import { FreshnessIndicator } from './FreshnessIndicator';
import { ErrorBoundary } from './ErrorBoundary';
import { logger } from '@/services/logger';

export interface ModuleCardProps {
  module: ModuleState;
}

/**
 * Known props for each primitive type (allowlist approach).
 *
 * Only the fields each primitive actually uses are forwarded.
 * This prevents unknown props (schemaVersion, dataSources, etc.) from
 * leaking into primitive components, fixing the LOW review item from 3.1.
 */
const SHARED_PRIMITIVE_PROPS = ['accessibleLabel', 'accessibleRole'] as const;

function extractPrimitiveProps(spec: Record<string, unknown>): Record<string, unknown> {
  const type = spec.type as string | undefined;

  switch (type) {
    case 'text':
      return pickProps(spec, ['text', 'variant', ...SHARED_PRIMITIVE_PROPS]);

    case 'metric':
      return pickProps(spec, ['value', 'label', 'unit', 'trend', ...SHARED_PRIMITIVE_PROPS]);

    case 'layout':
      return pickProps(spec, ['direction', 'columns', 'gap', ...SHARED_PRIMITIVE_PROPS]);

    case 'card':
      return pickProps(spec, ['title', 'children', ...SHARED_PRIMITIVE_PROPS]);

    case 'list':
      return pickProps(spec, ['items', 'title', ...SHARED_PRIMITIVE_PROPS]);

    default:
      // UnknownPrimitive only needs type
      return { type };
  }
}

/** Pick a subset of keys from an object, ignoring missing keys. */
function pickProps(
  source: Record<string, unknown>,
  keys: readonly string[],
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of keys) {
    if (key in source) {
      result[key] = source[key];
    }
  }
  return result;
}

function ModuleCardContent({ module }: ModuleCardProps) {
  // Capture render start time for NFR3 performance measurement
  const renderStartRef = React.useRef<number>(Date.now());

  const spec = module.spec as Record<string, unknown>;
  const moduleName = (spec.name as string) || module.spec.moduleId;
  const primitiveType = (spec.type as string) || '';
  const templateName = (spec.template as string) || 'data-card';
  const accessibleLabel = spec.accessibleLabel as string | undefined;

  // Resolve template definition for layout
  const templateDef = getTemplate(templateName);
  const layoutType = templateDef.layout.type;
  const layoutDirection = templateDef.layout.direction ?? 'vertical';
  const layoutColumns = layoutType === 'grid' ? (templateDef.layout.columns ?? 2) : undefined;

  const PrimitiveComponent = getPrimitive(primitiveType);
  const primitiveProps = extractPrimitiveProps(spec);

  // Log render timing after the component mounts (NFR3: < 100ms target)
  React.useEffect(() => {
    const renderMs = Date.now() - renderStartRef.current;
    if (renderMs > 100) {
      logger.warning('sdui', 'module_rendered', {
        module_id: module.spec.moduleId,
        render_ms: renderMs,
        template: templateName,
        type: primitiveType,
        agent_action: 'Module render exceeded 100ms NFR3 target. Check primitive complexity.',
      });
    } else {
      logger.info('sdui', 'module_rendered', {
        module_id: module.spec.moduleId,
        render_ms: renderMs,
        template: templateName,
        type: primitiveType,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View
      style={styles.card}
      accessibilityLabel={accessibleLabel}
    >
      <Text style={styles.title} numberOfLines={1}>
        {moduleName}
      </Text>
      <LayoutPrimitive
        direction={layoutColumns != null ? 'horizontal' : layoutDirection}
        columns={layoutColumns}
      >
        <PrimitiveComponent {...primitiveProps} type={primitiveType} />
      </LayoutPrimitive>
      <FreshnessIndicator
        updatedAt={module.updatedAt}
        dataStatus={module.dataStatus}
      />
    </View>
  );
}

export function ModuleCard({ module }: ModuleCardProps) {
  return (
    <ErrorBoundary moduleId={module.spec.moduleId}>
      <ModuleCardContent module={module} />
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.colors.surface,
    borderColor: tokens.colors.border,
    borderWidth: 1,
    borderRadius: tokens.radii.lg,
    padding: tokens.spacing.md,
    marginVertical: tokens.spacing.sm,
    minHeight: 48, // NFR33: minimum touch target 48dp Android
  },
  title: {
    ...tokens.typography.subtitle,
    color: tokens.colors.text,
    marginBottom: tokens.spacing.xs,
  },
});
