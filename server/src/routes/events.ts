import type { FastifyPluginAsync } from 'fastify';
import { authenticatedUserId } from '../middleware/auth.js';
import { ApiError } from '../middleware/errors.js';
import type { ApiServices } from './contracts.js';
import { eventsBodySchema, eventsQuerySchema, idempotencyKeySchema } from './schemas.js';

export interface EventRoutesOptions {
  readonly services: Pick<ApiServices, 'events'>;
}

export const eventRoutes: FastifyPluginAsync<EventRoutesOptions> = async (app, options) => {
  app.get('/v1/events', { preHandler: app.authenticate }, async (request) => {
    const query = eventsQuerySchema.parse(request.query);
    const events = await options.services.events.readAfter({
      userId: authenticatedUserId(request),
      cursor: query.cursor,
      limit: query.limit,
      ...(query.aggregateType !== undefined ? { aggregateType: query.aggregateType } : {}),
      ...(query.aggregateId !== undefined ? { aggregateId: query.aggregateId } : {}),
    });
    return {
      cursor: events.at(-1)?.globalPosition ?? query.cursor,
      events,
      hasMore: events.length === query.limit,
    };
  });

  app.post('/v1/events', { preHandler: app.authenticate }, async (request, reply) => {
    const parsedKey = idempotencyKeySchema.safeParse(request.headers['idempotency-key']);
    if (!parsedKey.success) {
      throw new ApiError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'A valid Idempotency-Key header is required.');
    }
    const body = eventsBodySchema.parse(request.body);
    const result = await options.services.events.appendBatch({
      userId: authenticatedUserId(request),
      idempotencyKey: parsedKey.data,
      events: body.events.map((event) => ({
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        expectedVersion: event.expectedVersion,
        eventType: event.eventType,
        payload: event.payload,
        ...(event.eventId !== undefined ? { eventId: event.eventId } : {}),
        ...(event.metadata !== undefined ? { metadata: event.metadata } : {}),
        ...(event.occurredAt !== undefined ? { occurredAt: event.occurredAt } : {}),
      })),
    });

    return reply.code(202).send({
      replayed: result.replayed,
      cursor: result.cursor,
      events: result.events,
    });
  });
};
