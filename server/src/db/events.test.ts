import assert from 'node:assert/strict';
import test from 'node:test';

import type { QueryResult, QueryResultRow } from 'pg';

import type { SqlExecutor } from './pool.js';
import { EventStore } from './events.js';

function emptyResult<Row extends QueryResultRow>(): QueryResult<Row> {
  return {
    command: 'SELECT',
    rowCount: 0,
    oid: 0,
    rows: [],
    fields: [],
  };
}

test('incremental event reads always bind the owner before cursor and filters', async () => {
  let captured: { text: string; values: readonly unknown[] } | undefined;
  const executor: SqlExecutor = {
    async query<Row extends QueryResultRow>(text: string, values: readonly unknown[] = []) {
      captured = { text, values };
      return emptyResult<Row>();
    },
  };

  const events = await new EventStore(executor).readAfter({
    userId: 'person_owner',
    cursor: '42',
    limit: 20,
    aggregateType: 'profile',
  });

  assert.deepEqual(events, []);
  assert.match(captured?.text ?? '', /WHERE owner_user_id = \$1/);
  assert.deepEqual(captured?.values, ['person_owner', '42', 'profile', null, 20]);
});
