import type { FastifyPluginAsync } from 'fastify';
import type { ApiServices } from './contracts.js';
import { ApiError } from '../middleware/errors.js';

export interface HealthRoutesOptions {
  readonly services: Pick<ApiServices, 'readiness'>;
}

export const healthRoutes: FastifyPluginAsync<HealthRoutesOptions> = async (app, options) => {
  app.get('/health', async () => ({ status: 'ok' as const }));

  app.get('/ready', async (_request, reply) => {
    let ready = false;
    try {
      ready = await options.services.readiness();
    } catch (error) {
      app.log.warn({ err: error }, 'readiness check failed');
    }

    if (!ready) throw new ApiError(503, 'NOT_READY', 'A required dependency is unavailable.');
    return reply.send({ status: 'ready' as const });
  });
};
