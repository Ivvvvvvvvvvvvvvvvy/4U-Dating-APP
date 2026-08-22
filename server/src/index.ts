import 'dotenv/config';

import { pathToFileURL } from 'node:url';
import { buildApp } from './app.js';
import { loadApiConfig } from './config.js';
import { closeDatabase, createDatabase, createRepositories } from './db/index.js';
import { createJwksAuthVerifier, type AuthVerifier } from './middleware/auth.js';
import { createRecommendationService } from './recommendations/index.js';

export async function startApi(): Promise<{ close(): Promise<void> }> {
  const config = loadApiConfig();
  const database = createDatabase(config.database);
  const repositories = createRepositories(database);
  const recommendationService = createRecommendationService({
    repositories,
    config: {
      rulesVersion: config.openai.rulesVersion,
      promptVersion: config.openai.promptVersion,
      modelVersion: config.openai.model,
      aiRefinementEnabled: config.aiRefinementEnabled,
    },
    isBlocked: (leftUserId, rightUserId) => repositories.blocks.isBlockedEither(leftUserId, rightUserId),
  });
  const services = {
    readiness: () => repositories.health.ready(),
    events: repositories.events,
    profiles: repositories.profiles,
    consents: repositories.consents,
    blocks: repositories.blocks,
    relationships: repositories.relationships,
    recommendations: recommendationService,
  };
  const authVerifier: AuthVerifier | undefined = config.authMode === 'jwt'
    ? createJwksAuthVerifier({
        issuer: config.jwt.issuer as string,
        audience: config.jwt.audience as string,
        jwksUrl: config.jwt.jwksUrl as string,
      })
    : undefined;

  try {
    const app = await buildApp({
      config,
      services,
      logger: { level: config.logLevel },
      ...(authVerifier ? { authVerifier } : {}),
    });

    let closing: Promise<void> | undefined;
    const close = (): Promise<void> => {
      closing ??= (async () => {
        await app.close();
        await closeDatabase(database);
      })();
      return closing;
    };
    for (const signal of ['SIGINT', 'SIGTERM'] as const) {
      process.once(signal, () => {
        void close().then(() => { process.exitCode = 0; }).catch((error: unknown) => {
          app.log.error({ err: error }, 'graceful shutdown failed');
          process.exitCode = 1;
        });
      });
    }

    await app.listen({ host: config.host, port: config.port });
    return { close };
  } catch (error) {
    await closeDatabase(database);
    throw error;
  }
}

function isMainModule(): boolean {
  const entry = process.argv[1];
  return entry !== undefined && import.meta.url === pathToFileURL(entry).href;
}

if (isMainModule()) {
  startApi().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Unknown API startup failure';
    process.stderr.write(`API startup failed: ${message}\n`);
    process.exitCode = 1;
  });
}
