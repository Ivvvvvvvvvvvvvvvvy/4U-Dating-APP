import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { PGlite, type PGliteInterface, type Transaction } from '@electric-sql/pglite';
import type { QueryResult, QueryResultRow } from 'pg';

import type { Database, SqlExecutor } from './pool.js';
import { createRepositories } from './index.js';

function toQueryResult<Row extends QueryResultRow>(result: {
  rows: unknown[];
  rowCount?: number;
  command?: string;
}): QueryResult<Row> {
  return {
    command: result.command ?? 'UNKNOWN',
    rowCount: result.rowCount ?? result.rows.length,
    oid: 0,
    rows: result.rows as Row[],
    fields: [],
  };
}

function executorFor(connection: Pick<PGliteInterface, 'query'> | Pick<Transaction, 'query'>): SqlExecutor {
  return {
    async query<Row extends QueryResultRow>(text: string, values: readonly unknown[] = []) {
      return toQueryResult<Row>(await connection.query(text, [...values]));
    },
  };
}

function databaseFor(postgres: PGlite): Database {
  const executor = executorFor(postgres);
  return {
    query: executor.query,
    transaction: (operation) => postgres.transaction((transaction) =>
      operation(executorFor(transaction))),
    close: () => postgres.close(),
  };
}

test('migration and core persistence flows execute against PostgreSQL', async () => {
  const postgres = new PGlite();
  const database = databaseFor(postgres);
  try {
    await postgres.exec(await readFile(new URL('../../migrations/0001_initial.sql', import.meta.url), 'utf8'));
    await postgres.exec(await readFile(new URL('../../migrations/0002_relationships.sql', import.meta.url), 'utf8'));
    const repositories = createRepositories(database);

    const first = await repositories.events.appendBatch({
      userId: 'person_a',
      idempotencyKey: 'event-batch-0001',
      events: [{
        eventId: 'event_1',
        aggregateType: 'profile_note',
        aggregateId: 'note_1',
        expectedVersion: 0,
        eventType: 'note.created',
        payload: { text: 'private' },
      }],
    });
    assert.equal(first.events[0]?.aggregateVersion, 1);
    assert.equal((await repositories.events.appendBatch({
      userId: 'person_a',
      idempotencyKey: 'event-batch-0001',
      events: [{
        eventId: 'event_1',
        aggregateType: 'profile_note',
        aggregateId: 'note_1',
        expectedVersion: 0,
        eventType: 'note.created',
        payload: { text: 'private' },
      }],
    })).replayed, true);
    assert.equal((await repositories.events.readAfter({ userId: 'person_b' })).length, 0);
    assert.equal((await repositories.events.readAfter({ userId: 'person_a' })).length, 1);

    const profile = await repositories.profiles.updateByUserId({
      userId: 'person_a',
      expectedVersion: 0,
      idempotencyKey: 'profile-write-0001',
      data: {
        displayName: 'A', profileStatus: 'RECOMMENDABLE', interests: ['walking'],
        photos: [], prompts: [], attributes: {},
      },
    });
    assert.equal(profile.version, 1);

    const block = await repositories.blocks.set({
      blockerUserId: 'person_a',
      blockedUserId: 'person_b',
      expectedVersion: 0,
      idempotencyKey: 'block-write-0001',
    });
    assert.equal(block.version, 1);
    assert.equal(await repositories.blocks.isBlockedEither('person_b', 'person_a'), true);
    assert.deepEqual(await repositories.blocks.remove({
      blockerUserId: 'person_a',
      blockedUserId: 'person_b',
      expectedVersion: 1,
      idempotencyKey: 'block-write-0002',
    }), { removed: true, version: 2 });
    assert.equal(await repositories.blocks.isBlockedEither('person_a', 'person_b'), false);
  } finally {
    await database.close();
  }
});
