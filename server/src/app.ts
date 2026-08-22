import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import {
  createDevBearerAuthVerifier,
  createJwksAuthVerifier,
  registerBearerAuth,
  type AuthVerifier,
} from './middleware/auth.js';
import { registerErrorHandling } from './middleware/errors.js';
import { registerRequestMetadata } from './middleware/request.js';
import {
  blockRoutes, eventRoutes, healthRoutes, meRoutes, recommendationRoutes, relationshipRoutes,
} from './routes/index.js';
import type { ApiServices } from './routes/contracts.js';

export interface AppConfig {
  readonly environment?: 'development' | 'test' | 'production';
  readonly authMode?: 'dev' | 'jwt';
  readonly devAuthToken: string;
  readonly devUserId: string;
  readonly corsAllowedOrigins: readonly string[];
  readonly rateLimitMax: number;
  readonly rateLimitWindowMs: number;
  readonly bodyLimitBytes?: number;
  readonly trustProxy?: boolean;
  readonly jwt?: {
    readonly issuer?: string;
    readonly audience?: string;
    readonly jwksUrl?: string;
  };
}

export interface BuildAppOptions {
  readonly config: AppConfig;
  readonly services: ApiServices;
  readonly logger?: FastifyServerOptions['logger'];
  /** Required in production; normally backed by a trusted JWT/JWKS implementation. */
  readonly authVerifier?: AuthVerifier;
}

function assertAppConfig(config: AppConfig): void {
  if (config.authMode !== 'jwt' && !config.devAuthToken) {
    throw new Error('DEV_AUTH_TOKEN must not be empty when AUTH_MODE=dev');
  }
  if (config.authMode !== 'jwt' && !config.devUserId) {
    throw new Error('DEV_USER_ID must not be empty when AUTH_MODE=dev');
  }
  if (!Number.isInteger(config.rateLimitMax) || config.rateLimitMax < 1) {
    throw new Error('RATE_LIMIT_MAX must be a positive integer');
  }
  if (!Number.isInteger(config.rateLimitWindowMs) || config.rateLimitWindowMs < 1) {
    throw new Error('RATE_LIMIT_WINDOW_MS must be a positive integer');
  }
}

export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  assertAppConfig(options.config);
  const jwt = options.config.jwt;
  const configuredVerifier = options.config.authMode === 'jwt'
    && jwt?.issuer && jwt.audience && jwt.jwksUrl
    ? createJwksAuthVerifier({ issuer: jwt.issuer, audience: jwt.audience, jwksUrl: jwt.jwksUrl })
    : undefined;
  if (options.config.authMode === 'jwt' && !options.authVerifier && !configuredVerifier) {
    throw new Error('AUTH_MODE=jwt requires JWT issuer, audience, and JWKS URL configuration.');
  }
  const authVerifier = options.authVerifier ?? configuredVerifier ?? createDevBearerAuthVerifier({
      token: options.config.devAuthToken,
      userId: options.config.devUserId,
    });
  if (options.config.environment === 'production' && authVerifier.kind === 'development') {
    throw new Error('Production requires an external AuthVerifier; static development tokens are forbidden.');
  }
  const app = Fastify({
    bodyLimit: options.config.bodyLimitBytes ?? 256 * 1024,
    logger: options.logger ?? false,
    trustProxy: options.config.trustProxy ?? false,
  });

  registerRequestMetadata(app);
  registerErrorHandling(app);
  registerBearerAuth(app, authVerifier);

  await app.register(cors, {
    origin: options.config.corsAllowedOrigins.length === 0
      ? false
      : [...options.config.corsAllowedOrigins],
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['authorization', 'content-type', 'idempotency-key', 'x-request-id'],
    exposedHeaders: ['location', 'retry-after', 'x-request-id'],
    maxAge: 600,
  });

  await app.register(rateLimit, {
    global: true,
    max: options.config.rateLimitMax,
    timeWindow: options.config.rateLimitWindowMs,
    keyGenerator: (request) => {
      return request.principal ? `${request.principal.userId}:${request.ip}` : request.ip;
    },
    errorResponseBuilder: (request) => ({
      statusCode: 429,
      code: 'RATE_LIMITED',
      message: 'Too many requests; try again later.',
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests; try again later.',
        requestId: request.id,
      },
    }),
  });

  await app.register(healthRoutes, { services: options.services });
  await app.register(eventRoutes, { services: options.services });
  await app.register(meRoutes, { services: options.services });
  await app.register(blockRoutes, { services: options.services });
  await app.register(relationshipRoutes, { services: options.services });
  await app.register(recommendationRoutes, { services: options.services });

  return app;
}
