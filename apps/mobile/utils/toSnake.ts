/**
 * Deep camelCase to snake_case converter for outgoing WS JSON payloads.
 *
 * Converts all object keys from camelCase to snake_case recursively.
 * Handles nested objects, arrays, and preserves primitive values.
 */

function camelToSnake(str: string): string {
  return str
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase();
}

export function toSnake<T = unknown>(data: unknown): T {
  if (data === null || data === undefined) {
    return data as T;
  }

  if (Array.isArray(data)) {
    return data.map((item) => toSnake(item)) as T;
  }

  if (typeof data === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      result[camelToSnake(key)] = toSnake(value);
    }
    return result as T;
  }

  // Primitives pass through unchanged
  return data as T;
}
