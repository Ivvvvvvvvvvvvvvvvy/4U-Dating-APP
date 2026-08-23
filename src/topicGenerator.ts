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
  ['发现伴侣和“小三”仍有联系，但说只是在处理旧事，你会信吗？', '结束一段越界关系后，彻底断联是不是最基本的态度？', '一方承认曾经越界，并承诺已经结束；另一方却发现他们仍在私下联系。', '第三者争议', RelationshipDimension.LOYALTY_AND_BOUNDARIES],
  ['婆婆未经同意进入卧室整理东西，伴侣应该当面制止吗？', '孝顺父母和保护伴侣边界发生冲突时，该站在哪一边？', '一方觉得长辈只是好心帮忙，另一方认为私人空间被严重侵犯。', '婆媳边界', RelationshipDimension.PRIVACY_AND_AUTONOMY],
  ['婆媳争吵时，伴侣说“你们都少说两句”算不算逃避？', '所谓一碗水端平，会不会其实是谁也不愿得罪？', '母亲和伴侣因家庭安排争执，夹在中间的人选择不判断谁对谁错。', '婆媳矛盾', RelationshipDimension.SUPPORT_AND_CARE],
  ['伴侣有一个无话不谈的异性知己，边界应该到哪里？', '精神上的亲密是否也可能超过普通朋友？', '他们几乎每天聊天，分享许多没有告诉伴侣的情绪和秘密。', '异性知己', RelationshipDimension.LOYALTY_AND_BOUNDARIES],
  ['前任突然生病求助，现任不同意帮忙，谁更合理？', '人情、责任与现任感受，应该怎么排序？', '前任身边暂时没有可以求助的人，但现任明确表示不舒服。', '前任求助', RelationshipDimension.LOYALTY_AND_BOUNDARIES],
  ['发现对象删除了和异性的聊天记录，但内容并不暧昧，算欺骗吗？', '删除记录本身，是否比聊天内容更值得警惕？', '对方解释只是担心引起误会，因此提前清理了聊天记录。', '聊天记录', RelationshipDimension.COMMUNICATION_AND_CONFLICT],
  ['结婚后必须和父母同住，否则就是不孝吗？', '家庭责任可以要求另一半牺牲自己的生活方式吗？', '一方坚持婚后照顾父母，另一方只接受住在附近但不同住。', '婚后同住', RelationshipDimension.CAREER_AND_LIFESTYLE],
  ['伴侣的家人长期插手你们的消费决定，该不该直接翻脸？', '长辈的经验和小家庭的自主权，边界在哪里？', '从买房到旅游，家人都会给出强烈意见，并要求按照他们的方式安排。', '家庭干预', RelationshipDimension.ECONOMICS_AND_RESPONSIBILITY],
  ['对象单独陪异性朋友旅行，说是早就约好的，能接受吗？', '过去的约定，是否应该为现在的关系重新调整？', '旅行计划在恋爱前已经确定，对方认为临时取消会伤害多年友谊。', '异性旅行', RelationshipDimension.LOYALTY_AND_BOUNDARIES],
  ['伴侣帮异性同事隐瞒感情问题，是热心还是越界？', '替别人保守秘密时，要不要顾及自己伴侣的感受？', '同事经常深夜倾诉并要求保密，伴侣知道后认为两人的关系已经过近。', '异性同事', RelationshipDimension.LOYALTY_AND_BOUNDARIES],
] as const;

const lifestyleSubjects = [
  ['手机相册里最近一张照片是什么？', '一张随手拍，通常比正式自我介绍更容易聊下去。', '你愿意从这张照片开始讲哪件小事？', '相册故事'],
  ['如果突然中了十万元，你第一笔会花在哪里？', '不用考虑标准答案，说说最真实的第一反应。', '你会先告诉谁，又会留下多少不动？', '意外惊喜'],
  ['如果能获得一个不太实用的超能力，你会选什么？', '越没用的超能力，往往越能看出一个人的想象力。', '它能给你的日常带来什么小快乐？', '脑洞问题'],
  ['旅行只能带三样东西，你最不能少哪三样？', '行李选择会暴露一个人的安全感来源。', '其中哪一样最能代表你的旅行习惯？', '旅行破冰'],
  ['深夜突然很饿，你最想点什么外卖？', '食物是最不容易冷场的话题之一。', '有没有一家店是你愿意专门推荐给别人的？', '深夜美食'],
  ['去 KTV 时，你一定会点哪首歌？', '不一定唱得最好，但一定最能让你进入状态。', '这首歌背后有没有一段故事？', 'KTV歌单'],
  ['完全不用工作的周末，你会怎么安排一天？', '从起床时间到夜晚活动，分享你的理想节奏。', '哪一段最适合邀请另一个人加入？', '理想周末'],
  ['哪部电影或综艺，你愿意陪别人再看一遍？', '愿意重看的内容，通常藏着稳定的兴趣偏好。', '你最想观察对方看到哪一段时的反应？', '影视分享'],
  ['如果带刚认识的人逛你的城市，你会先去哪？', '一条路线就能自然聊到食物、记忆和生活方式。', '这个地方为什么对你来说不一样？', '城市路线'],
  ['如果和别人交换一天生活，你最想体验谁的日常？', '从工作、兴趣到生活节奏，都可以大胆想象。', '你最想偷学对方的哪一种能力？', '交换人生'],
] as const;

const hotContexts = ['刚确认关系时', '异地相处时', '双方工作都很忙时', '发生过类似误会后', '准备认真发展时', '生活节奏差异很大时', '关系进入新阶段时'];
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
  const token = `life_${batch}_${index}`;
  return {
    entityType: FeedCardType.TOPIC,
    id: `topic_ai_${token}`,
    entityVersion: 1,
    kind: TopicKind.LIFESTYLE_PROMPT,
    title: source[0],
    summary: source[1],
    cover: media('lifestyle', token, index),
    moderationStatus: TopicModerationStatus.PUBLISHED,
    replyCount: 24 + ((batch * 29 + index * 17) % 180),
    lastActivityAt: new Date(Date.now() - ((index + 1) * 43 + batch % 11) * 60_000).toISOString() as LifestyleTopic['lastActivityAt'],
    tags: ['AI 生活', source[3]],
    prompt: source[1],
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
      eyebrow: topic.tags[1] ?? '话题',
      headline: topic.title,
      supportingText: topic.summary,
      badges: [],
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
