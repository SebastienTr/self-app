/**
 * SDUI Primitive Registry — maps type identifiers to native components.
 *
 * Usage:
 *   const Component = getPrimitive(spec.type);
 *   <Component {...props} />
 *
 * To add a new primitive:
 *   1. Create the component file in components/sdui/
 *   2. Add one entry to primitiveRegistry below
 *   No other file changes needed.
 */

import type React from 'react';

import { TextPrimitive } from './TextPrimitive';
import { MetricPrimitive } from './MetricPrimitive';
import { LayoutPrimitive } from './LayoutPrimitive';
import { CardPrimitive } from './CardPrimitive';
import { ListPrimitive } from './ListPrimitive';
import { UnknownPrimitive } from './UnknownPrimitive';

/**
 * Base props shared by all SDUI primitives.
 * Every concrete primitive extends this with its own specific props.
 */
export interface PrimitiveProps {
  accessibleLabel?: string;
  accessibleRole?: string;
}

/**
 * Registry mapping type identifiers to their React Native components.
 *
 * `status` and `table` are registered as stubs (UnknownPrimitive)
 * pending implementation in future stories.
 */
const primitiveRegistry = new Map<string, React.ComponentType<any>>([
  ['text', TextPrimitive],
  ['metric', MetricPrimitive],
  ['layout', LayoutPrimitive],
  ['card', CardPrimitive],
  ['list', ListPrimitive],
  ['status', UnknownPrimitive],
  ['table', UnknownPrimitive],
]);

/**
 * Look up the native component for a given primitive type.
 * Returns UnknownPrimitive if the type is not registered.
 *
 * Uses Map to avoid Object.prototype key collisions
 * (e.g., 'toString', 'constructor' won't resolve to inherited methods).
 */
export function getPrimitive(type: string): React.ComponentType<any> {
  return primitiveRegistry.get(type) ?? UnknownPrimitive;
}
