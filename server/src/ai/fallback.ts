import type { GeneratedExplanation } from './schema.js';
import type { ExplanationDimension, SafeExplanationEvidence } from './types.js';

export interface RuleFallbackInput {
  readonly evidence: readonly SafeExplanationEvidence[];
  readonly locale?: string;
}

const DIMENSION_PRIORITY: Readonly<Record<ExplanationDimension, number>> = {
  RELATIONSHIP: 6,
  LIFESTYLE: 5,
  COMMUNICATION: 4,
  INTERESTS: 3,
  MBTI: 2,
  ZODIAC: 1,
};

function orderedEvidence(evidence: readonly SafeExplanationEvidence[]): readonly SafeExplanationEvidence[] {
  return [...evidence].sort((left, right) =>
    DIMENSION_PRIORITY[right.dimension] - DIMENSION_PRIORITY[left.dimension]
    || right.similarity - left.similarity
    || left.evidenceId.localeCompare(right.evidenceId),
  );
}

function chineseCopy(item: SafeExplanationEvidence): Pick<GeneratedExplanation, 'headline' | 'summary'> {
  const common = item.leftLabel === item.rightLabel
    ? item.leftLabel
    : `${item.leftLabel}、${item.rightLabel}`;
  switch (item.dimension) {
    case 'RELATIONSHIP':
      return { headline: '关系方向有清楚的共同点', summary: `双方公开表达的关系方向与「${common}」有关。` };
    case 'LIFESTYLE':
      return { headline: '生活节奏有具体交集', summary: `双方公开的生活方式里都提到了「${common}」。` };
    case 'COMMUNICATION':
      return { headline: '沟通偏好有相近之处', summary: `双方公开的沟通偏好与「${common}」有关。` };
    case 'INTERESTS':
      return { headline: `都对${common}感兴趣`, summary: `「${common}」是双方公开兴趣里的一个共同点。` };
    case 'MBTI':
      return { headline: '个性表达带来一个话题', summary: `双方主动公开的个性标签与「${common}」有关，仅作轻量参考。` };
    case 'ZODIAC':
      return { headline: '发现一个轻松的聊天话题', summary: `双方公开资料与「${common}」有关，仅作为趣味话题。` };
  }
}

function englishCopy(item: SafeExplanationEvidence): Pick<GeneratedExplanation, 'headline' | 'summary'> {
  const common = item.leftLabel === item.rightLabel
    ? item.leftLabel
    : `${item.leftLabel} and ${item.rightLabel}`;
  switch (item.dimension) {
    case 'RELATIONSHIP': return { headline: 'A clear relationship commonality', summary: `Your public relationship preferences connect around ${common}.` };
    case 'LIFESTYLE': return { headline: 'A concrete lifestyle overlap', summary: `Your public lifestyle preferences connect around ${common}.` };
    case 'COMMUNICATION': return { headline: 'Similar communication preferences', summary: `Your public communication preferences connect around ${common}.` };
    case 'INTERESTS': return { headline: `A shared interest in ${common}`, summary: `${common} is one shared interest in your public profiles.` };
    case 'MBTI': return { headline: 'A light conversation starter', summary: `Your self-reported personality labels connect around ${common}; this is only a light reference.` };
    case 'ZODIAC': return { headline: 'A playful conversation starter', summary: `Your public profiles connect around ${common}; this is only for fun.` };
  }
}

/** Deterministic, evidence-bound copy used whenever AI is disabled or rejected. */
export function buildRuleFallback(input: RuleFallbackInput): GeneratedExplanation {
  const selected = orderedEvidence(input.evidence.filter((item) => item.similarity > 0))[0];
  if (!selected) {
    const chinese = !input.locale?.toLowerCase().startsWith('en');
    return {
      schemaVersion: '1.0',
      headline: chinese ? '资料还不足以生成契合解读' : 'Not enough information yet',
      summary: chinese ? '继续了解彼此，比猜测更可靠。' : 'Getting to know each other is more reliable than guessing.',
      rationales: [],
      uncertainty: null,
    };
  }

  const copy = input.locale?.toLowerCase().startsWith('en')
    ? englishCopy(selected)
    : chineseCopy(selected);
  return {
    schemaVersion: '1.0',
    ...copy,
    rationales: [{
      conclusionId: 'fallback_primary',
      dimension: selected.dimension,
      title: copy.headline,
      detail: copy.summary,
      evidenceIds: [selected.evidenceId],
    }],
    uncertainty: null,
  };
}
