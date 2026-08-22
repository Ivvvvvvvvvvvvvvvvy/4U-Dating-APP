import type { FastifyPluginAsync } from 'fastify';
import { authenticatedUserId } from '../middleware/auth.js';
import { ApiError, ResourceNotFoundError } from '../middleware/errors.js';
import type { ApiServices } from './contracts.js';
import {
  idempotencyKeySchema,
  recommendationBodySchema,
  recommendationFeedbackBodySchema,
  resultParamsSchema,
} from './schemas.js';

export interface RecommendationRoutesOptions {
  readonly services: Pick<ApiServices, 'recommendations'>;
}

export const recommendationRoutes: FastifyPluginAsync<RecommendationRoutesOptions> = async (app, options) => {
  app.post('/v1/recommendations', { preHandler: app.authenticate }, async (request, reply) => {
    const body = recommendationBodySchema.parse(request.body);
    const viewerId = authenticatedUserId(request);
    if (body.candidateId === viewerId) {
      throw new ApiError(400, 'INVALID_CANDIDATE', 'candidateId must identify another person.');
    }

    const { result } = await options.services.recommendations.request({
      viewerId,
      candidateId: body.candidateId,
      locale: body.locale,
    });
    reply.header('location', `/v1/recommendations/${encodeURIComponent(result.resultId)}`);
    return reply.code(result.state === 'PENDING' ? 202 : 200).send(result);
  });

  app.get('/v1/recommendations/:resultId', { preHandler: app.authenticate }, async (request) => {
    const { resultId } = resultParamsSchema.parse(request.params);
    const result = await options.services.recommendations.getForViewer(
      authenticatedUserId(request),
      resultId,
    );
    if (!result) throw new ResourceNotFoundError();
    return result;
  });

  app.post(
    '/v1/recommendations/:resultId/feedback',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const { resultId } = resultParamsSchema.parse(request.params);
      const parsedKey = idempotencyKeySchema.safeParse(request.headers['idempotency-key']);
      if (!parsedKey.success) {
        throw new ApiError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'A valid Idempotency-Key header is required.');
      }
      const body = recommendationFeedbackBodySchema.parse(request.body);
      const result = await options.services.recommendations.addFeedback({
        viewerId: authenticatedUserId(request),
        resultId,
        idempotencyKey: parsedKey.data,
        kind: body.kind,
        ...(body.evidenceId !== undefined ? { evidenceId: body.evidenceId } : {}),
      });
      if (!result) throw new ResourceNotFoundError();
      return reply.code(result.duplicate ? 200 : 201).send(result);
    },
  );
};
