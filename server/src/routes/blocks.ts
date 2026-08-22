import type { FastifyPluginAsync } from 'fastify';

import { authenticatedUserId } from '../middleware/auth.js';
import { ApiError, ResourceNotFoundError } from '../middleware/errors.js';
import type { ApiServices } from './contracts.js';
import { blockBodySchema, blockListQuerySchema, personParamsSchema, idempotencyKeySchema } from './schemas.js';

export interface BlockRoutesOptions {
  readonly services: Pick<ApiServices, 'blocks'>;
}

function requiredIdempotencyKey(value: string | string[] | undefined): string {
  const result = idempotencyKeySchema.safeParse(value);
  if (!result.success) {
    throw new ApiError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'A valid Idempotency-Key header is required.');
  }
  return result.data;
}

export const blockRoutes: FastifyPluginAsync<BlockRoutesOptions> = async (app, options) => {
  app.get('/v1/me/blocks', { preHandler: app.authenticate }, async (request) => {
    const query = blockListQuerySchema.parse(request.query);
    const blocks = await options.services.blocks.listByBlocker(
      authenticatedUserId(request),
      query.limit,
    );
    return { blocks };
  });

  app.get('/v1/me/blocks/:personId', { preHandler: app.authenticate }, async (request) => {
    const { personId } = personParamsSchema.parse(request.params);
    const block = await options.services.blocks.get(authenticatedUserId(request), personId);
    if (!block) throw new ResourceNotFoundError();
    return block;
  });

  app.put('/v1/me/blocks/:personId', { preHandler: app.authenticate }, async (request) => {
    const { personId } = personParamsSchema.parse(request.params);
    const blockerUserId = authenticatedUserId(request);
    if (personId === blockerUserId) {
      throw new ApiError(400, 'INVALID_TARGET', 'personId must identify another person.');
    }
    const body = blockBodySchema.parse(request.body);
    return options.services.blocks.set({
      blockerUserId,
      blockedUserId: personId,
      expectedVersion: body.expectedVersion,
      idempotencyKey: requiredIdempotencyKey(request.headers['idempotency-key']),
    });
  });

  app.delete('/v1/me/blocks/:personId', { preHandler: app.authenticate }, async (request) => {
    const { personId } = personParamsSchema.parse(request.params);
    const blockerUserId = authenticatedUserId(request);
    if (personId === blockerUserId) {
      throw new ApiError(400, 'INVALID_TARGET', 'personId must identify another person.');
    }
    const body = blockBodySchema.parse(request.body);
    return options.services.blocks.remove({
      blockerUserId,
      blockedUserId: personId,
      expectedVersion: body.expectedVersion,
      idempotencyKey: requiredIdempotencyKey(request.headers['idempotency-key']),
    });
  });
};
