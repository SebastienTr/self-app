/**
 * Unit tests for the SDUI primitive registry.
 *
 * Verifies: known types return correct components, unknown types return
 * UnknownPrimitive, registry extensibility pattern.
 */

import { getPrimitive } from './registry';
import { TextPrimitive } from './TextPrimitive';
import { MetricPrimitive } from './MetricPrimitive';
import { LayoutPrimitive } from './LayoutPrimitive';
import { CardPrimitive } from './CardPrimitive';
import { ListPrimitive } from './ListPrimitive';
import { UnknownPrimitive } from './UnknownPrimitive';

// Suppress console output during tests
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});

describe('getPrimitive', () => {
  it('returns TextPrimitive for type "text"', () => {
    expect(getPrimitive('text')).toBe(TextPrimitive);
  });

  it('returns MetricPrimitive for type "metric"', () => {
    expect(getPrimitive('metric')).toBe(MetricPrimitive);
  });

  it('returns LayoutPrimitive for type "layout"', () => {
    expect(getPrimitive('layout')).toBe(LayoutPrimitive);
  });

  it('returns UnknownPrimitive for unregistered type "chart"', () => {
    expect(getPrimitive('chart')).toBe(UnknownPrimitive);
  });

  it('returns UnknownPrimitive for unregistered type "widget"', () => {
    expect(getPrimitive('widget')).toBe(UnknownPrimitive);
  });

  it('returns UnknownPrimitive for empty string type', () => {
    expect(getPrimitive('')).toBe(UnknownPrimitive);
  });

  it('returns UnknownPrimitive for undefined type', () => {
    expect(getPrimitive(undefined as any)).toBe(UnknownPrimitive);
  });

  it('returns CardPrimitive for type "card"', () => {
    expect(getPrimitive('card')).toBe(CardPrimitive);
  });

  it('returns ListPrimitive for type "list"', () => {
    expect(getPrimitive('list')).toBe(ListPrimitive);
  });

  it('returns UnknownPrimitive for status type (stub for future)', () => {
    // status and table are registered as UnknownPrimitive stubs per story notes
    expect(getPrimitive('status')).toBe(UnknownPrimitive);
  });

  it('returns UnknownPrimitive for table type (stub for future)', () => {
    expect(getPrimitive('table')).toBe(UnknownPrimitive);
  });

  it('is case-sensitive — "Text" does not match "text"', () => {
    expect(getPrimitive('Text')).toBe(UnknownPrimitive);
  });

  // --- Edge case tests ---

  it('returns UnknownPrimitive for null type', () => {
    expect(getPrimitive(null as any)).toBe(UnknownPrimitive);
  });

  it('returns UnknownPrimitive for number type', () => {
    expect(getPrimitive(42 as any)).toBe(UnknownPrimitive);
  });

  it('returns UnknownPrimitive for boolean type', () => {
    expect(getPrimitive(true as any)).toBe(UnknownPrimitive);
  });

  it('returns UnknownPrimitive for whitespace-only type', () => {
    expect(getPrimitive('  ')).toBe(UnknownPrimitive);
  });

  it('returns UnknownPrimitive for type with leading/trailing spaces', () => {
    expect(getPrimitive(' text ')).toBe(UnknownPrimitive);
  });

  it('is case-sensitive — uppercase "TEXT" does not match "text"', () => {
    expect(getPrimitive('TEXT')).toBe(UnknownPrimitive);
  });

  it('is case-sensitive — "Metric" does not match "metric"', () => {
    expect(getPrimitive('Metric')).toBe(UnknownPrimitive);
  });

  it('returns UnknownPrimitive for type with special characters', () => {
    expect(getPrimitive('text/html')).toBe(UnknownPrimitive);
  });

  it('returns UnknownPrimitive for Object.prototype keys (no prototype pollution)', () => {
    // Registry uses Map, so prototype keys like 'toString', 'constructor'
    // correctly fall through to UnknownPrimitive.
    expect(getPrimitive('toString')).toBe(UnknownPrimitive);
    expect(getPrimitive('constructor')).toBe(UnknownPrimitive);
    expect(getPrimitive('hasOwnProperty')).toBe(UnknownPrimitive);
    expect(getPrimitive('__proto__')).toBe(UnknownPrimitive);
  });

  it('returns a function (component) for all known types', () => {
    const knownTypes = ['text', 'metric', 'layout', 'card', 'list', 'status', 'table'];
    for (const type of knownTypes) {
      const component = getPrimitive(type);
      expect(typeof component).toBe('function');
    }
  });

  it('returns a function for unknown types too', () => {
    const component = getPrimitive('nonexistent');
    expect(typeof component).toBe('function');
    expect(component).toBe(UnknownPrimitive);
  });
});
