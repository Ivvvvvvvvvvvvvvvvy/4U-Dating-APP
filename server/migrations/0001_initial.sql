CREATE TABLE aggregate_heads (
  owner_user_id text NOT NULL,
  aggregate_type text NOT NULL,
  aggregate_id text NOT NULL,
  version bigint NOT NULL DEFAULT 0 CHECK (version >= 0),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (owner_user_id, aggregate_type, aggregate_id)
);

CREATE TABLE event_batches (
  batch_id uuid PRIMARY KEY,
  owner_user_id text NOT NULL,
  actor_user_id text NOT NULL,
  idempotency_key text NOT NULL,
  request_hash char(64) NOT NULL,
  response jsonb CHECK (response IS NULL OR jsonb_typeof(response) = 'object'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  completed_at timestamptz,
  UNIQUE (owner_user_id, idempotency_key)
);

CREATE TABLE domain_events (
  global_position bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id text NOT NULL,
  batch_id uuid NOT NULL REFERENCES event_batches(batch_id),
  batch_index integer NOT NULL CHECK (batch_index >= 0),
  aggregate_type text NOT NULL,
  aggregate_id text NOT NULL,
  owner_user_id text NOT NULL,
  aggregate_version bigint NOT NULL CHECK (aggregate_version > 0),
  event_type text NOT NULL,
  actor_user_id text NOT NULL,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (batch_id, batch_index),
  CONSTRAINT domain_events_owner_event_unique UNIQUE (owner_user_id, event_id),
  UNIQUE (owner_user_id, aggregate_type, aggregate_id, aggregate_version)
);

CREATE INDEX domain_events_aggregate_idx
  ON domain_events (owner_user_id, aggregate_type, aggregate_id, aggregate_version);
CREATE INDEX domain_events_owner_idx ON domain_events (owner_user_id, global_position);

CREATE FUNCTION reject_domain_event_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'domain_events is append-only' USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER domain_events_are_append_only
BEFORE UPDATE OR DELETE ON domain_events
FOR EACH ROW EXECUTE FUNCTION reject_domain_event_mutation();

CREATE TABLE profiles (
  user_id text PRIMARY KEY,
  version bigint NOT NULL CHECK (version > 0),
  data jsonb NOT NULL CHECK (jsonb_typeof(data) = 'object'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX profiles_status_idx ON profiles ((data ->> 'profileStatus'));

CREATE TABLE consents (
  user_id text PRIMARY KEY,
  version bigint NOT NULL CHECK (version > 0),
  data jsonb NOT NULL CHECK (jsonb_typeof(data) = 'object'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE user_blocks (
  blocker_user_id text NOT NULL,
  blocked_user_id text NOT NULL,
  version bigint NOT NULL CHECK (version > 0),
  event_id text NOT NULL,
  blocked_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (blocker_user_id, blocked_user_id),
  CHECK (blocker_user_id <> blocked_user_id),
  UNIQUE (event_id)
);

CREATE INDEX user_blocks_reverse_idx ON user_blocks (blocked_user_id, blocker_user_id);

CREATE TABLE recommendation_results (
  result_id text PRIMARY KEY,
  pair_key text NOT NULL,
  left_user_id text NOT NULL,
  right_user_id text NOT NULL,
  viewer_user_id text NOT NULL,
  candidate_user_id text NOT NULL,
  left_profile_version bigint NOT NULL CHECK (left_profile_version >= 0),
  right_profile_version bigint NOT NULL CHECK (right_profile_version >= 0),
  left_consent_version bigint NOT NULL CHECK (left_consent_version >= 0),
  right_consent_version bigint NOT NULL CHECK (right_consent_version >= 0),
  rules_version text NOT NULL,
  model_version text NOT NULL,
  prompt_version text NOT NULL,
  score smallint CHECK (score BETWEEN 0 AND 100),
  display_mode text NOT NULL CHECK (display_mode IN ('numeric', 'common_points', 'insufficient')),
  evidence_count integer NOT NULL CHECK (evidence_count >= 0),
  core_evidence_count integer NOT NULL CHECK (core_evidence_count >= 0),
  evidence_ids jsonb NOT NULL CHECK (jsonb_typeof(evidence_ids) = 'array'),
  explanation jsonb NOT NULL CHECK (jsonb_typeof(explanation) = 'object'),
  artifact_hash char(64) NOT NULL,
  source text NOT NULL CHECK (source IN ('ai', 'rule_fallback')),
  validation_status text NOT NULL CHECK (validation_status IN ('approved', 'fallback', 'rejected')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'stale')),
  stale_reason text,
  generated_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (left_user_id <> right_user_id),
  CHECK (viewer_user_id <> candidate_user_id),
  CHECK (
    (viewer_user_id = left_user_id AND candidate_user_id = right_user_id)
    OR (viewer_user_id = right_user_id AND candidate_user_id = left_user_id)
  ),
  CHECK (
    (display_mode = 'numeric' AND score IS NOT NULL)
    OR (display_mode <> 'numeric' AND score IS NULL)
  ),
  CHECK (core_evidence_count <= evidence_count),
  CHECK (display_mode <> 'numeric' OR (evidence_count >= 3 AND core_evidence_count >= 1)),
  CHECK (expires_at > generated_at)
);

CREATE INDEX recommendation_results_viewer_idx
  ON recommendation_results (viewer_user_id, result_id);
CREATE INDEX recommendation_results_fresh_lookup_idx
  ON recommendation_results (
    pair_key, viewer_user_id, candidate_user_id, left_profile_version, right_profile_version,
    left_consent_version, right_consent_version, rules_version, model_version, prompt_version,
    generated_at DESC
  ) WHERE status = 'active';
CREATE INDEX recommendation_results_left_user_idx
  ON recommendation_results (left_user_id) WHERE status = 'active';
CREATE INDEX recommendation_results_right_user_idx
  ON recommendation_results (right_user_id) WHERE status = 'active';

CREATE TABLE recommendation_jobs (
  job_id text PRIMARY KEY,
  dedupe_key text NOT NULL,
  left_user_id text NOT NULL,
  right_user_id text NOT NULL,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'succeeded', 'fallback', 'failed', 'stale')),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  request_hash char(64) NOT NULL,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts integer NOT NULL DEFAULT 3 CHECK (max_attempts > 0),
  available_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  lease_expires_at timestamptz,
  worker_id text,
  result_id text REFERENCES recommendation_results(result_id) ON DELETE SET NULL,
  last_error_code text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (left_user_id <> right_user_id)
);


CREATE INDEX recommendation_jobs_claim_idx
  ON recommendation_jobs (available_at, created_at)
  WHERE status IN ('queued', 'running');
CREATE UNIQUE INDEX recommendation_jobs_active_dedupe_idx
  ON recommendation_jobs (dedupe_key) WHERE status IN ('queued', 'running');
CREATE INDEX recommendation_jobs_left_user_idx
  ON recommendation_jobs (left_user_id) WHERE status IN ('queued', 'running');
CREATE INDEX recommendation_jobs_right_user_idx
  ON recommendation_jobs (right_user_id) WHERE status IN ('queued', 'running');

CREATE TABLE recommendation_feedback (
  feedback_id text PRIMARY KEY,
  result_id text NOT NULL REFERENCES recommendation_results(result_id),
  viewer_user_id text NOT NULL,
  idempotency_key text NOT NULL,
  request_hash char(64) NOT NULL,
  kind text NOT NULL CHECK (kind IN (
    'INACCURATE_REASON', 'UNCOMFORTABLE', 'DO_NOT_USE_MY_FACT', 'NOT_HELPFUL'
  )),
  evidence_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(details) = 'object'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (viewer_user_id, idempotency_key)
);

CREATE INDEX recommendation_feedback_result_idx
  ON recommendation_feedback (result_id, created_at);
