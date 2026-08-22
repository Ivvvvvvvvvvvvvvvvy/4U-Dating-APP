CREATE TABLE relationship_pairs (
  pair_key text PRIMARY KEY,
  left_user_id text NOT NULL,
  right_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (left_user_id <> right_user_id),
  UNIQUE (left_user_id, right_user_id)
);

CREATE TABLE relationship_hearts (
  actor_user_id text NOT NULL,
  target_user_id text NOT NULL,
  pair_key text NOT NULL REFERENCES relationship_pairs(pair_key),
  version bigint NOT NULL CHECK (version > 0),
  status text NOT NULL CHECK (status IN ('ACTIVE', 'WITHDRAWN', 'EXPIRED')),
  expressed_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  withdrawn_at timestamptz,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (actor_user_id, target_user_id),
  CHECK (actor_user_id <> target_user_id),
  CHECK (expires_at > expressed_at),
  CHECK (
    (status = 'ACTIVE' AND withdrawn_at IS NULL)
    OR (status = 'WITHDRAWN' AND withdrawn_at IS NOT NULL)
    OR status = 'EXPIRED'
  )
);

CREATE INDEX relationship_hearts_pair_idx
  ON relationship_hearts (pair_key);
CREATE INDEX relationship_hearts_actor_idx
  ON relationship_hearts (actor_user_id, updated_at DESC, target_user_id);
CREATE INDEX relationship_hearts_reverse_active_idx
  ON relationship_hearts (target_user_id, actor_user_id, expires_at)
  WHERE status = 'ACTIVE';

CREATE TABLE relationship_matches (
  match_id text PRIMARY KEY,
  pair_key text NOT NULL UNIQUE REFERENCES relationship_pairs(pair_key),
  left_user_id text NOT NULL,
  right_user_id text NOT NULL,
  version bigint NOT NULL CHECK (version > 0),
  status text NOT NULL CHECK (status IN ('ACTIVE', 'UNMATCHED', 'BLOCKED')),
  matched_at timestamptz NOT NULL,
  unmatched_at timestamptz,
  blocked_at timestamptz,
  updated_at timestamptz NOT NULL,
  CHECK (match_id LIKE 'match_%'),
  CHECK (left_user_id <> right_user_id),
  CHECK (
    (status = 'ACTIVE' AND unmatched_at IS NULL AND blocked_at IS NULL)
    OR (status = 'UNMATCHED' AND unmatched_at IS NOT NULL AND blocked_at IS NULL)
    OR (status = 'BLOCKED' AND unmatched_at IS NULL AND blocked_at IS NOT NULL)
  )
);

CREATE INDEX relationship_matches_left_active_idx
  ON relationship_matches (left_user_id, matched_at DESC, match_id)
  WHERE status = 'ACTIVE';
CREATE INDEX relationship_matches_right_active_idx
  ON relationship_matches (right_user_id, matched_at DESC, match_id)
  WHERE status = 'ACTIVE';

CREATE TABLE relationship_conversations (
  thread_id text PRIMARY KEY,
  match_id text NOT NULL UNIQUE REFERENCES relationship_matches(match_id),
  pair_key text NOT NULL UNIQUE REFERENCES relationship_pairs(pair_key),
  version bigint NOT NULL CHECK (version > 0),
  status text NOT NULL CHECK (status IN ('CREATING', 'READY', 'CLOSED')),
  created_at timestamptz NOT NULL,
  ready_at timestamptz,
  closed_at timestamptz,
  updated_at timestamptz NOT NULL,
  CHECK (thread_id LIKE 'thread_%'),
  CHECK (
    (status = 'CREATING' AND ready_at IS NULL AND closed_at IS NULL)
    OR (status = 'READY' AND ready_at IS NOT NULL AND closed_at IS NULL)
    OR (status = 'CLOSED' AND closed_at IS NOT NULL)
  )
);

CREATE TABLE relationship_commands (
  actor_user_id text NOT NULL,
  idempotency_key text NOT NULL,
  command_id uuid NOT NULL UNIQUE,
  command_type text NOT NULL CHECK (command_type IN (
    'EXPRESS_HEART', 'WITHDRAW_HEART', 'UNMATCH'
  )),
  request_hash char(64) NOT NULL,
  response jsonb CHECK (response IS NULL OR jsonb_typeof(response) = 'object'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  completed_at timestamptz,
  PRIMARY KEY (actor_user_id, idempotency_key),
  CHECK (
    (completed_at IS NULL AND response IS NULL)
    OR (completed_at IS NOT NULL AND response IS NOT NULL)
  )
);

-- Blocking is a terminal relationship transition. This database guard keeps the
-- existing BlockRepository safe even when the block command does not call the
-- relationship repository. The pair row is the shared lock used by heart,
-- unmatch, and block paths, so opposite operations cannot commit out of order.
CREATE FUNCTION close_relationship_on_user_block() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  blocked_pair_key text;
  transitioned_at timestamptz := clock_timestamp();
BEGIN
  -- Cover the short interval before a canonical pair row exists.
  PERFORM pg_advisory_xact_lock(
    LEAST(hashtext(NEW.blocker_user_id), hashtext(NEW.blocked_user_id)),
    GREATEST(hashtext(NEW.blocker_user_id), hashtext(NEW.blocked_user_id))
  );

  SELECT pair_key
    INTO blocked_pair_key
    FROM relationship_pairs
   WHERE (left_user_id = NEW.blocker_user_id AND right_user_id = NEW.blocked_user_id)
      OR (left_user_id = NEW.blocked_user_id AND right_user_id = NEW.blocker_user_id)
   LIMIT 1;

  IF blocked_pair_key IS NULL THEN
    -- No relationship state exists to close. Heart creation inserts and locks
    -- this row before checking user_blocks, so a later heart still sees NEW.
    RETURN NEW;
  END IF;

  PERFORM 1 FROM relationship_pairs
   WHERE pair_key = blocked_pair_key
   FOR UPDATE;

  -- Defense in depth for maintenance writes that bypass BlockRepository. The
  -- normal API path first appends neutral owner-scoped invalidation events.
  UPDATE relationship_hearts
     SET status = 'EXPIRED',
         version = version + 1,
         updated_at = transitioned_at
   WHERE pair_key = blocked_pair_key
     AND status = 'ACTIVE';

  UPDATE relationship_matches
     SET status = 'BLOCKED',
         version = version + 1,
         blocked_at = transitioned_at,
         updated_at = transitioned_at
   WHERE pair_key = blocked_pair_key
     AND status = 'ACTIVE';

  UPDATE relationship_conversations
     SET status = 'CLOSED',
         version = version + 1,
         closed_at = transitioned_at,
         updated_at = transitioned_at
   WHERE pair_key = blocked_pair_key
     AND status IN ('CREATING', 'READY');

  RETURN NEW;
END;
$$;

CREATE TRIGGER user_blocks_close_relationship
BEFORE INSERT OR UPDATE ON user_blocks
FOR EACH ROW EXECUTE FUNCTION close_relationship_on_user_block();
