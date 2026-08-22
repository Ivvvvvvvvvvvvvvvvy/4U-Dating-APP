import type { FastifyPluginAsync } from 'fastify';
import { authenticatedUserId } from '../middleware/auth.js';
import { ApiError, ResourceNotFoundError } from '../middleware/errors.js';
import type { ApiServices } from './contracts.js';
import { aiConsentBodySchema, idempotencyKeySchema, profileBodySchema } from './schemas.js';

export interface MeRoutesOptions {
  readonly services: Pick<ApiServices, 'profiles' | 'consents'>;
}

function requiredIdempotencyKey(value: string | string[] | undefined): string {
  const result = idempotencyKeySchema.safeParse(value);
  if (!result.success) {
    throw new ApiError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'A valid Idempotency-Key header is required.');
  }
  return result.data;
}

export const meRoutes: FastifyPluginAsync<MeRoutesOptions> = async (app, options) => {
  app.get('/v1/me/profile', { preHandler: app.authenticate }, async (request) => {
    const result = await options.services.profiles.getByUserId(authenticatedUserId(request));
    if (!result) throw new ResourceNotFoundError();
    return result;
  });

  app.put('/v1/me/profile', { preHandler: app.authenticate }, async (request) => {
    const body = profileBodySchema.parse(request.body);
    const userId = authenticatedUserId(request);
    const current = await options.services.profiles.getByUserId(userId);
    return options.services.profiles.updateByUserId({
      userId,
      actorUserId: userId,
      expectedVersion: body.expectedVersion,
      data: {
        ...body.profile,
        profileStatus: current?.data.profileStatus ?? 'DRAFT',
        ...(current?.data.verification ? { verification: current.data.verification } : {}),
      },
      idempotencyKey: requiredIdempotencyKey(request.headers['idempotency-key']),
    });
  });

  app.get('/v1/me/ai-consent', { preHandler: app.authenticate }, async (request) => {
    const result = await options.services.consents.getByUserId(authenticatedUserId(request));
    if (!result) throw new ResourceNotFoundError();
    return result;
  });

  app.put('/v1/me/ai-consent', { preHandler: app.authenticate }, async (request) => {
    const body = aiConsentBodySchema.parse(request.body);
    const userId = authenticatedUserId(request);
    const current = await options.services.consents.getByUserId(userId);
    return options.services.consents.updateByUserId({
      userId,
      actorUserId: userId,
      expectedVersion: body.expectedVersion,
      data: {
        policyVersion: current?.data.policyVersion ?? 'ai-consent-v1',
        aiCompatibility: body.aiCompatibility,
        publicExplanation: body.publicExplanation,
        modelTraining: current?.data.modelTraining ?? false,
        fieldPolicies: body.fieldPolicies,
        privacy: current?.data.privacy ?? {
          showAge: false,
          showZodiac: false,
          showInConfirmedParticipantLists: false,
          exactLocationSharing: 'CONFIRMED_ACTIVITY_ONLY',
          lockScreenMessagePreview: 'HIDDEN',
        },
        extensions: current?.data.extensions ?? {},
      },
      idempotencyKey: requiredIdempotencyKey(request.headers['idempotency-key']),
    });
  });
};
