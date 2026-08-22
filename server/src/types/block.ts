import type { JsonValue } from './json.js';

export interface UserBlock {
  blockerUserId: string;
  blockedUserId: string;
  version: number;
  eventId: string;
  blockedAt: string;
  updatedAt: string;
}

export interface SetUserBlockInput {
  blockerUserId: string;
  blockedUserId: string;
  expectedVersion: number;
  idempotencyKey: string;
  metadata?: Record<string, JsonValue>;
}

export interface RemoveUserBlockInput extends SetUserBlockInput {}
