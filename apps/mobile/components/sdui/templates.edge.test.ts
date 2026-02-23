/**
 * Edge-case unit tests for the composition template registry (Story 3.3 TEA expansion).
 *
 * Covers paths not exercised by templates.test.ts:
 *   - Null/undefined input to getTemplate
 *   - Prototype-pollution safety for templateRegistry Map
 *   - Reference identity (same call returns same object)
 *   - TemplateLayout field completeness (grid columns, stack direction)
 *   - data-card header slot has variant field
 *   - metric-dashboard layout has no direction (grid only has columns)
 *   - simple-list slot min/max cardinality
 */

import { getTemplate } from './templates';
import type { TemplateDefinition } from './templates';

describe('getTemplate — edge cases and robustness', () => {
  // ── Null / undefined input ─────────────────────────────────────────────────

  it('falls back to data-card when called with null', () => {
    const result = getTemplate(null as any);
    const dataCard = getTemplate('data-card');
    expect(result).toBe(dataCard);
  });

  it('falls back to data-card when called with undefined', () => {
    const result = getTemplate(undefined as any);
    const dataCard = getTemplate('data-card');
    expect(result).toBe(dataCard);
  });

  it('falls back to data-card when called with a number', () => {
    const result = getTemplate(42 as any);
    const dataCard = getTemplate('data-card');
    expect(result).toBe(dataCard);
  });

  // ── Prototype-pollution safety ─────────────────────────────────────────────

  it('returns data-card fallback for "__proto__" (prototype-pollution safe)', () => {
    const result = getTemplate('__proto__');
    const dataCard = getTemplate('data-card');
    // Map-based registry prevents Object.prototype key collisions
    expect(result).toBe(dataCard);
  });

  it('returns data-card fallback for "constructor"', () => {
    const result = getTemplate('constructor');
    const dataCard = getTemplate('data-card');
    expect(result).toBe(dataCard);
  });

  it('returns data-card fallback for "toString"', () => {
    const result = getTemplate('toString');
    const dataCard = getTemplate('data-card');
    expect(result).toBe(dataCard);
  });

  it('returns data-card fallback for "hasOwnProperty"', () => {
    const result = getTemplate('hasOwnProperty');
    const dataCard = getTemplate('data-card');
    expect(result).toBe(dataCard);
  });

  // ── Reference identity (deterministic, no cloning) ────────────────────────

  it('returns the same object reference on repeated calls for the same template', () => {
    const first = getTemplate('metric-dashboard');
    const second = getTemplate('metric-dashboard');
    expect(first).toBe(second);
  });

  it('returns the same data-card reference for two different unknown names', () => {
    const first = getTemplate('unknown-a');
    const second = getTemplate('unknown-b');
    expect(first).toBe(second);
  });

  // ── metric-dashboard layout fields ────────────────────────────────────────

  it('metric-dashboard layout has no direction property (grid only)', () => {
    const tmpl = getTemplate('metric-dashboard');
    // Grid templates use columns, not direction
    expect(tmpl.layout.direction).toBeUndefined();
  });

  it('metric-dashboard layout.columns is exactly 2', () => {
    const tmpl = getTemplate('metric-dashboard');
    expect(tmpl.layout.columns).toBe(2);
  });

  // ── data-card layout and slot fields ──────────────────────────────────────

  it('data-card layout has no columns (stack only)', () => {
    const tmpl = getTemplate('data-card');
    expect(tmpl.layout.columns).toBeUndefined();
  });

  it('data-card header slot has a variant field equal to "title"', () => {
    const tmpl = getTemplate('data-card');
    const headerSlot = tmpl.slots.find((s) => s.role === 'header');
    expect(headerSlot).toBeDefined();
    expect(headerSlot!.variant).toBe('title');
  });

  it('data-card content slot has min 1 and max 1', () => {
    const tmpl = getTemplate('data-card');
    const contentSlot = tmpl.slots.find((s) => s.role === 'content');
    expect(contentSlot).toBeDefined();
    expect(contentSlot!.min).toBe(1);
    expect(contentSlot!.max).toBe(1);
  });

  it('data-card has exactly 2 slots', () => {
    const tmpl = getTemplate('data-card');
    expect(tmpl.slots).toHaveLength(2);
  });

  // ── simple-list slot cardinality ───────────────────────────────────────────

  it('simple-list list slot has min 1 and max 1', () => {
    const tmpl = getTemplate('simple-list');
    const listSlot = tmpl.slots[0];
    expect(listSlot.min).toBe(1);
    expect(listSlot.max).toBe(1);
  });

  it('simple-list layout has no columns', () => {
    const tmpl = getTemplate('simple-list');
    expect(tmpl.layout.columns).toBeUndefined();
  });

  // ── Returned shape completeness ────────────────────────────────────────────

  it('all templates have layout.type of stack or grid', () => {
    const validTypes = new Set(['stack', 'grid']);
    for (const name of ['metric-dashboard', 'data-card', 'simple-list']) {
      const tmpl = getTemplate(name);
      expect(validTypes.has(tmpl.layout.type)).toBe(true);
    }
  });

  it('stack templates have layout.direction of vertical or horizontal', () => {
    const stackTemplates = ['data-card', 'simple-list'];
    for (const name of stackTemplates) {
      const tmpl = getTemplate(name);
      expect(tmpl.layout.type).toBe('stack');
      expect(['vertical', 'horizontal']).toContain(tmpl.layout.direction);
    }
  });

  it('getTemplate always returns a TemplateDefinition with non-empty slots', () => {
    const names = ['metric-dashboard', 'data-card', 'simple-list', 'anything-unknown'];
    for (const name of names) {
      const tmpl: TemplateDefinition = getTemplate(name);
      expect(tmpl.slots.length).toBeGreaterThanOrEqual(1);
    }
  });

  // ── Future MVP template names fall back to data-card ──────────────────────

  it('falls back for "timeline-view" (future MVP template)', () => {
    const result = getTemplate('timeline-view');
    expect(result).toBe(getTemplate('data-card'));
  });

  it('falls back for "chart-with-context" (future MVP template)', () => {
    const result = getTemplate('chart-with-context');
    expect(result).toBe(getTemplate('data-card'));
  });
});
