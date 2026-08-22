export type PersistenceErrorCode =
  | 'NOT_FOUND'
  | 'VERSION_CONFLICT'
  | 'RELATIONSHIP_STATE_CONFLICT'
  | 'IDEMPOTENCY_CONFLICT'
  | 'DUPLICATE_EVENT_CONFLICT'
  | 'VALIDATION_ERROR'
  | 'LEASE_LOST'
  | 'INVARIANT_VIOLATION';

export class PersistenceError extends Error {
  constructor(
    public readonly code: PersistenceErrorCode,
    message: string,
    public readonly details: Readonly<Record<string, unknown>> = {},
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundError extends PersistenceError {
  constructor(resource: string, identifier: string) {
    super('NOT_FOUND', `${resource} was not found`, { resource, identifier });
  }
}

export class VersionConflictError extends PersistenceError {
  constructor(
    aggregateType: string,
    aggregateId: string,
    expectedVersion: number,
    actualVersion: number,
  ) {
    super('VERSION_CONFLICT', 'The entity changed since it was read', {
      aggregateType,
      aggregateId,
      expectedVersion,
      actualVersion,
    });
  }
}

export class RelationshipStateConflictError extends PersistenceError {
  constructor(message = 'The relationship cannot transition from its current state') {
    super('RELATIONSHIP_STATE_CONFLICT', message);
  }
}

export class IdempotencyConflictError extends PersistenceError {
  constructor(idempotencyKey: string) {
    super(
      'IDEMPOTENCY_CONFLICT',
      'The idempotency key was already used for a different request',
      { idempotencyKey },
    );
  }
}

export class DuplicateEventConflictError extends PersistenceError {
  constructor(eventId: string) {
    super(
      'DUPLICATE_EVENT_CONFLICT',
      'The event ID was already used in this owner stream',
      { eventId },
    );
  }
}

export class ValidationError extends PersistenceError {
  constructor(message: string, details: Readonly<Record<string, unknown>> = {}) {
    super('VALIDATION_ERROR', message, details);
  }
}

export class LeaseLostError extends PersistenceError {
  constructor(jobId: string, workerId: string) {
    super('LEASE_LOST', 'The recommendation job lease is no longer owned by this worker', {
      jobId,
      workerId,
    });
  }
}

export class InvariantViolationError extends PersistenceError {
  constructor(message: string, details: Readonly<Record<string, unknown>> = {}) {
    super('INVARIANT_VIOLATION', message, details);
  }
}
