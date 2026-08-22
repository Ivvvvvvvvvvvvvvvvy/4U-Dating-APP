import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { PGlite, type PGliteInterface, type Transaction } from '@electric-sql/pglite';
import type { QueryResult, QueryResultRow } from 'pg';

import { BlockRepository } from './blocks.js';
import { IdempotencyConflictError, RelationshipStateConflictError, VersionConflictError } from './errors.js';
import type { Database, SqlExecutor } from './pool.js';
import { RelationshipRepository } from './relationships.js';

function executorFor(connection: Pick<PGliteInterface, 'query'> | Pick<Transaction, 'query'>): SqlExecutor {
  return { async query<Row extends QueryResultRow>(text: string, values: readonly unknown[] = []) {
    const result = await connection.query(text, [...values]);
    return { command: result.command ?? 'UNKNOWN', rowCount: result.rowCount ?? result.rows.length,
      oid: 0, rows: result.rows as Row[], fields: [] } as QueryResult<Row>;
  } };
}

function databaseFor(postgres: PGlite): Database {
  const executor = executorFor(postgres);
  return { query: executor.query, transaction: (operation) => postgres.transaction((tx) => operation(executorFor(tx))), close: () => postgres.close() };
}

async function setup() {
  const postgres = new PGlite();
  await postgres.exec(await readFile(new URL('../../migrations/0001_initial.sql', import.meta.url), 'utf8'));
  await postgres.exec(await readFile(new URL('../../migrations/0002_relationships.sql', import.meta.url), 'utf8'));
  const database = databaseFor(postgres);
  const profile = (displayName: string, birthDate = '1990-01-01') => JSON.stringify({
    displayName, profileStatus: 'RECOMMENDABLE', birthDate, interests: [], photos: [], prompts: [],
    verification: { account: 'VERIFIED', personhood: 'VERIFIED', profileReview: 'VERIFIED' }, attributes: {},
  });
  await database.query("INSERT INTO profiles(user_id,version,data) VALUES ('person_a',1,$1),('person_b',1,$2),('person_c',1,$3)", [profile('A'), profile('B'), profile('C', '2015-01-01')]);
  return { postgres, database, relationships: new RelationshipRepository(database, { now: () => new Date('2026-08-23T12:00:00.000Z') }) };
}

test('relationship flow preserves unilateral privacy, idempotency, matching, unmatch, and terminality', async () => {
  const { database, relationships } = await setup();
  try {
    const first = await relationships.expressHeart({ actorUserId:'person_a',targetUserId:'person_b',expectedVersion:0,idempotencyKey:'heart-a-b-0001' });
    assert.equal(first.changed, true); assert.equal(first.match, undefined); assert.equal(first.heart.version, 1);
    const replay = await relationships.expressHeart({ actorUserId:'person_a',targetUserId:'person_b',expectedVersion:0,idempotencyKey:'heart-a-b-0001' });
    assert.equal(replay.replayed, true); assert.equal(replay.match, undefined);
    const noOp = await relationships.expressHeart({ actorUserId:'person_a',targetUserId:'person_b',expectedVersion:1,idempotencyKey:'heart-a-b-noop1' });
    assert.equal(noOp.changed, false); assert.equal(noOp.heart.version, 1); assert.equal(noOp.match, undefined);
    await assert.rejects(relationships.expressHeart({ actorUserId:'person_a',targetUserId:'person_b',expectedVersion:1,idempotencyKey:'heart-a-b-0001' }), IdempotencyConflictError);
    await assert.rejects(relationships.expressHeart({ actorUserId:'person_a',targetUserId:'person_b',expectedVersion:0,idempotencyKey:'heart-stale-0001' }), VersionConflictError);
    assert.equal(Number((await database.query<{ count:string }>("SELECT count(*) count FROM domain_events WHERE owner_user_id='person_b'")).rows[0]?.count), 0);

    const mutual = await relationships.expressHeart({ actorUserId:'person_b',targetUserId:'person_a',expectedVersion:0,idempotencyKey:'heart-b-a-0001' });
    assert.equal(mutual.match?.status, 'ACTIVE'); assert.match(mutual.match?.matchId ?? '', /^match_/); assert.match(mutual.match?.conversation.threadId ?? '', /^thread_/);
    assert.equal((await relationships.listMatches('person_a')).length, 1);
    assert.equal((await relationships.getMatch('person_c', mutual.match?.matchId ?? '')), null);
    assert.equal(Number((await database.query<{ count:string }>('SELECT count(*) count FROM relationship_matches')).rows[0]?.count), 1);

    await assert.rejects(relationships.withdrawHeart({ actorUserId:'person_a',targetUserId:'person_b',expectedVersion:1,idempotencyKey:'withdraw-after-match' }), RelationshipStateConflictError);
    const unmatched = await relationships.unmatch({ actorUserId:'person_a',matchId:mutual.match?.matchId ?? '',expectedVersion:1,idempotencyKey:'unmatch-0000001' });
    assert.equal(unmatched?.match.status, 'UNMATCHED'); assert.equal(unmatched?.match.conversation.status, 'CLOSED');
    const unmatchReplay = await relationships.unmatch({ actorUserId:'person_a',matchId:mutual.match?.matchId ?? '',expectedVersion:1,idempotencyKey:'unmatch-0000001' });
    assert.equal(unmatchReplay?.replayed, true); assert.equal(unmatchReplay?.match.status, 'UNMATCHED');
    assert.equal(await relationships.getMatch('person_a', mutual.match?.matchId ?? ''), null);
    await assert.rejects(relationships.expressHeart({ actorUserId:'person_a',targetUserId:'person_b',expectedVersion:1,idempotencyKey:'rematch-00000001' }), RelationshipStateConflictError);
  } finally { await database.close(); }
});

test('withdrawal works before match and eligibility and blocks fail closed', async () => {
  const { database, relationships } = await setup();
  try {
    const heart = await relationships.expressHeart({ actorUserId:'person_a',targetUserId:'person_b',expectedVersion:0,idempotencyKey:'heart-a-b-0002' });
    const withdrawn = await relationships.withdrawHeart({ actorUserId:'person_a',targetUserId:'person_b',expectedVersion:heart.heart.version,idempotencyKey:'withdraw-0000001' });
    assert.equal(withdrawn.heart.status, 'WITHDRAWN'); assert.equal(withdrawn.heart.version, 2);
    const withdrawalReplay = await relationships.withdrawHeart({ actorUserId:'person_a',targetUserId:'person_b',expectedVersion:heart.heart.version,idempotencyKey:'withdraw-0000001' });
    assert.equal(withdrawalReplay.replayed, true); assert.equal(withdrawalReplay.heart.status, 'WITHDRAWN');
    await assert.rejects(relationships.expressHeart({ actorUserId:'person_a',targetUserId:'person_c',expectedVersion:0,idempotencyKey:'underage-0000001' }), (error: unknown) => Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'NOT_FOUND'));
    assert.throws(() => relationships.expressHeart({ actorUserId:'person_a',targetUserId:'person_a',expectedVersion:0,idempotencyKey:'self-heart-00001' }), (error: unknown) => Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'VALIDATION_ERROR'));
    await database.query("INSERT INTO user_blocks(blocker_user_id,blocked_user_id,version,event_id,blocked_at) VALUES('person_b','person_a',1,'block_event',clock_timestamp())");
    assert.equal(await relationships.getOutgoingHeart('person_a','person_b'), null);
    await assert.rejects(relationships.expressHeart({ actorUserId:'person_a',targetUserId:'person_b',expectedVersion:2,idempotencyKey:'blocked-00000001' }), (error: unknown) => Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'NOT_FOUND'));
  } finally { await database.close(); }
});

test('expired hearts are mapped without mutating storage and can be renewed', async () => {
  const { database, relationships } = await setup();
  try {
    const first = await relationships.expressHeart({actorUserId:'person_a',targetUserId:'person_b',expectedVersion:0,idempotencyKey:'expiring-heart-01'});
    const later = new RelationshipRepository(database, { now: () => new Date('2026-09-23T12:00:00.000Z') });
    assert.equal((await later.getOutgoingHeart('person_a','person_b'))?.status,'EXPIRED');
    const stored=await database.query<{status:string}>("SELECT status FROM relationship_hearts WHERE actor_user_id='person_a' AND target_user_id='person_b'");
    assert.equal(stored.rows[0]?.status,'ACTIVE');
    const renewed=await later.expressHeart({actorUserId:'person_a',targetUserId:'person_b',expectedVersion:first.heart.version,idempotencyKey:'renewed-heart-01'});
    assert.equal(renewed.changed,true); assert.equal(renewed.heart.status,'ACTIVE'); assert.equal(renewed.heart.version,2);
  } finally { await database.close(); }
});

test('block trigger terminally closes an active match and conversation', async () => {
  const { database, relationships } = await setup();
  try {
    await relationships.expressHeart({actorUserId:'person_a',targetUserId:'person_b',expectedVersion:0,idempotencyKey:'heart-a-b-block'});
    const mutual=await relationships.expressHeart({actorUserId:'person_b',targetUserId:'person_a',expectedVersion:0,idempotencyKey:'heart-b-a-block'});
    await database.query("INSERT INTO user_blocks(blocker_user_id,blocked_user_id,version,event_id,blocked_at) VALUES('person_a','person_b',1,'block_matched',clock_timestamp())");
    const state=await database.query<{match_status:string;match_version:number;conversation_status:string;conversation_version:number}>("SELECT m.status match_status,m.version match_version,c.status conversation_status,c.version conversation_version FROM relationship_matches m JOIN relationship_conversations c ON c.match_id=m.match_id WHERE m.match_id=$1",[mutual.match?.matchId]);
    assert.deepEqual(state.rows[0],{match_status:'BLOCKED',match_version:2,conversation_status:'CLOSED',conversation_version:2});
    const hearts=await database.query<{status:string}>("SELECT status FROM relationship_hearts WHERE pair_key=(SELECT pair_key FROM relationship_matches WHERE match_id=$1) ORDER BY actor_user_id",[mutual.match?.matchId]);
    assert.deepEqual(hearts.rows.map((row)=>row.status),['EXPIRED','EXPIRED']);
    assert.equal(await relationships.getMatch('person_a',mutual.match?.matchId??''),null);
    await database.query("DELETE FROM user_blocks WHERE blocker_user_id='person_a' AND blocked_user_id='person_b'");
    await assert.rejects(relationships.expressHeart({actorUserId:'person_a',targetUserId:'person_b',expectedVersion:1,idempotencyKey:'blocked-rematch-1'}),RelationshipStateConflictError);
  } finally { await database.close(); }
});

test('block repository invalidates pre-block intent and unblocking cannot resurrect it', async () => {
  const { database, relationships } = await setup();
  try {
    const blocks = new BlockRepository(database);
    await relationships.expressHeart({actorUserId:'person_a',targetUserId:'person_b',expectedVersion:0,idempotencyKey:'heart-before-block'});
    await blocks.set({blockerUserId:'person_b',blockedUserId:'person_a',expectedVersion:0,idempotencyKey:'block-before-match'});
    const invalidated=await database.query<{status:string;version:number}>("SELECT status,version FROM relationship_hearts WHERE actor_user_id='person_a' AND target_user_id='person_b'");
    assert.deepEqual(invalidated.rows[0],{status:'EXPIRED',version:2});
    const neutral=await database.query<{event_type:string;actor_user_id:string}>("SELECT event_type,actor_user_id FROM domain_events WHERE owner_user_id='person_a' AND event_type='heart.invalidated'");
    assert.deepEqual(neutral.rows[0],{event_type:'heart.invalidated',actor_user_id:'person_a'});
    await blocks.remove({blockerUserId:'person_b',blockedUserId:'person_a',expectedVersion:1,idempotencyKey:'unblock-after-heart'});
    const reverse=await relationships.expressHeart({actorUserId:'person_b',targetUserId:'person_a',expectedVersion:0,idempotencyKey:'heart-after-unblock'});
    assert.equal(reverse.match,undefined);
  } finally { await database.close(); }
});
