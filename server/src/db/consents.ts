import {
  consentDataSchema,
  type ConsentRecord,
  type ConsentUpsertInput,
} from '../types/index.js';
import { EventStore } from './events.js';
import { InvariantViolationError } from './errors.js';
import type { Database } from './pool.js';
import { staleRecommendations } from './profiles.js';
import { isoTimestamp, toJsonObject } from './util.js';

type ConsentRow = {
  user_id: string;
  version: string;
  data: unknown;
  created_at: Date | string;
  updated_at: Date | string;
};

function mapConsent(row: ConsentRow): ConsentRecord {
  return {
    userId: row.user_id,
    version: Number(row.version),
    data: consentDataSchema.parse(row.data),
    createdAt: isoTimestamp(row.created_at),
    updatedAt: isoTimestamp(row.updated_at),
  };
}

export class ConsentRepository {
  constructor(private readonly database: Database) {}

  async getByUserId(userId: string): Promise<ConsentRecord | null> {
    const result = await this.database.query<ConsentRow>(
      `SELECT user_id, version, data, created_at, updated_at FROM consents WHERE user_id = $1`,
      [userId],
    );
    const row = result.rows[0];
    return row ? mapConsent(row) : null;
  }

  updateByUserId(input: ConsentUpsertInput): Promise<ConsentRecord> {
    return this.database.transaction(async (transaction) => {
      const data = consentDataSchema.parse(input.data);
      const append = await new EventStore(transaction).appendBatch({
        userId: input.userId,
        ...(input.actorUserId ? { actorUserId: input.actorUserId } : {}),
        idempotencyKey: input.idempotencyKey,
        events: [{
          aggregateType: 'consent',
          aggregateId: input.userId,
          expectedVersion: input.expectedVersion,
          eventType: input.expectedVersion === 0 ? 'consent.granted' : 'consent.changed',
          payload: toJsonObject({ consent: data }),
          metadata: toJsonObject(input.metadata ?? {}),
        }],
      });
      const event = append.events[0];
      if (!event) throw new Error('Consent event append returned no event');

      if (!append.replayed) {
        const projected = await transaction.query(
          `INSERT INTO consents (user_id, version, data, created_at, updated_at)
           VALUES ($1, $2, $3::jsonb, $5::timestamptz, $5::timestamptz)
           ON CONFLICT (user_id) DO UPDATE
             SET version = EXCLUDED.version, data = EXCLUDED.data, updated_at = EXCLUDED.updated_at
           WHERE consents.version = $4`,
          [
            input.userId, event.aggregateVersion, JSON.stringify(data), input.expectedVersion,
            event.recordedAt,
          ],
        );
        if (projected.rowCount !== 1) {
          throw new InvariantViolationError('Consent projection version diverged from its event stream', {
            userId: input.userId,
            expectedVersion: input.expectedVersion,
          });
        }
        await staleRecommendations(transaction, input.userId, 'consent_version_changed');
      }

      const persisted = await transaction.query<ConsentRow>(
        `SELECT user_id, version, data, created_at, updated_at FROM consents WHERE user_id = $1`,
        [input.userId],
      );
      const row = persisted.rows[0];
      if (!row) throw new Error('Consent projection was not materialized');
      if (append.replayed && Number(row.version) !== event.aggregateVersion) {
        return {
          userId: input.userId,
          version: event.aggregateVersion,
          data,
          createdAt: isoTimestamp(row.created_at),
          updatedAt: event.recordedAt,
        };
      }
      return mapConsent(row);
    });
  }

  upsert(input: ConsentUpsertInput): Promise<ConsentRecord> {
    return this.updateByUserId(input);
  }
}
