import type { FastifyPluginAsync } from 'fastify';

import { authenticatedUserId } from '../middleware/auth.js';
import { ApiError, ResourceNotFoundError } from '../middleware/errors.js';
import type { ApiServices } from './contracts.js';
import {
  heartBodySchema,
  idempotencyKeySchema,
  matchBodySchema,
  matchParamsSchema,
  personParamsSchema,
  relationshipListQuerySchema,
} from './schemas.js';

export interface RelationshipRoutesOptions {
  readonly services: Pick<ApiServices, 'relationships'>;
}

function requiredIdempotencyKey(value: string | string[] | undefined): string {
  const result = idempotencyKeySchema.safeParse(value);
  if (!result.success) {
    throw new ApiError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'A valid Idempotency-Key header is required.');
  }
  return result.data;
}

export const relationshipRoutes: FastifyPluginAsync<RelationshipRoutesOptions> = async (
  app,
  options,
) => {
  app.get('/v1/me/hearts', { preHandler: app.authenticate }, async (request) => {
    const query = relationshipListQuerySchema.parse(request.query);
    const hearts = await options.services.relationships.listOutgoingHearts(
      authenticatedUserId(request),
      { limit: query.limit },
    );
    return { hearts };
  });

  app.get('/v1/me/hearts/:personId', { preHandler: app.authenticate }, async (request) => {
    const { personId } = personParamsSchema.parse(request.params);
    const heart = await options.services.relationships.getOutgoingHeart(
      authenticatedUserId(request),
      personId,
    );
    if (!heart) throw new ResourceNotFoundError();
    return heart;
  });

  app.put('/v1/me/hearts/:personId', { preHandler: app.authenticate }, async (request) => {
    const { personId } = personParamsSchema.parse(request.params);
    const actorUserId = authenticatedUserId(request);
    if (personId === actorUserId) {
      throw new ApiError(400, 'INVALID_TARGET', 'personId must identify another person.');
    }
    const body = heartBodySchema.parse(request.body);
    return options.services.relationships.expressHeart({
      actorUserId,
      targetUserId: personId,
      expectedVersion: body.expectedVersion,
      idempotencyKey: requiredIdempotencyKey(request.headers['idempotency-key']),
    });
  });

  app.delete('/v1/me/hearts/:personId', { preHandler: app.authenticate }, async (request) => {
    const { personId } = personParamsSchema.parse(request.params);
    const actorUserId = authenticatedUserId(request);
    if (personId === actorUserId) {
      throw new ApiError(400, 'INVALID_TARGET', 'personId must identify another person.');
    }
    const body = heartBodySchema.parse(request.body);
    return options.services.relationships.withdrawHeart({
      actorUserId,
      targetUserId: personId,
      expectedVersion: body.expectedVersion,
      idempotencyKey: requiredIdempotencyKey(request.headers['idempotency-key']),
    });
  });

  app.get('/v1/me/matches', { preHandler: app.authenticate }, async (request) => {
    const query = relationshipListQuerySchema.parse(request.query);
    const matches = await options.services.relationships.listMatches(
      authenticatedUserId(request),
      { limit: query.limit },
    );
    return { matches };
  });

  app.get('/v1/me/matches/:matchId', { preHandler: app.authenticate }, async (request) => {
    const { matchId } = matchParamsSchema.parse(request.params);
    const match = await options.services.relationships.getMatch(
      authenticatedUserId(request),
      matchId,
    );
    if (!match) throw new ResourceNotFoundError();
    return match;
  });

  app.delete('/v1/me/matches/:matchId', { preHandler: app.authenticate }, async (request) => {
    const { matchId } = matchParamsSchema.parse(request.params);
    const body = matchBodySchema.parse(request.body);
    const result = await options.services.relationships.unmatch({
      actorUserId: authenticatedUserId(request),
      matchId,
      expectedVersion: body.expectedVersion,
      idempotencyKey: requiredIdempotencyKey(request.headers['idempotency-key']),
    });
    if (!result) throw new ResourceNotFoundError();
    return result;
  });
};
