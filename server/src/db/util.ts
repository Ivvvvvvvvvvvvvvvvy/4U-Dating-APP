import { createHash } from 'node:crypto';

import { jsonObjectSchema, type JsonObject, type JsonValue } from '../types/json.js';

function normalizeJson(value: unknown): JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('JSON numbers must be finite');
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeJson(entry));
  }
  if (typeof value === 'object') {
    const result: Record<string, JsonValue> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const entry = (value as Record<string, unknown>)[key];
      if (entry !== undefined) result[key] = normalizeJson(entry);
    }
    return result;
  }
  throw new TypeError(`Unsupported JSON value: ${typeof value}`);
}

export function toJsonObject(value: unknown): JsonObject {
  return jsonObjectSchema.parse(normalizeJson(value));
}

export function stableJson(value: unknown): string {
  return JSON.stringify(normalizeJson(value));
}

export function hashJson(value: unknown): string {
  return createHash('sha256').update(stableJson(value)).digest('hex');
}

export function isoTimestamp(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function requireSafeInteger(value: string | number, label: string): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(parsed)) throw new RangeError(`${label} exceeds JavaScript safe integer range`);
  return parsed;
}
