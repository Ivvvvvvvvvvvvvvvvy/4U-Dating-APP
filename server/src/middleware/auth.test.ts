import assert from 'node:assert/strict';
import test from 'node:test';

import type { FastifyRequest } from 'fastify';
import {
  exportJWK,
  generateKeyPair,
  SignJWT,
  type CryptoKey,
  type JWK,
  type JWTPayload,
  type JWTHeaderParameters,
} from 'jose';

import { createJwksAuthVerifier } from './auth.js';
import { ApiError } from './errors.js';

const ISSUER = 'https://identity.example.test';
const AUDIENCE = 'for-u-api';
const JWKS_URL = `${ISSUER}/.well-known/jwks.json`;
const REQUEST = {} as FastifyRequest;

interface SigningKey {
  readonly privateKey: CryptoKey;
  readonly publicJwk: JWK;
}

async function createSigningKey(kid: string): Promise<SigningKey> {
  const { privateKey, publicKey } = await generateKeyPair('RS256', { extractable: true });
  return {
    privateKey,
    publicJwk: {
      ...await exportJWK(publicKey),
      alg: 'RS256',
      kid,
      use: 'sig',
    },
  };
}

function validClaims(overrides: JWTPayload = {}): JWTPayload {
  return {
    iss: ISSUER,
    aud: AUDIENCE,
    sub: 'person_123',
    exp: Math.floor(Date.now() / 1_000) + 300,
    ...overrides,
  };
}

function signToken(
  privateKey: CryptoKey,
  claims: JWTPayload,
  protectedHeader: JWTHeaderParameters = { alg: 'RS256', kid: 'key-a' },
): Promise<string> {
  return new SignJWT(claims).setProtectedHeader(protectedHeader).sign(privateKey);
}

function countingFetch(responder: () => Response | Promise<Response>): {
  readonly fetch: typeof globalThis.fetch;
  readonly calls: () => number;
} {
  let calls = 0;
  const fetch = (async () => {
    calls += 1;
    return responder();
  }) as typeof globalThis.fetch;
  return { fetch, calls: () => calls };
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

test('JWKS verifier validates RS256 claims, preserves scope semantics, and caches keys', async () => {
  const key = await createSigningKey('key-a');
  const remote = countingFetch(() => jsonResponse({ keys: [key.publicJwk] }));
  const verifier = createJwksAuthVerifier({
    issuer: ISSUER,
    audience: AUDIENCE,
    jwksUrl: JWKS_URL,
    fetch: remote.fetch,
  });

  const scopeToken = await signToken(
    key.privateKey,
    validClaims({ aud: ['another-api', AUDIENCE], scope: 'read write', scp: ['ignored'] }),
    { alg: 'RS256', kid: 'key-a', typ: 'JWT' },
  );
  assert.deepEqual(await verifier.verifyBearerToken(scopeToken, REQUEST), {
    userId: 'person_123',
    subject: 'person_123',
    scopes: ['read', 'write'],
  });

  const scpToken = await signToken(
    key.privateKey,
    validClaims({ scp: ['profile:read', 'events:read'] }),
    { alg: 'RS256', kid: 'key-a', typ: 'at+jwt' },
  );
  assert.deepEqual(await verifier.verifyBearerToken(scpToken, REQUEST), {
    userId: 'person_123',
    subject: 'person_123',
    scopes: ['profile:read', 'events:read'],
  });

  const now = Math.floor(Date.now() / 1_000);
  const tokenWithoutTypOrScopes = await signToken(
    key.privateKey,
    validClaims({ exp: now - 10, nbf: now + 10 }),
  );
  assert.deepEqual(await verifier.verifyBearerToken(tokenWithoutTypOrScopes, REQUEST), {
    userId: 'person_123',
    subject: 'person_123',
  });
  assert.equal(remote.calls(), 1);
});

test('JWKS verifier rejects invalid headers, claims, and signatures', async () => {
  const key = await createSigningKey('key-a');
  const otherKey = await createSigningKey('other-key');
  const remote = countingFetch(() => jsonResponse({ keys: [key.publicJwk] }));
  const verifier = createJwksAuthVerifier({
    issuer: ISSUER,
    audience: AUDIENCE,
    jwksUrl: JWKS_URL,
    clockToleranceSeconds: 0,
    fetch: remote.fetch,
  });

  const invalidHeaders = [
    await signToken(key.privateKey, validClaims(), { alg: 'RS256', kid: 'key-a', typ: 'not-a-jwt' }),
    await signToken(key.privateKey, validClaims(), { alg: 'RS256', typ: 'JWT' }),
    await new SignJWT(validClaims())
      .setProtectedHeader({ alg: 'HS256', kid: 'symmetric-key' })
      .sign(new TextEncoder().encode('a-test-secret-that-is-at-least-32-bytes')),
  ];
  for (const token of invalidHeaders) {
    assert.equal(await verifier.verifyBearerToken(token, REQUEST), null);
  }
  assert.equal(remote.calls(), 0, 'rejected headers must not trigger a JWKS request');

  const now = Math.floor(Date.now() / 1_000);
  const invalidTokens: readonly [string, string][] = [
    ['issuer', await signToken(key.privateKey, validClaims({ iss: 'https://other.example.test' }))],
    ['audience', await signToken(key.privateKey, validClaims({ aud: 'other-api' }))],
    ['empty subject', await signToken(key.privateKey, validClaims({ sub: '' }))],
    ['missing expiration', await signToken(key.privateKey, { iss: ISSUER, aud: AUDIENCE, sub: 'person_123' })],
    ['expired', await signToken(key.privateKey, validClaims({ exp: now - 1 }))],
    ['not active', await signToken(key.privateKey, validClaims({ nbf: now + 60 }))],
    ['signature', await signToken(otherKey.privateKey, validClaims(), { alg: 'RS256', kid: 'key-a' })],
  ];
  for (const [name, token] of invalidTokens) {
    assert.equal(await verifier.verifyBearerToken(token, REQUEST), null, name);
  }
  assert.equal(remote.calls(), 1);
});

test('unknown kids are cooled down and concurrent misses do not amplify JWKS requests', async () => {
  const knownKey = await createSigningKey('known-key');
  const unknownKey = await createSigningKey('unknown-key');
  const remote = countingFetch(async () => {
    await new Promise<void>((resolve) => setImmediate(resolve));
    return jsonResponse({ keys: [knownKey.publicJwk] });
  });
  const verifier = createJwksAuthVerifier({
    issuer: ISSUER,
    audience: AUDIENCE,
    jwksUrl: JWKS_URL,
    fetch: remote.fetch,
  });
  const unknownToken = await signToken(
    unknownKey.privateKey,
    validClaims(),
    { alg: 'RS256', kid: 'unknown-key' },
  );

  const misses = await Promise.all(
    Array.from({ length: 12 }, () => verifier.verifyBearerToken(unknownToken, REQUEST)),
  );
  assert.ok(misses.every((principal) => principal === null));
  assert.equal(remote.calls(), 1, 'cold concurrent misses must share one fetch');

  assert.equal(await verifier.verifyBearerToken(unknownToken, REQUEST), null);
  assert.equal(remote.calls(), 1, 'unknown kid retries during cooldown must not refetch');

  const knownToken = await signToken(
    knownKey.privateKey,
    validClaims(),
    { alg: 'RS256', kid: 'known-key' },
  );
  assert.equal((await verifier.verifyBearerToken(knownToken, REQUEST))?.userId, 'person_123');
  assert.equal(remote.calls(), 1);
});

test('JWKS endpoint failures fail closed as AUTH_UNAVAILABLE', async () => {
  const key = await createSigningKey('key-a');
  const token = await signToken(key.privateKey, validClaims());
  const failingFetches: readonly [string, typeof globalThis.fetch][] = [
    ['network failure', countingFetch(() => { throw new Error('connection refused'); }).fetch],
    ['non-200 response', countingFetch(() => jsonResponse({}, 503)).fetch],
    ['invalid JSON', countingFetch(() => new Response('{', { status: 200 })).fetch],
    ['invalid JWKS', countingFetch(() => jsonResponse({ notKeys: [] })).fetch],
  ];

  for (const [name, fetch] of failingFetches) {
    const verifier = createJwksAuthVerifier({
      issuer: ISSUER,
      audience: AUDIENCE,
      jwksUrl: JWKS_URL,
      fetch,
    });
    await assert.rejects(
      verifier.verifyBearerToken(token, REQUEST),
      (error: unknown) => error instanceof ApiError
        && error.statusCode === 503
        && error.code === 'AUTH_UNAVAILABLE',
      name,
    );
  }
});
