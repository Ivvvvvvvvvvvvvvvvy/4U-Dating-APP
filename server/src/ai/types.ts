export const EXPLANATION_DIMENSIONS = [
  'RELATIONSHIP',
  'LIFESTYLE',
  'COMMUNICATION',
  'INTERESTS',
  'MBTI',
  'ZODIAC',
] as const;

export type ExplanationDimension = (typeof EXPLANATION_DIMENSIONS)[number];

/**
 * The only evidence shape accepted at the AI boundary. `leftLabel` and
 * `rightLabel` must already be display-safe summaries; raw profile objects and
 * free-form source text do not belong here.
 */
export interface ExplanationEvidence {
  readonly evidenceId: string;
  readonly dimension: ExplanationDimension | Lowercase<ExplanationDimension>;
  readonly sourceKey: string;
  readonly leftLabel: string;
  readonly rightLabel: string;
  readonly similarity?: number;
  readonly scoreAllowed?: boolean;
  readonly explanationAllowed?: boolean;
  readonly current?: boolean;
}

/** Minimal, de-identified record that can be serialized to an AI provider. */
export interface SafeExplanationEvidence {
  readonly evidenceId: string;
  readonly dimension: ExplanationDimension;
  readonly leftLabel: string;
  readonly rightLabel: string;
  readonly similarity: number;
}

export type EvidenceOmissionReason =
  | 'DUPLICATE_ID'
  | 'INVALID_ID'
  | 'INVALID_DIMENSION'
  | 'NOT_AUTHORIZED'
  | 'STALE'
  | 'FORBIDDEN_SOURCE'
  | 'UNSAFE_LABEL';

export interface EvidenceOmission {
  readonly evidenceId: string;
  readonly reason: EvidenceOmissionReason;
}

export interface SafeEvidenceProjection {
  readonly evidence: readonly SafeExplanationEvidence[];
  readonly allowedEvidenceIds: ReadonlySet<string>;
  readonly omitted: readonly EvidenceOmission[];
}

export interface ExplanationGeneratorInput {
  readonly evidence: readonly SafeExplanationEvidence[];
  readonly locale?: string;
  readonly promptVersion?: string;
  readonly signal?: AbortSignal;
}

export interface ExplanationGenerator {
  generate(input: ExplanationGeneratorInput): Promise<unknown>;
}
