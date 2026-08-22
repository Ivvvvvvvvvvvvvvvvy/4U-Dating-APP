import { randomUUID } from 'node:crypto';

import { z } from 'zod';

const booleanFromEnvironment = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true');

const optionalSecret = z
  .string()
  .trim()
  .transform((value) => value || undefined)
  .optional();

export const MAX_OPENAI_RETRY_BACKOFF_MS = 2_000;
export const DEFAULT_WORKER_COMPLETION_MARGIN_MS = 5_000;

const sharedEnvironmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  DATABASE_URL: z.string().url().startsWith('postgresql://'),
  DATABASE_SSL: booleanFromEnvironment.default(false),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
  DATABASE_IDLE_TIMEOUT_MS: z.coerce.number().int().min(1_000).default(30_000),
  DATABASE_CONNECTION_TIMEOUT_MS: z.coerce.number().int().min(250).default(5_000),
  DATABASE_STATEMENT_TIMEOUT_MS: z.coerce.number().int().min(250).default(15_000),
  AI_REFINEMENT_ENABLED: booleanFromEnvironment.default(false),
  OPENAI_MODEL: z.string().trim().min(1).default('gpt-5.6-sol'),
  RECOMMENDATION_RULES_VERSION: z.string().trim().min(1).max(120).default('compatibility-rules-v1'),
  AI_PROMPT_VERSION: z.string().trim().min(1).max(120).default('compatibility-explanation-v1'),
});

// Deliberately excludes OPENAI_API_KEY and all provider transport settings.
// Zod strips unknown environment keys, so the API loader never copies those
// values into its runtime configuration.
const apiEnvironmentSchema = sharedEnvironmentSchema.extend({
  HOST: z.string().min(1).default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  TRUST_PROXY: booleanFromEnvironment.default(false),
  CORS_ALLOWED_ORIGINS: z.string().optional(),
  CORS_ORIGINS: z.string().optional(),
  DEV_API_TOKEN: optionalSecret,
  DEV_USER_ID: z.string().trim().min(1).optional(),
  DEV_AUTH_USER_ID: z.string().trim().min(1).optional(),
  RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(100_000).default(120),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1_000).default(60_000),
  BODY_LIMIT_BYTES: z.coerce.number().int().min(1_024).max(10 * 1_024 * 1_024).default(262_144),
  AUTH_MODE: z.enum(['dev', 'jwt']).default('dev'),
  DEV_AUTH_TOKEN: optionalSecret,
  JWT_ISSUER: optionalSecret,
  JWT_AUDIENCE: optionalSecret,
  JWT_JWKS_URL: z.string().url().refine((url) => url.startsWith('https://'), {
    message: 'JWT_JWKS_URL must use HTTPS',
  }).optional(),
});

const workerEnvironmentSchema = sharedEnvironmentSchema.extend({
  WORKER_ID: optionalSecret,
  WORKER_POLL_MS: z.coerce.number().int().min(100).default(1_000),
  // The repository caps claimed leases at one hour. Reject larger values here
  // instead of validating a duration that the database would silently reduce.
  WORKER_LEASE_MS: z.coerce.number().int().min(1_000).max(3_600_000).default(60_000),
  WORKER_COMPLETION_MARGIN_MS: z.coerce.number().int().min(1_000).max(600_000)
    .default(DEFAULT_WORKER_COMPLETION_MARGIN_MS),
});

const enabledWorkerEnvironmentSchema = workerEnvironmentSchema.extend({
  OPENAI_API_KEY: z.string().trim().min(1, 'OPENAI_API_KEY is required when AI_REFINEMENT_ENABLED=true'),
  OPENAI_BASE_URL: z.string().url().default('https://api.openai.com/v1'),
  OPENAI_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(3_600_000).default(12_000),
  OPENAI_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(3).default(2),
});

type SharedConfig = {
  environment: z.infer<typeof sharedEnvironmentSchema>['NODE_ENV'];
  logLevel: z.infer<typeof sharedEnvironmentSchema>['LOG_LEVEL'];
  aiRefinementEnabled: boolean;
  database: {
    connectionString: string;
    ssl: boolean;
    maxConnections: number;
    idleTimeoutMs: number;
    connectionTimeoutMs: number;
    statementTimeoutMs: number;
  };
  openai: {
    model: string;
    rulesVersion: string;
    promptVersion: string;
  };
};

export type ApiConfig = SharedConfig & {
  host: string;
  port: number;
  trustProxy: boolean;
  corsAllowedOrigins: readonly string[];
  devAuthToken: string;
  devUserId: string;
  rateLimitMax: number;
  rateLimitWindowMs: number;
  bodyLimitBytes: number;
  authMode: 'dev' | 'jwt';
  jwt: {
    issuer?: string;
    audience?: string;
    jwksUrl?: string;
  };
};

type WorkerConfigBase = SharedConfig & {
  workerId: string;
  workerPollMs: number;
  workerLeaseMs: number;
  workerCompletionMarginMs: number;
};

export type WorkerConfig =
  | (WorkerConfigBase & { aiRefinementEnabled: false })
  | (WorkerConfigBase & {
      aiRefinementEnabled: true;
      openai: SharedConfig['openai'] & {
        apiKey: string;
        baseUrl: string;
        timeoutMs: number;
        maxAttempts: number;
      };
    });

/** Backward-compatible name for code that only needs the API/common shape. */
export type AppConfig = ApiConfig;

type ParsedSharedEnvironment = z.infer<typeof sharedEnvironmentSchema>;

function toSharedConfig(parsed: ParsedSharedEnvironment): SharedConfig {
  return {
    environment: parsed.NODE_ENV,
    logLevel: parsed.LOG_LEVEL,
    aiRefinementEnabled: parsed.AI_REFINEMENT_ENABLED,
    database: {
      connectionString: parsed.DATABASE_URL,
      ssl: parsed.DATABASE_SSL,
      maxConnections: parsed.DATABASE_POOL_MAX,
      idleTimeoutMs: parsed.DATABASE_IDLE_TIMEOUT_MS,
      connectionTimeoutMs: parsed.DATABASE_CONNECTION_TIMEOUT_MS,
      statementTimeoutMs: parsed.DATABASE_STATEMENT_TIMEOUT_MS,
    },
    openai: {
      model: parsed.OPENAI_MODEL,
      rulesVersion: parsed.RECOMMENDATION_RULES_VERSION,
      promptVersion: parsed.AI_PROMPT_VERSION,
    },
  };
}

/**
 * Conservative upper bound used for lease validation. It treats the timeout as
 * a per-attempt budget and includes the largest supported retry delay between
 * attempts, even though the current provider applies a tighter aggregate
 * deadline.
 */
export function maximumModelProcessingMs(timeoutMs: number, maxAttempts: number): number {
  return timeoutMs * maxAttempts + MAX_OPENAI_RETRY_BACKOFF_MS * (maxAttempts - 1);
}

export function loadApiConfig(environment: NodeJS.ProcessEnv = process.env): ApiConfig {
  const parsed = apiEnvironmentSchema.parse(environment);
  const corsAllowedOrigins = [...new Set(
    (parsed.CORS_ALLOWED_ORIGINS ?? parsed.CORS_ORIGINS ?? '').split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  )];
  const devAuthToken = parsed.DEV_AUTH_TOKEN ?? parsed.DEV_API_TOKEN;
  if (parsed.NODE_ENV === 'production' && parsed.AUTH_MODE === 'dev') {
    throw new Error('AUTH_MODE=dev is forbidden in production');
  }
  if (parsed.AUTH_MODE === 'dev' && !devAuthToken) {
    throw new Error('DEV_AUTH_TOKEN is required when AUTH_MODE=dev');
  }
  if (parsed.AUTH_MODE === 'jwt'
    && (!parsed.JWT_ISSUER || !parsed.JWT_AUDIENCE || !parsed.JWT_JWKS_URL)) {
    throw new Error('JWT_ISSUER, JWT_AUDIENCE, and JWT_JWKS_URL are required when AUTH_MODE=jwt');
  }

  return {
    ...toSharedConfig(parsed),
    host: parsed.HOST,
    port: parsed.PORT,
    trustProxy: parsed.TRUST_PROXY,
    corsAllowedOrigins,
    devAuthToken: devAuthToken ?? '',
    devUserId: parsed.DEV_USER_ID ?? parsed.DEV_AUTH_USER_ID ?? 'person_me',
    rateLimitMax: parsed.RATE_LIMIT_MAX,
    rateLimitWindowMs: parsed.RATE_LIMIT_WINDOW_MS,
    bodyLimitBytes: parsed.BODY_LIMIT_BYTES,
    authMode: parsed.AUTH_MODE,
    jwt: {
      ...(parsed.JWT_ISSUER ? { issuer: parsed.JWT_ISSUER } : {}),
      ...(parsed.JWT_AUDIENCE ? { audience: parsed.JWT_AUDIENCE } : {}),
      ...(parsed.JWT_JWKS_URL ? { jwksUrl: parsed.JWT_JWKS_URL } : {}),
    },
  };
}

export function loadWorkerConfig(environment: NodeJS.ProcessEnv = process.env): WorkerConfig {
  // Parse the non-sensitive switch first. When disabled, provider-only fields
  // are not part of the selected schema and are therefore neither required nor
  // retained in the returned worker configuration.
  const aiRefinementEnabled = booleanFromEnvironment.default(false)
    .parse(environment.AI_REFINEMENT_ENABLED);
  const parsed = aiRefinementEnabled
    ? enabledWorkerEnvironmentSchema.parse(environment)
    : workerEnvironmentSchema.parse(environment);
  const base = {
    ...toSharedConfig(parsed),
    workerId: parsed.WORKER_ID ?? `for-u-worker-${randomUUID()}`,
    workerPollMs: parsed.WORKER_POLL_MS,
    workerLeaseMs: parsed.WORKER_LEASE_MS,
    workerCompletionMarginMs: parsed.WORKER_COMPLETION_MARGIN_MS,
  };

  if (!aiRefinementEnabled) {
    return { ...base, aiRefinementEnabled: false };
  }

  const enabled = parsed as z.infer<typeof enabledWorkerEnvironmentSchema>;
  const modelProcessingMs = maximumModelProcessingMs(
    enabled.OPENAI_TIMEOUT_MS, enabled.OPENAI_MAX_ATTEMPTS,
  );
  const protectedProcessingMs = modelProcessingMs + enabled.WORKER_COMPLETION_MARGIN_MS;
  if (enabled.WORKER_LEASE_MS <= protectedProcessingMs) {
    throw new Error(
      `WORKER_LEASE_MS must be greater than ${protectedProcessingMs}ms `
      + `(OPENAI_TIMEOUT_MS * OPENAI_MAX_ATTEMPTS + up to `
      + `${MAX_OPENAI_RETRY_BACKOFF_MS}ms per retry + WORKER_COMPLETION_MARGIN_MS)`,
    );
  }

  return {
    ...base,
    aiRefinementEnabled: true,
    openai: {
      ...base.openai,
      apiKey: enabled.OPENAI_API_KEY,
      baseUrl: enabled.OPENAI_BASE_URL,
      timeoutMs: enabled.OPENAI_TIMEOUT_MS,
      maxAttempts: enabled.OPENAI_MAX_ATTEMPTS,
    },
  };
}

/** Existing callers load the secret-free API configuration by default. */
export function loadConfig(environment: NodeJS.ProcessEnv = process.env): ApiConfig {
  return loadApiConfig(environment);
}
