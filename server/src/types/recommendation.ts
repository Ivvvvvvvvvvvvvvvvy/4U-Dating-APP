import { z } from 'zod';

import { jsonObjectSchema, type JsonObject } from './json.js';

export const recommendationDisplayModeSchema = z.enum([
  'numeric',
  'common_points',
  'insufficient',
]);
export const recommendationSourceSchema = z.enum(['ai', 'rule_fallback']);
export const recommendationValidationStatusSchema = z.enum([
  'approved',
  'fallback',
  'rejected',
]);
export const recommendationResultStatusSchema = z.enum(['active', 'stale']);
export const recommendationJobStatusSchema = z.enum([
  'queued',
  'running',
  'succeeded',
  'fallback',
  'failed',
  'stale',
]);

export type RecommendationDisplayMode = z.infer<typeof recommendationDisplayModeSchema>;
export type RecommendationSource = z.infer<typeof recommendationSourceSchema>;
export type RecommendationValidationStatus = z.infer<typeof recommendationValidationStatusSchema>;
export type RecommendationResultStatus = z.infer<typeof recommendationResultStatusSchema>;
export type RecommendationJobStatus = z.infer<typeof recommendationJobStatusSchema>;

export const recommendationResultWriteSchema = z.object({
  resultId: z.string().trim().min(1).max(200),
  pairKey: z.string().trim().min(1).max(500),
  leftUserId: z.string().trim().min(1).max(200),
  rightUserId: z.string().trim().min(1).max(200),
  viewerUserId: z.string().trim().min(1).max(200),
  candidateUserId: z.string().trim().min(1).max(200),
  leftProfileVersion: z.number().int().nonnegative(),
  rightProfileVersion: z.number().int().nonnegative(),
  leftConsentVersion: z.number().int().nonnegative(),
  rightConsentVersion: z.number().int().nonnegative(),
  rulesVersion: z.string().trim().min(1).max(120),
  modelVersion: z.string().trim().max(120).default('none'),
  promptVersion: z.string().trim().max(120).default('none'),
  score: z.number().int().min(0).max(100).nullable(),
  displayMode: recommendationDisplayModeSchema,
  evidenceCount: z.number().int().nonnegative(),
  coreEvidenceCount: z.number().int().nonnegative(),
  evidenceIds: z.array(z.string().trim().min(1).max(200)).max(100),
  explanation: jsonObjectSchema,
  source: recommendationSourceSchema,
  validationStatus: recommendationValidationStatusSchema,
  generatedAt: z.iso.datetime({ offset: true }),
  expiresAt: z.iso.datetime({ offset: true }),
}).superRefine((value, context) => {
  if ((value.displayMode === 'numeric') !== (value.score !== null)) {
    context.addIssue({
      code: 'custom',
      path: ['score'],
      message: 'score is required only when displayMode is numeric',
    });
  }
  if (value.displayMode === 'numeric'
    && (value.evidenceCount < 3 || value.coreEvidenceCount < 1)) {
    context.addIssue({
      code: 'custom',
      path: ['displayMode'],
      message: 'numeric results require three independent evidence items and one core item',
    });
  }
  if (value.coreEvidenceCount > value.evidenceCount) {
    context.addIssue({
      code: 'custom',
      path: ['coreEvidenceCount'],
      message: 'coreEvidenceCount cannot exceed evidenceCount',
    });
  }
  if (Date.parse(value.expiresAt) <= Date.parse(value.generatedAt)) {
    context.addIssue({
      code: 'custom',
      path: ['expiresAt'],
      message: 'expiresAt must be later than generatedAt',
    });
  }
});

export type RecommendationResultWrite = z.infer<typeof recommendationResultWriteSchema>;

export interface RecommendationResult extends RecommendationResultWrite {
  status: RecommendationResultStatus;
  staleReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RecommendationLookup {
  pairKey: string;
  viewerUserId: string;
  candidateUserId: string;
  leftProfileVersion: number;
  rightProfileVersion: number;
  leftConsentVersion: number;
  rightConsentVersion: number;
  rulesVersion: string;
  modelVersion?: string;
  promptVersion?: string;
  now?: string;
}

export interface RecommendationJob {
  jobId: string;
  dedupeKey: string;
  leftUserId: string;
  rightUserId: string;
  status: RecommendationJobStatus;
  payload: JsonObject;
  attempts: number;
  maxAttempts: number;
  availableAt: string;
  leaseExpiresAt: string | null;
  workerId: string | null;
  resultId: string | null;
  lastErrorCode: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EnqueueRecommendationJobInput {
  jobId?: string;
  dedupeKey: string;
  leftUserId: string;
  rightUserId: string;
  payload: JsonObject;
  maxAttempts?: number;
  availableAt?: string;
}

export interface ClaimRecommendationJobInput {
  workerId: string;
  leaseMs?: number;
}

export interface RecommendationFeedbackInput {
  feedbackId?: string;
  resultId: string;
  viewerUserId: string;
  idempotencyKey: string;
  kind: 'INACCURATE_REASON' | 'UNCOMFORTABLE' | 'DO_NOT_USE_MY_FACT' | 'NOT_HELPFUL';
  evidenceId?: string;
  details?: JsonObject;
}

export interface RecommendationFeedback {
  feedbackId: string;
  resultId: string;
  viewerUserId: string;
  kind: RecommendationFeedbackInput['kind'];
  evidenceId: string | null;
  details: JsonObject;
  createdAt: string;
}
