import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';

export interface ApiErrorBody {
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly requestId: string;
  };
}

export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly headers?: Readonly<Record<string, string>>;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    options?: { cause?: unknown; headers?: Readonly<Record<string, string>> },
  ) {
    super(message, { cause: options?.cause });
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    if (options?.headers !== undefined) this.headers = options.headers;
  }
}

export class VersionConflictError extends ApiError {
  constructor(message = 'The resource changed; fetch the latest version and retry.') {
    super(409, 'VERSION_CONFLICT', message);
  }
}

export class ResourceNotFoundError extends ApiError {
  constructor(message = 'The requested resource was not found.') {
    super(404, 'NOT_FOUND', message);
  }
}

export function sendApiError(
  reply: FastifyReply,
  request: FastifyRequest,
  statusCode: number,
  code: string,
  message: string,
): FastifyReply {
  const body: ApiErrorBody = { error: { code, message, requestId: request.id } };
  return reply.code(statusCode).send(body);
}

function repositoryError(error: unknown): ApiError | undefined {
  if (!error || typeof error !== 'object') return undefined;

  const code = 'code' in error && typeof error.code === 'string' ? error.code : undefined;
  const name = 'name' in error && typeof error.name === 'string' ? error.name : undefined;
  if (code === 'VERSION_CONFLICT' || name === 'VersionConflictError') {
    return new VersionConflictError();
  }
  if (code === 'NOT_FOUND' || name === 'NotFoundError') {
    return new ResourceNotFoundError();
  }
  if (code === 'DUPLICATE_EVENT_CONFLICT' || code === 'IDEMPOTENCY_CONFLICT') {
    return new ApiError(409, code, 'The idempotency key was already used with different input.');
  }
  if (code === 'RELATIONSHIP_STATE_CONFLICT') {
    return new ApiError(409, code, 'The relationship cannot transition from its current state.');
  }
  if (code === 'VALIDATION_ERROR') {
    return new ApiError(400, code, 'The request is invalid.');
  }
  return undefined;
}

export function registerErrorHandling(app: FastifyInstance): void {
  app.setNotFoundHandler((request, reply) =>
    sendApiError(reply, request, 404, 'NOT_FOUND', 'The requested route was not found.'),
  );

  app.setErrorHandler((error: FastifyError | ZodError | ApiError, request, reply) => {
    let normalized: ApiError;

    if (error instanceof ApiError) {
      normalized = error;
    } else if (error instanceof ZodError) {
      normalized = new ApiError(400, 'VALIDATION_ERROR', 'The request is invalid.', { cause: error });
    } else {
      const mappedRepositoryError = repositoryError(error);
      if (mappedRepositoryError) {
        normalized = mappedRepositoryError;
      } else if (error.statusCode === 404) {
        // Candidate ineligibility and authorization failures are intentionally
        // indistinguishable from a missing resource. Do not expose their cause.
        normalized = new ResourceNotFoundError();
      } else if (error.statusCode === 429) {
        normalized = new ApiError(429, 'RATE_LIMITED', 'Too many requests; try again later.');
      } else if (error.statusCode === 400) {
        normalized = new ApiError(400, 'VALIDATION_ERROR', 'The request is invalid.');
      } else {
        request.log.error({ err: error }, 'request failed');
        normalized = new ApiError(500, 'INTERNAL_ERROR', 'An unexpected error occurred.');
      }
    }

    for (const [name, value] of Object.entries(normalized.headers ?? {})) reply.header(name, value);
    return sendApiError(reply, request, normalized.statusCode, normalized.code, normalized.message);
  });
}
