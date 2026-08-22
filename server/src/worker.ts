import 'dotenv/config';

import { pathToFileURL } from 'node:url';
import { createOpenAIResponsesGenerator } from './ai/index.js';
import { loadWorkerConfig } from './config.js';
import { closeDatabase, createDatabase, createRepositories } from './db/index.js';
import { runRecommendationWorker, type WorkerLogger } from './jobs/index.js';
import { createRecommendationService } from './recommendations/index.js';

const logger: WorkerLogger = {
  info(details, message) { process.stdout.write(`${JSON.stringify({ level: 'info', message, ...details })}\n`); },
  warn(details, message) { process.stderr.write(`${JSON.stringify({ level: 'warn', message, ...details })}\n`); },
  error(details, message) { process.stderr.write(`${JSON.stringify({ level: 'error', message, ...details })}\n`); },
};

export async function startWorker(): Promise<void> {
  const config = loadWorkerConfig();
  const database = createDatabase(config.database);
  const repositories = createRepositories(database);
  const controller = new AbortController();
  const aiProvider = config.aiRefinementEnabled
    ? createOpenAIResponsesGenerator({
        apiKey: config.openai.apiKey,
        baseUrl: config.openai.baseUrl,
        model: config.openai.model,
        timeoutMs: config.openai.timeoutMs,
        maxAttempts: config.openai.maxAttempts,
      })
    : undefined;
  const service = createRecommendationService({
    repositories,
    config: {
      rulesVersion: config.openai.rulesVersion,
      promptVersion: config.openai.promptVersion,
      modelVersion: config.openai.model,
      aiRefinementEnabled: config.aiRefinementEnabled,
    },
    isBlocked: (leftUserId, rightUserId) => repositories.blocks.isBlockedEither(leftUserId, rightUserId),
    ...(aiProvider ? { aiProvider } : {}),
  });

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => controller.abort(new Error(`Received ${signal}`)));
  }

  try {
    await runRecommendationWorker({
      queue: repositories.recommendations,
      processJob: (job, workerId, signal) => service.processJob(job, workerId, signal),
      workerId: config.workerId,
      pollIntervalMs: config.workerPollMs,
      leaseMs: config.workerLeaseMs,
      signal: controller.signal,
      logger,
    });
  } finally {
    await closeDatabase(database);
  }
}

function isMainModule(): boolean {
  const entry = process.argv[1];
  return entry !== undefined && import.meta.url === pathToFileURL(entry).href;
}

if (isMainModule()) {
  startWorker().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Unknown worker failure';
    process.stderr.write(`Worker failed: ${message}\n`);
    process.exitCode = 1;
  });
}
