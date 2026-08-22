import { canonicalPairKey, canonicalizeUserIds } from './pair.js';
import {
  COMPATIBILITY_WEIGHTS,
  CORE_EVIDENCE_DIMENSIONS,
  EVIDENCE_DIMENSIONS,
} from './types.js';
import type {
  AuthorizedEvidenceItem,
  CompatibilityDimensionScore,
  CompatibilityDimensionScores,
  CompatibilityDisplayReason,
  CompatibilityScore,
  EvidenceDimension,
  ScoreCompatibilityInput,
} from './types.js';

const coreDimensions = new Set<EvidenceDimension>(CORE_EVIDENCE_DIMENSIONS);
const knownDimensions = new Set<EvidenceDimension>(EVIDENCE_DIMENSIONS);

function round(value: number, decimalPlaces = 8): number {
  const scale = 10 ** decimalPlaces;
  return Math.round((value + Number.EPSILON) * scale) / scale;
}

function isFullyAuthorized(item: AuthorizedEvidenceItem): boolean {
  return item.current === true
    && item.scoreAllowed === true
    && item.explanationAllowed === true
    && item.scoreAuthorized === true
    && item.explanationAuthorized === true
    && item.authorized === true
    && item.explainable === true;
}

function assertScoringEvidence(item: AuthorizedEvidenceItem): void {
  if (!knownDimensions.has(item.dimension)) {
    throw new TypeError(`Unsupported evidence dimension: ${String(item.dimension)}`);
  }
  if (!item.evidenceId || item.evidenceId.trim() !== item.evidenceId) {
    throw new TypeError('evidenceId must be a non-empty, trimmed string');
  }
  if (!item.sourceKey || item.sourceKey.trim() !== item.sourceKey) {
    throw new TypeError('sourceKey must be a non-empty, trimmed string');
  }
  if (!Number.isFinite(item.similarity) || item.similarity < 0 || item.similarity > 1) {
    throw new RangeError('similarity must be a finite number in the inclusive range 0..1');
  }
}

function compareEvidence(left: AuthorizedEvidenceItem, right: AuthorizedEvidenceItem): number {
  return left.sourceKey.localeCompare(right.sourceKey, 'en')
    || left.evidenceId.localeCompare(right.evidenceId, 'en')
    || left.similarity - right.similarity;
}

function scoreDimension(
  dimension: EvidenceDimension,
  evidence: readonly AuthorizedEvidenceItem[],
): CompatibilityDimensionScore {
  const weight = COMPATIBILITY_WEIGHTS[dimension];
  if (evidence.length === 0) {
    return {
      dimension,
      weight,
      includedInScore: false,
      evidenceCount: 0,
      independentSourceCount: 0,
      sourceKeys: [],
      similarity: null,
      score: null,
      weightedPoints: null,
    };
  }

  // Give every independent source equal influence, even if one source emitted many facts.
  const similaritiesBySource = new Map<string, number[]>();
  for (const item of [...evidence].sort(compareEvidence)) {
    const similarities = similaritiesBySource.get(item.sourceKey);
    if (similarities) similarities.push(item.similarity);
    else similaritiesBySource.set(item.sourceKey, [item.similarity]);
  }

  const sourceKeys = [...similaritiesBySource.keys()].sort((left, right) => left.localeCompare(right, 'en'));
  const sourceSimilarities = sourceKeys.map((sourceKey) => {
    const similarities = similaritiesBySource.get(sourceKey);
    if (!similarities || similarities.length === 0) return 0;
    return similarities.reduce((sum, value) => sum + value, 0) / similarities.length;
  });
  const similarity = sourceSimilarities.reduce((sum, value) => sum + value, 0)
    / sourceSimilarities.length;

  return {
    dimension,
    weight,
    includedInScore: weight > 0,
    evidenceCount: evidence.length,
    independentSourceCount: sourceKeys.length,
    sourceKeys,
    similarity: round(similarity),
    score: Math.round(similarity * 100),
    weightedPoints: round(similarity * weight),
  };
}

function determineDisplayReason(
  availableWeight: number,
  independentEvidenceCount: number,
  coreEvidenceCount: number,
): CompatibilityDisplayReason {
  if (availableWeight === 0) return 'NO_WEIGHTED_EVIDENCE';
  if (independentEvidenceCount < 3) return 'INSUFFICIENT_INDEPENDENT_EVIDENCE';
  if (coreEvidenceCount < 1) return 'MISSING_CORE_EVIDENCE';
  return 'SUFFICIENT_EVIDENCE';
}

/**
 * Computes a deterministic, order-independent pair score from authorized evidence.
 * Missing dimensions are neutral: their weights are absent from the denominator.
 */
export function scoreCompatibility(input: ScoreCompatibilityInput): CompatibilityScore {
  const canonicalUserIds = canonicalizeUserIds(input.leftUserId, input.rightUserId);
  const usableEvidence = input.evidence.filter(isFullyAuthorized);
  const evidenceIds = new Set<string>();
  for (const item of usableEvidence) {
    assertScoringEvidence(item);
    if (evidenceIds.has(item.evidenceId)) {
      throw new TypeError(`Duplicate authorized evidenceId: ${item.evidenceId}`);
    }
    evidenceIds.add(item.evidenceId);
  }

  const evidenceByDimension = new Map<EvidenceDimension, AuthorizedEvidenceItem[]>(
    EVIDENCE_DIMENSIONS.map((dimension) => [dimension, []]),
  );
  for (const item of usableEvidence) evidenceByDimension.get(item.dimension)?.push(item);

  const dimensionScores: CompatibilityDimensionScores = {
    relationship: scoreDimension('relationship', evidenceByDimension.get('relationship') ?? []),
    lifestyle: scoreDimension('lifestyle', evidenceByDimension.get('lifestyle') ?? []),
    communication: scoreDimension('communication', evidenceByDimension.get('communication') ?? []),
    interests: scoreDimension('interests', evidenceByDimension.get('interests') ?? []),
    mbti: scoreDimension('mbti', evidenceByDimension.get('mbti') ?? []),
    zodiac: scoreDimension('zodiac', evidenceByDimension.get('zodiac') ?? []),
  };

  const weightedEvidence = usableEvidence.filter(
    (item) => COMPATIBILITY_WEIGHTS[item.dimension] > 0,
  );
  // A compared mismatch may lower a dimension score, but it is not a positive
  // matching fact and therefore cannot unlock numeric display by itself.
  const matchingEvidence = weightedEvidence.filter((item) => item.similarity > 0);
  const independentSourceKeys = new Set(matchingEvidence.map((item) => item.sourceKey));
  const coreSourceKeys = new Set(
    matchingEvidence
      .filter((item) => coreDimensions.has(item.dimension))
      .map((item) => item.sourceKey),
  );

  let availableWeight = 0;
  let weightedPoints = 0;
  for (const dimension of EVIDENCE_DIMENSIONS) {
    const dimensionScore = dimensionScores[dimension];
    if (!dimensionScore.includedInScore || dimensionScore.similarity === null) continue;
    availableWeight += dimensionScore.weight;
    weightedPoints += dimensionScore.similarity * dimensionScore.weight;
  }

  const displayReason = determineDisplayReason(
    availableWeight,
    independentSourceKeys.size,
    coreSourceKeys.size,
  );
  const canDisplayNumericScore = displayReason === 'SUFFICIENT_EVIDENCE';
  const score = canDisplayNumericScore
    ? Math.min(100, Math.max(0, Math.round((weightedPoints / availableWeight) * 100)))
    : null;

  return {
    pairKey: canonicalPairKey(input.leftUserId, input.rightUserId),
    canonicalUserIds,
    score,
    canDisplayNumericScore,
    displayReason,
    dimensionScores,
    evidenceCount: usableEvidence.length,
    weightedEvidenceCount: weightedEvidence.length,
    independentEvidenceCount: independentSourceKeys.size,
    coreEvidenceCount: coreSourceKeys.size,
    availableWeight,
  };
}
