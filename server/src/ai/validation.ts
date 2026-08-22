import { generatedExplanationSchema, type GeneratedExplanation } from './schema.js';
import type { SafeExplanationEvidence } from './types.js';

export type ExplanationValidationCode =
  | 'SCHEMA_INVALID'
  | 'UNKNOWN_EVIDENCE_ID'
  | 'DUPLICATE_EVIDENCE_ID'
  | 'DIMENSION_MISMATCH'
  | 'DUPLICATE_CONCLUSION_ID'
  | 'FORBIDDEN_CLAIM'
  | 'UNSUPPORTED_CLAIM'
  | 'MULTIPLE_HEADLINE_REASONS';

export interface ExplanationValidationIssue {
  readonly code: ExplanationValidationCode;
  readonly path: string;
  readonly detail?: string;
}

export type ExplanationValidationResult =
  | { readonly valid: true; readonly value: GeneratedExplanation; readonly issues: readonly [] }
  | { readonly valid: false; readonly issues: readonly ExplanationValidationIssue[] };

const FORBIDDEN_CLAIMS: readonly RegExp[] = [
  /(?:soulmate|made for each other|perfect match|destined|meant to be|天生一对|灵魂伴侣|命中注定|绝配)/i,
  /(?:success (?:rate|probability)|relationship will|guaranteed|一定(?:会|能)|成功率|幸福概率|长久概率)/i,
  /(?:already likes? you|attracted to you|wants you|对方.{0,8}(?:喜欢|心动|爱上)你|TA.{0,8}(?:喜欢|心动|爱上)你)/i,
  /(?:beautiful|handsome|attractive|hot|appearance|body|颜值|漂亮|帅气|身材|性感|性吸引力)/i,
  /(?:income|salary|wealth|asset|social class|family background|收入|薪资|资产|阶层|家境|门当户对)/i,
  /(?:race|ethnicity|religion|political|sexual orientation|health condition|disability|fertility|种族|民族|宗教|政治|性取向|健康|残障|生育能力)/i,
  /(?:loyal person|unfaithful|good character|bad character|psychopath|narcissist|depress(?:ed|ion)|忠诚的人|不忠|人品|心理诊断|抑郁|自恋型人格)/i,
  /(?:private filter|hidden preference|age filter|gender preference|私密筛选|隐藏偏好|年龄范围|性别偏好)/i,
  /(?:browsing history|viewed similar|click history|frequently browsed|浏览记录|看过类似|点击记录|频繁浏览)/i,
  /(?:personality|temperament|introvert|extrovert|性格|人格|外向|内向|说明双方|表明双方|意味着双方)/i,
];

// Claims must be grounded in the supplied safe labels. This deliberately uses
// conservative token overlap as a final backstop after evidence-ID validation.
const GENERIC_TERMS = new Set([
  '你', '你们', '双方', '共同', '都', '也', '可能', '更', '比较', '相近', '契合',
  '适合', '了解', '话题', '方向', '方式', '方面', 'ta', 'both', 'you', 'your',
  'shared', 'similar', 'might', 'may', 'could', 'and', 'the', 'have', 'with',
]);

function normalizeText(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, ' ').trim();
}

function tokens(value: string): readonly string[] {
  const normalized = normalizeText(value);
  const latin = normalized.match(/[a-z0-9]{3,}/g) ?? [];
  const hanRuns = normalized.match(/[\p{Script=Han}]{2,}/gu) ?? [];
  const han = hanRuns.flatMap((run) => {
    if (run.length <= 4) return [run];
    const grams: string[] = [];
    for (let index = 0; index < run.length - 1; index += 1) grams.push(run.slice(index, index + 2));
    return grams;
  });
  return [...new Set([...latin, ...han].filter((token) => !GENERIC_TERMS.has(token)))];
}

function isGrounded(text: string, cited: readonly SafeExplanationEvidence[]): boolean {
  const claim = normalizeText(text);
  const evidenceTokens = cited.flatMap((item) => [...tokens(item.leftLabel), ...tokens(item.rightLabel)]);
  if (evidenceTokens.length === 0) return false;
  return evidenceTokens.some((token) => claim.includes(token));
}

function hasMultipleHeadlineReasons(headline: string): boolean {
  return /[;；。！？!?]|(?:，|,).{2,}(?:，|,)|(?:以及|并且|同时|而且| and | also )/i.test(headline);
}

export function containsForbiddenClaim(text: string): boolean {
  return FORBIDDEN_CLAIMS.some((pattern) => pattern.test(text));
}

/**
 * Enforces schema, evidence lineage, and content policy after generation. This
 * validation is mandatory even when the provider reports strict-schema output.
 */
export function validateGeneratedExplanation(
  candidate: unknown,
  evidence: readonly SafeExplanationEvidence[],
): ExplanationValidationResult {
  const parsed = generatedExplanationSchema.safeParse(candidate);
  if (!parsed.success) {
    const detail = parsed.error.issues[0]?.message;
    return {
      valid: false,
      issues: [{
        code: 'SCHEMA_INVALID',
        path: '$',
        ...(detail === undefined ? {} : { detail }),
      }],
    };
  }

  const value = parsed.data;
  const byId = new Map(evidence.map((item) => [item.evidenceId, item]));
  const issues: ExplanationValidationIssue[] = [];
  const conclusionIds = new Set<string>();
  const allCitedEvidence = new Map<string, SafeExplanationEvidence>();

  if (hasMultipleHeadlineReasons(value.headline)) {
    issues.push({ code: 'MULTIPLE_HEADLINE_REASONS', path: '$.headline' });
  }

  const topLevelText = `${value.headline} ${value.summary}`;
  if (containsForbiddenClaim(topLevelText)) {
    issues.push({ code: 'FORBIDDEN_CLAIM', path: '$.headline|$.summary' });
  }

  value.rationales.forEach((rationale, index) => {
    const path = `$.rationales[${index}]`;
    if (conclusionIds.has(rationale.conclusionId)) {
      issues.push({ code: 'DUPLICATE_CONCLUSION_ID', path: `${path}.conclusionId` });
    }
    conclusionIds.add(rationale.conclusionId);

    const ids = new Set<string>();
    const cited: SafeExplanationEvidence[] = [];
    for (const evidenceId of rationale.evidenceIds) {
      if (ids.has(evidenceId)) {
        issues.push({ code: 'DUPLICATE_EVIDENCE_ID', path: `${path}.evidenceIds`, detail: evidenceId });
        continue;
      }
      ids.add(evidenceId);
      const item = byId.get(evidenceId);
      if (!item) {
        issues.push({ code: 'UNKNOWN_EVIDENCE_ID', path: `${path}.evidenceIds`, detail: evidenceId });
        continue;
      }
      cited.push(item);
      allCitedEvidence.set(item.evidenceId, item);
      if (item.dimension !== rationale.dimension) {
        issues.push({ code: 'DIMENSION_MISMATCH', path: `${path}.dimension`, detail: evidenceId });
      }
    }

    const text = `${rationale.title} ${rationale.detail}`;
    if (containsForbiddenClaim(text)) {
      issues.push({ code: 'FORBIDDEN_CLAIM', path });
    } else if (cited.length > 0 && !isGrounded(text, cited)) {
      issues.push({ code: 'UNSUPPORTED_CLAIM', path });
    }
  });

  if (value.uncertainty) {
    const ids = new Set<string>();
    const cited: SafeExplanationEvidence[] = [];
    for (const evidenceId of value.uncertainty.evidenceIds) {
      if (ids.has(evidenceId)) {
        issues.push({ code: 'DUPLICATE_EVIDENCE_ID', path: '$.uncertainty.evidenceIds', detail: evidenceId });
        continue;
      }
      ids.add(evidenceId);
      const item = byId.get(evidenceId);
      if (!item) issues.push({ code: 'UNKNOWN_EVIDENCE_ID', path: '$.uncertainty.evidenceIds', detail: evidenceId });
      else {
        cited.push(item);
        allCitedEvidence.set(item.evidenceId, item);
      }
    }
    if (containsForbiddenClaim(value.uncertainty.text)) {
      issues.push({ code: 'FORBIDDEN_CLAIM', path: '$.uncertainty.text' });
    } else if (cited.length > 0 && !isGrounded(value.uncertainty.text, cited)) {
      issues.push({ code: 'UNSUPPORTED_CLAIM', path: '$.uncertainty.text' });
    }
  }

  if (allCitedEvidence.size > 0 && !isGrounded(topLevelText, [...allCitedEvidence.values()])) {
    issues.push({ code: 'UNSUPPORTED_CLAIM', path: '$.headline|$.summary' });
  }

  return issues.length > 0
    ? { valid: false, issues: Object.freeze(issues) }
    : { valid: true, value, issues: [] };
}
