export interface ClaimedRecommendationJob {
  readonly jobId: string;
  readonly attempts: number;
  readonly maxAttempts: number;
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface RecommendationJobQueue<Job extends ClaimedRecommendationJob = ClaimedRecommendationJob> {
  claimNextJob(input: { workerId: string; leaseMs: number }): Promise<Job | null>;
  failJob(
    jobId: string,
    workerId: string,
    input: { code: string; retryable: boolean; retryAt?: string },
  ): Promise<unknown>;
}

export interface RecommendationJobProcessResult {
  readonly outcome: 'succeeded' | 'fallback' | 'retrying' | 'failed';
  readonly resultId?: string;
  readonly reason?: string;
}

/**
 * The processor owns the terminal job transition. This keeps result persistence
 * and queue completion in the same service boundary and avoids double-completing
 * leases after a successful AI write.
 */
export type RecommendationJobProcessor<Job extends ClaimedRecommendationJob = ClaimedRecommendationJob> = (
  job: Job,
  workerId: string,
  signal: AbortSignal,
) => Promise<RecommendationJobProcessResult>;

export interface WorkerLogger {
  info(details: Readonly<Record<string, unknown>>, message: string): void;
  warn(details: Readonly<Record<string, unknown>>, message: string): void;
  error(details: Readonly<Record<string, unknown>>, message: string): void;
}

export interface RecommendationWorkerOptions<Job extends ClaimedRecommendationJob> {
  readonly queue: RecommendationJobQueue<Job>;
  readonly processJob: RecommendationJobProcessor<Job>;
  readonly workerId: string;
  readonly pollIntervalMs: number;
  readonly leaseMs: number;
  readonly signal: AbortSignal;
  readonly logger: WorkerLogger;
  readonly random?: () => number;
  readonly now?: () => number;
}

function errorCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') {
    return error.code.slice(0, 120);
  }
  return 'JOB_PROCESSING_FAILED';
}

function isRetryable(error: unknown): boolean {
  if (error && typeof error === 'object' && 'retryable' in error
    && typeof error.retryable === 'boolean') return error.retryable;
  return true;
}

function retryAt(
  job: ClaimedRecommendationJob,
  now: () => number,
  random: () => number,
): string {
  const exponent = Math.max(0, Math.min(job.attempts - 1, 6));
  const baseDelayMs = Math.min(60_000, 1_000 * (2 ** exponent));
  const jitterMs = Math.floor(baseDelayMs * 0.2 * random());
  return new Date(now() + baseDelayMs + jitterMs).toISOString();
}

async function waitUntilNextPoll(milliseconds: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return;
  await new Promise<void>((resolve) => {
    const timer = setTimeout(finish, milliseconds);
    function finish() {
      clearTimeout(timer);
      signal.removeEventListener('abort', finish);
      resolve();
    }
    signal.addEventListener('abort', finish, { once: true });
  });
}

/** Claims and processes at most one job. Useful for tests and scheduled runtimes. */
export async function processNextRecommendationJob<Job extends ClaimedRecommendationJob>(
  options: RecommendationWorkerOptions<Job>,
): Promise<'idle' | 'processed' | 'failed'> {
  if (options.signal.aborted) return 'idle';
  const job = await options.queue.claimNextJob({
    workerId: options.workerId,
    leaseMs: options.leaseMs,
  });
  if (!job) return 'idle';

  try {
    const result = await options.processJob(job, options.workerId, options.signal);
    const failed = result.outcome === 'retrying' || result.outcome === 'failed';
    const details = {
      jobId: job.jobId,
      outcome: result.outcome,
      ...(result.resultId ? { resultId: result.resultId } : {}),
      ...(result.reason ? { reason: result.reason } : {}),
    };
    if (failed) options.logger.warn(details, 'recommendation job was not completed');
    else options.logger.info(details, 'recommendation job completed');
    return failed ? 'failed' : 'processed';
  } catch (error) {
    const retryable = isRetryable(error) && job.attempts < job.maxAttempts;
    const code = errorCode(error);
    await options.queue.failJob(job.jobId, options.workerId, {
      code,
      retryable,
      ...(retryable ? { retryAt: retryAt(job, options.now ?? Date.now, options.random ?? Math.random) } : {}),
    });
    // Never log job payloads: they can contain consent-scoped evidence.
    options.logger.warn({ jobId: job.jobId, code, retryable, attempts: job.attempts }, 'recommendation job crashed');
    return 'failed';
  }
}

/** Runs until aborted, polling only when the queue is empty or temporarily unavailable. */
export async function runRecommendationWorker<Job extends ClaimedRecommendationJob>(
  options: RecommendationWorkerOptions<Job>,
): Promise<void> {
  if (!options.workerId || options.pollIntervalMs < 100 || options.leaseMs < 1_000) {
    throw new Error('Invalid recommendation worker configuration.');
  }

  options.logger.info({ workerId: options.workerId }, 'recommendation worker started');
  while (!options.signal.aborted) {
    try {
      const result = await processNextRecommendationJob(options);
      if (result !== 'idle') continue;
    } catch (error) {
      options.logger.error({ code: errorCode(error) }, 'recommendation queue polling failed');
    }
    await waitUntilNextPoll(options.pollIntervalMs, options.signal);
  }
  options.logger.info({ workerId: options.workerId }, 'recommendation worker stopped');
}
