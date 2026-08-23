# 4U backend

Node 22, TypeScript, Fastify, and PostgreSQL backend for 4U. It stores versioned profile and consent projections, append-only domain events, outgoing hearts, matches/conversations, blocks, recommendation artifacts/jobs, and recommendation feedback. Compatibility scoring is deterministic; optional OpenAI-generated copy is processed asynchronously and must pass server-side evidence and safety validation.

The repository's GitHub Pages deployment remains a static frontend. This service is deployed separately on an API host; neither PostgreSQL nor provider credentials can run on GitHub Pages.

## Prerequisites

- Node.js 22.x and npm
- Docker with Compose v2 for the recommended local PostgreSQL setup
- `curl` for the request examples

Run backend commands from this directory unless a command explicitly starts at the repository root.

## Local PostgreSQL and migrations

From the repository root:

```bash
docker compose up -d postgres
docker compose ps
docker compose run --rm migrate
```

If you only want the database and intend to run Node processes on the host, use the three commands above. Running `docker compose up` without service names starts the full containerized stack described next.

Or start the complete local backend (migration, API, and worker):

```bash
docker compose up --build -d
docker compose ps
curl --fail-with-body http://127.0.0.1:3000/ready
```

Compose waits for PostgreSQL, runs migrations once, and starts the API and worker only after the migration exits successfully. AI refinement is disabled by default; with `AI_REFINEMENT_ENABLED=false`, recommendations retain the deterministic safe fallback and no provider key is required.

Stop services without deleting data using `docker compose down`. Removing the named volume with `docker compose down --volumes` permanently deletes the local database; back it up first if it matters.

When using `.env.local`, add `--env-file .env.local` immediately after `docker compose` in each of these commands.

The database is exposed only on `127.0.0.1:5432` by default. Override `POSTGRES_PORT` if that port is occupied. Compose uses disposable local-only defaults; put overrides in `/4U/.env.local` and invoke Compose with `docker compose --env-file .env.local ...` from the repository root. The root `*.local` ignore rule covers this file; do not create an unignored root `.env`. Never reuse the example password outside local development. Because Compose interpolates the same password into a URI, choose an alphanumeric local password; production should inject a correctly encoded `DATABASE_URL` directly.

For a host-run backend, switch to the server directory and create separate `/4U/server/.env.api.local` and `/4U/server/.env.worker.local` files from the relevant sections of `.env.example`. The API file must omit `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_TIMEOUT_MS`, and `OPENAI_MAX_ATTEMPTS`; add those worker-only values to the worker file only when refinement is enabled.

```bash
npm install
DOTENV_CONFIG_PATH=.env.api.local npm run migrate
```

The example `DATABASE_URL` points to the Compose database at `127.0.0.1:5432`. Both role files match the repository's `*.local` ignore rule. They are also excluded from the Docker build context and must not be committed. Select the corresponding file with `DOTENV_CONFIG_PATH` for every host-run process.

Migrations are ordered SQL files under `migrations/`. The runner records each filename and SHA-256 checksum in `schema_migrations`, runs each new file in a transaction, and refuses to continue if an applied file changed. Therefore:

- Add a new numbered migration; never edit an applied migration.
- Run migrations as a one-shot release job before starting new API and worker replicas.
- Keep schema changes backward-compatible during rolling releases (expand, deploy/backfill, then contract).
- Back up and test restore procedures before a destructive or high-volume migration.

## Development and production commands

The package exposes these commands:

| Command | Purpose |
|---|---|
| `npm run dev` | Watch `src/index.ts` with `tsx` |
| `npm run worker` | Run the recommendation worker from TypeScript |
| `npm run check` | Type-check without emitting files |
| `npm test` | Run Node/TypeScript tests |
| `npm run build` | Compile to `dist/` |
| `npm start` | Run `dist/index.js` |
| `npm run worker:prod` | Run `dist/worker.js` |
| `npm run migrate` | Run migrations from TypeScript |
| `npm run migrate:prod` | Run compiled migrations |

A normal host-run local loop uses two terminals after migration:

```bash
# From the repository root:
docker compose up -d postgres
cd server
npm install
DOTENV_CONFIG_PATH=.env.api.local npm run migrate
DOTENV_CONFIG_PATH=.env.api.local npm run dev
# In a second terminal from server/:
# DOTENV_CONFIG_PATH=.env.worker.local npm run worker
```

A release should build one immutable image, then use that same image for the migration job, API, and worker:

```bash
docker build -t for-u-server:release .
docker run --rm --env-file /path/to/migration.env for-u-server:release npm run migrate:prod
docker run --rm --env-file /path/to/api.env -p 127.0.0.1:3000:3000 for-u-server:release npm start
docker run --rm --env-file /path/to/worker.env for-u-server:release npm run worker:prod
```

These commands are illustrative for a single host. A production scheduler should run exactly one migration job and supervise long-running API/worker processes. Do not put secret values in an image, Compose file, shell history, CI log, or command line.

For the repository's single-host production topology, use `docker-compose.production.yml` with a root-owned, mode `0600` environment file stored outside Git. It requires JWT/JWKS configuration, exposes the API only on loopback, keeps PostgreSQL off the host network, and uses the checked-in `deploy/nginx-4u.conf` for the same-origin public entry point. The root `docker-compose.yml` remains development-only.

## Configuration

Configuration is validated at startup. Values below are canonical; legacy aliases in code are compatibility aids, not names for new deployments.

| Variable | Default / requirement | Notes |
|---|---|---|
| `POSTGRES_PORT` | `5432` in Compose | Host port override used by Compose only, not the Node process |
| `NODE_ENV` | `development` | `production` rejects development auth |
| `HOST` / `PORT` | `0.0.0.0` / `3000` | Bind the container internally; publish it only through the proxy |
| `LOG_LEVEL` | `info` | Fastify log level |
| `TRUST_PROXY` | `false` | Enable only when untrusted clients cannot bypass the trusted reverse proxy |
| `DATABASE_URL` | required | Secret PostgreSQL connection URI |
| `DATABASE_SSL` | `false` | Use `true` when the production database requires verified TLS |
| `DATABASE_POOL_MAX` | `10` | Per-process pool limit; budget across API and worker replicas |
| `DATABASE_IDLE_TIMEOUT_MS` | `30000` | Idle pooled connection timeout |
| `DATABASE_CONNECTION_TIMEOUT_MS` | `5000` | Initial connection timeout |
| `DATABASE_STATEMENT_TIMEOUT_MS` | `15000` | Database statement timeout |
| `CORS_ALLOWED_ORIGINS` | empty | Comma-separated exact origins; empty denies browser CORS |
| `RATE_LIMIT_MAX` | `120` | Requests per rate-limit window |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Rate-limit window |
| `BODY_LIMIT_BYTES` | `262144` | Maximum request body |
| `AUTH_MODE` | `dev` | Use `jwt` in production |
| `DEV_AUTH_TOKEN` | required in dev mode | Local-only shared bearer token; Compose supplies a development-only default |
| `DEV_USER_ID` | `person_me` | Identity represented by the local token |
| `JWT_ISSUER` | required for JWT mode | Exact trusted issuer |
| `JWT_AUDIENCE` | required for JWT mode | Required access-token audience |
| `JWT_JWKS_URL` | required for JWT mode | HTTPS JWKS endpoint |
| `JWT_JWKS_FILE` | optional alternative in JWT mode | Read-only deployment-managed JWKS JSON file; when set, avoids a runtime network dependency |
| `WORKER_ID` | process-specific value | Must be unique per worker replica; Compose uses `for-u-worker-local` |
| `WORKER_POLL_MS` | `1000` | Database queue poll interval |
| `WORKER_LEASE_MS` | `60000` | Job lease; when AI is enabled, must exceed the full retry budget plus completion margin |
| `WORKER_COMPLETION_MARGIN_MS` | `5000` | Reserved time for validation and the fenced database commit after model work |
| `AI_REFINEMENT_ENABLED` | `false` | Shared non-secret rollout switch; set identically on API and worker |
| `OPENAI_API_KEY` | required only on an enabled worker | Worker-only secret; never inject it into the API process |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | The API key is sent to this host; change only to a trusted endpoint |
| `OPENAI_MODEL` | `gpt-5.6-sol` | Non-secret artifact identity shared by API and worker; pin and promote changes together |
| `OPENAI_TIMEOUT_MS` | `12000` | Per-attempt upper bound used conservatively in lease validation |
| `OPENAI_MAX_ATTEMPTS` | `2` | Includes the first attempt |
| `RECOMMENDATION_RULES_VERSION` | `compatibility-rules-v1` | Bump when deterministic scoring behavior changes |
| `AI_PROMPT_VERSION` | `compatibility-explanation-v1` | Bump when generation instructions/schema change |

The worker requires `WORKER_LEASE_MS > OPENAI_TIMEOUT_MS * OPENAI_MAX_ATTEMPTS + 2000 * (OPENAI_MAX_ATTEMPTS - 1) + WORKER_COMPLETION_MARGIN_MS`; `2000ms` is the maximum provider backoff for each retry. With the defaults, the protected interval is `12000 * 2 + 2000 + 5000 = 31000ms`, so the `60000ms` lease passes. Equality and smaller values fail at startup, preserving positive completion headroom. The Responses request is hard-coded with `store: false`; there is no supported switch to enable provider storage.

`CORS_ORIGINS`, `DEV_API_TOKEN`, and `DEV_AUTH_USER_ID` are temporary backward-compatible aliases in the loader. New environments should use the canonical names in the table.

### Secret handling

Use a deployment secret manager to inject `DATABASE_URL`, the worker-only `OPENAI_API_KEY`, and any local development token at runtime. Give each environment separate, least-privilege database credentials and a separate restricted OpenAI project key. Rotate credentials after exposure and on a regular schedule. Redact authorization headers, connection strings, profile evidence, prompts, and generated prose from ordinary logs.

Never define an OpenAI credential with a `VITE_*` name: Vite embeds those values in the public browser bundle. The static frontend should receive only the public API base URL.

## HTTP surface

`GET /health` is a public liveness check. `GET /ready` is a public readiness check and returns `503 NOT_READY` until required dependencies and the migrated database are available. All `/v1` routes require `Authorization: Bearer …`.

| Method and path | Purpose | Idempotency |
|---|---|---|
| `GET /health` | Process liveness | n/a |
| `GET /ready` | Dependency/schema readiness | n/a |
| `GET /v1/events` | Read the caller's event stream after an opaque numeric cursor | n/a |
| `POST /v1/events` | Append a client event batch | Required header |
| `GET /v1/me/profile` | Read the caller's profile | n/a |
| `PUT /v1/me/profile` | Create/update the caller's versioned profile | Required header plus `expectedVersion` |
| `GET /v1/me/ai-consent` | Read the caller's AI consent | n/a |
| `PUT /v1/me/ai-consent` | Update versioned consent | Required header plus `expectedVersion` |
| `GET /v1/me/blocks` | List blocks created by the caller | n/a |
| `GET /v1/me/blocks/:personId` | Read one block created by the caller | n/a |
| `PUT /v1/me/blocks/:personId` | Block another person | Required header plus `expectedVersion` |
| `DELETE /v1/me/blocks/:personId` | Remove the caller's block | Required header plus `expectedVersion` |
| `GET /v1/me/hearts` | List the caller's outgoing hearts only | n/a |
| `GET /v1/me/hearts/:personId` | Read the caller's outgoing heart only | n/a |
| `PUT /v1/me/hearts/:personId` | Express or renew a private heart | Required header plus `expectedVersion` |
| `DELETE /v1/me/hearts/:personId` | Withdraw a heart before matching | Required header plus `expectedVersion` |
| `GET /v1/me/matches` | List active viewer-owned matches and conversations | n/a |
| `GET /v1/me/matches/:matchId` | Read a viewer-owned active match | n/a |
| `DELETE /v1/me/matches/:matchId` | Unmatch and close its conversation | Required header plus `expectedVersion` |
| `POST /v1/recommendations` | Persist a safe result and optionally queue refinement | Service-deduplicated by pair/versions |
| `GET /v1/recommendations/:resultId` | Read a viewer-owned result | n/a |
| `POST /v1/recommendations/:resultId/feedback` | Record recommendation feedback | Required header |

`GET /v1/events` accepts `cursor` (default `0`), `limit` (default `100`, maximum `1000`), and optional `aggregateType` / `aggregateId` filters. The stream is always scoped to the authenticated owner; its numeric cursor is an opaque continuation value, not a global-data authorization mechanism.
`POST /v1/events` accepts only client-owned aggregate types prefixed with `client_`. Profile, consent, heart, match, conversation, and block streams are server-owned and can only be changed through their dedicated authenticated endpoints.

Errors use one envelope:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request is invalid.",
    "requestId": "req-example"
  }
}
```

Expected statuses include `400` for invalid input, `401` for a missing/invalid bearer token, neutral `404` for missing or cross-viewer resources, `409` for version/idempotency conflicts, `429` for rate limits, and `503` when readiness or authentication dependencies are unavailable. Responses include `X-Request-Id` and personalized responses use `Cache-Control: private, no-store`.

Relationship privacy is directional: heart endpoints expose only hearts sent by the authenticated caller. There is no incoming-heart endpoint. A reciprocal active heart atomically creates one canonical match and one conversation; only then may either participant observe the match. Hearts expire after 30 days by default. Blocking either direction closes an active relationship, and unblocking never silently restores it.

## Curl examples

Use placeholders or private shell variables; never paste a real token into documentation:

```bash
API_BASE_URL=http://127.0.0.1:3000
API_TOKEN='<local-token-from-your-private-env>'

curl --fail-with-body "$API_BASE_URL/health"
curl --fail-with-body "$API_BASE_URL/ready"

curl --fail-with-body "$API_BASE_URL/v1/me/profile" \
  -H "Authorization: Bearer $API_TOKEN"

curl --fail-with-body \
  "$API_BASE_URL/v1/events?cursor=0&limit=100&aggregateType=profile" \
  -H "Authorization: Bearer $API_TOKEN"

curl --fail-with-body -X PUT "$API_BASE_URL/v1/me/profile" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: <unique-key-for-this-logical-write>' \
  --data '{
    "expectedVersion": 0,
    "profile": {
      "displayName": "示例用户",
      "interests": ["城市漫步"],
      "photos": [],
      "prompts": [],
      "attributes": {}
    }
  }'

curl --fail-with-body -X PUT "$API_BASE_URL/v1/me/ai-consent" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: <unique-key-for-this-logical-write>' \
  --data '{
    "expectedVersion": 0,
    "aiCompatibility": false,
    "publicExplanation": false,
    "fieldPolicies": []
  }'

curl --fail-with-body -X POST "$API_BASE_URL/v1/events" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: <unique-key-for-this-event-batch>' \
  --data '{
    "events": [{
      "eventId": "00000000-0000-4000-8000-000000000001",
      "aggregateType": "client_session",
      "aggregateId": "session_example",
      "expectedVersion": 0,
      "eventType": "PROFILE_VIEWED",
      "occurredAt": "2026-08-22T12:00:00Z",
      "payload": {"targetId": "person_example"}
    }]
  }'

curl --fail-with-body -X POST "$API_BASE_URL/v1/recommendations" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{"candidateId":"person_example","locale":"zh-CN"}'

RESULT_ID='<result-id-returned-by-the-previous-request>'
curl --fail-with-body "$API_BASE_URL/v1/recommendations/$RESULT_ID" \
  -H "Authorization: Bearer $API_TOKEN"

curl --fail-with-body -X POST "$API_BASE_URL/v1/recommendations/$RESULT_ID/feedback" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: <unique-key-for-this-feedback>' \
  --data '{"kind":"NOT_HELPFUL"}'
```

`profileStatus` and `verification` are server-owned. A self-service profile request containing either field is rejected rather than trusted or silently accepted.

`person_example` must exist, and both parties must have eligible profiles and consent records, before the recommendation request can succeed. Reuse an idempotency key only when retrying the identical logical request; using it with different input returns `409`.

## Public deployment

Deploy the backend and worker separately from GitHub Pages. A typical public path is:

```text
Browser -> HTTPS reverse proxy/load balancer -> Fastify API :3000 -> PostgreSQL
                                               |
                                               +-> recommendation job table <- worker -> OpenAI
```

Production requirements:

1. Terminate TLS at a managed load balancer or maintained reverse proxy. Redirect HTTP to HTTPS, expose only `443`, and keep port `3000` and PostgreSQL on private networks.
2. Set `NODE_ENV=production` and `AUTH_MODE=jwt`. Configure the exact issuer, audience, and HTTPS JWKS URL. Development shared-token auth is rejected in production.
3. Set `CORS_ALLOWED_ORIGINS` to exact frontend origins, for example `https://happyeye1.github.io` while Pages hosts the UI. Origins never include `/4U/` paths. Do not use `*`; CORS is not authentication.
4. Set `TRUST_PROXY=true` only when direct public access to Fastify is impossible and the proxy overwrites forwarded headers. This preserves correct client IP/rate limiting.
5. Run one migration job, wait for success, then roll API and worker replicas. Probe `/health` for liveness and `/ready` for traffic readiness.
6. Provide graceful termination time, cap API and worker database pools across all replicas, and alert on readiness failures, `5xx`, queue age, exhausted jobs, rate limits, database saturation, and AI validation/fallback rates.

Minimal Nginx location (TLS certificate configuration omitted because it is environment-specific):

```nginx
location / {
    # API is published to loopback when Nginx runs on the same host.
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Request-Id $request_id;
    client_max_body_size 256k;
}
```

The proxy must not log authorization headers or request bodies containing profile/consent evidence. Apply HSTS only after HTTPS is working on every required subdomain.

## Backups and recovery

For local development, create a timestamped custom-format backup in a protected directory outside the repository. A dump contains private profile and consent data and must not be committed:

```bash
BACKUP_DIRECTORY=/path/to/protected/backup-directory
mkdir -p "$BACKUP_DIRECTORY"
docker compose exec -T postgres \
  sh -c 'pg_dump --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --format=custom' \
  > "$BACKUP_DIRECTORY/for_u-$(date -u +%Y%m%dT%H%M%SZ).dump"
```

Test recovery into a separate database; never overwrite the active database during a restore drill:

```bash
docker compose exec -T postgres \
  sh -c 'createdb --username "$POSTGRES_USER" for_u_restore'
BACKUP_FILE=/path/to/protected/for_u-example.dump
docker compose exec -T postgres \
  sh -c 'pg_restore --username "$POSTGRES_USER" --dbname for_u_restore --exit-on-error' \
  < "$BACKUP_FILE"
```

For production, use encrypted managed backups plus point-in-time recovery, store copies in a separate failure domain, define retention and RPO/RTO targets, restrict restore permissions, and perform scheduled restore tests. Database snapshots alone do not prove recoverability. Keep backup handling aligned with profile deletion and data-retention obligations.

See [`../docs/server-architecture.md`](../docs/server-architecture.md) for component boundaries, data flow, and operational trade-offs.
