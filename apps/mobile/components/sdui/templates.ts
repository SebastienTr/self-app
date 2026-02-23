/**
 * Composition Template Registry — maps template names to layout + slot definitions.
 *
 * Templates describe how a module's layout is structured (grid/stack)
 * and which primitives fill each slot.
 *
 * First Light ships with 3 templates:
 *   - metric-dashboard: 2-column grid with metrics and optional chart
 *   - data-card: vertical stack with header text and content
 *   - simple-list: vertical stack with a single list primitive
 *
 * To add a new template: add one entry to templateRegistry below.
 * No other changes needed — same pattern as primitive registry.
 *
 * Uses Map to avoid Object.prototype key collisions.
 */

/**
 * Defines a slot within a template.
 *
 * Each slot specifies a role (e.g., 'header', 'content'), which primitive(s) can
 * fill it, and optional cardinality (min/max) and optional constraints.
 */
export interface TemplateSlot {
  role: string;
  /** Single primitive type or array of accepted types */
  primitive: string | string[];
  min?: number;
  max?: number;
  optional?: boolean;
  /** Variant hint for primitives that support it (e.g., 'title' for TextPrimitive) */
  variant?: string;
}

/**
 * Defines a template's layout configuration.
 */
export interface TemplateLayout {
  type: 'stack' | 'grid';
  direction?: 'vertical' | 'horizontal';
  columns?: number;
}

/**
 * Full template definition: layout + slots.
 */
export interface TemplateDefinition {
  layout: TemplateLayout;
  slots: TemplateSlot[];
}

/**
 * Registry mapping template names to their definitions.
 *
 * First Light: 3 templates. MVP will add map-with-details, timeline-view,
 * chart-with-context — do NOT implement those here yet.
 */
const templateRegistry = new Map<string, TemplateDefinition>([
  [
    'metric-dashboard',
    {
      layout: { type: 'grid', columns: 2 },
      slots: [
        { role: 'metrics', primitive: 'metric', min: 2, max: 4 },
        { role: 'chart', primitive: 'chart', optional: true },
      ],
    },
  ],
  [
    'data-card',
    {
      layout: { type: 'stack', direction: 'vertical' },
      slots: [
        { role: 'header', primitive: 'text', variant: 'title' },
        { role: 'content', primitive: ['list', 'table'], min: 1, max: 1 },
      ],
    },
  ],
  [
    'simple-list',
    {
      layout: { type: 'stack', direction: 'vertical' },
      slots: [{ role: 'list', primitive: 'list', min: 1, max: 1 }],
    },
  ],
]);

/**
 * Look up the template definition for a given template name.
 * Returns the 'data-card' template if the name is not registered.
 *
 * Per architecture: data-card is the universal fallback for unknown templates.
 */
export function getTemplate(name: string): TemplateDefinition {
  return templateRegistry.get(name) ?? templateRegistry.get('data-card')!;
}
