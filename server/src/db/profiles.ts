import {
  profileDataSchema,
  type ProfileRecord,
  type ProfileUpsertInput,
} from '../types/index.js';
import { EventStore } from './events.js';
import { InvariantViolationError } from './errors.js';
import type { Database, SqlExecutor } from './pool.js';
import { isoTimestamp, toJsonObject } from './util.js';

type ProfileRow = {
  user_id: string;
  version: string;
  data: unknown;
  created_at: Date | string;
  updated_at: Date | string;
};

function mapProfile(row: ProfileRow): ProfileRecord {
  return {
    userId: row.user_id,
    version: Number(row.version),
    data: profileDataSchema.parse(row.data),
    createdAt: isoTimestamp(row.created_at),
    updatedAt: isoTimestamp(row.updated_at),
  };
}

export class ProfileRepository {
  constructor(private readonly database: Database) {}

  async getByUserId(userId: string): Promise<ProfileRecord | null> {
    const result = await this.database.query<ProfileRow>(
      `SELECT user_id, version, data, created_at, updated_at FROM profiles WHERE user_id = $1`,
      [userId],
    );
    const row = result.rows[0];
    return row ? mapProfile(row) : null;
  }

  updateByUserId(input: ProfileUpsertInput): Promise<ProfileRecord> {
    return this.database.transaction(async (transaction) => {
      const data = profileDataSchema.parse(input.data);
      const eventStore = new EventStore(transaction);
      const append = await eventStore.appendBatch({
        userId: input.userId,
        ...(input.actorUserId ? { actorUserId: input.actorUserId } : {}),
        idempotencyKey: input.idempotencyKey,
        events: [{
          aggregateType: 'profile',
          aggregateId: input.userId,
          expectedVersion: input.expectedVersion,
          eventType: input.expectedVersion === 0 ? 'profile.created' : 'profile.updated',
          payload: toJsonObject({ profile: data }),
          metadata: toJsonObject(input.metadata ?? {}),
        }],
      });
      const event = append.events[0];
      if (!event) throw new Error('Profile event append returned no event');

      if (!append.replayed) {
        const projected = await transaction.query(
          `INSERT INTO profiles (user_id, version, data, created_at, updated_at)
           VALUES ($1, $2, $3::jsonb, $5::timestamptz, $5::timestamptz)
           ON CONFLICT (user_id) DO UPDATE
             SET version = EXCLUDED.version, data = EXCLUDED.data, updated_at = EXCLUDED.updated_at
           WHERE profiles.version = $4`,
          [
            input.userId, event.aggregateVersion, JSON.stringify(data), input.expectedVersion,
            event.recordedAt,
          ],
        );
        if (projected.rowCount !== 1) {
          throw new InvariantViolationError('Profile projection version diverged from its event stream', {
            userId: input.userId,
            expectedVersion: input.expectedVersion,
          });
        }
        await staleRecommendations(transaction, input.userId, 'profile_version_changed');
      }

      const persisted = await transaction.query<ProfileRow>(
        `SELECT user_id, version, data, created_at, updated_at FROM profiles WHERE user_id = $1`,
        [input.userId],
      );
      const row = persisted.rows[0];
      if (!row) throw new Error('Profile projection was not materialized');
      if (append.replayed && Number(row.version) !== event.aggregateVersion) {
        return {
          userId: input.userId,
          version: event.aggregateVersion,
          data,
          createdAt: isoTimestamp(row.created_at),
          updatedAt: event.recordedAt,
        };
      }
      return mapProfile(row);
    });
  }

  upsert(input: ProfileUpsertInput): Promise<ProfileRecord> {
    return this.updateByUserId(input);
  }
}

export async function staleRecommendations(
  executor: SqlExecutor,
  userId: string,
  reason: string,
): Promise<number> {
  const results = await executor.query(
    `UPDATE recommendation_results
        SET status = 'stale', stale_reason = $2, updated_at = clock_timestamp()
      WHERE status = 'active' AND (left_user_id = $1 OR right_user_id = $1)`,
    [userId, reason],
  );
  await executor.query(
    `UPDATE recommendation_jobs
        SET status = 'stale', worker_id = NULL, lease_expires_at = NULL, updated_at = clock_timestamp()
      WHERE status IN ('queued', 'running') AND (left_user_id = $1 OR right_user_id = $1)`,
    [userId],
  );
  return results.rowCount ?? 0;
}
