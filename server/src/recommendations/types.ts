export const EVIDENCE_DIMENSIONS = [
  'relationship',
  'lifestyle',
  'communication',
  'interests',
  'mbti',
  'zodiac',
] as const;

export type EvidenceDimension = (typeof EVIDENCE_DIMENSIONS)[number];

export const CORE_EVIDENCE_DIMENSIONS = [
  'relationship',
  'lifestyle',
  'communication',
] as const satisfies readonly EvidenceDimension[];

export type CoreEvidenceDimension = (typeof CORE_EVIDENCE_DIMENSIONS)[number];

export const COMPATIBILITY_WEIGHTS = Object.freeze({
  relationship: 35,
  lifestyle: 25,
  communication: 20,
  interests: 15,
  mbti: 5,
  zodiac: 0,
}) satisfies Readonly<Record<EvidenceDimension, number>>;

export type SafeEvidencePrimitive = string | number | boolean | null;
export type SafeEvidenceValue = SafeEvidencePrimitive | readonly SafeEvidencePrimitive[];

/** Profile-level switches are deliberately separate from per-evidence permission flags. */
export interface EvidenceProfileConsent {
  readonly aiCompatibility: boolean;
  readonly publicExplanation: boolean;
}

/**
 * A side of an evidence candidate contains only an already-sanitized value. Raw profile
 * values must not be passed to this boundary. Both per-side permissions are required.
 */
export interface EvidenceCandidateSide {
  readonly safeLabel?: string;
  readonly safeValue?: SafeEvidenceValue;
  readonly useForScore: boolean;
  readonly useForExplanation: boolean;
}

export interface EvidenceCandidate {
  readonly evidenceId: string;
  readonly dimension: EvidenceDimension;
  /** Stable provenance key; multiple facts from the same source are not independent. */
  readonly sourceKey: string;
  /** Symmetric similarity in the inclusive range 0..1. */
  readonly similarity: number;
  /** Explicit false marks a stale evidence snapshot. Omission means current. */
  readonly current?: boolean;
  readonly left: EvidenceCandidateSide;
  readonly right: EvidenceCandidateSide;
}

export interface BuildAuthorizedEvidenceInput {
  readonly leftConsent: EvidenceProfileConsent;
  readonly rightConsent: EvidenceProfileConsent;
  readonly items: readonly EvidenceCandidate[];
}

export interface AuthorizedEvidenceSide {
  readonly safeLabel?: string;
  readonly safeValue?: SafeEvidenceValue;
}

/**
 * Safe projection consumed by deterministic scoring and AI explanation generation.
 * Literal true flags make it difficult to accidentally mix unfiltered evidence in.
 */
export interface AuthorizedEvidenceItem {
  readonly id: string;
  readonly evidenceId: string;
  readonly dimension: EvidenceDimension;
  readonly sourceKey: string;
  readonly similarity: number;
  readonly left: AuthorizedEvidenceSide;
  readonly right: AuthorizedEvidenceSide;
  /** Always present so this object is structurally accepted by the AI safe projector. */
  readonly leftLabel: string;
  readonly rightLabel: string;
  readonly leftValue?: SafeEvidenceValue;
  readonly rightValue?: SafeEvidenceValue;
  readonly scoreAllowed: true;
  readonly explanationAllowed: true;
  readonly scoreAuthorized: true;
  readonly explanationAuthorized: true;
  readonly authorized: true;
  readonly explainable: true;
  readonly current: true;
}

export interface ScoreCompatibilityInput {
  readonly leftUserId: string;
  readonly rightUserId: string;
  readonly evidence: readonly AuthorizedEvidenceItem[];
}

export interface CompatibilityDimensionScore {
  readonly dimension: EvidenceDimension;
  readonly weight: number;
  readonly includedInScore: boolean;
  readonly evidenceCount: number;
  readonly independentSourceCount: number;
  readonly sourceKeys: readonly string[];
  readonly similarity: number | null;
  /** Rounded 0..100 dimension score; null when the dimension is absent. */
  readonly score: number | null;
  /** Unnormalized points contributed before division by availableWeight. */
  readonly weightedPoints: number | null;
}

export type CompatibilityDimensionScores = Readonly<
  Record<EvidenceDimension, CompatibilityDimensionScore>
>;

export type CompatibilityDisplayReason =
  | 'SUFFICIENT_EVIDENCE'
  | 'NO_WEIGHTED_EVIDENCE'
  | 'INSUFFICIENT_INDEPENDENT_EVIDENCE'
  | 'MISSING_CORE_EVIDENCE';

export interface CompatibilityScore {
  readonly pairKey: string;
  readonly canonicalUserIds: readonly [string, string];
  /** Public/display-safe integer score, or null when the evidence gate is not met. */
  readonly score: number | null;
  readonly canDisplayNumericScore: boolean;
  readonly displayReason: CompatibilityDisplayReason;
  readonly dimensionScores: CompatibilityDimensionScores;
  /** All authorized items supplied, including zero-weight zodiac evidence. */
  readonly evidenceCount: number;
  /** Authorized items in positive-weight dimensions. */
  readonly weightedEvidenceCount: number;
  /** Unique positive-weight source keys used by the numeric-display gate. */
  readonly independentEvidenceCount: number;
  /** Unique source keys in relationship, lifestyle, or communication. */
  readonly coreEvidenceCount: number;
  /** Sum of configured weights for present positive-weight dimensions. */
  readonly availableWeight: number;
}

export const ELIGIBILITY_REJECTION_CODES = [
  'SELF_PAIR',
  'UNDERAGE',
  'INACTIVE',
  'UNVERIFIED',
  'MISSING_ELIGIBILITY_CONSENT',
  'AGE_MISMATCH',
  'GENDER_MISMATCH',
  'REGION_MISMATCH',
  'RELATIONSHIP_GOAL_MISMATCH',
  'BLOCKED',
] as const;

export type EligibilityRejectionCode = (typeof ELIGIBILITY_REJECTION_CODES)[number];

export interface EligibilityPreferences {
  readonly minAge?: number;
  readonly maxAge?: number;
  readonly acceptedGenders?: readonly string[];
  readonly acceptedRegions?: readonly string[];
  readonly acceptedRelationshipGoals?: readonly string[];
}

export interface EligibilityProfile {
  readonly userId: string;
  readonly isAdult: boolean;
  readonly isActive: boolean;
  readonly isVerified: boolean;
  readonly eligibilityConsent: boolean;
  readonly age?: number;
  readonly gender?: string;
  readonly region?: string;
  readonly relationshipGoal?: string;
  readonly preferences?: EligibilityPreferences;
  readonly blockedUserIds?: readonly string[];
  /** Upstream can set this when a bilateral block check was already resolved. */
  readonly blockedEither?: boolean;
}

export interface AssessEligibilityInput {
  readonly left: EligibilityProfile;
  readonly right: EligibilityProfile;
  /** Pair-level result from an authoritative block service, if already available. */
  readonly blockedEither?: boolean;
}

export interface EligibilityRejection {
  readonly code: EligibilityRejectionCode;
  /** User whose state or preferences caused rejection; omitted for pair-level checks. */
  readonly userId?: string;
  readonly counterpartyUserId?: string;
}

export interface EligibilityAssessment {
  readonly pairKey: string;
  readonly canonicalUserIds: readonly [string, string];
  readonly eligible: boolean;
  readonly rejectionCodes: readonly EligibilityRejectionCode[];
  readonly rejections: readonly EligibilityRejection[];
}
