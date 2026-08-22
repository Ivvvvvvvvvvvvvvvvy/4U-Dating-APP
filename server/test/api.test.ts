import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';

import { buildApp, type AppConfig } from '../src/app.js';
import { processNextRecommendationJob } from '../src/jobs/worker.js';
import type { ApiServices } from '../src/routes/contracts.js';
import type {
  AppendEventsResult,
  ConsentRecord,
  HeartView,
  MatchView,
  ProfileData,
  ProfileRecord,
  SelfServiceProfileData,
} from '../src/types/index.js';

const AUTH_TOKEN = 'integration-test-token';
const USER_ID = 'person_viewer';
const ALLOWED_ORIGIN = 'https://client.example.test';
const NOW = '2026-08-22T12:00:00.000Z';

const DEFAULT_CONFIG: AppConfig = {
  environment: 'test',
  authMode: 'dev',
  devAuthToken: AUTH_TOKEN,
  devUserId: USER_ID,
  corsAllowedOrigins: [ALLOWED_ORIGIN],
  rateLimitMax: 100,
  rateLimitWindowMs: 60_000,
};

const INITIAL_PROFILE_DATA: ProfileData = {
  displayName: 'Lin',
  profileStatus: 'RECOMMENDABLE',
  interests: ['climbing'],
  photos: [],
  prompts: [],
  attributes: {},
};

const INITIAL_PROFILE: ProfileRecord = {
  userId: USER_ID,
  version: 3,
  data: INITIAL_PROFILE_DATA,
  createdAt: NOW,
  updatedAt: NOW,
};

const INITIAL_CONSENT: ConsentRecord = {
  userId: USER_ID,
  version: 1,
  data: {
    policyVersion: 'consent-2026-08',
    aiCompatibility: true,
    publicExplanation: false,
    modelTraining: false,
    fieldPolicies: [],
    privacy: {
      showAge: false,
      showZodiac: false,
      showInConfirmedParticipantLists: false,
      exactLocationSharing: 'CONFIRMED_ACTIVITY_ONLY',
      lockScreenMessagePreview: 'HIDDEN',
    },
    extensions: {},
  },
  createdAt: NOW,
  updatedAt: NOW,
};

const ACTIVE_HEART: HeartView = {
  actorUserId: USER_ID,
  targetUserId: 'person_candidate',
  status: 'ACTIVE',
  version: 1,
  expressedAt: NOW,
  expiresAt: '2026-09-21T12:00:00.000Z',
  withdrawnAt: null,
  updatedAt: NOW,
};

const ACTIVE_MATCH: MatchView = {
  matchId: 'match_1',
  status: 'ACTIVE',
  version: 1,
  participantUserIds: [USER_ID, 'person_candidate'],
  matchedAt: NOW,
  updatedAt: NOW,
  conversation: {
    threadId: 'thread_1',
    matchId: 'match_1',
    status: 'READY',
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
  },
};

type ServiceOverrides = {
  readonly readiness?: ApiServices['readiness'];
  readonly events?: ApiServices['events'];
  readonly profiles?: ApiServices['profiles'];
  readonly consents?: ApiServices['consents'];
  readonly blocks?: ApiServices['blocks'];
  readonly relationships?: ApiServices['relationships'];
  readonly recommendations?: ApiServices['recommendations'];
};

function defaultEventResult(
  input: Parameters<ApiServices['events']['appendBatch']>[0],
): AppendEventsResult {
  const events = input.events.map((event, index) => ({
    eventId: event.eventId ?? `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    aggregateType: event.aggregateType,
    aggregateId: event.aggregateId,
    aggregateVersion: event.expectedVersion + 1,
    globalPosition: String(index + 1),
    eventType: event.eventType,
    recordedAt: NOW,
  }));
  return { replayed: false, cursor: events.at(-1)?.globalPosition ?? '0', events };
}

function createServices(overrides: ServiceOverrides = {}): ApiServices {
  return {
    readiness: overrides.readiness ?? (async () => true),
    events: overrides.events ?? {
      appendBatch: async (input) => defaultEventResult(input),
      readAfter: async () => [],
    },
    profiles: overrides.profiles ?? {
      getByUserId: async () => INITIAL_PROFILE,
      updateByUserId: async (input) => ({
        userId: input.userId,
        version: input.expectedVersion + 1,
        data: input.data,
        createdAt: NOW,
        updatedAt: NOW,
      }),
    },
    consents: overrides.consents ?? {
      getByUserId: async () => INITIAL_CONSENT,
      updateByUserId: async (input) => ({
        userId: input.userId,
        version: input.expectedVersion + 1,
        data: input.data,
        createdAt: NOW,
        updatedAt: NOW,
      }),
    },
    blocks: overrides.blocks ?? {
      get: async () => null,
      listByBlocker: async () => [],
      set: async (input) => ({
        blockerUserId: input.blockerUserId,
        blockedUserId: input.blockedUserId,
        version: input.expectedVersion + 1,
        eventId: 'event_block_1',
        blockedAt: NOW,
        updatedAt: NOW,
      }),
      remove: async (input) => ({ removed: true, version: input.expectedVersion + 1 }),
    },
    relationships: overrides.relationships ?? {
      expressHeart: async (input) => ({
        replayed: false,
        changed: true,
        heart: {
          actorUserId: input.actorUserId,
          targetUserId: input.targetUserId,
          status: 'ACTIVE',
          version: input.expectedVersion + 1,
          expressedAt: NOW,
          expiresAt: '2026-09-21T12:00:00.000Z',
          withdrawnAt: null,
          updatedAt: NOW,
        },
      }),
      withdrawHeart: async (input) => ({
        replayed: false,
        changed: true,
        heart: {
          actorUserId: input.actorUserId,
          targetUserId: input.targetUserId,
          status: 'WITHDRAWN',
          version: input.expectedVersion + 1,
          expressedAt: NOW,
          expiresAt: '2026-09-21T12:00:00.000Z',
          withdrawnAt: NOW,
          updatedAt: NOW,
        },
      }),
      getOutgoingHeart: async () => null,
      listOutgoingHearts: async () => [],
      getMatch: async () => null,
      listMatches: async () => [],
      unmatch: async (input) => ({
        replayed: false,
        changed: true,
        match: {
          matchId: input.matchId,
          status: 'UNMATCHED',
          version: input.expectedVersion + 1,
          participantUserIds: [USER_ID, 'person_candidate'],
          matchedAt: NOW,
          updatedAt: NOW,
          conversation: {
            threadId: 'thread_1',
            matchId: input.matchId,
            status: 'CLOSED',
            version: 2,
            createdAt: NOW,
            updatedAt: NOW,
          },
        },
      }),
    },
    recommendations: overrides.recommendations ?? {
      request: async () => ({
        result: { resultId: 'result_ready', state: 'READY' },
        queued: false,
      }),
      getForViewer: async () => ({ resultId: 'result_ready', state: 'READY' }),
      addFeedback: async () => ({
        feedbackId: 'feedback_1',
        duplicate: false,
        createdAt: NOW,
      }),
    },
  };
}

async function createTestApp(
  t: TestContext,
  options: {
    readonly services?: ApiServices;
    readonly config?: Partial<AppConfig>;
  } = {},
) {
  const app = await buildApp({
    config: { ...DEFAULT_CONFIG, ...options.config },
    services: options.services ?? createServices(),
  });
  t.after(() => app.close());
  return app;
}

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return { authorization: `Bearer ${AUTH_TOKEN}`, ...extra };
}

interface InjectResponseLike {
  readonly statusCode: number;
  readonly headers: Record<string, string | string[] | number | undefined>;
  json(): unknown;
}

interface ApiErrorEnvelope {
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly requestId: string;
  };
}

function assertApiError(
  response: InjectResponseLike,
  statusCode: number,
  code: string,
  message?: string,
): ApiErrorEnvelope {
  assert.equal(response.statusCode, statusCode);
  const body = response.json() as ApiErrorEnvelope;
  assert.deepEqual(Object.keys(body), ['error']);
  assert.deepEqual(Object.keys(body.error).sort(), ['code', 'message', 'requestId']);
  assert.equal(body.error.code, code);
  if (message !== undefined) assert.equal(body.error.message, message);
  assert.ok(body.error.requestId);
  assert.equal(response.headers['x-request-id'], body.error.requestId);
  assert.equal(response.headers['cache-control'], 'private, no-store');
  assert.equal(response.headers['x-content-type-options'], 'nosniff');
  return body;
}

test('health and readiness are public and expose request metadata', async (t) => {
  let readinessChecks = 0;
  const services = createServices({
    readiness: async () => {
      readinessChecks += 1;
      return true;
    },
  });
  const app = await createTestApp(t, { services });

  const health = await app.inject({ method: 'GET', url: '/health' });
  assert.equal(health.statusCode, 200);
  assert.deepEqual(health.json(), { status: 'ok' });
  assert.equal(readinessChecks, 0);
  assert.ok(health.headers['x-request-id']);
  assert.equal(health.headers['cache-control'], 'private, no-store');

  const ready = await app.inject({ method: 'GET', url: '/ready' });
  assert.equal(ready.statusCode, 200);
  assert.deepEqual(ready.json(), { status: 'ready' });
  assert.equal(readinessChecks, 1);
  assert.ok(ready.headers['x-request-id']);
});

test('readiness fails closed with a normalized 503 response', async (t) => {
  const app = await createTestApp(t, {
    services: createServices({ readiness: async () => false }),
  });

  const response = await app.inject({ method: 'GET', url: '/ready' });
  assertApiError(
    response,
    503,
    'NOT_READY',
    'A required dependency is unavailable.',
  );
});

test('protected routes require an exact bearer token and use its principal', async (t) => {
  const requestedUserIds: string[] = [];
  const services = createServices({
    profiles: {
      getByUserId: async (userId) => {
        requestedUserIds.push(userId);
        return INITIAL_PROFILE;
      },
      updateByUserId: async () => INITIAL_PROFILE,
    },
  });
  const app = await createTestApp(t, { services });

  const missing = await app.inject({ method: 'GET', url: '/v1/me/profile' });
  assertApiError(missing, 401, 'UNAUTHORIZED', 'A valid bearer token is required.');
  assert.equal(missing.headers['www-authenticate'], 'Bearer');

  const wrong = await app.inject({
    method: 'GET',
    url: '/v1/me/profile',
    headers: { authorization: 'Bearer wrong-token' },
  });
  assertApiError(wrong, 401, 'UNAUTHORIZED', 'A valid bearer token is required.');
  assert.equal(wrong.headers['www-authenticate'], 'Bearer');
  assert.deepEqual(requestedUserIds, []);

  const valid = await app.inject({
    method: 'GET',
    url: '/v1/me/profile',
    headers: authHeaders(),
  });
  assert.equal(valid.statusCode, 200);
  assert.deepEqual(valid.json(), INITIAL_PROFILE);
  assert.deepEqual(requestedUserIds, [USER_ID]);
});

test('CORS emits headers only for configured origins', async (t) => {
  const app = await createTestApp(t);

  const allowed = await app.inject({
    method: 'GET',
    url: '/health',
    headers: { origin: ALLOWED_ORIGIN },
  });
  assert.equal(allowed.statusCode, 200);
  assert.equal(allowed.headers['access-control-allow-origin'], ALLOWED_ORIGIN);
  assert.equal(allowed.headers['access-control-allow-credentials'], undefined);

  const preflight = await app.inject({
    method: 'OPTIONS',
    url: '/v1/me/profile',
    headers: {
      origin: ALLOWED_ORIGIN,
      'access-control-request-method': 'PUT',
      'access-control-request-headers': 'authorization, content-type, idempotency-key',
    },
  });
  assert.equal(preflight.statusCode, 204);
  assert.equal(preflight.headers['access-control-allow-origin'], ALLOWED_ORIGIN);
  assert.match(String(preflight.headers['access-control-allow-methods']), /PUT/);
  assert.match(String(preflight.headers['access-control-allow-headers']), /idempotency-key/i);

  const denied = await app.inject({
    method: 'GET',
    url: '/health',
    headers: { origin: 'https://attacker.example.test' },
  });
  assert.equal(denied.statusCode, 200);
  assert.equal(denied.headers['access-control-allow-origin'], undefined);
});

test('event ingestion returns stable first-write and replay responses', async (t) => {
  const calls: Parameters<ApiServices['events']['appendBatch']>[0][] = [];
  const appendedEvent = {
    eventId: '00000000-0000-4000-8000-000000000001',
    aggregateType: 'client_profile_flow',
    aggregateId: USER_ID,
    aggregateVersion: 1,
    globalPosition: '42',
    eventType: 'PROFILE_CREATED',
    recordedAt: NOW,
  };
  const services = createServices({
    events: {
      appendBatch: async (input) => {
        calls.push(input);
        return {
          replayed: calls.length > 1,
          cursor: '42',
          events: [appendedEvent],
        };
      },
      readAfter: async () => [],
    },
  });
  const app = await createTestApp(t, { services });
  const event = {
    eventId: appendedEvent.eventId,
    aggregateType: 'client_profile_flow',
    aggregateId: USER_ID,
    expectedVersion: 0,
    eventType: 'PROFILE_CREATED',
    payload: { displayName: 'Lin' },
    metadata: { source: 'api-test' },
    occurredAt: '2026-08-22T11:59:00.000Z',
  };
  const request = {
    method: 'POST' as const,
    url: '/v1/events',
    headers: authHeaders({ 'idempotency-key': 'event-key-0001' }),
    payload: { events: [event] },
  };

  const first = await app.inject(request);
  assert.equal(first.statusCode, 202);
  assert.deepEqual(first.json(), { replayed: false, cursor: '42', events: [appendedEvent] });

  const replay = await app.inject(request);
  assert.equal(replay.statusCode, 202);
  assert.deepEqual(replay.json(), { replayed: true, cursor: '42', events: [appendedEvent] });
  assert.deepEqual(calls, [
    { userId: USER_ID, idempotencyKey: 'event-key-0001', events: [event] },
    { userId: USER_ID, idempotencyKey: 'event-key-0001', events: [event] },
  ]);
});

test('incremental event reads are cursor based and scoped to the authenticated owner', async (t) => {
  const reads: Parameters<ApiServices['events']['readAfter']>[0][] = [];
  const event = {
    eventId: '00000000-0000-4000-8000-000000000002',
    aggregateType: 'client_profile_flow',
    aggregateId: USER_ID,
    aggregateVersion: 2,
    globalPosition: '43',
    eventType: 'PROFILE_UPDATED',
    actorUserId: USER_ID,
    payload: { displayName: 'Lin Q.' },
    metadata: {},
    occurredAt: NOW,
    recordedAt: NOW,
  };
  const services = createServices({
    events: {
      appendBatch: async (input) => defaultEventResult(input),
      readAfter: async (input) => {
        reads.push(input);
        return [event];
      },
    },
  });
  const app = await createTestApp(t, { services });

  const response = await app.inject({
    method: 'GET',
    url: '/v1/events?cursor=42&limit=25&aggregateType=client_profile_flow&aggregateId=person_viewer',
    headers: authHeaders(),
  });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { cursor: '43', events: [event], hasMore: false });
  assert.deepEqual(reads, [{
    userId: USER_ID,
    cursor: '42',
    limit: 25,
    aggregateType: 'client_profile_flow',
    aggregateId: 'person_viewer',
  }]);

  const invalid = await app.inject({
    method: 'GET',
    url: '/v1/events?cursor=-1',
    headers: authHeaders(),
  });
  assertApiError(invalid, 400, 'VALIDATION_ERROR', 'The request is invalid.');
  assert.equal(reads.length, 1);
});

test('profile GET and PUT preserve versioning, idempotency, and server-owned fields', async (t) => {
  const verification: NonNullable<ProfileData['verification']> = {
    account: 'VERIFIED',
    personhood: 'VERIFIED',
    profileReview: 'VERIFIED',
  };
  const initialProfile: ProfileRecord = {
    ...INITIAL_PROFILE,
    data: { ...INITIAL_PROFILE.data, verification },
  };
  let profile = initialProfile;
  const getCalls: string[] = [];
  const updateCalls: Parameters<ApiServices['profiles']['updateByUserId']>[0][] = [];
  const services = createServices({
    profiles: {
      getByUserId: async (userId) => {
        getCalls.push(userId);
        return profile;
      },
      updateByUserId: async (input) => {
        updateCalls.push(input);
        profile = {
          userId: input.userId,
          version: input.expectedVersion + 1,
          data: input.data,
          createdAt: NOW,
          updatedAt: '2026-08-22T12:01:00.000Z',
        };
        return profile;
      },
    },
  });
  const app = await createTestApp(t, { services });

  const get = await app.inject({
    method: 'GET',
    url: '/v1/me/profile',
    headers: authHeaders(),
  });
  assert.equal(get.statusCode, 200);
  assert.deepEqual(get.json(), initialProfile);

  const nextProfile: SelfServiceProfileData = {
    displayName: 'Lin Q.',
    interests: ['climbing', 'jazz'],
    photos: [],
    prompts: [],
    attributes: {},
  };
  const expectedData: ProfileData = {
    ...nextProfile,
    profileStatus: 'RECOMMENDABLE',
    verification,
  };
  const put = await app.inject({
    method: 'PUT',
    url: '/v1/me/profile',
    headers: authHeaders({ 'idempotency-key': 'profile-key-0001' }),
    payload: { expectedVersion: 3, profile: nextProfile },
  });
  assert.equal(put.statusCode, 200);
  assert.deepEqual(put.json(), {
    userId: USER_ID,
    version: 4,
    data: expectedData,
    createdAt: NOW,
    updatedAt: '2026-08-22T12:01:00.000Z',
  });
  assert.deepEqual(getCalls, [USER_ID, USER_ID]);
  assert.deepEqual(updateCalls, [{
    userId: USER_ID,
    actorUserId: USER_ID,
    expectedVersion: 3,
    data: expectedData,
    idempotencyKey: 'profile-key-0001',
  }]);
});

test('profile PUT rejects attempts to set server-owned status or verification', async (t) => {
  let getCalls = 0;
  let updateCalls = 0;
  const services = createServices({
    profiles: {
      getByUserId: async () => {
        getCalls += 1;
        return INITIAL_PROFILE;
      },
      updateByUserId: async () => {
        updateCalls += 1;
        throw new Error('must not be called');
      },
    },
  });
  const app = await createTestApp(t, { services });
  const protectedFieldAttempts = [
    {
      expectedVersion: 3,
      profile: { displayName: 'Attacker', profileStatus: 'RECOMMENDABLE' },
    },
    {
      expectedVersion: 3,
      profile: {
        displayName: 'Attacker',
        verification: {
          account: 'VERIFIED',
          personhood: 'VERIFIED',
          profileReview: 'VERIFIED',
        },
      },
    },
  ];

  for (const [index, payload] of protectedFieldAttempts.entries()) {
    const response = await app.inject({
      method: 'PUT',
      url: '/v1/me/profile',
      headers: authHeaders({ 'idempotency-key': `profile-attack-${index}` }),
      payload,
    });
    assertApiError(response, 400, 'VALIDATION_ERROR', 'The request is invalid.');
  }

  assert.equal(getCalls, 0);
  assert.equal(updateCalls, 0);
});

test('profile PUT gives a new profile safe server-owned defaults', async (t) => {
  const updateCalls: Parameters<ApiServices['profiles']['updateByUserId']>[0][] = [];
  const services = createServices({
    profiles: {
      getByUserId: async () => null,
      updateByUserId: async (input) => {
        updateCalls.push(input);
        return {
          userId: input.userId,
          version: 1,
          data: input.data,
          createdAt: NOW,
          updatedAt: NOW,
        };
      },
    },
  });
  const app = await createTestApp(t, { services });
  const profile: SelfServiceProfileData = {
    displayName: 'New user',
    interests: [],
    photos: [],
    prompts: [],
    attributes: {},
  };

  const response = await app.inject({
    method: 'PUT',
    url: '/v1/me/profile',
    headers: authHeaders({ 'idempotency-key': 'profile-new-user' }),
    payload: { expectedVersion: 0, profile },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(updateCalls, [{
    userId: USER_ID,
    actorUserId: USER_ID,
    expectedVersion: 0,
    data: { ...profile, profileStatus: 'DRAFT' },
    idempotencyKey: 'profile-new-user',
  }]);
  assert.deepEqual((response.json() as ProfileRecord).data, {
    ...profile,
    profileStatus: 'DRAFT',
  });
  assert.equal('verification' in (response.json() as ProfileRecord).data, false);
});

test('consent rejects unsafe policy combinations before calling the service', async (t) => {
  let updateCalls = 0;
  const services = createServices({
    consents: {
      getByUserId: async () => null,
      updateByUserId: async () => {
        updateCalls += 1;
        throw new Error('must not be called');
      },
    },
  });
  const app = await createTestApp(t, { services });

  const response = await app.inject({
    method: 'PUT',
    url: '/v1/me/ai-consent',
    headers: authHeaders({ 'idempotency-key': 'consent-key-0001' }),
    payload: {
      expectedVersion: 1,
      aiCompatibility: false,
      publicExplanation: true,
      fieldPolicies: [],
    },
  });

  assertApiError(response, 400, 'VALIDATION_ERROR', 'The request is invalid.');
  assert.equal(updateCalls, 0);
});

test('consent maps repository version conflicts to a safe 409', async (t) => {
  const updateCalls: Parameters<ApiServices['consents']['updateByUserId']>[0][] = [];
  const conflict = Object.assign(new Error('actual version and database details'), {
    code: 'VERSION_CONFLICT',
  });
  const services = createServices({
    consents: {
      getByUserId: async () => null,
      updateByUserId: async (input) => {
        updateCalls.push(input);
        throw conflict;
      },
    },
  });
  const app = await createTestApp(t, { services });
  const fieldPolicy = {
    fieldId: 'interests',
    useForEligibility: true,
    useForRanking: true,
    useForDisplayScore: true,
    useForExplanation: true,
  };

  const response = await app.inject({
    method: 'PUT',
    url: '/v1/me/ai-consent',
    headers: authHeaders({ 'idempotency-key': 'consent-key-0002' }),
    payload: {
      expectedVersion: 4,
      aiCompatibility: true,
      publicExplanation: true,
      fieldPolicies: [fieldPolicy],
    },
  });

  assertApiError(
    response,
    409,
    'VERSION_CONFLICT',
    'The resource changed; fetch the latest version and retry.',
  );
  assert.doesNotMatch(response.body, /database details/);
  assert.deepEqual(updateCalls, [{
    userId: USER_ID,
    actorUserId: USER_ID,
    expectedVersion: 4,
    data: {
      policyVersion: 'ai-consent-v1',
      aiCompatibility: true,
      publicExplanation: true,
      modelTraining: false,
      fieldPolicies: [fieldPolicy],
      privacy: {
        showAge: false,
        showZodiac: false,
        showInConfirmedParticipantLists: false,
        exactLocationSharing: 'CONFIRMED_ACTIVITY_ONLY',
        lockScreenMessagePreview: 'HIDDEN',
      },
      extensions: {},
    },
    idempotencyKey: 'consent-key-0002',
  }]);
});

test('block routes are actor scoped, versioned, and idempotent', async (t) => {
  const setCalls: Parameters<ApiServices['blocks']['set']>[0][] = [];
  const removeCalls: Parameters<ApiServices['blocks']['remove']>[0][] = [];
  const blocks = [{
    blockerUserId: USER_ID,
    blockedUserId: 'person_candidate',
    version: 2,
    eventId: 'event_block_1',
    blockedAt: NOW,
    updatedAt: NOW,
  }];
  const services = createServices({
    blocks: {
      listByBlocker: async (blockerUserId, limit) => {
        assert.equal(blockerUserId, USER_ID);
        assert.equal(limit, 25);
        return blocks;
      },
      get: async (blockerUserId, blockedUserId) => {
        assert.equal(blockerUserId, USER_ID);
        return blocks.find((block) => block.blockedUserId === blockedUserId) ?? null;
      },
      set: async (input) => { setCalls.push(input); return blocks[0] as NonNullable<typeof blocks[0]>; },
      remove: async (input) => {
        removeCalls.push(input);
        return { removed: true, version: input.expectedVersion + 1 };
      },
    },
  });
  const app = await createTestApp(t, { services });

  const list = await app.inject({
    method: 'GET', url: '/v1/me/blocks?limit=25', headers: authHeaders(),
  });
  assert.equal(list.statusCode, 200);
  assert.deepEqual(list.json(), { blocks });

  const get = await app.inject({
    method: 'GET', url: '/v1/me/blocks/person_candidate', headers: authHeaders(),
  });
  assert.equal(get.statusCode, 200);
  assert.deepEqual(get.json(), blocks[0]);

  const put = await app.inject({
    method: 'PUT',
    url: '/v1/me/blocks/person_candidate',
    headers: authHeaders({ 'idempotency-key': 'block-key-0001' }),
    payload: { expectedVersion: 1 },
  });
  assert.equal(put.statusCode, 200);
  assert.deepEqual(setCalls, [{
    blockerUserId: USER_ID,
    blockedUserId: 'person_candidate',
    expectedVersion: 1,
    idempotencyKey: 'block-key-0001',
  }]);

  const remove = await app.inject({
    method: 'DELETE',
    url: '/v1/me/blocks/person_candidate',
    headers: authHeaders({ 'idempotency-key': 'block-key-0002' }),
    payload: { expectedVersion: 2 },
  });
  assert.equal(remove.statusCode, 200);
  assert.deepEqual(remove.json(), { removed: true, version: 3 });
  assert.deepEqual(removeCalls, [{
    blockerUserId: USER_ID,
    blockedUserId: 'person_candidate',
    expectedVersion: 2,
    idempotencyKey: 'block-key-0002',
  }]);

  const self = await app.inject({
    method: 'PUT',
    url: `/v1/me/blocks/${USER_ID}`,
    headers: authHeaders({ 'idempotency-key': 'block-self-0001' }),
    payload: { expectedVersion: 0 },
  });
  assertApiError(self, 400, 'INVALID_TARGET', 'personId must identify another person.');

  const missingKey = await app.inject({
    method: 'DELETE',
    url: '/v1/me/blocks/person_candidate',
    headers: authHeaders(),
    payload: { expectedVersion: 2 },
  });
  assertApiError(
    missingKey, 400, 'IDEMPOTENCY_KEY_REQUIRED',
    'A valid Idempotency-Key header is required.',
  );
});

test('heart routes expose only the authenticated actor outgoing state', async (t) => {
  const expressCalls: Parameters<ApiServices['relationships']['expressHeart']>[0][] = [];
  const withdrawCalls: Parameters<ApiServices['relationships']['withdrawHeart']>[0][] = [];
  const services = createServices({
    relationships: {
      expressHeart: async (input) => {
        expressCalls.push(input);
        return { replayed: false, changed: true, heart: ACTIVE_HEART };
      },
      withdrawHeart: async (input) => {
        withdrawCalls.push(input);
        return {
          replayed: false,
          changed: true,
          heart: { ...ACTIVE_HEART, status: 'WITHDRAWN', version: 2, withdrawnAt: NOW },
        };
      },
      getOutgoingHeart: async (actorUserId, targetUserId) => (
        actorUserId === USER_ID && targetUserId === 'person_candidate' ? ACTIVE_HEART : null
      ),
      listOutgoingHearts: async (actorUserId, options) => {
        assert.equal(actorUserId, USER_ID);
        assert.deepEqual(options, { limit: 20 });
        return [ACTIVE_HEART];
      },
      getMatch: async () => null,
      listMatches: async () => [],
      unmatch: async () => ({ replayed: false, changed: true, match: ACTIVE_MATCH }),
    },
  });
  const app = await createTestApp(t, { services });

  const list = await app.inject({
    method: 'GET', url: '/v1/me/hearts?limit=20', headers: authHeaders(),
  });
  assert.equal(list.statusCode, 200);
  assert.deepEqual(list.json(), { hearts: [ACTIVE_HEART] });

  const get = await app.inject({
    method: 'GET', url: '/v1/me/hearts/person_candidate', headers: authHeaders(),
  });
  assert.equal(get.statusCode, 200);
  assert.deepEqual(get.json(), ACTIVE_HEART);

  const put = await app.inject({
    method: 'PUT',
    url: '/v1/me/hearts/person_candidate',
    headers: authHeaders({ 'idempotency-key': 'heart-key-0001' }),
    payload: { expectedVersion: 0 },
  });
  assert.equal(put.statusCode, 200);
  assert.deepEqual(put.json(), { replayed: false, changed: true, heart: ACTIVE_HEART });
  assert.deepEqual(expressCalls, [{
    actorUserId: USER_ID, targetUserId: 'person_candidate',
    expectedVersion: 0, idempotencyKey: 'heart-key-0001',
  }]);

  const remove = await app.inject({
    method: 'DELETE',
    url: '/v1/me/hearts/person_candidate',
    headers: authHeaders({ 'idempotency-key': 'heart-key-0002' }),
    payload: { expectedVersion: 1 },
  });
  assert.equal(remove.statusCode, 200);
  assert.deepEqual(withdrawCalls, [{
    actorUserId: USER_ID, targetUserId: 'person_candidate',
    expectedVersion: 1, idempotencyKey: 'heart-key-0002',
  }]);
  assert.equal((remove.json() as { heart: HeartView }).heart.status, 'WITHDRAWN');
  assert.equal('incomingHeart' in (put.json() as object), false);

  const self = await app.inject({
    method: 'PUT',
    url: `/v1/me/hearts/${USER_ID}`,
    headers: authHeaders({ 'idempotency-key': 'heart-self-0001' }),
    payload: { expectedVersion: 0 },
  });
  assertApiError(self, 400, 'INVALID_TARGET', 'personId must identify another person.');
});

test('match routes are viewer scoped and unmatch requires an idempotent versioned command', async (t) => {
  const unmatchCalls: Parameters<ApiServices['relationships']['unmatch']>[0][] = [];
  const services = createServices({
    relationships: {
      expressHeart: async () => ({ replayed: false, changed: true, heart: ACTIVE_HEART }),
      withdrawHeart: async () => ({ replayed: false, changed: true, heart: ACTIVE_HEART }),
      getOutgoingHeart: async () => null,
      listOutgoingHearts: async () => [],
      getMatch: async (viewerUserId, matchId) => (
        viewerUserId === USER_ID && matchId === ACTIVE_MATCH.matchId ? ACTIVE_MATCH : null
      ),
      listMatches: async (viewerUserId, options) => {
        assert.equal(viewerUserId, USER_ID);
        assert.deepEqual(options, { limit: 10 });
        return [ACTIVE_MATCH];
      },
      unmatch: async (input) => {
        unmatchCalls.push(input);
        return {
          replayed: false,
          changed: true,
          match: {
            ...ACTIVE_MATCH,
            status: 'UNMATCHED',
            version: 2,
            conversation: { ...ACTIVE_MATCH.conversation, status: 'CLOSED', version: 2 },
          },
        };
      },
    },
  });
  const app = await createTestApp(t, { services });

  const list = await app.inject({
    method: 'GET', url: '/v1/me/matches?limit=10', headers: authHeaders(),
  });
  assert.equal(list.statusCode, 200);
  assert.deepEqual(list.json(), { matches: [ACTIVE_MATCH] });

  const get = await app.inject({
    method: 'GET', url: '/v1/me/matches/match_1', headers: authHeaders(),
  });
  assert.equal(get.statusCode, 200);
  assert.deepEqual(get.json(), ACTIVE_MATCH);

  const missing = await app.inject({
    method: 'GET', url: '/v1/me/matches/match_foreign', headers: authHeaders(),
  });
  assertApiError(missing, 404, 'NOT_FOUND', 'The requested resource was not found.');

  const remove = await app.inject({
    method: 'DELETE',
    url: '/v1/me/matches/match_1',
    headers: authHeaders({ 'idempotency-key': 'unmatch-key-0001' }),
    payload: { expectedVersion: 1 },
  });
  assert.equal(remove.statusCode, 200);
  assert.deepEqual(unmatchCalls, [{
    actorUserId: USER_ID, matchId: 'match_1',
    expectedVersion: 1, idempotencyKey: 'unmatch-key-0001',
  }]);
  const body = remove.json() as { match: MatchView };
  assert.equal(body.match.status, 'UNMATCHED');
  assert.equal(body.match.conversation.status, 'CLOSED');
});

test('recommendation creation returns 200 for ready and 202 for pending results', async (t) => {
  const calls: Parameters<ApiServices['recommendations']['request']>[0][] = [];
  const services = createServices({
    recommendations: {
      request: async (input) => {
        calls.push(input);
        if (input.candidateId === 'person_pending') {
          return {
            result: { resultId: 'result_pending', state: 'PENDING', summary: 'Queued safely' },
            queued: true,
          };
        }
        return {
          result: { resultId: 'result_ready', state: 'READY', score: 82 },
          queued: false,
        };
      },
      getForViewer: async () => null,
      addFeedback: async () => null,
    },
  });
  const app = await createTestApp(t, { services });

  const ready = await app.inject({
    method: 'POST',
    url: '/v1/recommendations',
    headers: authHeaders(),
    payload: { candidateId: 'person_ready' },
  });
  assert.equal(ready.statusCode, 200);
  assert.equal(ready.headers.location, '/v1/recommendations/result_ready');
  assert.deepEqual(ready.json(), { resultId: 'result_ready', state: 'READY', score: 82 });

  const pending = await app.inject({
    method: 'POST',
    url: '/v1/recommendations',
    headers: authHeaders(),
    payload: { candidateId: 'person_pending', locale: 'en-US' },
  });
  assert.equal(pending.statusCode, 202);
  assert.equal(pending.headers.location, '/v1/recommendations/result_pending');
  assert.deepEqual(pending.json(), {
    resultId: 'result_pending',
    state: 'PENDING',
    summary: 'Queued safely',
  });
  assert.deepEqual(calls, [
    { viewerId: USER_ID, candidateId: 'person_ready', locale: 'zh-CN' },
    { viewerId: USER_ID, candidateId: 'person_pending', locale: 'en-US' },
  ]);
});

test('cross-user recommendation lookups return the same neutral 404 as missing results', async (t) => {
  const calls: Array<{ viewerId: string; resultId: string }> = [];
  const services = createServices({
    recommendations: {
      request: async () => ({
        result: { resultId: 'unused', state: 'READY' },
        queued: false,
      }),
      getForViewer: async (viewerId, resultId) => {
        calls.push({ viewerId, resultId });
        return null;
      },
      addFeedback: async () => null,
    },
  });
  const app = await createTestApp(t, { services });

  const foreign = await app.inject({
    method: 'GET',
    url: '/v1/recommendations/result_owned_by_another_user',
    headers: authHeaders(),
  });
  const body = assertApiError(
    foreign,
    404,
    'NOT_FOUND',
    'The requested resource was not found.',
  );
  assert.doesNotMatch(body.error.message, /owner|another|forbidden/i);
  assert.deepEqual(calls, [{ viewerId: USER_ID, resultId: 'result_owned_by_another_user' }]);
});

test('feedback idempotency returns 201 initially and 200 for a replay', async (t) => {
  const calls: Parameters<ApiServices['recommendations']['addFeedback']>[0][] = [];
  const services = createServices({
    recommendations: {
      request: async () => ({
        result: { resultId: 'result_ready', state: 'READY' },
        queued: false,
      }),
      getForViewer: async () => null,
      addFeedback: async (input) => {
        calls.push(input);
        return {
          feedbackId: 'feedback_42',
          duplicate: calls.length > 1,
          createdAt: NOW,
        };
      },
    },
  });
  const app = await createTestApp(t, { services });
  const request = {
    method: 'POST' as const,
    url: '/v1/recommendations/result_ready/feedback',
    headers: authHeaders({ 'idempotency-key': 'feedback-key-0001' }),
    payload: { kind: 'DO_NOT_USE_MY_FACT', evidenceId: 'evidence_7' },
  };

  const first = await app.inject(request);
  assert.equal(first.statusCode, 201);
  assert.deepEqual(first.json(), {
    feedbackId: 'feedback_42',
    duplicate: false,
    createdAt: NOW,
  });

  const replay = await app.inject(request);
  assert.equal(replay.statusCode, 200);
  assert.deepEqual(replay.json(), {
    feedbackId: 'feedback_42',
    duplicate: true,
    createdAt: NOW,
  });
  assert.deepEqual(calls, [
    {
      viewerId: USER_ID,
      resultId: 'result_ready',
      idempotencyKey: 'feedback-key-0001',
      kind: 'DO_NOT_USE_MY_FACT',
      evidenceId: 'evidence_7',
    },
    {
      viewerId: USER_ID,
      resultId: 'result_ready',
      idempotencyKey: 'feedback-key-0001',
      kind: 'DO_NOT_USE_MY_FACT',
      evidenceId: 'evidence_7',
    },
  ]);
});

test('validation, idempotency, unknown-route, and internal errors use one safe envelope', async (t) => {
  let eventCalls = 0;
  let recommendationCalls = 0;
  const services = createServices({
    events: {
      appendBatch: async (input) => {
        eventCalls += 1;
        return defaultEventResult(input);
      },
    },
    recommendations: {
      request: async () => {
        recommendationCalls += 1;
        throw new Error('private upstream detail');
      },
      getForViewer: async () => null,
      addFeedback: async () => null,
    },
  });
  const app = await createTestApp(t, { services });

  const invalid = await app.inject({
    method: 'POST',
    url: '/v1/recommendations',
    headers: authHeaders(),
    payload: { candidateId: 'not-a-person-id' },
  });
  assertApiError(invalid, 400, 'VALIDATION_ERROR', 'The request is invalid.');
  assert.equal(recommendationCalls, 0);

  const missingKey = await app.inject({
    method: 'POST',
    url: '/v1/events',
    headers: authHeaders(),
    payload: {
      events: [{
        aggregateType: 'profile',
        aggregateId: USER_ID,
        expectedVersion: 0,
        eventType: 'PROFILE_CREATED',
        payload: {},
      }],
    },
  });
  assertApiError(
    missingKey,
    400,
    'IDEMPOTENCY_KEY_REQUIRED',
    'A valid Idempotency-Key header is required.',
  );
  assert.equal(eventCalls, 0);

  const serverOwnedEvent = await app.inject({
    method: 'POST',
    url: '/v1/events',
    headers: authHeaders({ 'idempotency-key': 'forged-event-0001' }),
    payload: {
      events: [{
        aggregateType: 'match',
        aggregateId: 'match_foreign',
        expectedVersion: 0,
        eventType: 'match.created',
        payload: {},
      }],
    },
  });
  assertApiError(serverOwnedEvent, 400, 'VALIDATION_ERROR', 'The request is invalid.');
  assert.equal(eventCalls, 0);

  const unknown = await app.inject({ method: 'GET', url: '/v1/not-a-route' });
  assertApiError(unknown, 404, 'NOT_FOUND', 'The requested route was not found.');

  const internal = await app.inject({
    method: 'POST',
    url: '/v1/recommendations',
    headers: authHeaders(),
    payload: { candidateId: 'person_service_failure' },
  });
  assertApiError(internal, 500, 'INTERNAL_ERROR', 'An unexpected error occurred.');
  assert.doesNotMatch(internal.body, /private upstream detail/);
  assert.equal(recommendationCalls, 1);
});

test('global rate limiting returns the standard envelope and retry metadata', async (t) => {
  const app = await createTestApp(t, {
    config: { rateLimitMax: 1, rateLimitWindowMs: 60_000 },
  });

  const first = await app.inject({ method: 'GET', url: '/health' });
  assert.equal(first.statusCode, 200);

  const limited = await app.inject({ method: 'GET', url: '/health' });
  assertApiError(
    limited,
    429,
    'RATE_LIMITED',
    'Too many requests; try again later.',
  );
  assert.ok(limited.headers['retry-after']);
});

test('worker delegates terminal transitions to the recommendation processor', async () => {
  let failures = 0;
  const job = { jobId: 'job_1', attempts: 1, maxAttempts: 3, payload: {} };
  const result = await processNextRecommendationJob({
    queue: {
      claimNextJob: async () => job,
      failJob: async () => { failures += 1; },
    },
    processJob: async (claimed, workerId) => {
      assert.equal(claimed, job);
      assert.equal(workerId, 'worker_test');
      return { outcome: 'succeeded', resultId: 'rec_1' };
    },
    workerId: 'worker_test',
    pollIntervalMs: 100,
    leaseMs: 1_000,
    signal: new AbortController().signal,
    logger: { info() {}, warn() {}, error() {} },
  });

  assert.equal(result, 'processed');
  assert.equal(failures, 0);
});

test('worker records an unexpected processor crash with bounded retry metadata', async () => {
  const failures: unknown[] = [];
  const job = { jobId: 'job_1', attempts: 1, maxAttempts: 3, payload: {} };
  const result = await processNextRecommendationJob({
    queue: {
      claimNextJob: async () => job,
      failJob: async (...args) => { failures.push(args); },
    },
    processJob: async () => {
      throw Object.assign(new Error('provider unavailable'), { code: 'UPSTREAM', retryable: true });
    },
    workerId: 'worker_test',
    pollIntervalMs: 100,
    leaseMs: 1_000,
    signal: new AbortController().signal,
    logger: { info() {}, warn() {}, error() {} },
    now: () => Date.parse('2026-08-22T12:00:00.000Z'),
    random: () => 0,
  });

  assert.equal(result, 'failed');
  assert.deepEqual(failures, [[
    'job_1',
    'worker_test',
    { code: 'UPSTREAM', retryable: true, retryAt: '2026-08-22T12:00:01.000Z' },
  ]]);
});
