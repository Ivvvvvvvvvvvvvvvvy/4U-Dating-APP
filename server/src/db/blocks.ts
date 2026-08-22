import { z } from 'zod';

import { canonicalPairKey, canonicalizeUserIds } from '../recommendations/pair.js';
import type { RemoveUserBlockInput, SetUserBlockInput, UserBlock } from '../types/index.js';
import { InvariantViolationError, NotFoundError, ValidationError } from './errors.js';
import { EventStore } from './events.js';
import type { Database } from './pool.js';
import { staleRecommendations } from './profiles.js';
import { isoTimestamp, toJsonObject } from './util.js';

const userIdSchema = z.string().trim().min(1).max(200);

type BlockRow = {
  blocker_user_id: string;
  blocked_user_id: string;
  version: string;
  event_id: string;
  blocked_at: Date | string;
  updated_at: Date | string;
};

type HeartRelationshipRow = {
  actor_user_id: string;
  target_user_id: string;
  version: string;
};

type MatchRelationshipRow = {
  match_id: string;
  left_user_id: string;
  right_user_id: string;
  version: string;
};

type ConversationRelationshipRow = {
  thread_id: string;
  version: string;
};

function validateUsers(blockerUserId: string, blockedUserId: string): void {
  userIdSchema.parse(blockerUserId);
  userIdSchema.parse(blockedUserId);
  if (blockerUserId === blockedUserId) throw new ValidationError('A user cannot block themself');
}

function mapBlock(row: BlockRow): UserBlock {
  return {
    blockerUserId: row.blocker_user_id,
    blockedUserId: row.blocked_user_id,
    version: Number(row.version),
    eventId: row.event_id,
    blockedAt: isoTimestamp(row.blocked_at),
    updatedAt: isoTimestamp(row.updated_at),
  };
}

async function lockRelationshipPair(
  executor: import('./pool.js').SqlExecutor,
  firstUserId: string,
  secondUserId: string,
): Promise<void> {
  const [leftUserId, rightUserId] = canonicalizeUserIds(firstUserId, secondUserId);
  const pairKey = canonicalPairKey(leftUserId, rightUserId);
  await executor.query(
    `SELECT pg_advisory_xact_lock(
       LEAST(hashtext($1), hashtext($2)),
       GREATEST(hashtext($1), hashtext($2))
     )`,
    [leftUserId, rightUserId],
  );
  await executor.query(
    `INSERT INTO relationship_pairs (pair_key, left_user_id, right_user_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (pair_key) DO NOTHING`,
    [pairKey, leftUserId, rightUserId],
  );
  await executor.query(
    `SELECT pair_key FROM relationship_pairs WHERE pair_key = $1 FOR UPDATE`,
    [pairKey],
  );
}

async function closeRelationshipForBlock(
  transaction: import('./pool.js').SqlExecutor,
  blockerUserId: string,
  blockedUserId: string,
  blockEventId: string,
  occurredAt: string,
): Promise<void> {
  const pairKey = canonicalPairKey(blockerUserId, blockedUserId);
  const eventStore = new EventStore(transaction);
  const hearts = await transaction.query<HeartRelationshipRow>(
    `SELECT actor_user_id, target_user_id, version
       FROM relationship_hearts
      WHERE pair_key = $1 AND status = 'ACTIVE'
      ORDER BY actor_user_id
      FOR UPDATE`,
    [pairKey],
  );

  for (const heart of hearts.rows) {
    const version = Number(heart.version);
    const appended = await eventStore.appendBatch({
      userId: heart.actor_user_id,
      // This owner-facing stream records a neutral invalidation. The separate
      // blocker's user_block stream retains the authoritative audit actor.
      actorUserId: heart.actor_user_id,
      idempotencyKey: `block:${blockEventId}:heart:${heart.actor_user_id}`,
      events: [{
        aggregateType: 'heart',
        aggregateId: heart.target_user_id,
        expectedVersion: version,
        eventType: 'heart.invalidated',
        payload: toJsonObject({ targetUserId: heart.target_user_id }),
        occurredAt,
      }],
    });
    const event = appended.events[0];
    if (!event) throw new InvariantViolationError('Block heart invalidation returned no event');
    const updated = await transaction.query(
      `UPDATE relationship_hearts
          SET version = $4, status = 'EXPIRED', updated_at = $5::timestamptz
        WHERE actor_user_id = $1 AND target_user_id = $2
          AND version = $3 AND status = 'ACTIVE'`,
      [heart.actor_user_id, heart.target_user_id, version, event.aggregateVersion, occurredAt],
    );
    if (updated.rowCount !== 1) {
      throw new InvariantViolationError('Block heart projection diverged from its event stream');
    }
  }

  const matches = await transaction.query<MatchRelationshipRow>(
    `SELECT match_id, left_user_id, right_user_id, version
       FROM relationship_matches
      WHERE pair_key = $1 AND status = 'ACTIVE'
      FOR UPDATE`,
    [pairKey],
  );
  const match = matches.rows[0];
  if (!match) return;

  const conversations = await transaction.query<ConversationRelationshipRow>(
    `SELECT thread_id, version
       FROM relationship_conversations
      WHERE match_id = $1 AND status IN ('CREATING', 'READY')
      FOR UPDATE`,
    [match.match_id],
  );
  const conversation = conversations.rows[0];
  if (!conversation) {
    throw new InvariantViolationError('Active match has no open conversation during block');
  }

  for (const ownerUserId of [match.left_user_id, match.right_user_id]) {
    await eventStore.appendBatch({
      userId: ownerUserId,
      actorUserId: ownerUserId,
      idempotencyKey: `block:${blockEventId}:relationship`,
      events: [{
        aggregateType: 'match',
        aggregateId: match.match_id,
        expectedVersion: Number(match.version),
        eventType: 'match.closed',
        payload: toJsonObject({ matchId: match.match_id }),
        occurredAt,
      }, {
        aggregateType: 'conversation',
        aggregateId: conversation.thread_id,
        expectedVersion: Number(conversation.version),
        eventType: 'conversation.closed',
        payload: toJsonObject({ matchId: match.match_id, threadId: conversation.thread_id }),
        occurredAt,
      }],
    });
  }

  const matchUpdate = await transaction.query(
    `UPDATE relationship_matches
        SET version = version + 1, status = 'BLOCKED', blocked_at = $2::timestamptz,
            updated_at = $2::timestamptz
      WHERE match_id = $1 AND status = 'ACTIVE'`,
    [match.match_id, occurredAt],
  );
  const conversationUpdate = await transaction.query(
    `UPDATE relationship_conversations
        SET version = version + 1, status = 'CLOSED', closed_at = $2::timestamptz,
            updated_at = $2::timestamptz
      WHERE thread_id = $1 AND status IN ('CREATING', 'READY')`,
    [conversation.thread_id, occurredAt],
  );
  if (matchUpdate.rowCount !== 1 || conversationUpdate.rowCount !== 1) {
    throw new InvariantViolationError('Block relationship projection diverged from its event stream');
  }
}

export class BlockRepository {
  constructor(private readonly database: Database) {}

  async listByBlocker(blockerUserId: string, limit = 100): Promise<UserBlock[]> {
    const validatedBlockerUserId = userIdSchema.parse(blockerUserId);
    const validatedLimit = z.number().int().min(1).max(100).parse(limit);
    const result = await this.database.query<BlockRow>(
      `SELECT blocker_user_id, blocked_user_id, version, event_id, blocked_at, updated_at
         FROM user_blocks
        WHERE blocker_user_id = $1
        ORDER BY blocked_at DESC, blocked_user_id ASC
        LIMIT $2`,
      [validatedBlockerUserId, validatedLimit],
    );
    return result.rows.map(mapBlock);
  }

  async isBlockedEither(leftUserId: string, rightUserId: string): Promise<boolean> {
    validateUsers(leftUserId, rightUserId);
    const result = await this.database.query<{ blocked: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM user_blocks
          WHERE (blocker_user_id = $1 AND blocked_user_id = $2)
             OR (blocker_user_id = $2 AND blocked_user_id = $1)
       ) AS blocked`,
      [leftUserId, rightUserId],
    );
    return result.rows[0]?.blocked ?? false;
  }

  async get(blockerUserId: string, blockedUserId: string): Promise<UserBlock | null> {
    validateUsers(blockerUserId, blockedUserId);
    const result = await this.database.query<BlockRow>(
      `SELECT blocker_user_id, blocked_user_id, version, event_id, blocked_at, updated_at
         FROM user_blocks WHERE blocker_user_id = $1 AND blocked_user_id = $2`,
      [blockerUserId, blockedUserId],
    );
    const row = result.rows[0];
    return row ? mapBlock(row) : null;
  }

  set(input: SetUserBlockInput): Promise<UserBlock> {
    validateUsers(input.blockerUserId, input.blockedUserId);
    return this.database.transaction(async (transaction) => {
      await lockRelationshipPair(transaction, input.blockerUserId, input.blockedUserId);
      const appended = await new EventStore(transaction).appendBatch({
        userId: input.blockerUserId,
        idempotencyKey: input.idempotencyKey,
        events: [{
          aggregateType: 'user_block',
          aggregateId: input.blockedUserId,
          expectedVersion: input.expectedVersion,
          eventType: 'user.blocked',
          payload: toJsonObject({ blockedUserId: input.blockedUserId }),
          metadata: toJsonObject(input.metadata ?? {}),
        }],
      });
      const event = appended.events[0];
      if (!event) throw new InvariantViolationError('Block event append returned no event');
      if (!appended.replayed) {
        await closeRelationshipForBlock(
          transaction, input.blockerUserId, input.blockedUserId, event.eventId, event.recordedAt,
        );
        const projected = await transaction.query<BlockRow>(
          `INSERT INTO user_blocks (
             blocker_user_id, blocked_user_id, version, event_id, blocked_at, updated_at
           ) VALUES ($1, $2, $3, $4, $5::timestamptz, $5::timestamptz)
           ON CONFLICT (blocker_user_id, blocked_user_id) DO UPDATE SET
             version = EXCLUDED.version, event_id = EXCLUDED.event_id,
             blocked_at = EXCLUDED.blocked_at, updated_at = EXCLUDED.updated_at
           WHERE user_blocks.version = $6
           RETURNING blocker_user_id, blocked_user_id, version, event_id, blocked_at, updated_at`,
          [
            input.blockerUserId, input.blockedUserId, event.aggregateVersion, event.eventId,
            event.recordedAt, input.expectedVersion,
          ],
        );
        if (projected.rowCount !== 1) {
          throw new InvariantViolationError('Block projection version diverged from its event stream');
        }
        await staleRecommendations(transaction, input.blockerUserId, 'block_state_changed');
        await staleRecommendations(transaction, input.blockedUserId, 'block_state_changed');
        const row = projected.rows[0];
        if (!row) throw new InvariantViolationError('Block projection returned no row');
        return mapBlock(row);
      }
      const existing = await transaction.query<BlockRow>(
        `SELECT blocker_user_id, blocked_user_id, version, event_id, blocked_at, updated_at
           FROM user_blocks WHERE blocker_user_id = $1 AND blocked_user_id = $2`,
        [input.blockerUserId, input.blockedUserId],
      );
      const row = existing.rows[0];
      if (!row || Number(row.version) !== event.aggregateVersion) {
        return {
          blockerUserId: input.blockerUserId,
          blockedUserId: input.blockedUserId,
          version: event.aggregateVersion,
          eventId: event.eventId,
          blockedAt: event.recordedAt,
          updatedAt: event.recordedAt,
        };
      }
      return mapBlock(row);
    });
  }

  async remove(input: RemoveUserBlockInput): Promise<{ removed: boolean; version: number }> {
    validateUsers(input.blockerUserId, input.blockedUserId);
    return this.database.transaction(async (transaction) => {
      await lockRelationshipPair(transaction, input.blockerUserId, input.blockedUserId);
      const appended = await new EventStore(transaction).appendBatch({
        userId: input.blockerUserId,
        idempotencyKey: input.idempotencyKey,
        events: [{
          aggregateType: 'user_block',
          aggregateId: input.blockedUserId,
          expectedVersion: input.expectedVersion,
          eventType: 'user.unblocked',
          payload: toJsonObject({ blockedUserId: input.blockedUserId }),
          metadata: toJsonObject(input.metadata ?? {}),
        }],
      });
      const event = appended.events[0];
      if (!event) throw new InvariantViolationError('Unblock event append returned no event');
      let removed = false;
      if (!appended.replayed) {
        const existing = await transaction.query<BlockRow>(
          `SELECT blocker_user_id, blocked_user_id, version, event_id, blocked_at, updated_at
             FROM user_blocks
            WHERE blocker_user_id = $1 AND blocked_user_id = $2
            FOR UPDATE`,
          [input.blockerUserId, input.blockedUserId],
        );
        if (!existing.rows[0]) throw new NotFoundError('user block', input.blockedUserId);
        const deleted = await transaction.query(
          `DELETE FROM user_blocks
            WHERE blocker_user_id = $1 AND blocked_user_id = $2 AND version = $3`,
          [input.blockerUserId, input.blockedUserId, input.expectedVersion],
        );
        removed = (deleted.rowCount ?? 0) === 1;
        if (!removed) {
          throw new NotFoundError('user block', input.blockedUserId);
        }
        await staleRecommendations(transaction, input.blockerUserId, 'block_state_changed');
        await staleRecommendations(transaction, input.blockedUserId, 'block_state_changed');
      }
      return { removed: appended.replayed ? true : removed, version: event.aggregateVersion };
    });
  }
}
