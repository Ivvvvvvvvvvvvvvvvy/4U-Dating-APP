import { randomUUID } from 'node:crypto';

import { z } from 'zod';

import {
  jsonObjectSchema,
  type AppendEventsInput,
  type AppendEventsResult,
  type AppendedEvent,
  type StoredDomainEvent,
} from '../types/index.js';
import {
  DuplicateEventConflictError,
  IdempotencyConflictError,
  InvariantViolationError,
  VersionConflictError,
} from './errors.js';
import type { Database, SqlExecutor } from './pool.js';
import { hashJson, isoTimestamp } from './util.js';

const newEventSchema = z.object({
  eventId: z.string().trim().min(1).max(200).optional(),
  aggregateType: z.string().trim().min(1).max(100),
  aggregateId: z.string().trim().min(1).max(300),
  expectedVersion: z.number().int().nonnegative(),
  eventType: z.string().trim().min(1).max(160),
  payload: jsonObjectSchema,
  metadata: jsonObjectSchema.optional(),
  occurredAt: z.iso.datetime({ offset: true }).optional(),
});

const appendInputSchema = z.object({
  userId: z.string().trim().min(1).max(200),
  actorUserId: z.string().trim().min(1).max(200).optional(),
  idempotencyKey: z.string().trim().min(8).max(255),
  events: z.array(newEventSchema).min(1).max(100),
});

type EventRow = {
  event_id: string;
  aggregate_type: string;
  aggregate_id: string;
  aggregate_version: string;
  global_position: string;
  event_type: string;
  actor_user_id: string;
  payload: StoredDomainEvent['payload'];
  metadata: StoredDomainEvent['metadata'];
  occurred_at: Date | string;
  recorded_at: Date | string;
};

type BatchRow = { request_hash: string; response: AppendEventsResult | null };
type HeadRow = { version: string };
type PostgreSqlError = { code?: unknown; constraint?: unknown };

function isOwnerEventConflict(error: unknown): boolean {
  const candidate = error as PostgreSqlError | null;
  return candidate?.code === '23505'
    && candidate.constraint === 'domain_events_owner_event_unique';
}

function isDatabase(executor: SqlExecutor): executor is Database {
  return 'transaction' in executor && typeof executor.transaction === 'function';
}

async function inTransaction<T>(
  executor: SqlExecutor,
  operation: (transaction: SqlExecutor) => Promise<T>,
): Promise<T> {
  return isDatabase(executor) ? executor.transaction(operation) : operation(executor);
}

function mapAppendedEvent(row: EventRow): AppendedEvent {
  return {
    eventId: row.event_id,
    aggregateType: row.aggregate_type,
    aggregateId: row.aggregate_id,
    aggregateVersion: Number(row.aggregate_version),
    globalPosition: row.global_position,
    eventType: row.event_type,
    recordedAt: isoTimestamp(row.recorded_at),
  };
}

function mapStoredEvent(row: EventRow): StoredDomainEvent {
  return {
    ...mapAppendedEvent(row),
    actorUserId: row.actor_user_id,
    payload: row.payload,
    metadata: row.metadata,
    occurredAt: isoTimestamp(row.occurred_at),
  };
}

export class EventStore {
  constructor(private readonly executor: SqlExecutor) {}

  appendBatch(input: AppendEventsInput): Promise<AppendEventsResult> {
    const parsed = appendInputSchema.parse(input);
    return inTransaction(this.executor, (transaction) => this.appendWithinTransaction(transaction, parsed));
  }

  private async appendWithinTransaction(
    transaction: SqlExecutor,
    input: z.infer<typeof appendInputSchema>,
  ): Promise<AppendEventsResult> {
    const requestHash = hashJson(input);
    const batchId = randomUUID();
    const insertedBatch = await transaction.query<{ batch_id: string }>(
      `INSERT INTO event_batches (batch_id, owner_user_id, actor_user_id, idempotency_key, request_hash)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (owner_user_id, idempotency_key) DO NOTHING
       RETURNING batch_id`,
      [batchId, input.userId, input.actorUserId ?? input.userId, input.idempotencyKey, requestHash],
    );

    if (insertedBatch.rowCount === 0) {
      const existing = await transaction.query<BatchRow>(
        `SELECT request_hash, response
           FROM event_batches
          WHERE owner_user_id = $1 AND idempotency_key = $2
          FOR UPDATE`,
        [input.userId, input.idempotencyKey],
      );
      const batch = existing.rows[0];
      if (!batch) throw new InvariantViolationError('Idempotency reservation disappeared');
      if (batch.request_hash !== requestHash) {
        throw new IdempotencyConflictError(input.idempotencyKey);
      }
      if (!batch.response) {
        throw new InvariantViolationError('Completed event batch has no stored response', {
          idempotencyKey: input.idempotencyKey,
        });
      }
      return { ...batch.response, replayed: true };
    }

    const aggregateKeys = [...new Map(
      input.events.map((event) => [
        `${event.aggregateType}\0${event.aggregateId}`,
        { aggregateType: event.aggregateType, aggregateId: event.aggregateId },
      ]),
    ).values()].sort((left, right) => {
      const leftKey = `${left.aggregateType}\0${left.aggregateId}`;
      const rightKey = `${right.aggregateType}\0${right.aggregateId}`;
      return Buffer.compare(Buffer.from(leftKey), Buffer.from(rightKey));
    });

    const versions = new Map<string, number>();
    for (const key of aggregateKeys) {
      await transaction.query(
        `INSERT INTO aggregate_heads (owner_user_id, aggregate_type, aggregate_id, version)
         VALUES ($1, $2, $3, 0)
         ON CONFLICT (owner_user_id, aggregate_type, aggregate_id) DO NOTHING`,
        [input.userId, key.aggregateType, key.aggregateId],
      );
      const head = await transaction.query<HeadRow>(
        `SELECT version
           FROM aggregate_heads
          WHERE owner_user_id = $1 AND aggregate_type = $2 AND aggregate_id = $3
          FOR UPDATE`,
        [input.userId, key.aggregateType, key.aggregateId],
      );
      const row = head.rows[0];
      if (!row) throw new InvariantViolationError('Aggregate head disappeared');
      versions.set(`${key.aggregateType}\0${key.aggregateId}`, Number(row.version));
    }

    const appended: AppendedEvent[] = [];
    for (let batchIndex = 0; batchIndex < input.events.length; batchIndex += 1) {
      const event = input.events[batchIndex];
      if (!event) throw new InvariantViolationError('Validated event batch contained a hole');
      const aggregateKey = `${event.aggregateType}\0${event.aggregateId}`;
      const currentVersion = versions.get(aggregateKey);
      if (currentVersion === undefined) throw new InvariantViolationError('Aggregate was not locked');
      if (event.expectedVersion !== currentVersion) {
        throw new VersionConflictError(
          event.aggregateType,
          event.aggregateId,
          event.expectedVersion,
          currentVersion,
        );
      }

      const nextVersion = currentVersion + 1;
      let inserted;
      try {
        inserted = await transaction.query<EventRow>(
        `INSERT INTO domain_events (
           event_id, batch_id, batch_index, aggregate_type, aggregate_id, owner_user_id,
           aggregate_version, event_type, actor_user_id, payload, metadata, occurred_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb,
                   COALESCE($12::timestamptz, clock_timestamp()))
         RETURNING event_id, aggregate_type, aggregate_id, aggregate_version,
                   global_position, event_type, actor_user_id, payload, metadata,
                   occurred_at, recorded_at`,
        [
          event.eventId ?? randomUUID(),
          batchId,
          batchIndex,
          event.aggregateType,
          event.aggregateId,
          input.userId,
          nextVersion,
          event.eventType,
          input.actorUserId ?? input.userId,
          JSON.stringify(event.payload),
          JSON.stringify(event.metadata ?? {}),
          event.occurredAt ?? null,
        ],
        );
      } catch (error) {
        if (isOwnerEventConflict(error)) {
          throw new DuplicateEventConflictError(event.eventId ?? 'generated-event-id');
        }
        throw error;
      }
      const row = inserted.rows[0];
      if (!row) throw new InvariantViolationError('Event insert returned no row');
      appended.push(mapAppendedEvent(row));
      versions.set(aggregateKey, nextVersion);
    }

    for (const key of aggregateKeys) {
      const nextVersion = versions.get(`${key.aggregateType}\0${key.aggregateId}`);
      if (nextVersion === undefined) throw new InvariantViolationError('Aggregate version disappeared');
      await transaction.query(
        `UPDATE aggregate_heads
            SET version = $4, updated_at = clock_timestamp()
          WHERE owner_user_id = $1 AND aggregate_type = $2 AND aggregate_id = $3`,
        [input.userId, key.aggregateType, key.aggregateId, nextVersion],
      );
    }

    const last = appended.at(-1);
    if (!last) throw new InvariantViolationError('Validated event batch produced no events');
    const response: AppendEventsResult = { replayed: false, cursor: last.globalPosition, events: appended };
    await transaction.query(
      `UPDATE event_batches SET response = $2::jsonb, completed_at = clock_timestamp() WHERE batch_id = $1`,
      [batchId, JSON.stringify(response)],
    );
    return response;
  }

  async readAfter(options: {
    userId: string;
    cursor?: string;
    limit?: number;
    aggregateType?: string;
    aggregateId?: string;
  }): Promise<StoredDomainEvent[]> {
    const userId = z.string().trim().min(1).max(200).parse(options.userId);
    const cursor = options.cursor ?? '0';
    if (!/^\d+$/.test(cursor)) throw new RangeError('cursor must be a non-negative integer string');
    const limit = Math.min(Math.max(options.limit ?? 100, 1), 1_000);
    const result = await this.executor.query<EventRow>(
      `SELECT event_id, aggregate_type, aggregate_id, aggregate_version, global_position,
              event_type, actor_user_id, payload, metadata, occurred_at, recorded_at
         FROM domain_events
        WHERE owner_user_id = $1
          AND global_position > $2::bigint
          AND ($3::text IS NULL OR aggregate_type = $3)
          AND ($4::text IS NULL OR aggregate_id = $4)
        ORDER BY global_position ASC
        LIMIT $5`,
      [
        userId, cursor, options.aggregateType ?? null,
        options.aggregateId ?? null, limit,
      ],
    );
    return result.rows.map(mapStoredEvent);
  }

  async readAggregate(
    userId: string,
    aggregateType: string,
    aggregateId: string,
    afterVersion = 0,
  ): Promise<StoredDomainEvent[]> {
    const validatedUserId = z.string().trim().min(1).max(200).parse(userId);
    const validatedAggregateType = z.string().trim().min(1).max(100).parse(aggregateType);
    const validatedAggregateId = z.string().trim().min(1).max(300).parse(aggregateId);
    const validatedAfterVersion = z.number().int().nonnegative().parse(afterVersion);
    const result = await this.executor.query<EventRow>(
      `SELECT event_id, aggregate_type, aggregate_id, aggregate_version, global_position,
              event_type, actor_user_id, payload, metadata, occurred_at, recorded_at
         FROM domain_events
        WHERE owner_user_id = $1 AND aggregate_type = $2 AND aggregate_id = $3
          AND aggregate_version > $4
        ORDER BY aggregate_version ASC`,
      [validatedUserId, validatedAggregateType, validatedAggregateId, validatedAfterVersion],
    );
    return result.rows.map(mapStoredEvent);
  }
}
