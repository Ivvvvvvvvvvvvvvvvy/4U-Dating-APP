import { randomUUID } from 'node:crypto';

import {
  jsonObjectSchema,
  recommendationResultWriteSchema,
  type ClaimRecommendationJobInput,
  type EnqueueRecommendationJobInput,
  type RecommendationFeedback,
  type RecommendationFeedbackInput,
  type RecommendationJob,
  type RecommendationLookup,
  type RecommendationResult,
  type RecommendationResultWrite,
} from '../types/index.js';
import { IdempotencyConflictError, LeaseLostError, NotFoundError, ValidationError } from './errors.js';
import type { Database, SqlExecutor } from './pool.js';
import { staleRecommendations } from './profiles.js';
import { hashJson, isoTimestamp } from './util.js';

type RecommendationRow = {
  result_id: string;
  pair_key: string;
  left_user_id: string;
  right_user_id: string;
  viewer_user_id: string;
  candidate_user_id: string;
  left_profile_version: string;
  right_profile_version: string;
  left_consent_version: string;
  right_consent_version: string;
  rules_version: string;
  model_version: string;
  prompt_version: string;
  score: number | null;
  display_mode: RecommendationResult['displayMode'];
  evidence_count: number;
  core_evidence_count: number;
  evidence_ids: unknown;
  explanation: unknown;
  source: RecommendationResult['source'];
  validation_status: RecommendationResult['validationStatus'];
  status: RecommendationResult['status'];
  stale_reason: string | null;
  generated_at: Date | string;
  expires_at: Date | string;
  created_at: Date | string;
  updated_at: Date | string;
  artifact_hash: string;
};

type JobRow = {
  job_id: string;
  dedupe_key: string;
  left_user_id: string;
  right_user_id: string;
  status: RecommendationJob['status'];
  payload: unknown;
  request_hash: string;
  attempts: number;
  max_attempts: number;
  available_at: Date | string;
  lease_expires_at: Date | string | null;
  worker_id: string | null;
  result_id: string | null;
  last_error_code: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type FeedbackRow = {
  feedback_id: string;
  result_id: string;
  viewer_user_id: string;
  kind: RecommendationFeedback['kind'];
  evidence_id: string | null;
  details: unknown;
  request_hash: string;
  created_at: Date | string;
};

const recommendationColumns = `
  result_id, pair_key, left_user_id, right_user_id, viewer_user_id, candidate_user_id,
  left_profile_version, right_profile_version, left_consent_version, right_consent_version,
  rules_version, model_version, prompt_version, score, display_mode, evidence_count,
  core_evidence_count, evidence_ids, explanation, source, validation_status, status, stale_reason,
  generated_at, expires_at, created_at, updated_at, artifact_hash`;

const jobColumns = `
  job_id, dedupe_key, left_user_id, right_user_id, status, payload, attempts, max_attempts,
  available_at, lease_expires_at, worker_id, result_id, last_error_code, created_at, updated_at,
  request_hash`;
const qualifiedJobColumns = `
  job.job_id AS job_id, job.dedupe_key AS dedupe_key,
  job.left_user_id AS left_user_id, job.right_user_id AS right_user_id, job.status AS status,
  job.payload AS payload, job.attempts AS attempts, job.max_attempts AS max_attempts,
  job.available_at AS available_at, job.lease_expires_at AS lease_expires_at,
  job.worker_id AS worker_id, job.result_id AS result_id,
  job.last_error_code AS last_error_code, job.created_at AS created_at,
  job.updated_at AS updated_at, job.request_hash AS request_hash`;

function resultArtifactHash(input: RecommendationResultWrite): string {
  const { generatedAt: _generatedAt, expiresAt: _expiresAt, ...stableArtifact } = input;
  return hashJson(stableArtifact);
}

export function canonicalPair(leftUserId: string, rightUserId: string): {
  leftUserId: string;
  rightUserId: string;
  pairKey: string;
} {
  if (!leftUserId || !rightUserId || leftUserId === rightUserId) {
    throw new ValidationError('A recommendation requires two different users');
  }
  if (leftUserId.trim() !== leftUserId || rightUserId.trim() !== rightUserId) {
    throw new ValidationError('Recommendation user IDs must be trimmed');
  }
  const [left, right] = leftUserId.localeCompare(rightUserId, 'en') <= 0
    ? [leftUserId, rightUserId]
    : [rightUserId, leftUserId];
  return {
    leftUserId: left,
    rightUserId: right,
    pairKey: `${left.length}:${left}|${right.length}:${right}`,
  };
}

function assertCanonicalPair(input: RecommendationResultWrite): void {
  const canonical = canonicalPair(input.leftUserId, input.rightUserId);
  if (input.leftUserId !== canonical.leftUserId || input.rightUserId !== canonical.rightUserId) {
    throw new ValidationError('Recommendation user IDs must be in canonical lexical order', canonical);
  }
  if (input.pairKey !== canonical.pairKey) {
    throw new ValidationError('Recommendation pairKey does not match the canonical user pair', canonical);
  }
  const members = new Set([input.leftUserId, input.rightUserId]);
  if (!members.has(input.viewerUserId) || !members.has(input.candidateUserId)) {
    throw new ValidationError('Viewer and candidate must belong to the recommendation pair');
  }
}

function mapRecommendation(row: RecommendationRow): RecommendationResult {
  const evidenceIds = Array.isArray(row.evidence_ids)
    ? row.evidence_ids.map((value) => String(value))
    : [];
  return {
    resultId: row.result_id,
    pairKey: row.pair_key,
    leftUserId: row.left_user_id,
    rightUserId: row.right_user_id,
    viewerUserId: row.viewer_user_id,
    candidateUserId: row.candidate_user_id,
    leftProfileVersion: Number(row.left_profile_version),
    rightProfileVersion: Number(row.right_profile_version),
    leftConsentVersion: Number(row.left_consent_version),
    rightConsentVersion: Number(row.right_consent_version),
    rulesVersion: row.rules_version,
    modelVersion: row.model_version,
    promptVersion: row.prompt_version,
    score: row.score,
    displayMode: row.display_mode,
    evidenceCount: row.evidence_count,
    coreEvidenceCount: row.core_evidence_count,
    evidenceIds,
    explanation: jsonObjectSchema.parse(row.explanation),
    source: row.source,
    validationStatus: row.validation_status,
    generatedAt: isoTimestamp(row.generated_at),
    expiresAt: isoTimestamp(row.expires_at),
    status: row.status,
    staleReason: row.stale_reason,
    createdAt: isoTimestamp(row.created_at),
    updatedAt: isoTimestamp(row.updated_at),
  };
}

function mapJob(row: JobRow): RecommendationJob {
  return {
    jobId: row.job_id,
    dedupeKey: row.dedupe_key,
    leftUserId: row.left_user_id,
    rightUserId: row.right_user_id,
    status: row.status,
    payload: jsonObjectSchema.parse(row.payload),
    attempts: row.attempts,
    maxAttempts: row.max_attempts,
    availableAt: isoTimestamp(row.available_at),
    leaseExpiresAt: row.lease_expires_at ? isoTimestamp(row.lease_expires_at) : null,
    workerId: row.worker_id,
    resultId: row.result_id,
    lastErrorCode: row.last_error_code,
    createdAt: isoTimestamp(row.created_at),
    updatedAt: isoTimestamp(row.updated_at),
  };
}

function mapFeedback(row: FeedbackRow): RecommendationFeedback {
  return {
    feedbackId: row.feedback_id,
    resultId: row.result_id,
    viewerUserId: row.viewer_user_id,
    kind: row.kind,
    evidenceId: row.evidence_id,
    details: jsonObjectSchema.parse(row.details),
    createdAt: isoTimestamp(row.created_at),
  };
}

async function requireOwnedResult(
  executor: SqlExecutor,
  resultId: string,
  viewerUserId: string,
): Promise<boolean> {
  const result = await executor.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM recommendation_results WHERE result_id = $1 AND viewer_user_id = $2
     ) AS exists`,
    [resultId, viewerUserId],
  );
  return result.rows[0]?.exists ?? false;
}

export class RecommendationRepository {
  constructor(private readonly database: Database) {}

  async create(rawInput: RecommendationResultWrite): Promise<RecommendationResult> {
    const input = recommendationResultWriteSchema.parse(rawInput);
    assertCanonicalPair(input);
    const artifactHash = resultArtifactHash(input);
    const inserted = await this.database.query<RecommendationRow>(
      `INSERT INTO recommendation_results (
         result_id, pair_key, left_user_id, right_user_id, viewer_user_id, candidate_user_id,
         left_profile_version, right_profile_version, left_consent_version, right_consent_version,
         rules_version, model_version, prompt_version, score, display_mode, evidence_count,
         core_evidence_count, evidence_ids, explanation, source, validation_status, artifact_hash,
         generated_at, expires_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
         $17, $18::jsonb, $19::jsonb, $20, $21, $22, $23, $24
       )
       ON CONFLICT (result_id) DO NOTHING
       RETURNING ${recommendationColumns}`,
      [
        input.resultId, input.pairKey, input.leftUserId, input.rightUserId,
        input.viewerUserId, input.candidateUserId, input.leftProfileVersion,
        input.rightProfileVersion, input.leftConsentVersion, input.rightConsentVersion,
        input.rulesVersion, input.modelVersion, input.promptVersion, input.score, input.displayMode,
        input.evidenceCount, input.coreEvidenceCount, JSON.stringify(input.evidenceIds),
        JSON.stringify(input.explanation), input.source, input.validationStatus, artifactHash,
        input.generatedAt, input.expiresAt,
      ],
    );
    const insertedRow = inserted.rows[0];
    if (insertedRow) return mapRecommendation(insertedRow);

    const existing = await this.database.query<RecommendationRow>(
      `SELECT ${recommendationColumns} FROM recommendation_results WHERE result_id = $1`,
      [input.resultId],
    );
    const row = existing.rows[0];
    if (!row || row.artifact_hash !== artifactHash) {
      throw new IdempotencyConflictError(input.resultId);
    }
    return mapRecommendation(row);
  }

  async upsertResult(rawInput: RecommendationResultWrite): Promise<RecommendationResult> {
    const input = recommendationResultWriteSchema.parse(rawInput);
    assertCanonicalPair(input);
    const artifactHash = resultArtifactHash(input);
    const result = await this.database.query<RecommendationRow>(
      `INSERT INTO recommendation_results (
         result_id, pair_key, left_user_id, right_user_id, viewer_user_id, candidate_user_id,
         left_profile_version, right_profile_version, left_consent_version, right_consent_version,
         rules_version, model_version, prompt_version, score, display_mode, evidence_count,
         core_evidence_count, evidence_ids, explanation, source, validation_status, artifact_hash,
         generated_at, expires_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
         $17, $18::jsonb, $19::jsonb, $20, $21, $22, $23, $24
       )
       ON CONFLICT (result_id) DO UPDATE SET
         model_version = EXCLUDED.model_version, prompt_version = EXCLUDED.prompt_version,
         score = EXCLUDED.score, display_mode = EXCLUDED.display_mode,
         evidence_count = EXCLUDED.evidence_count, core_evidence_count = EXCLUDED.core_evidence_count,
         evidence_ids = EXCLUDED.evidence_ids, explanation = EXCLUDED.explanation,
         source = EXCLUDED.source, validation_status = EXCLUDED.validation_status,
         artifact_hash = EXCLUDED.artifact_hash, generated_at = EXCLUDED.generated_at,
         expires_at = EXCLUDED.expires_at, updated_at = clock_timestamp()
       WHERE recommendation_results.status = 'active'
         AND recommendation_results.pair_key = EXCLUDED.pair_key
         AND recommendation_results.left_user_id = EXCLUDED.left_user_id
         AND recommendation_results.right_user_id = EXCLUDED.right_user_id
         AND recommendation_results.viewer_user_id = EXCLUDED.viewer_user_id
         AND recommendation_results.candidate_user_id = EXCLUDED.candidate_user_id
         AND recommendation_results.left_profile_version = EXCLUDED.left_profile_version
         AND recommendation_results.right_profile_version = EXCLUDED.right_profile_version
         AND recommendation_results.left_consent_version = EXCLUDED.left_consent_version
         AND recommendation_results.right_consent_version = EXCLUDED.right_consent_version
         AND recommendation_results.rules_version = EXCLUDED.rules_version
       RETURNING ${recommendationColumns}`,
      [
        input.resultId, input.pairKey, input.leftUserId, input.rightUserId,
        input.viewerUserId, input.candidateUserId, input.leftProfileVersion,
        input.rightProfileVersion, input.leftConsentVersion, input.rightConsentVersion,
        input.rulesVersion, input.modelVersion, input.promptVersion, input.score, input.displayMode,
        input.evidenceCount, input.coreEvidenceCount, JSON.stringify(input.evidenceIds),
        JSON.stringify(input.explanation), input.source, input.validationStatus, artifactHash,
        input.generatedAt, input.expiresAt,
      ],
    );
    const row = result.rows[0];
    if (!row) {
      throw new IdempotencyConflictError(input.resultId);
    }
    return mapRecommendation(row);
  }

  async getByResultId(resultId: string, viewerUserId: string): Promise<RecommendationResult | null> {
    const result = await this.database.query<RecommendationRow>(
      `SELECT ${recommendationColumns}
         FROM recommendation_results
        WHERE result_id = $1 AND viewer_user_id = $2`,
      [resultId, viewerUserId],
    );
    const row = result.rows[0];
    return row ? mapRecommendation(row) : null;
  }

  getForViewer(viewerUserId: string, resultId: string): Promise<RecommendationResult | null> {
    return this.getByResultId(resultId, viewerUserId);
  }

  async getFreshByPairAndVersions(input: RecommendationLookup): Promise<RecommendationResult | null> {
    const result = await this.database.query<RecommendationRow>(
      `SELECT ${recommendationColumns}
         FROM recommendation_results
        WHERE pair_key = $1 AND viewer_user_id = $2 AND candidate_user_id = $3
          AND left_profile_version = $4 AND right_profile_version = $5
          AND left_consent_version = $6 AND right_consent_version = $7
          AND rules_version = $8
          AND ($9::text IS NULL OR model_version = $9)
          AND ($10::text IS NULL OR prompt_version = $10)
          AND status = 'active' AND validation_status <> 'rejected'
          AND expires_at > COALESCE($11::timestamptz, clock_timestamp())
        ORDER BY generated_at DESC LIMIT 1`,
      [
        input.pairKey, input.viewerUserId, input.candidateUserId,
        input.leftProfileVersion, input.rightProfileVersion,
        input.leftConsentVersion, input.rightConsentVersion, input.rulesVersion,
        input.modelVersion ?? null, input.promptVersion ?? null, input.now ?? null,
      ],
    );
    const row = result.rows[0];
    return row ? mapRecommendation(row) : null;
  }

  markStaleByUser(userId: string, reason = 'user_state_changed'): Promise<number> {
    return this.database.transaction((transaction) => staleRecommendations(transaction, userId, reason));
  }

  async enqueueJob(input: EnqueueRecommendationJobInput): Promise<{
    job: RecommendationJob;
    created: boolean;
  }> {
    const canonical = canonicalPair(input.leftUserId, input.rightUserId);
    const jobId = input.jobId ?? randomUUID();
    const requestHash = hashJson({
      dedupeKey: input.dedupeKey,
      leftUserId: canonical.leftUserId,
      rightUserId: canonical.rightUserId,
      payload: input.payload,
      maxAttempts: input.maxAttempts ?? 3,
      availableAt: input.availableAt ?? null,
    });
    const inserted = await this.database.query<JobRow>(
      `INSERT INTO recommendation_jobs (
         job_id, dedupe_key, left_user_id, right_user_id, payload, max_attempts, available_at,
         request_hash
       ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, COALESCE($7::timestamptz, clock_timestamp()), $8)
       ON CONFLICT (dedupe_key) WHERE status IN ('queued', 'running') DO NOTHING
       RETURNING ${jobColumns}`,
      [
        jobId, input.dedupeKey, canonical.leftUserId, canonical.rightUserId,
        JSON.stringify(input.payload), input.maxAttempts ?? 3, input.availableAt ?? null, requestHash,
      ],
    );
    const insertedRow = inserted.rows[0];
    if (insertedRow) return { job: mapJob(insertedRow), created: true };
    const existing = await this.database.query<JobRow>(
      `SELECT ${jobColumns} FROM recommendation_jobs
        WHERE dedupe_key = $1 AND status IN ('queued', 'running')
        ORDER BY created_at DESC LIMIT 1`,
      [input.dedupeKey],
    );
    const row = existing.rows[0];
    if (!row) throw new Error('Recommendation job disappeared after deduplication');
    if (row.request_hash !== requestHash) throw new IdempotencyConflictError(input.dedupeKey);
    return { job: mapJob(row), created: false };
  }

  async claimNextJob(input: ClaimRecommendationJobInput): Promise<RecommendationJob | null> {
    const leaseMs = Math.min(Math.max(input.leaseMs ?? 60_000, 1_000), 3_600_000);
    return this.database.transaction(async (transaction) => {
      await transaction.query(
        `UPDATE recommendation_jobs
            SET status = 'failed', worker_id = NULL, lease_expires_at = NULL,
                last_error_code = COALESCE(last_error_code, 'LEASE_EXPIRED'),
                updated_at = clock_timestamp()
          WHERE status = 'running' AND lease_expires_at < clock_timestamp()
            AND attempts >= max_attempts`,
      );
      const result = await transaction.query<JobRow>(
        `WITH candidate AS (
           SELECT job_id FROM recommendation_jobs
            WHERE attempts < max_attempts
              AND (
                (status = 'queued' AND available_at <= clock_timestamp())
                OR (status = 'running' AND lease_expires_at < clock_timestamp())
              )
            ORDER BY available_at ASC, created_at ASC
            FOR UPDATE SKIP LOCKED
            LIMIT 1
         )
         UPDATE recommendation_jobs AS job
            SET status = 'running', attempts = job.attempts + 1, worker_id = $1,
                lease_expires_at = clock_timestamp() + ($2::integer * interval '1 millisecond'),
                updated_at = clock_timestamp()
           FROM candidate
          WHERE job.job_id = candidate.job_id
         RETURNING ${qualifiedJobColumns}`,
        [input.workerId, leaseMs],
      );
      const row = result.rows[0];
      return row ? mapJob(row) : null;
    });
  }

  completeJob(
    jobId: string,
    workerId: string,
    resultId: string,
    outcome: 'succeeded' | 'fallback' = 'succeeded',
  ): Promise<RecommendationJob> {
    return this.finishJob(jobId, workerId, { outcome, resultId });
  }

  completeJobWithResult(
    jobId: string,
    workerId: string,
    result: RecommendationResultWrite,
    outcome: 'succeeded' | 'fallback' = 'succeeded',
  ): Promise<{ job: RecommendationJob; result: RecommendationResult }> {
    return this.database.transaction(async (transaction) => {
      const lease = await transaction.query<{ job_id: string }>(
        `SELECT job_id FROM recommendation_jobs
          WHERE job_id = $1 AND status = 'running' AND worker_id = $2
            AND lease_expires_at >= clock_timestamp()
          FOR UPDATE`,
        [jobId, workerId],
      );
      if (!lease.rows[0]) throw new LeaseLostError(jobId, workerId);
      const resultRepository = new RecommendationRepository({
        query: (text, values) => transaction.query(text, values),
        transaction: (operation) => operation(transaction),
        close: async () => undefined,
      });
      const persisted = await resultRepository.upsertResult(result);
      const completed = await resultRepository.finishJob(jobId, workerId, {
        outcome,
        resultId: persisted.resultId,
      });
      return { job: completed, result: persisted };
    });
  }

  async failJob(
    jobId: string,
    workerId: string,
    input: { code: string; retryable: boolean; retryAt?: string },
  ): Promise<RecommendationJob> {
    return this.finishJob(jobId, workerId, {
      outcome: input.retryable ? 'queued' : 'failed',
      errorCode: input.code,
      ...(input.retryAt ? { retryAt: input.retryAt } : {}),
    });
  }

  private async finishJob(
    jobId: string,
    workerId: string,
    input: {
      outcome: 'succeeded' | 'fallback' | 'queued' | 'failed';
      resultId?: string;
      errorCode?: string;
      retryAt?: string;
    },
  ): Promise<RecommendationJob> {
    const result = await this.database.query<JobRow>(
      `UPDATE recommendation_jobs
          SET status = CASE
                WHEN $3 = 'queued' AND attempts >= max_attempts THEN 'failed'
                ELSE $3
              END,
              result_id = COALESCE($4, result_id),
              last_error_code = $5,
              available_at = CASE WHEN $3 = 'queued'
                THEN COALESCE($6::timestamptz, clock_timestamp())
                ELSE available_at END,
              worker_id = NULL, lease_expires_at = NULL, updated_at = clock_timestamp()
        WHERE job_id = $1 AND status = 'running' AND worker_id = $2
          AND lease_expires_at >= clock_timestamp()
        RETURNING ${jobColumns}`,
      [
        jobId, workerId, input.outcome, input.resultId ?? null, input.errorCode ?? null,
        input.retryAt ?? null,
      ],
    );
    const row = result.rows[0];
    if (!row) throw new LeaseLostError(jobId, workerId);
    return mapJob(row);
  }

  async addFeedback(input: RecommendationFeedbackInput): Promise<{
    feedback: RecommendationFeedback;
    duplicate: boolean;
  }> {
    return this.database.transaction(async (transaction) => {
      if (!await requireOwnedResult(transaction, input.resultId, input.viewerUserId)) {
        throw new NotFoundError('recommendation result', input.resultId);
      }
      const requestHash = hashJson({
        resultId: input.resultId,
        viewerUserId: input.viewerUserId,
        kind: input.kind,
        evidenceId: input.evidenceId ?? null,
        details: input.details ?? {},
      });
      const feedbackId = input.feedbackId ?? randomUUID();
      const inserted = await transaction.query<FeedbackRow>(
        `INSERT INTO recommendation_feedback (
           feedback_id, result_id, viewer_user_id, idempotency_key, request_hash, kind, evidence_id, details
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
         ON CONFLICT (viewer_user_id, idempotency_key) DO NOTHING
         RETURNING feedback_id, result_id, viewer_user_id, kind, evidence_id, details,
                   request_hash, created_at`,
        [
          feedbackId, input.resultId, input.viewerUserId, input.idempotencyKey, requestHash,
          input.kind, input.evidenceId ?? null, JSON.stringify(input.details ?? {}),
        ],
      );
      const insertedRow = inserted.rows[0];
      if (insertedRow) return { feedback: mapFeedback(insertedRow), duplicate: false };

      const existing = await transaction.query<FeedbackRow>(
        `SELECT feedback_id, result_id, viewer_user_id, kind, evidence_id, details,
                request_hash, created_at
           FROM recommendation_feedback
          WHERE viewer_user_id = $1 AND idempotency_key = $2
          FOR UPDATE`,
        [input.viewerUserId, input.idempotencyKey],
      );
      const row = existing.rows[0];
      if (!row || row.request_hash !== requestHash) {
        throw new IdempotencyConflictError(input.idempotencyKey);
      }
      return { feedback: mapFeedback(row), duplicate: true };
    });
  }
}
