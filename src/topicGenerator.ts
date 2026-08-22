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
  type MediaAsset,
  type RelationshipTopic,
  type LifestyleTopic,
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
  ['朋友圈可见范围', '恋爱后还需要对伴侣完全公开朋友圈吗？', '公开能带来安全感，还是保留空间更重要？', '恋爱边界'],
  ['异性朋友', '有伴侣后，和异性朋友单独吃饭需要提前说吗？', '报备、信任和个人自由之间，你会如何划线？', '边界讨论'],
  ['约会买单', '第一次约会，坚持 AA 会让人觉得太生疏吗？', '公平、诚意和经济压力，哪一项更影响你的判断？', '约会消费'],
  ['回复速度', '已读后很久不回，算不算一种关系信号？', '忙碌和冷淡有时很难分辨，你会看哪些细节？', '沟通热点'],
  ['旅行分歧', '第一次共同旅行意见不合，应该谁先让步？', '行程效率和彼此体验冲突时，你更看重什么？', '相处考验'],
  ['公开关系', '稳定交往后，是否应该主动在社交平台公开？', '关系确认需要公开表达，还是双方知道就足够？', '关系确认'],
  ['前任联系', '逢年过节回复前任的问候，算越界吗？', '礼貌回应和情感牵连的边界在哪里？', '热门争议'],
  ['独处时间', '周末只想自己待着，需要向伴侣解释原因吗？', '亲密关系是否也应该允许不被打扰的时间？', '个人空间'],
  ['定位共享', '情侣长期共享实时定位，是安心还是压力？', '安全感不应该建立在监控上，但透明度如何把握？', '隐私边界'],
  ['纪念日', '忘记重要纪念日，能代表不够在乎吗？', '记住日期和真实投入，哪一个更能说明问题？', '情感表达'],
] as const;

const lifestyleSubjects = [
  ['周末', '理想周末只安排一件事，你会选什么？', '把时间留给兴趣、朋友还是彻底休息？', '周末方式'],
  ['早餐', '如果每天只能保留一种早餐习惯，你会选哪种？', '一顿早餐里也藏着一个人的生活节奏。', '日常偏好'],
  ['城市散步', '下班后多出两小时，你会去哪里走走？', '熟悉的街区和陌生的小路，你更想选哪一种？', '城市生活'],
  ['居住', '一个人住时，你最舍得为哪件家居用品花钱？', '舒适、审美和实用，你会如何排序？', '生活品质'],
  ['旅行', '旅行时临时改变计划，会让你兴奋还是焦虑？', '计划感和随性往往决定两个人能否同行。', '旅行节奏'],
  ['社交', '朋友临时约你出门，你通常会答应吗？', '临时邀约能带来惊喜，也可能打乱自己的节奏。', '社交能量'],
  ['音乐', '哪一首歌最适合分享给刚认识的人？', '有些歌比自我介绍更容易表达一个人。', '兴趣表达'],
  ['做饭', '一起做饭时，你更愿意掌勺还是负责收拾？', '轻微协作最容易看见真实的相处方式。', '生活协作'],
  ['消费', '偶尔奖励自己，你更愿意买体验还是买东西？', '消费选择背后，是不同的快乐来源。', '消费方式'],
  ['睡前', '睡前最后半小时，你最想留给什么？', '阅读、聊天、刷视频或什么都不做？', '生活节奏'],
] as const;

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
  return {
    id: `media_ai_${token}`,
    url: covers[index % covers.length],
    alt: stream === 'hot' ? '正在讨论的热点话题' : '温暖的日常生活场景',
    width: 1200,
    height: 900,
  };
}

function createHotTopic(batch: number, index: number): RelationshipTopic {
  const source = hotSubjects[(batch * 3 + index) % hotSubjects.length];
  const token = `hot_${batch}_${index}`;
  return {
    entityType: FeedCardType.TOPIC,
    id: `topic_ai_${token}`,
    entityVersion: 1,
    kind: TopicKind.RELATIONSHIP_SCENARIO,
    title: source[1],
    summary: source[2],
    cover: media('hot', token, index),
    moderationStatus: TopicModerationStatus.PUBLISHED,
    replyCount: 180 + ((batch * 73 + index * 47) % 820),
    lastActivityAt: new Date(Date.now() - ((index + 1) * 11 + batch % 7) * 60_000).toISOString() as RelationshipTopic['lastActivityAt'],
    tags: ['AI 热点', source[3], source[0]],
    scenario: `这是根据近期高讨论度关系议题生成的匿名讨论场景：${source[2]}`,
    primaryDimension: RelationshipDimension.COMMUNICATION_AND_CONFLICT,
    positionOptions: [
      { id: 'support', label: '更认同主动沟通' },
      { id: 'oppose', label: '更认同保留边界' },
      { id: 'depends', label: '取决于具体情境' },
    ],
    reasonOptionsByPosition: {
      support: [{ id: 'clarity', label: '明确表达能减少误解', dimension: RelationshipDimension.COMMUNICATION_AND_CONFLICT }],
      oppose: [{ id: 'autonomy', label: '亲密关系也需要个人空间', dimension: RelationshipDimension.PRIVACY_AND_AUTONOMY }],
      depends: [{ id: 'context', label: '关系阶段和事件程度都很重要', dimension: RelationshipDimension.RELATIONSHIP_PACING }],
    },
  };
}

function createLifestyleTopic(batch: number, index: number): LifestyleTopic {
  const source = lifestyleSubjects[(batch * 5 + index) % lifestyleSubjects.length];
  const token = `life_${batch}_${index}`;
  return {
    entityType: FeedCardType.TOPIC,
    id: `topic_ai_${token}`,
    entityVersion: 1,
    kind: TopicKind.LIFESTYLE_PROMPT,
    title: source[1],
    summary: source[2],
    cover: media('lifestyle', token, index),
    moderationStatus: TopicModerationStatus.PUBLISHED,
    replyCount: 24 + ((batch * 29 + index * 17) % 180),
    lastActivityAt: new Date(Date.now() - ((index + 1) * 43 + batch % 11) * 60_000).toISOString() as LifestyleTopic['lastActivityAt'],
    tags: ['AI 生活', source[3], source[0]],
    prompt: `从一个具体日常开始：${source[2]}`,
    openingQuestion: '你的选择是什么？为什么这件小事对你重要？',
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
      eyebrow: `${stream === 'hot' ? 'AI 热点' : 'AI 生活'} · ${topic.replyCount} 条讨论`,
      headline: topic.title,
      supportingText: topic.summary,
      badges: [{ label: 'AI 生成', tone: 'ACCENT' }],
      facts: [{ label: '讨论', value: `${topic.replyCount} 条` }],
      primaryActionLabel: stream === 'hot' ? '表达观点' : '加入讨论',
    },
    allowedActions: [
      FeedAction.VIEW_DETAIL,
      stream === 'hot' ? FeedAction.VOTE : FeedAction.JOIN_DISCUSSION,
      FeedAction.SAVE,
      FeedAction.HIDE,
      FeedAction.REPORT,
    ],
  };
}

export function generateTopicBatch(stream: AiTopicStream, size = 8): GeneratedTopicBatch {
  batchSequence += 1;
  const batchNumber = batchSequence;
  const topics = Array.from({ length: size }, (_, index) => (
    stream === 'hot' ? createHotTopic(batchNumber, index) : createLifestyleTopic(batchNumber, index)
  ));
  topics.forEach((topic) => generatedTopics.set(topic.id, topic));
  return {
    stream,
    batchNumber,
    generatedAt: new Date().toISOString(),
    topics,
    cards: topics.map((topic, index) => createCard(topic, stream, batchNumber, index)),
  };
}

export function findGeneratedTopicById(id: TopicId): Topic | undefined {
  return generatedTopics.get(id);
}

export function resolveGeneratedTopicEntity(card: FeedCard): Topic | undefined {
  if (card.cardType !== FeedCardType.TOPIC) return undefined;
  return generatedTopics.get(card.entityId);
}
