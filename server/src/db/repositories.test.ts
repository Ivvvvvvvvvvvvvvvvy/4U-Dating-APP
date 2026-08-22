import assert from 'node:assert/strict';
import test from 'node:test';

import type { QueryResult, QueryResultRow } from 'pg';

import type { Database, SqlExecutor } from './pool.js';
import { BlockRepository } from './blocks.js';
import { RecommendationRepository } from './recommendations.js';
import type { RecommendationResultWrite } from '../types/index.js';

function queryResult<Row extends QueryResultRow>(rows: Row[]): QueryResult<Row> {
  return { command: 'SELECT', rowCount: rows.length, oid: 0, rows, fields: [] };
}

function fakeDatabase(
  query: SqlExecutor['query'],
): Database {
  return {
    query,
    transaction: (operation) => operation({ query }),
    close: async () => undefined,
  };
}

const resultWrite: RecommendationResultWrite = {
  resultId: 'rec_generated',
  pairKey: '8:person_a|8:person_b',
  leftUserId: 'person_a',
  rightUserId: 'person_b',
  viewerUserId: 'person_a',
  candidateUserId: 'person_b',
  leftProfileVersion: 1,
  rightProfileVersion: 2,
  leftConsentVersion: 3,
  rightConsentVersion: 4,
  rulesVersion: 'rules-v1',
  modelVersion: 'model-v1',
  promptVersion: 'prompt-v1',
  score: 80,
  displayMode: 'numeric',
  evidenceCount: 3,
  coreEvidenceCount: 1,
  evidenceIds: ['ev_1', 'ev_2', 'ev_3'],
  explanation: { schemaVersion: '1.0' },
  source: 'ai',
  validationStatus: 'approved',
  generatedAt: '2026-08-22T00:00:00.000Z',
  expiresAt: '2026-08-23T00:00:00.000Z',
};

test('job completion fences the active lease before persisting an artifact', async () => {
  const statements: string[] = [];
  const database = fakeDatabase(async <Row extends QueryResultRow>(text: string) => {
    statements.push(text);
    return queryResult<Row>([]);
  });

  await assert.rejects(
    new RecommendationRepository(database).completeJobWithResult(
      'job_1',
      'worker_1',
      resultWrite,
    ),
    (error: unknown) => Boolean(
      error && typeof error === 'object' && 'code' in error && error.code === 'LEASE_LOST',
    ),
  );
  assert.equal(statements.length, 1);
  assert.match(statements[0] ?? '', /lease_expires_at >= clock_timestamp()/);
});

test('bilateral block checks query both directions', async () => {
  let captured: { text: string; values: readonly unknown[] } | undefined;
  const database = fakeDatabase(async <Row extends QueryResultRow>(
    text: string,
    values: readonly unknown[] = [],
  ) => {
    captured = { text, values };
    return queryResult([{ blocked: true }] as unknown as Row[]);
  });

  assert.equal(
    await new BlockRepository(database).isBlockedEither('person_a', 'person_b'),
    true,
  );
  assert.match(captured?.text ?? '', /blocker_user_id = \$2 AND blocked_user_id = \$1/);
  assert.deepEqual(captured?.values, ['person_a', 'person_b']);
});

test('job dedupe verifies a stable request hash', async () => {
  let call = 0;
  const database = fakeDatabase(async <Row extends QueryResultRow>() => {
    call += 1;
    if (call === 1) return queryResult<Row>([]);
    return queryResult([{
      job_id: 'job_existing',
      dedupe_key: 'dedupe_key',
      left_user_id: 'person_a',
      right_user_id: 'person_b',
      status: 'queued',
      payload: {},
      attempts: 0,
      max_attempts: 3,
      available_at: new Date(),
      lease_expires_at: null,
      worker_id: null,
      result_id: null,
      last_error_code: null,
      created_at: new Date(),
      updated_at: new Date(),
      request_hash: 'different-request',
    }] as unknown as Row[]);
  });

  await assert.rejects(
    new RecommendationRepository(database).enqueueJob({
      dedupeKey: 'dedupe_key',
      leftUserId: 'person_a',
      rightUserId: 'person_b',
      payload: {},
    }),
    (error: unknown) => Boolean(
      error && typeof error === 'object' && 'code' in error && error.code === 'IDEMPOTENCY_CONFLICT',
    ),
  );
});
