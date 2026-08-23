import { useCallback, useEffect, useState } from 'react';
import {
  DiscussionMatchMode,
  RelationshipDimension,
  TopicKind,
  type Person,
  type PersonId,
  type RelationshipTopic,
  type Topic,
  type TopicVoteRecord,
} from './domain';

const STORAGE_KEY = '4u:rfc:topic-votes';

export type TopicVoteMap = Record<string, TopicVoteRecord>;

export function isPersonalExpression(topic: Topic) {
  return topic.kind === TopicKind.LIFESTYLE_PROMPT && topic.tags.some((tag) => tag === '轻表达' || tag === '近况');
}

export function topicGenreLabel(topic: Topic) {
  if (topic.kind === TopicKind.RELATIONSHIP_SCENARIO) return '关系议题';
  if (isPersonalExpression(topic)) return '轻量表达';
  return '生活兴趣';
}

export function topicPrimaryAction(topic: Topic) {
  return topic.kind === TopicKind.RELATIONSHIP_SCENARIO ? '说说你的选择' : '加入讨论';
}

export function ageBand(age: number) {
  if (age < 25) return '18-24岁';
  if (age < 30) return '25-29岁';
  if (age < 35) return '30-34岁';
  return '35岁以上';
}

export function dimensionLabel(dimension: RelationshipDimension) {
  const labels: Record<RelationshipDimension, string> = {
    [RelationshipDimension.LOYALTY_AND_BOUNDARIES]: '忠诚与异性边界',
    [RelationshipDimension.PRIVACY_AND_AUTONOMY]: '隐私与自主',
    [RelationshipDimension.ECONOMICS_AND_RESPONSIBILITY]: '经济观与责任',
    [RelationshipDimension.COMMUNICATION_AND_CONFLICT]: '沟通与冲突',
    [RelationshipDimension.COMPANIONSHIP_AND_CONTACT]: '陪伴与联系',
    [RelationshipDimension.CAREER_AND_LIFESTYLE]: '事业与生活方式',
    [RelationshipDimension.RELATIONSHIP_PACING]: '关系推进节奏',
    [RelationshipDimension.SUPPORT_AND_CARE]: '支持与照顾',
  };
  return labels[dimension];
}

export function useTopicVotes() {
  const [votes, setVotes] = useState<TopicVoteMap>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as TopicVoteMap; }
    catch { return {}; }
  });
  useEffect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(votes)), [votes]);
  const saveVote = useCallback((vote: TopicVoteRecord) => {
    setVotes((current) => ({ ...current, [vote.topicId]: vote }));
  }, []);
  return { votes, saveVote };
}

export function matchModeCopy(
  mode: DiscussionMatchMode,
  topic: Topic,
  vote?: TopicVoteRecord,
): { title: string; description: string; action: string } {
  if (topic.kind !== TopicKind.RELATIONSHIP_SCENARIO) {
    return {
      title: '和正在看同一话题的人聊聊',
      description: '系统优先匹配当前在线、选择了同一生活话题的人。讨论前只展示有限资料。',
      action: '加入讨论',
    };
  }
  const position = topic.positionOptions.find((option) => option.id === vote?.positionId)?.label ?? '这个选择';
  const reason = vote?.primaryReasonId
    ? topic.reasonOptionsByPosition[vote.positionId]?.find((option) => option.id === vote.primaryReasonId)?.label
    : undefined;
  const dimension = vote?.primaryReasonId
    ? dimensionLabel(topic.reasonOptionsByPosition[vote.positionId]?.find((option) => option.id === vote.primaryReasonId)?.dimension ?? topic.primaryDimension)
    : dimensionLabel(topic.primaryDimension);

  if (mode === DiscussionMatchMode.SAME_POSITION_SAME_REASON) {
    return {
      title: reason ? `TA 和你一样，更在意${reason}` : `和同观点、同原因的人聊聊`,
      description: `立场一致、主因一致。用来建立低风险共鸣。`,
      action: '和同观点、同原因的人聊聊',
    };
  }
  if (mode === DiscussionMatchMode.SAME_POSITION_DIFFERENT_REASON) {
    return {
      title: `你们都选择「${position}」，但在意的点不同`,
      description: '立场一致、主因不同。用来发现同结果背后的差异。',
      action: '看看相同选择背后的不同理由',
    };
  }
  return {
    title: `你们都很看重${dimension}，但对判断的结论不同`,
    description: '表层立场不同，但有共同底层价值。不匹配完全相反、没有共同价值的观点。',
    action: '听听同样重视这件事、但判断不同的人怎么想',
  };
}

export function simulatePartnerVote(topic: RelationshipTopic, vote: TopicVoteRecord, mode: DiscussionMatchMode): TopicVoteRecord {
  const reasons = topic.reasonOptionsByPosition[vote.positionId] ?? [];
  if (mode === DiscussionMatchMode.SAME_POSITION_SAME_REASON) {
    return {
      topicId: topic.id,
      positionId: vote.positionId,
      primaryReasonId: vote.primaryReasonId ?? reasons[0]?.id,
      secondaryReasonIds: [],
      skippedStage2: !vote.primaryReasonId,
    };
  }
  if (mode === DiscussionMatchMode.SAME_POSITION_DIFFERENT_REASON) {
    const other = reasons.find((reason) => reason.id !== vote.primaryReasonId) ?? reasons[0];
    return {
      topicId: topic.id,
      positionId: vote.positionId,
      primaryReasonId: other?.id,
      secondaryReasonIds: [],
      skippedStage2: !other,
    };
  }
  const otherPosition = topic.positionOptions.find((option) => option.id !== vote.positionId)?.id ?? vote.positionId;
  const sharedDimension = vote.primaryReasonId
    ? topic.reasonOptionsByPosition[vote.positionId]?.find((reason) => reason.id === vote.primaryReasonId)?.dimension
    : topic.primaryDimension;
  const counterpartReasons = topic.reasonOptionsByPosition[otherPosition] ?? [];
  const shared = counterpartReasons.find((reason) => reason.dimension === sharedDimension) ?? counterpartReasons[0];
  return {
    topicId: topic.id,
    positionId: otherPosition,
    primaryReasonId: shared?.id,
    secondaryReasonIds: [],
    skippedStage2: !shared,
  };
}

export function voteLabels(topic: RelationshipTopic, vote?: TopicVoteRecord) {
  if (!vote) return { position: undefined, reason: undefined };
  return {
    position: topic.positionOptions.find((option) => option.id === vote.positionId)?.label,
    reason: vote.primaryReasonId
      ? topic.reasonOptionsByPosition[vote.positionId]?.find((option) => option.id === vote.primaryReasonId)?.label
      : undefined,
  };
}

export function structuredPrompts(topic: Topic) {
  if (topic.kind === TopicKind.LIFESTYLE_PROMPT) {
    return [
      { stage: 'OPENING' as const, text: topic.openingQuestion },
      { stage: 'UNDERSTANDING' as const, text: '对方刚说的哪一句，你最想接下去？' },
      { stage: 'CONDITION' as const, text: '如果时间、预算或天气变了，你的选择会怎么调整？' },
      { stage: 'REFLECTION' as const, text: '现实里，你希望和什么样的人一起做这件事？' },
      { stage: 'CLOSING' as const, text: '愿意继续认识对方吗？' },
    ];
  }
  return [
    { stage: 'OPENING' as const, text: '你最在意这个情景里的哪一点？' },
    { stage: 'UNDERSTANDING' as const, text: '先复述一下对方的理由，你认同其中哪部分？' },
    { stage: 'CONDITION' as const, text: '如果补充一个什么条件，你会改变判断？' },
    { stage: 'REFLECTION' as const, text: '现实中你希望男女朋友如何处理类似问题？' },
    { stage: 'CLOSING' as const, text: '愿意继续认识对方吗？' },
  ];
}

export function pickPartnerForMode(
  mode: DiscussionMatchMode,
  people: readonly Person[],
  currentUserId: PersonId,
  topicId?: string,
) {
  const pool = people.filter((person) => person.id !== currentUserId);
  if (pool.length === 0) return people[0];

  const modeOffset = mode === DiscussionMatchMode.SAME_POSITION_SAME_REASON
    ? 0
    : mode === DiscussionMatchMode.SAME_POSITION_DIFFERENT_REASON
      ? 1
      : 2;
  const generatedTopicParts = topicId?.match(/^topic_ai_(hot|life)_(\d+)_(\d+)$/);
  const topicOffset = generatedTopicParts
    ? (Number(generatedTopicParts[2]) * 2) + Number(generatedTopicParts[3]) + (generatedTopicParts[1] === 'life' ? 3 : 0)
    : topicId
      ? Array.from(topicId).reduce((hash, character) => ((hash * 31) + character.charCodeAt(0)) >>> 0, 0)
      : 0;
  return pool[(topicOffset + modeOffset) % pool.length] ?? pool[0];
}
