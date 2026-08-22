import { EXPLANATION_DIMENSIONS, type EvidenceOmission, type ExplanationDimension, type ExplanationEvidence, type SafeEvidenceProjection, type SafeExplanationEvidence } from './types.js';

const SAFE_EVIDENCE_ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/;
const MAX_LABEL_LENGTH = 120;

// These fields must never cross the model boundary, even when a caller
// accidentally marks them as explainable. Matching is intentionally broad.
const FORBIDDEN_SOURCE = /(?:birth|birthday|dateofbirth|exact(?:location|address)|address|phone|email|contact|genderpreference|desiredgender|agerange|block|heart|likecount|popularity|rank(?:ing)?score|income|salary|asset|wealth|class|employer|occupation|school|photo|image|name|health|disab|fertility|religion|politic|race|ethni|sexualorientation)/i;

const UNSAFE_LABEL_PATTERNS = [
  /(?:https?:\/\/|www\.)/i,
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
  /(?:\+?\d[\s().-]*){7,}/,
  /\b(?:19|20)\d{2}[-/.](?:0?[1-9]|1[0-2])[-/.](?:0?[1-9]|[12]\d|3[01])\b/,
  /(?:ignore|disregard|override).{0,30}(?:instruction|prompt|system|developer)/i,
  /(?:reveal|print|return).{0,30}(?:prompt|secret|api.?key|hidden)/i,
  /(?:忽略|无视|覆盖).{0,20}(?:指令|提示词|系统消息|开发者消息)/,
  /(?:输出|泄露|显示).{0,20}(?:密钥|提示词|隐藏信息|系统消息)/,
];

function normalizeDimension(value: ExplanationEvidence['dimension']): ExplanationDimension | undefined {
  const normalized = value.toUpperCase();
  return (EXPLANATION_DIMENSIONS as readonly string[]).includes(normalized)
    ? normalized as ExplanationDimension
    : undefined;
}

function safeLabel(value: string): string | undefined {
  const normalized = value
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized || normalized.length > MAX_LABEL_LENGTH) return undefined;
  if (UNSAFE_LABEL_PATTERNS.some((pattern) => pattern.test(normalized))) return undefined;
  return normalized;
}

function omission(evidenceId: string, reason: EvidenceOmission['reason']): EvidenceOmission {
  return { evidenceId, reason };
}

/**
 * Applies a deny-by-default projection before any provider call. The output
 * deliberately omits source keys, owner identifiers, versions, and consent
 * metadata: those remain server-side for validation and auditing.
 */
export function projectSafeEvidence(items: readonly ExplanationEvidence[]): SafeEvidenceProjection {
  const projected: SafeExplanationEvidence[] = [];
  const omitted: EvidenceOmission[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    if (!SAFE_EVIDENCE_ID.test(item.evidenceId)) {
      omitted.push(omission(item.evidenceId, 'INVALID_ID'));
      continue;
    }
    if (seen.has(item.evidenceId)) {
      omitted.push(omission(item.evidenceId, 'DUPLICATE_ID'));
      continue;
    }
    seen.add(item.evidenceId);

    const dimension = normalizeDimension(item.dimension);
    if (!dimension) {
      omitted.push(omission(item.evidenceId, 'INVALID_DIMENSION'));
      continue;
    }
    if (item.scoreAllowed !== true || item.explanationAllowed !== true) {
      omitted.push(omission(item.evidenceId, 'NOT_AUTHORIZED'));
      continue;
    }
    if (item.current !== true) {
      omitted.push(omission(item.evidenceId, 'STALE'));
      continue;
    }
    if (FORBIDDEN_SOURCE.test(item.sourceKey)) {
      omitted.push(omission(item.evidenceId, 'FORBIDDEN_SOURCE'));
      continue;
    }

    const leftLabel = safeLabel(item.leftLabel);
    const rightLabel = safeLabel(item.rightLabel);
    if (!leftLabel || !rightLabel) {
      omitted.push(omission(item.evidenceId, 'UNSAFE_LABEL'));
      continue;
    }

    projected.push(Object.freeze({
      evidenceId: item.evidenceId,
      dimension,
      leftLabel,
      rightLabel,
      similarity: Math.min(1, Math.max(0, item.similarity ?? 0.5)),
    }));
  }

  const evidence = Object.freeze(projected);
  return Object.freeze({
    evidence,
    allowedEvidenceIds: new Set(evidence.map((item) => item.evidenceId)),
    omitted: Object.freeze(omitted),
  });
}
