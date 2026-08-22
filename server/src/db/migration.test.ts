import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('initial schema makes events immutable and stream ownership explicit', async () => {
  const sql = await readFile(new URL('../../migrations/0001_initial.sql', import.meta.url), 'utf8');
  assert.match(sql, /CREATE TRIGGER domain_events_are_append_only/);
  assert.match(sql, /PRIMARY KEY \(owner_user_id, aggregate_type, aggregate_id\)/);
  assert.match(sql, /CONSTRAINT domain_events_owner_event_unique UNIQUE \(owner_user_id, event_id\)/);
});

test('initial schema persists guarded recommendation artifacts, jobs, feedback, and blocks', async () => {
  const sql = await readFile(new URL('../../migrations/0001_initial.sql', import.meta.url), 'utf8');
  for (const table of [
    'profiles',
    'consents',
    'user_blocks',
    'recommendation_results',
    'recommendation_jobs',
    'recommendation_feedback',
  ]) {
    assert.match(sql, new RegExp(`CREATE TABLE ${table}`));
  }
  assert.match(sql, /request_hash char\(64\) NOT NULL/);
  assert.match(sql, /CHECK \(left_user_id <> right_user_id\)/);
});

test('relationship schema enforces pair uniqueness, private directional hearts, and block closure', async () => {
  const sql = await readFile(new URL('../../migrations/0002_relationships.sql', import.meta.url), 'utf8');
  for (const table of [
    'relationship_pairs',
    'relationship_hearts',
    'relationship_matches',
    'relationship_conversations',
    'relationship_commands',
  ]) {
    assert.match(sql, new RegExp(`CREATE TABLE ${table}`));
  }
  assert.match(sql, /PRIMARY KEY \(actor_user_id, target_user_id\)/);
  assert.match(sql, /pair_key text NOT NULL UNIQUE REFERENCES relationship_pairs/);
  assert.match(sql, /match_id text NOT NULL UNIQUE REFERENCES relationship_matches/);
  assert.match(sql, /PRIMARY KEY \(actor_user_id, idempotency_key\)/);
  assert.match(sql, /CREATE TRIGGER user_blocks_close_relationship/);
  assert.match(sql, /BEFORE INSERT OR UPDATE ON user_blocks/);
});
