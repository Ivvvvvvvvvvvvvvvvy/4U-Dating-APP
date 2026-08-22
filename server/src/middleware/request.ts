import type { FastifyInstance } from 'fastify';

export function registerRequestMetadata(app: FastifyInstance): void {
  app.addHook('onRequest', async (request, reply) => {
    reply.header('x-request-id', request.id);
  });

  app.addHook('onSend', async (_request, reply, payload) => {
    reply.header('cache-control', 'private, no-store');
    reply.header('x-content-type-options', 'nosniff');
    return payload;
  });
}
