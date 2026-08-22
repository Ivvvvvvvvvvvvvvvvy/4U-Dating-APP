import assert from 'node:assert/strict';
import test from 'node:test';

import type { QueryResult, QueryResultRow } from 'pg';

import { HealthRepository } from './health.js';
import type { SqlExecutor } from './pool.js';

function result<Row extends QueryResultRow>(rows: Row[]): QueryResult<Row> {
  return { command: 'SELECT', rowCount: rows.length, oid: 0, rows, fields: [] };
}

test('readiness requires sentinel tables from every current migration', async () => {
  let sql = '';
  const executor: SqlExecutor = {
    async query<Row extends QueryResultRow>(text: string) {
      sql = text;
      return result([{ ready: true }] as unknown as Row[]);
    },
  };

  assert.equal(await new HealthRepository(executor).ready(), true);
  assert.match(sql, /domain_events/);
  assert.match(sql, /relationship_commands/);
  assert.equal(sql.includes('COUNT(*) = 2'), true);
});
