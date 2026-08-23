import { timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  createRemoteJWKSet,
  createLocalJWKSet,
  customFetch,
  decodeProtectedHeader,
  errors as joseErrors,
  jwtVerify,
  type FetchImplementation,
  type JWTPayload,
  type JSONWebKeySet,
} from 'jose';
import { ApiError } from './errors.js';

export interface AuthenticatedPrincipal {
  readonly userId: string;
  readonly subject?: string;
  readonly scopes?: readonly string[];
}

declare module 'fastify' {
  interface FastifyRequest {
    principal?: AuthenticatedPrincipal;
  }
}

export interface DevBearerAuthOptions {
  readonly token: string;
  readonly userId: string;
}

export interface AuthVerifier {
  readonly kind: 'external' | 'development';
  verifyBearerToken(token: string, request: FastifyRequest): Promise<AuthenticatedPrincipal | null>;
}

export interface JwksAuthVerifierOptions {
  readonly issuer: string;
  readonly audience: string;
  readonly jwksUrl: string;
  readonly cacheTtlMs?: number;
  readonly clockToleranceSeconds?: number;
  readonly fetch?: typeof globalThis.fetch;
}

export interface LocalJwksAuthVerifierOptions {
  readonly issuer: string;
  readonly audience: string;
  readonly jwks: JSONWebKeySet;
  readonly clockToleranceSeconds?: number;
}

const JWKS_FETCH_TIMEOUT_MS = 5_000;
const JWKS_COOLDOWN_MS = 30_000;
const DEFAULT_JWKS_CACHE_TTL_MS = 5 * 60_000;

function parseScopes(claims: JWTPayload): readonly string[] | undefined {
  const value = claims.scope ?? claims.scp;
  if (typeof value === 'string') return value.split(' ').filter(Boolean);
  if (Array.isArray(value) && value.every((entry) => typeof entry === 'string')) return value;
  return undefined;
}

function authenticationUnavailable(cause?: unknown): ApiError {
  return new ApiError(503, 'AUTH_UNAVAILABLE', 'The authentication service is unavailable.',
    cause === undefined ? undefined : { cause });
}

function isRemoteJwksError(error: unknown): boolean {
  return error instanceof joseErrors.JWKSTimeout
    || error instanceof joseErrors.JWKSInvalid
    // jose uses this exact base error for an invalid JSON JWKS response.
    || (error instanceof joseErrors.JOSEError
      && error.code === 'ERR_JOSE_GENERIC'
      && error.message === 'Failed to parse the JSON Web Key Set HTTP response as JSON');
}

function equalSecret(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function createDevBearerAuthVerifier(options: DevBearerAuthOptions): AuthVerifier {
  if (!options.token) throw new Error('The development bearer token must not be empty.');
  return {
    kind: 'development',
    async verifyBearerToken(token) {
      return equalSecret(token, options.token) ? { userId: options.userId } : null;
    },
  };
}

/** Fail-closed RS256 verifier backed by jose's bounded remote JWKS cache. */
export function createJwksAuthVerifier(options: JwksAuthVerifierOptions): AuthVerifier {
  const fetchImplementation = options.fetch ?? globalThis.fetch;
  const cacheTtlMs = options.cacheTtlMs ?? DEFAULT_JWKS_CACHE_TTL_MS;
  const clockToleranceSeconds = options.clockToleranceSeconds ?? 30;

  const fetchJwks: FetchImplementation = async (url, init) => {
    try {
      const response = await fetchImplementation(url, init);
      if (response.status !== 200) throw authenticationUnavailable();
      return response;
    } catch (cause) {
      if (cause instanceof ApiError) throw cause;
      throw authenticationUnavailable(cause);
    }
  };

  const remoteJwks = createRemoteJWKSet(new URL(options.jwksUrl), {
    cacheMaxAge: cacheTtlMs,
    cooldownDuration: JWKS_COOLDOWN_MS,
    timeoutDuration: JWKS_FETCH_TIMEOUT_MS,
    [customFetch]: fetchJwks,
  });

  return {
    kind: 'external',
    async verifyBearerToken(token) {
      if (token.length > 16_384) return null;

      try {
        // Preserve the existing requirement for kid and the optional, restricted typ
        // values before any attacker-controlled token can trigger a JWKS request.
        const header = decodeProtectedHeader(token);
        if (header.alg !== 'RS256' || typeof header.kid !== 'string') return null;
        if (header.typ !== undefined && header.typ !== 'JWT' && header.typ !== 'at+jwt') return null;

        const { payload } = await jwtVerify(token, remoteJwks, {
          algorithms: ['RS256'],
          issuer: options.issuer,
          audience: options.audience,
          clockTolerance: clockToleranceSeconds,
          requiredClaims: ['sub', 'exp'],
        });
        if (typeof payload.sub !== 'string' || !payload.sub) return null;

        const scopes = parseScopes(payload);
        return {
          userId: payload.sub,
          subject: payload.sub,
          ...(scopes ? { scopes } : {}),
        };
      } catch (error) {
        if (error instanceof ApiError) throw error;
        if (isRemoteJwksError(error)) throw authenticationUnavailable(error);
        return null;
      }
    },
  };
}

/** Fail-closed RS256 verifier for a locally mounted, deployment-managed JWKS. */
export function createLocalJwksAuthVerifier(options: LocalJwksAuthVerifierOptions): AuthVerifier {
  const localJwks = createLocalJWKSet(options.jwks);
  const clockToleranceSeconds = options.clockToleranceSeconds ?? 30;
  return {
    kind: 'external',
    async verifyBearerToken(token) {
      if (token.length > 16_384) return null;
      try {
        const header = decodeProtectedHeader(token);
        if (header.alg !== 'RS256' || typeof header.kid !== 'string') return null;
        if (header.typ !== undefined && header.typ !== 'JWT' && header.typ !== 'at+jwt') return null;
        const { payload } = await jwtVerify(token, localJwks, {
          algorithms: ['RS256'],
          issuer: options.issuer,
          audience: options.audience,
          clockTolerance: clockToleranceSeconds,
          requiredClaims: ['sub', 'exp'],
        });
        if (typeof payload.sub !== 'string' || !payload.sub) return null;
        const scopes = parseScopes(payload);
        return {
          userId: payload.sub,
          subject: payload.sub,
          ...(scopes ? { scopes } : {}),
        };
      } catch {
        return null;
      }
    },
  };
}

export function registerBearerAuth(app: FastifyInstance, verifier: AuthVerifier): void {
  app.decorateRequest('principal', undefined);

  app.decorate('authenticate', async (request: FastifyRequest) => {
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) {
      throw new ApiError(401, 'UNAUTHORIZED', 'A valid bearer token is required.', {
        headers: { 'www-authenticate': 'Bearer' },
      });
    }

    const token = authorization.slice('Bearer '.length);
    const principal = token ? await verifier.verifyBearerToken(token, request) : null;
    if (!principal) {
      throw new ApiError(401, 'UNAUTHORIZED', 'A valid bearer token is required.', {
        headers: { 'www-authenticate': 'Bearer' },
      });
    }

    request.principal = principal;
  });
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate(request: FastifyRequest): Promise<void>;
  }
}

export function authenticatedUserId(request: FastifyRequest): string {
  if (!request.principal) throw new ApiError(401, 'UNAUTHORIZED', 'Authentication is required.');
  return request.principal.userId;
}
