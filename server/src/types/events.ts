import type { JsonObject } from './json.js';

export interface NewDomainEvent {
  eventId?: string;
  aggregateType: string;
  aggregateId: string;
  expectedVersion: number;
  eventType: string;
  payload: JsonObject;
  metadata?: JsonObject;
  occurredAt?: string;
}

export interface AppendEventsInput {
  /** Owner/tenant boundary for both idempotency and stream reads. */
  userId: string;
  /** Optional audit actor when an authorized service writes on the owner's behalf. */
  actorUserId?: string;
  idempotencyKey: string;
  events: readonly NewDomainEvent[];
}

export interface AppendedEvent {
  eventId: string;
  aggregateType: string;
  aggregateId: string;
  aggregateVersion: number;
  globalPosition: string;
  eventType: string;
  recordedAt: string;
}

export interface AppendEventsResult {
  replayed: boolean;
  cursor: string;
  events: AppendedEvent[];
}

export interface StoredDomainEvent extends AppendedEvent {
  actorUserId: string;
  payload: JsonObject;
  metadata: JsonObject;
  occurredAt: string;
}
