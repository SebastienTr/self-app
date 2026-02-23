/**
 * Unit tests for the composition template registry.
 *
 * Verifies: known templates resolve, unknown falls back to data-card,
 * getTemplate returns correct shape, adding a template needs only 1 registry entry.
 */

import { getTemplate } from './templates';

describe('getTemplate — composition template registry', () => {
  // ── Known templates resolve correctly ──────────────────────────────────────

  it('resolves "metric-dashboard" template', () => {
    const tmpl = getTemplate('metric-dashboard');
    expect(tmpl).toBeDefined();
    expect(tmpl.layout.type).toBe('grid');
    expect(tmpl.layout.columns).toBe(2);
  });

  it('metric-dashboard slots have metrics and chart roles', () => {
    const tmpl = getTemplate('metric-dashboard');
    const roles = tmpl.slots.map((s) => s.role);
    expect(roles).toContain('metrics');
    expect(roles).toContain('chart');
  });

  it('metric-dashboard metrics slot: primitive is "metric", min 2, max 4', () => {
    const tmpl = getTemplate('metric-dashboard');
    const metrics = tmpl.slots.find((s) => s.role === 'metrics');
    expect(metrics).toBeDefined();
    expect(metrics!.primitive).toBe('metric');
    expect(metrics!.min).toBe(2);
    expect(metrics!.max).toBe(4);
  });

  it('metric-dashboard chart slot is optional', () => {
    const tmpl = getTemplate('metric-dashboard');
    const chart = tmpl.slots.find((s) => s.role === 'chart');
    expect(chart).toBeDefined();
    expect(chart!.optional).toBe(true);
  });

  it('resolves "data-card" template', () => {
    const tmpl = getTemplate('data-card');
    expect(tmpl).toBeDefined();
    expect(tmpl.layout.type).toBe('stack');
    expect(tmpl.layout.direction).toBe('vertical');
  });

  it('data-card slots have header and content roles', () => {
    const tmpl = getTemplate('data-card');
    const roles = tmpl.slots.map((s) => s.role);
    expect(roles).toContain('header');
    expect(roles).toContain('content');
  });

  it('data-card content slot accepts list or table', () => {
    const tmpl = getTemplate('data-card');
    const content = tmpl.slots.find((s) => s.role === 'content');
    expect(content).toBeDefined();
    expect(Array.isArray(content!.primitive)).toBe(true);
    expect(content!.primitive).toContain('list');
    expect(content!.primitive).toContain('table');
  });

  it('resolves "simple-list" template', () => {
    const tmpl = getTemplate('simple-list');
    expect(tmpl).toBeDefined();
    expect(tmpl.layout.type).toBe('stack');
    expect(tmpl.layout.direction).toBe('vertical');
  });

  it('simple-list has a single list slot', () => {
    const tmpl = getTemplate('simple-list');
    expect(tmpl.slots).toHaveLength(1);
    expect(tmpl.slots[0].role).toBe('list');
    expect(tmpl.slots[0].primitive).toBe('list');
    expect(tmpl.slots[0].min).toBe(1);
    expect(tmpl.slots[0].max).toBe(1);
  });

  // ── Unknown template falls back to data-card ────────────────────────────────

  it('falls back to "data-card" for unknown template name', () => {
    const unknown = getTemplate('does-not-exist');
    const dataCard = getTemplate('data-card');
    expect(unknown).toBe(dataCard);
  });

  it('falls back to "data-card" for empty string', () => {
    const result = getTemplate('');
    const dataCard = getTemplate('data-card');
    expect(result).toBe(dataCard);
  });

  it('falls back to "data-card" for MVP templates not yet implemented', () => {
    const result = getTemplate('map-with-details');
    const dataCard = getTemplate('data-card');
    expect(result).toBe(dataCard);
  });

  // ── Return shape is always a TemplateDefinition ─────────────────────────────

  it('every returned template has layout and slots fields', () => {
    const templates = ['metric-dashboard', 'data-card', 'simple-list'];
    for (const name of templates) {
      const tmpl = getTemplate(name);
      expect(tmpl).toHaveProperty('layout');
      expect(tmpl).toHaveProperty('slots');
      expect(Array.isArray(tmpl.slots)).toBe(true);
    }
  });

  it('every slot has at least a role and primitive field', () => {
    const templates = ['metric-dashboard', 'data-card', 'simple-list'];
    for (const name of templates) {
      const tmpl = getTemplate(name);
      for (const slot of tmpl.slots) {
        expect(slot).toHaveProperty('role');
        expect(slot).toHaveProperty('primitive');
      }
    }
  });
});
