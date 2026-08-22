import assert from 'node:assert/strict';
import test from 'node:test';

import {
  loadApiConfig,
  loadConfig,
  loadWorkerConfig,
  maximumModelProcessingMs,
} from './config.js';

const baseEnvironment = {
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/for_u',
  DEV_AUTH_TOKEN: 'test-only-token',
};

test('loadConfig supplies fail-closed API defaults and current model identity', () => {
  const config = loadConfig(baseEnvironment);
  assert.equal(config.environment, 'development');
  assert.equal(config.authMode, 'dev');
  assert.equal(config.port, 3000);
  assert.equal(config.aiRefinementEnabled, false);
  assert.equal(config.openai.model, 'gpt-5.6-sol');
  assert.equal('apiKey' in config.openai, false);
  assert.equal('baseUrl' in config.openai, false);
  assert.equal('timeoutMs' in config.openai, false);
});

test('API configuration uses only the non-secret refinement switch and identity', () => {
  const config = loadApiConfig({
    ...baseEnvironment,
    AI_REFINEMENT_ENABLED: 'true',
    OPENAI_API_KEY: 'must-not-enter-api-config',
    OPENAI_BASE_URL: 'not a URL and deliberately ignored by the API loader',
    OPENAI_TIMEOUT_MS: 'not-a-number',
    OPENAI_MAX_ATTEMPTS: 'not-a-number',
    OPENAI_MODEL: 'model-release-42',
    AI_PROMPT_VERSION: 'prompt-release-9',
  });

  assert.equal(config.aiRefinementEnabled, true);
  assert.equal(config.openai.model, 'model-release-42');
  assert.equal(config.openai.promptVersion, 'prompt-release-9');
  assert.equal('apiKey' in config.openai, false);
  assert.equal('baseUrl' in config.openai, false);
  assert.equal('timeoutMs' in config.openai, false);
  assert.equal('maxAttempts' in config.openai, false);
});

test('loadConfig rejects development authentication in production', () => {
  assert.throws(
    () => loadConfig({ ...baseEnvironment, NODE_ENV: 'production', AUTH_MODE: 'dev' }),
    /forbidden in production/,
  );
});

test('loadConfig never supplies a predictable development credential', () => {
  assert.throws(
    () => loadConfig({ DATABASE_URL: baseEnvironment.DATABASE_URL }),
    /DEV_AUTH_TOKEN is required/,
  );
});

test('loadConfig requires the complete JWT verifier contract', () => {
  assert.throws(
    () => loadConfig({ ...baseEnvironment, AUTH_MODE: 'jwt', JWT_ISSUER: 'https://id.example' }),
    /JWT_ISSUER, JWT_AUDIENCE, and JWT_JWKS_URL/,
  );
  const config = loadConfig({
    ...baseEnvironment,
    NODE_ENV: 'production',
    AUTH_MODE: 'jwt',
    JWT_ISSUER: 'https://id.example',
    JWT_AUDIENCE: 'for-u-api',
    JWT_JWKS_URL: 'https://id.example/jwks.json',
  });
  assert.equal(config.authMode, 'jwt');
  assert.equal(config.jwt.audience, 'for-u-api');
  assert.equal(config.aiRefinementEnabled, false);
});

test('disabled worker does not require or retain provider configuration', () => {
  const config = loadWorkerConfig({
    DATABASE_URL: baseEnvironment.DATABASE_URL,
    OPENAI_API_KEY: 'ignored-while-disabled',
    OPENAI_BASE_URL: 'invalid-and-ignored',
  });

  assert.equal(config.aiRefinementEnabled, false);
  assert.equal('apiKey' in config.openai, false);
  assert.equal('baseUrl' in config.openai, false);
});

test('enabled worker requires its provider secret', () => {
  assert.throws(
    () => loadWorkerConfig({
      DATABASE_URL: baseEnvironment.DATABASE_URL,
      AI_REFINEMENT_ENABLED: 'true',
    }),
    /OPENAI_API_KEY/,
  );
});

test('enabled worker validates lease against attempts, retry backoff, and completion margin', () => {
  const enabledEnvironment = {
    DATABASE_URL: baseEnvironment.DATABASE_URL,
    AI_REFINEMENT_ENABLED: 'true',
    OPENAI_API_KEY: 'worker-only-secret',
    OPENAI_TIMEOUT_MS: '12000',
    OPENAI_MAX_ATTEMPTS: '2',
    WORKER_COMPLETION_MARGIN_MS: '5000',
  };
  assert.equal(maximumModelProcessingMs(12_000, 2), 26_000);
  assert.throws(
    () => loadWorkerConfig({ ...enabledEnvironment, WORKER_LEASE_MS: '31000' }),
    /WORKER_LEASE_MS must be greater than 31000ms/,
  );

  const config = loadWorkerConfig({ ...enabledEnvironment, WORKER_LEASE_MS: '31001' });
  assert.equal(config.aiRefinementEnabled, true);
  if (!config.aiRefinementEnabled) assert.fail('expected enabled worker configuration');
  assert.equal(config.openai.apiKey, 'worker-only-secret');
  assert.equal(config.openai.model, 'gpt-5.6-sol');
  assert.equal(config.workerLeaseMs, 31_001);
});
