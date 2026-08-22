import { EVIDENCE_DIMENSIONS } from './types.js';
import type {
  AuthorizedEvidenceItem,
  AuthorizedEvidenceSide,
  BuildAuthorizedEvidenceInput,
  EvidenceCandidate,
  EvidenceCandidateSide,
  EvidenceDimension,
  SafeEvidencePrimitive,
  SafeEvidenceValue,
} from './types.js';

const DIMENSION_ORDER = new Map<EvidenceDimension, number>(
  EVIDENCE_DIMENSIONS.map((dimension, index) => [dimension, index]),
);

function isEvidenceDimension(value: unknown): value is EvidenceDimension {
  return typeof value === 'string' && EVIDENCE_DIMENSIONS.includes(value as EvidenceDimension);
}

function isSafePrimitive(value: unknown): value is SafeEvidencePrimitive {
  return value === null
    || typeof value === 'string'
    || typeof value === 'number'
    || typeof value === 'boolean';
}

function copySafeValue(value: SafeEvidenceValue): SafeEvidenceValue {
  if (!Array.isArray(value)) {
    if (!isSafePrimitive(value) || (typeof value === 'number' && !Number.isFinite(value))) {
      throw new TypeError('safeValue must be a finite JSON primitive or an array of primitives');
    }
    return value;
  }
  if (!value.every(isSafePrimitive)) {
    throw new TypeError('safeValue arrays may contain only string, number, boolean, or null');
  }
  if (value.some((entry) => typeof entry === 'number' && !Number.isFinite(entry))) {
    throw new TypeError('safeValue numbers must be finite');
  }
  return [...value];
}

function safeLabel(side: EvidenceCandidateSide): string | undefined {
  if (side.safeLabel === undefined) return undefined;
  const label = side.safeLabel.trim();
  return label.length > 0 ? label : undefined;
}

function projectSide(side: EvidenceCandidateSide): AuthorizedEvidenceSide | null {
  const label = safeLabel(side);
  const hasValue = Object.prototype.hasOwnProperty.call(side, 'safeValue');
  if (!label && !hasValue) return null;

  return {
    ...(label ? { safeLabel: label } : {}),
    ...(hasValue ? { safeValue: copySafeValue(side.safeValue as SafeEvidenceValue) } : {}),
  };
}

function explanationLabel(side: AuthorizedEvidenceSide): string | undefined {
  if (side.safeLabel !== undefined) return side.safeLabel;
  if (side.safeValue === undefined) return undefined;

  const value = Array.isArray(side.safeValue)
    ? side.safeValue.map((entry) => String(entry)).join(', ')
    : String(side.safeValue);
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function assertAuthorizedCandidate(item: EvidenceCandidate): void {
  if (!item.evidenceId || item.evidenceId.trim() !== item.evidenceId) {
    throw new TypeError('evidenceId must be a non-empty, trimmed string');
  }
  if (!item.sourceKey || item.sourceKey.trim() !== item.sourceKey) {
    throw new TypeError('sourceKey must be a non-empty, trimmed string');
  }
  if (!isEvidenceDimension(item.dimension)) {
    throw new TypeError(`Unsupported evidence dimension: ${String(item.dimension)}`);
  }
  if (!Number.isFinite(item.similarity) || item.similarity < 0 || item.similarity > 1) {
    throw new RangeError('similarity must be a finite number in the inclusive range 0..1');
  }
}

function hasBilateralItemPermission(item: EvidenceCandidate): boolean {
  return item.current !== false
    && item.left.useForScore
    && item.right.useForScore
    && item.left.useForExplanation
    && item.right.useForExplanation;
}

function compareEvidence(left: AuthorizedEvidenceItem, right: AuthorizedEvidenceItem): number {
  return (DIMENSION_ORDER.get(left.dimension) ?? Number.MAX_SAFE_INTEGER)
      - (DIMENSION_ORDER.get(right.dimension) ?? Number.MAX_SAFE_INTEGER)
    || left.sourceKey.localeCompare(right.sourceKey, 'en')
    || left.evidenceId.localeCompare(right.evidenceId, 'en')
    || left.similarity - right.similarity;
}

/**
 * Intersects both profiles' global consent with both sides' per-item permissions.
 * The returned projection contains no raw/private fields and is safe for public-score
 * explanation generation.
 */
export function buildAuthorizedEvidence(
  input: BuildAuthorizedEvidenceInput,
): readonly AuthorizedEvidenceItem[] {
  const profilesAllowPublicAi = input.leftConsent.aiCompatibility
    && input.rightConsent.aiCompatibility
    && input.leftConsent.publicExplanation
    && input.rightConsent.publicExplanation;

  if (!profilesAllowPublicAi) return [];

  const authorized: AuthorizedEvidenceItem[] = [];
  const authorizedEvidenceIds = new Set<string>();
  for (const item of input.items) {
    if (!hasBilateralItemPermission(item)) continue;

    assertAuthorizedCandidate(item);
    if (authorizedEvidenceIds.has(item.evidenceId)) {
      throw new TypeError(`Duplicate authorized evidenceId: ${item.evidenceId}`);
    }
    const left = projectSide(item.left);
    const right = projectSide(item.right);
    if (!left || !right) continue;
    const leftLabel = explanationLabel(left);
    const rightLabel = explanationLabel(right);
    if (!leftLabel || !rightLabel) continue;
    authorizedEvidenceIds.add(item.evidenceId);

    authorized.push({
      id: item.evidenceId,
      evidenceId: item.evidenceId,
      dimension: item.dimension,
      sourceKey: item.sourceKey,
      similarity: item.similarity,
      left,
      right,
      leftLabel,
      rightLabel,
      ...(left.safeValue !== undefined ? { leftValue: copySafeValue(left.safeValue) } : {}),
      ...(right.safeValue !== undefined ? { rightValue: copySafeValue(right.safeValue) } : {}),
      scoreAllowed: true,
      explanationAllowed: true,
      scoreAuthorized: true,
      explanationAuthorized: true,
      authorized: true,
      explainable: true,
      current: true,
    });
  }

  return authorized.sort(compareEvidence);
}
