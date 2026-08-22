# 4U server architecture

## Scope and deployment boundary

The 4U browser application remains a static Vite bundle hosted by GitHub Pages. The backend is an independently deployed Node 22 service. GitHub Pages receives only a public API base URL; database credentials, identity-provider configuration, and OpenAI credentials exist exclusively in backend runtime secret stores.

The implemented backend foundation covers profiles, AI consent, append-only events, blocks, private outgoing hearts, unique mutual matches/conversations, deterministic compatibility results, asynchronous recommendation jobs, feedback, auth, CORS, rate limiting, and health checks. It is not yet a complete backend for every frontend activity, topic, message, or moderation flow.

```text
                         public Internet
                               |
                         HTTPS :443 only
                               v
                  reverse proxy / load balancer
                    |                      |
                    | /v1, /health, /ready| exact-origin CORS
                    v                      v
              Fastify API             static 4U SPA
                 :3000                 GitHub Pages
                    |
          +---------+-------------------+
          |                             |
          v                             v
      PostgreSQL <--- leased jobs --- AI worker --- HTTPS ---> OpenAI Responses API
          ^                             |
          +------ validated result -----+

External JWT issuer ---- HTTPS JWKS ----> Fastify API
```

API and worker use the same immutable image and schema version but run as separate processes. They share only the non-secret AI rollout flag and model/prompt/rules identities; the provider key and transport settings are injected into the worker only. A one-shot migration job must finish before either receives work. The local Compose stack models that ordering with PostgreSQL, migration, API, and worker services; production should use the equivalent release-job and rollout primitives of its orchestrator.

## Runtime components

### Fastify API

The API owns transport validation, bearer authentication, viewer identity, per-user authorization, CORS, request size/rate limits, request IDs, and stable error mapping. Public endpoints are limited to `GET /health` and `GET /ready`; application endpoints live under `/v1` and require a bearer token.

`allowedActions` and any viewer-scoped recommendation result remain server decisions. A browser-provided user ID, profile status, entity version, or UI state is never authorization evidence. Cross-viewer recommendation lookups deliberately return the same neutral `404` as missing results.

### PostgreSQL

PostgreSQL is the source of truth and the initial durable job queue. Migration `0001_initial.sql` creates:

- `schema_migrations`: applied filename/checksum history.
- `aggregate_heads`, `event_batches`, and append-only `domain_events`: owner-scoped optimistic versions, retry-safe batches, and event audit history.
- `profiles` and `consents`: current versioned JSON projections.
- `recommendation_results`: viewer-scoped, version-bound deterministic or AI-refined artifacts.
- `recommendation_jobs`: deduplicated queue rows with attempts, availability, worker leases, and failure state.
- `recommendation_feedback`: viewer-owned, idempotent feedback.
- `relationship_pairs`, `relationship_hearts`, `relationship_matches`, and `relationship_conversations`: a canonical pair lock, directional private intent, and unique mutual relationship projections.
- `relationship_commands`: actor-scoped idempotent relationship command receipts.

Profile or consent updates mark associated recommendation results/jobs stale in the same database transaction. Reads must still verify viewer ownership and freshness; cache eviction or job cancellation alone is not an authorization boundary.

### Recommendation engine and AI worker

Eligibility and score calculation are deterministic server code. Eligibility applies adult, account/profile status, verification, bilateral preferences, consent, and block gates before scoring. The score uses only bilateral, current, purpose-authorized evidence. Missing dimensions are excluded from the denominator; a numeric score requires at least three independent sources and at least one relationship, lifestyle, or communication source. Zodiac has zero numerical weight and MBTI has limited influence.

The model does not choose candidates, apply hard filters, or calculate the score. The asynchronous flow is:

1. The authenticated viewer requests a result with `candidateId` and locale.
2. The API loads authoritative profiles and consents, checks eligibility, projects an allowlist of safe evidence, calculates a deterministic result, persists a safe fallback, and optionally enqueues a deduplicated refinement job. It decides whether to queue exclusively from the non-secret `AI_REFINEMENT_ENABLED` switch and never constructs a provider.
3. A worker claims one row using a bounded lease. When refinement is enabled, it requires the worker-only `OPENAI_API_KEY`, constructs the provider, and sends only allowlisted evidence labels/IDs to the Responses API with `store: false`. When disabled, it neither requires nor retains provider transport configuration.
4. Strict-schema output is parsed and then independently checked for known evidence IDs, dimension agreement, grounded claims, and prohibited sensitive or certainty claims.
5. Only validated output replaces/refines the persisted artifact. Timeout, provider errors, malformed output, or policy failures preserve a rule-based fallback instead of blocking the user-facing path.

Every artifact binds pair direction, viewer/candidate, profile versions, consent versions, rules version, model version, prompt version, evidence IDs, validation outcome, and expiry. The API and worker receive the same non-secret model/prompt/rules identity so a queued job and its completed result stay consistent. The default model is `gpt-5.6-sol`, and deployments may override it with `OPENAI_MODEL`. The symmetric pair score and viewer-directional explanation are kept distinct.

## HTTP and trust boundaries

### Authentication

Local development uses one timing-safe compared bearer token mapped to `DEV_USER_ID`. This is deliberately incapable of representing a public multi-user system. Production sets `NODE_ENV=production` and `AUTH_MODE=jwt`; startup rejects development auth in production. JWT verification is fail-closed and validates an RS256 signature from the configured HTTPS JWKS set plus issuer, audience, subject, expiration, and not-before.

The static cross-origin frontend should hold only a short-lived access token in memory and send it in the `Authorization` header. Do not store refresh tokens or provider secrets in browser storage. If a future same-site cookie design is introduced, it also needs `Secure`, `HttpOnly`, appropriate `SameSite`, credentialed CORS, and CSRF protection; the present API intentionally configures `credentials: false`.

### CORS

`CORS_ALLOWED_ORIGINS` is a comma-separated exact allowlist. An empty list denies browser CORS. For GitHub Pages, the origin is `https://happyeye1.github.io`; `/4U/` is a path and must not be appended to the origin. CORS controls browser access only—it does not authenticate callers and does not protect the API from non-browser clients.

### Reverse proxy and HTTPS

The API listens on its internal port and should not be directly Internet-addressable. The edge proxy terminates TLS, redirects plaintext HTTP, applies request/body/time bounds, and forwards requests to Fastify. Set `TRUST_PROXY=true` only when the network prevents bypass and the proxy overwrites `X-Forwarded-*`; otherwise spoofed headers could weaken IP-based rate limiting and audit data. PostgreSQL and the worker have no public listener.

Rate limiting is defense in depth. Production should enforce both edge limits and application per-user/IP limits, and should use a shared limiter if multiple API replicas must observe one global budget.

## Reliability and operations

### Health contract

- `GET /health`: liveness. It confirms that the Fastify process can answer and must not depend on PostgreSQL or OpenAI. Restart the process when this fails.
- `GET /ready`: readiness. It checks required dependencies and verifies sentinel tables from both current migrations (`domain_events` and `relationship_commands`). Remove the instance from traffic on `503`; do not necessarily restart it immediately.

OpenAI is intentionally not a readiness dependency because deterministic fallback keeps the base path available. A worker needs separate supervision based on process state, queue lease progress, and oldest queued-job age; an API health response cannot prove worker health.

Suggested rollout order:

1. Build and scan one immutable image.
2. Back up the database and run the image's one-shot migration command.
3. Verify migration success and database readiness.
4. Roll API replicas and wait for `/ready`.
5. Roll worker replicas and verify queue claims/completions.
6. Smoke-test an authenticated read, an idempotent write retry, and deterministic fallback.
7. Enable AI generation only after queue, cost, validation, and fallback metrics are healthy.

Graceful shutdown should stop accepting traffic, stop claiming jobs, finish or release the active lease, close the PostgreSQL pool, and exit before the orchestrator grace period ends. An enabled worker enforces `WORKER_LEASE_MS > OPENAI_TIMEOUT_MS * OPENAI_MAX_ATTEMPTS + 2000 * (OPENAI_MAX_ATTEMPTS - 1) + WORKER_COMPLETION_MARGIN_MS`; the retry term covers the maximum provider backoff and the margin reserves time for validation, final authority reads, and the fenced database completion. The defaults protect `31000ms` with a `60000ms` lease. Autoscaling must respect PostgreSQL connection budgets: `(API replicas + worker replicas + release jobs) x DATABASE_POOL_MAX` must fit below the database limit with headroom.

### Observability without leaking user data

Correlate edge and application logs with `X-Request-Id`. Record route, status, latency, queue age, attempt/outcome, validation reason, provider request ID, token usage, and model/prompt/rules versions. Do not log authorization headers, database URLs, raw profile/consent JSON, precise birth/location data, evidence labels, full prompts, or generated prose in normal application logs. Metrics should include readiness, request/error/rate-limit rates, pool saturation, migration failures, queue depth/age, lease expiry, job exhaustion, provider latency/status, validation rejection, fallback, and cost.

### Backups and disaster recovery

Production should use encrypted automated snapshots and point-in-time recovery, plus copies in an independent failure domain. Define RPO, RTO, retention, ownership, and an incident restore runbook. Restore into an isolated database on a schedule, run migrations/readiness checks against it, and verify representative profiles, event sequence/version invariants, consent invalidation, recommendation ownership, and job state.

The append-only event store improves auditability but is not a backup. Backups must cover every table, and access/deletion procedures must account for sensitive profile and consent data.

## Security and privacy invariants

- No database, JWT, development bearer, or OpenAI secret is included in Git, a browser bundle, an image layer, or a client response.
- `OPENAI_API_KEY` is worker-only; no `VITE_OPENAI_API_KEY` exists, and the API process neither reads nor retains it. The API uses the non-secret `AI_REFINEMENT_ENABLED` switch to enqueue refinement. Changing the worker's `OPENAI_BASE_URL` changes who receives the key and evidence, so it requires a security review.
- OpenAI requests always use `store: false`; profile text is untrusted data rather than instructions.
- Public/profile DTOs exclude incoming one-way hearts, internal rank signals, exact meeting points, candidate filters, and unauthorized participant/evidence data. Relationship APIs expose only the caller's outgoing hearts; a counterpart becomes visible through this domain only after a mutual match exists.
- Consent is checked by purpose and on both sides. Eligibility, ranking, score display, and explanation permissions are not interchangeable.
- Profile/consent version changes immediately stale prior results and queued work.
- Every write is reauthorized on the server. Versioned aggregate writes also use optimistic concurrency; `Idempotency-Key` makes retries safe but does not replace version checks where they apply.
- CORS, robots metadata, hidden UI controls, and `allowedActions` are not authorization controls.
- AI output is never trusted merely because it matches a JSON schema; evidence, privacy, and content validation are mandatory.

## Known boundaries

The server currently exposes profile, consent, event, block, outgoing-heart, match/conversation, and recommendation routes. Activity capacity, topic voting/matching, message transport, notifications, media upload, moderation, onboarding/review, and full frontend API integration remain outside this backend slice. Those capabilities must preserve the public DTO/privacy rules in `src/domain.ts` when they are added.

The current backend is a focused foundation rather than the full 4U product API. Add each remaining capability behind the same authenticated, versioned, idempotent, privacy-preserving boundaries.
