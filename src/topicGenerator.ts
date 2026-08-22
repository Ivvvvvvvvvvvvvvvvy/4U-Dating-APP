import {
  FeedAction,
  FeedCardType,
  FeedPresentationTemplate,
  FeedReasonCode,
  PathType,
  RelationshipDimension,
  TopicKind,
  TopicModerationStatus,
  type FeedCard,
  type LifestyleTopic,
  type MediaAsset,
  type RelationshipTopic,
  type Topic,
  type TopicFeedCard,
  type TopicId,
} from './domain';

export type AiTopicStream = 'hot' | 'lifestyle';

export type GeneratedTopicBatch = {
  readonly stream: AiTopicStream;
  readonly batchNumber: number;
  readonly generatedAt: string;
  readonly topics: readonly Topic[];
  readonly cards: readonly TopicFeedCard[];
};

const generatedTopics = new Map<TopicId, Topic>();
let batchSequence = 0;

const hotSubjects = [
  ['恋爱后还需要对伴侣完全公开朋友圈吗？', '公开能带来安全感，还是保留空间更重要？', '一方希望彼此公开社交动态，另一方认为部分内容只对朋友可见也很正常。', '朋友圈边界', RelationshipDimension.PRIVACY_AND_AUTONOMY],
  ['和异性朋友单独吃饭，需要提前告诉伴侣吗？', '报备、信任和个人自由之间，你会如何划线？', '双方都认可正常社交，但对是否需要提前说明有不同理解。', '异性社交', RelationshipDimension.LOYALTY_AND_BOUNDARIES],
  ['第一次约会坚持 AA，会显得太生疏吗？', '公平、诚意和经济压力，哪一项更影响你的判断？', '两个人都愿意赴约，但对买单是否代表诚意有不同看法。', '约会消费', RelationshipDimension.ECONOMICS_AND_RESPONSIBILITY],
  ['已读后很久不回，算不算一种关系信号？', '忙碌和冷淡有时很难分辨，你会看哪些细节？', '一方习惯忙完集中回复，另一方会把长时间不回理解成不在意。', '回复速度', RelationshipDimension.COMPANIONSHIP_AND_CONTACT],
  ['第一次共同旅行意见不合，应该谁先让步？', '行程效率与彼此体验冲突时，你更看重什么？', '一方想按计划走完景点，另一方更希望随时停下来改变安排。', '旅行分歧', RelationshipDimension.COMMUNICATION_AND_CONFLICT],
  ['稳定交往后，应该主动在社交平台公开吗？', '关系确认需要公开表达，还是双方知道就足够？', '一方把公开视为确认关系，另一方很少在社交平台分享私人生活。', '公开关系', RelationshipDimension.RELATIONSHIP_PACING],
  ['逢年过节回复前任问候，算越界吗？', '礼貌回应和情感牵连的边界在哪里？', '回复内容并不暧昧，但现任仍然感到不舒服。', '前任边界', RelationshipDimension.LOYALTY_AND_BOUNDARIES],
  ['周末只想自己待着，需要向伴侣解释吗？', '亲密关系是否也应该允许不被打扰的时间？', '一方需要独处恢复精力，另一方担心这意味着关系正在疏远。', '个人空间', RelationshipDimension.PRIVACY_AND_AUTONOMY],
  ['情侣长期共享实时定位，是安心还是压力？', '透明度和被监控感之间，边界应该在哪里？', '共享定位最初为了安全，但后来逐渐变成了关系里的默认要求。', '定位共享', RelationshipDimension.PRIVACY_AND_AUTONOMY],
  ['忘记重要纪念日，能代表不够在乎吗？', '记住日期与真实投入，哪一个更能说明问题？', '一方认真准备了纪念日，另一方却完全忘记，但平时一直很照顾对方。', '情感表达', RelationshipDimension.SUPPORT_AND_CARE],
] as const;

const lifestyleSubjects = [
  ['理想周末只安排一件事，你会选什么？', '把时间留给兴趣、朋友，还是彻底休息？', '如果不考虑待办清单，你最想怎么度过？', '周末方式'],
  ['如果每天只能保留一种早餐习惯，你会选哪种？', '一顿早餐里也藏着一个人的生活节奏。', '你愿意早起准备，还是更喜欢简单快速？', '日常偏好'],
  ['下班后多出两小时，你会去哪里走走？', '熟悉的街区和陌生的小路，你更想选哪一种？', '分享一条你愿意反复走的路线。', '城市生活'],
  ['一个人住时，你最舍得为哪件家居用品花钱？', '舒适、审美和实用，你会如何排序？', '说说那件最能提升幸福感的小东西。', '生活品质'],
  ['旅行时临时改变计划，会让你兴奋还是焦虑？', '计划感和随性往往决定两个人能否同行。', '你最近一次临时改计划是什么时候？', '旅行节奏'],
  ['朋友临时约你出门，你通常会答应吗？', '临时邀约能带来惊喜，也可能打乱自己的节奏。', '什么样的邀约最容易让你立刻出门？', '社交能量'],
  ['哪一首歌最适合分享给刚认识的人？', '有些歌比自我介绍更容易表达一个人。', '它会让对方知道你的哪一面？', '兴趣表达'],
  ['一起做饭时，你更愿意掌勺还是负责收拾？', '轻微协作最容易看见真实的相处方式。', '你最想和别人一起完成哪道菜？', '生活协作'],
  ['偶尔奖励自己，你更愿意买体验还是买东西？', '消费选择背后，是不同的快乐来源。', '最近一次让你觉得值得的消费是什么？', '消费方式'],
  ['睡前最后半小时，你最想留给什么？', '阅读、聊天、刷视频，还是安静发呆？', '哪种睡前状态会让你觉得一天完整结束？', '生活节奏'],
] as const;

const hotContexts = ['刚确认关系时', '异地相处时', '双方工作都很忙时', '发生过类似误会后', '准备认真发展时', '生活节奏差异很大时', '关系进入新阶段时'];
const lifeContexts = ['在陌生城市生活时', '一个人度过时', '和刚认识的人相处时', '没有工作安排的一天', '预算有限的时候', '天气刚刚好的周末', '想把生活过慢一点的时候'];
const hotCovers = [
  'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1200&q=84',
  'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1200&q=84',
  'https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?auto=format&fit=crop&w=1200&q=84',
];
const lifestyleCovers = [
  'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=84',
  'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=84',
  'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1200&q=84',
];

function media(stream: AiTopicStream, token: string, index: number): MediaAsset {
  const covers = stream === 'hot' ? hotCovers : lifestyleCovers;
  return { id: `media_ai_${token}`, url: covers[index % covers.length], alt: stream === 'hot' ? '热点话题讨论场景' : '温暖的日常生活场景', width: 1200, height: 900 };
}

function createHotTopic(batch: number, index: number): RelationshipTopic {
  const source = hotSubjects[(batch * 3 + index) % hotSubjects.length];
  const context = hotContexts[(batch + index * 2) % hotContexts.length];
  const token = `hot_${batch}_${index}`;
  return {
    entityType: FeedCardType.TOPIC,
    id: `topic_ai_${token}`,
    entityVersion: 1,
    kind: TopicKind.RELATIONSHIP_SCENARIO,
    title: `${context}，${source[0]}`,
    summary: source[1],
    cover: media('hot', token, index),
    moderationStatus: TopicModerationStatus.PUBLISHED,
    replyCount: 180 + ((batch * 73 + index * 47) % 820),
    lastActivityAt: new Date(Date.now() - ((index + 1) * 11 + batch % 7) * 60_000).toISOString() as RelationshipTopic['lastActivityAt'],
    tags: ['AI 热点', source[3]],
    scenario: `${source[2]}当前情境是：${context}。`,
    reversal: `如果双方已经提前明确过彼此的边界，你的选择会改变吗？`,
    primaryDimension: source[4],
    positionOptions: [
      { id: 'communicate', label: '应该主动沟通并说明' },
      { id: 'space', label: '应该尊重个人空间' },
      { id: 'rules', label: '双方需要先约定规则' },
      { id: 'depends', label: '取决于具体情境' },
    ],
    reasonOptionsByPosition: {
      communicate: [
        { id: 'clarity', label: '明确表达能减少误解', dimension: RelationshipDimension.COMMUNICATION_AND_CONFLICT },
        { id: 'care', label: '伴侣感受需要被回应', dimension: RelationshipDimension.SUPPORT_AND_CARE },
        { id: 'trust', label: '透明会增加关系安全感', dimension: RelationshipDimension.LOYALTY_AND_BOUNDARIES },
      ],
      space: [
        { id: 'autonomy', label: '亲密关系也需要个人空间', dimension: RelationshipDimension.PRIVACY_AND_AUTONOMY },
        { id: 'trust_space', label: '信任不应依赖持续确认', dimension: RelationshipDimension.LOYALTY_AND_BOUNDARIES },
        { id: 'pace', label: '每个人适应关系的节奏不同', dimension: RelationshipDimension.RELATIONSHIP_PACING },
      ],
      rules: [
        { id: 'shared_rule', label: '共同规则比单方要求更公平', dimension: RelationshipDimension.COMMUNICATION_AND_CONFLICT },
        { id: 'expectation', label: '提前对齐能避免事后争执', dimension: RelationshipDimension.RELATIONSHIP_PACING },
        { id: 'responsibility', label: '双方都要为关系负责', dimension: RelationshipDimension.ECONOMICS_AND_RESPONSIBILITY },
      ],
      depends: [
        { id: 'context', label: '关系阶段会影响判断', dimension: RelationshipDimension.RELATIONSHIP_PACING },
        { id: 'frequency', label: '频率和程度更重要', dimension: RelationshipDimension.COMPANIONSHIP_AND_CONTACT },
        { id: 'history', label: '需要结合双方过往经历', dimension: RelationshipDimension.SUPPORT_AND_CARE },
      ],
    },
    resultStats: {
      respondentCount: 900 + ((batch * 137 + index * 83) % 2400),
      positionShares: { communicate: 0.34, space: 0.19, rules: 0.31, depends: 0.16 },
      reasonSharesByPosition: {
        communicate: { clarity: 0.42, care: 0.34, trust: 0.24 },
        space: { autonomy: 0.43, trust_space: 0.32, pace: 0.25 },
        rules: { shared_rule: 0.41, expectation: 0.36, responsibility: 0.23 },
        depends: { context: 0.4, frequency: 0.35, history: 0.25 },
      },
    },
  };
}

function createLifestyleTopic(batch: number, index: number): LifestyleTopic {
  const source = lifestyleSubjects[(batch * 5 + index) % lifestyleSubjects.length];
  const context = lifeContexts[(batch * 2 + index) % lifeContexts.length];
  const token = `life_${batch}_${index}`;
  return {
    entityType: FeedCardType.TOPIC,
    id: `topic_ai_${token}`,
    entityVersion: 1,
    kind: TopicKind.LIFESTYLE_PROMPT,
    title: `${context}，${source[0]}`,
    summary: source[1],
    cover: media('lifestyle', token, index),
    moderationStatus: TopicModerationStatus.PUBLISHED,
    replyCount: 24 + ((batch * 29 + index * 17) % 180),
    lastActivityAt: new Date(Date.now() - ((index + 1) * 43 + batch % 11) * 60_000).toISOString() as LifestyleTopic['lastActivityAt'],
    tags: ['AI 生活', source[3]],
    prompt: `${context}。${source[1]}`,
    openingQuestion: source[2],
  };
}

function createCard(topic: Topic, stream: AiTopicStream, batch: number, index: number): TopicFeedCard {
  return {
    schemaVersion: '1.0',
    cardId: `feed_ai_${stream}_${batch}_${index}`,
    cardType: FeedCardType.TOPIC,
    pathType: PathType.TOPIC,
    entityId: topic.id,
    entityVersion: topic.entityVersion,
    requestId: `request_ai_topics_${stream}_${batch}`,
    rankPosition: index + 1,
    reason: {
      code: FeedReasonCode.FRESH_DISCUSSION,
      headline: stream === 'hot' ? 'AI 识别的高讨论度议题' : 'AI 生成的生活破冰问题',
      explanation: stream === 'hot' ? '结合讨论热度与关系相关性生成。' : '从具体日常偏好出发，更容易自然开聊。',
      evidenceLabels: [...topic.tags],
    },
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() as TopicFeedCard['expiresAt'],
    presentation: {
      template: FeedPresentationTemplate.TOPIC_CONVERSATION,
      image: topic.cover,
      eyebrow: stream === 'hot' ? 'AI 热点 · 两阶段投票' : 'AI 生活 · 即时讨论',
      headline: topic.title,
      supportingText: topic.summary,
      badges: [{ label: stream === 'hot' ? 'AI 热点' : 'AI 生活', tone: 'ACCENT' }],
      facts: [{ label: '讨论', value: `${topic.replyCount} 条` }],
      primaryActionLabel: stream === 'hot' ? '说说你的选择' : '加入讨论',
    },
    allowedActions: [FeedAction.VIEW_DETAIL, stream === 'hot' ? FeedAction.VOTE : FeedAction.JOIN_DISCUSSION, FeedAction.SAVE, FeedAction.HIDE, FeedAction.REPORT],
  };
}

export function generateTopicBatch(stream: AiTopicStream, size = 8): GeneratedTopicBatch {
  batchSequence += 1;
  const batchNumber = batchSequence;
  const topics = Array.from({ length: size }, (_, index) => stream === 'hot' ? createHotTopic(batchNumber, index) : createLifestyleTopic(batchNumber, index));
  topics.forEach((topic) => generatedTopics.set(topic.id, topic));
  return { stream, batchNumber, generatedAt: new Date().toISOString(), topics, cards: topics.map((topic, index) => createCard(topic, stream, batchNumber, index)) };
}

export function findGeneratedTopicById(id: TopicId): Topic | undefined {
  return generatedTopics.get(id);
}

export function resolveGeneratedTopicEntity(card: FeedCard): Topic | undefined {
  return card.cardType === FeedCardType.TOPIC ? generatedTopics.get(card.entityId) : undefined;
}
