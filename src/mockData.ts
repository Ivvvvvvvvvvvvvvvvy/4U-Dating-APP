import {
  APPLICATION_STATE_SEMANTICS,
  ActivityCategory,
  ActivityFormat,
  ActivityFulfillmentStatus,
  ActivityPublicationStatus,
  ActivityRecruitmentStatus,
  ActivityRoomStatus,
  ApplicationState,
  ConversationStatus,
  DiscussionMatchMode,
  FeedAction,
  FeedCardType,
  FeedPresentationTemplate,
  FeedReasonCode,
  MatchStatus,
  MbtiType,
  MessageDeliveryStatus,
  MessageKind,
  OpportunityOrganizerStatus,
  ParticipationMode,
  PathType,
  ProfileStatus,
  RelationshipDimension,
  RelationshipGoal,
  ThreadAction,
  ThreadKind,
  TopicDiscussionStatus,
  TopicKind,
  TopicModerationStatus,
  VerificationStatus,
  ZodiacSign,
  type Activity,
  type ActivityFeedCard,
  type ActivityApplication,
  type ActivityId,
  type ActivityOpportunity,
  type ActivityOpportunityId,
  type FeedCard,
  type FeedEntity,
  type MediaAsset,
  type Message,
  type MessageId,
  type Person,
  type PersonId,
  type Thread,
  type ThreadId,
  type Topic,
  type TopicFeedCard,
  type TopicId,
  type CurrentUser,
} from './domain';

const media = (
  id: string,
  url: string,
  alt: string,
  width = 1200,
  height = 1500,
): MediaAsset => ({
  id: `media_${id}`,
  url,
  alt,
  width,
  height,
});

const verified = {
  account: VerificationStatus.VERIFIED,
  personhood: VerificationStatus.VERIFIED,
  profileReview: VerificationStatus.VERIFIED,
} as const;

const currentUserProfile: Person = {
  entityType: FeedCardType.PERSON,
  id: 'person_me',
  entityVersion: 4,
  profileStatus: ProfileStatus.RECOMMENDABLE,
  displayName: '小满',
  age: 27,
  city: '上海',
  occupation: '产品设计师',
  bio: '喜欢从一场展、一段散步开始认识真实的人。',
  relationshipGoal: RelationshipGoal.LONG_TERM,
  mbti: MbtiType.INFJ,
  zodiac: ZodiacSign.LIBRA,
  interests: ['城市摄影', '独立电影', 'City Walk'],
  photos: [
    media(
      'me_portrait',
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=900&q=84',
      '小满在窗边的自然光头像',
    ),
  ],
  prompts: [
    { prompt: '理想的周末', answer: '上午看展，傍晚随便走走，给聊天留一点空白。' },
  ],
  verification: verified,
};

export const people = [
  {
    entityType: FeedCardType.PERSON,
    id: 'person_lan',
    entityVersion: 7,
    profileStatus: ProfileStatus.RECOMMENDABLE,
    displayName: '阿岚',
    age: 28,
    city: '上海',
    occupation: '品牌设计师',
    bio: '喜欢把周末过得慢一点，带相机但不急着按快门。',
    relationshipGoal: RelationshipGoal.LONG_TERM,
    mbti: MbtiType.INFP,
    zodiac: ZodiacSign.PISCES,
    interests: ['摄影', '夜游', '独立电影', '逛展'],
    photos: [
      media(
        'lan_portrait',
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=900&q=84',
        '阿岚的户外头像',
      ),
      media(
        'lan_camera',
        'https://images.unsplash.com/photo-1452780212940-6f5c0d14d848?auto=format&fit=crop&w=900&q=84',
        '阿岚拍摄的胶片相机',
      ),
    ],
    prompts: [
      { prompt: '最近想完成的小事', answer: '在闭馆前再去一次喜欢的展，然后沿江走回家。' },
      { prompt: '舒服的相处方式', answer: '能认真聊，也能安静看各自喜欢的东西。' },
    ],
    verification: verified,
  },
  {
    entityType: FeedCardType.PERSON,
    id: 'person_zhou',
    entityVersion: 5,
    profileStatus: ProfileStatus.RECOMMENDABLE,
    displayName: '小周',
    age: 27,
    city: '上海',
    occupation: '产品经理',
    bio: '抱石新手，周末也会沿苏州河骑行。',
    relationshipGoal: RelationshipGoal.SERIOUS_DATING,
    mbti: MbtiType.ENTP,
    zodiac: ZodiacSign.GEMINI,
    interests: ['抱石', '骑行', '咖啡', '现场音乐'],
    photos: [
      media(
        'zhou_portrait',
        'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=900&q=84',
        '小周的户外头像',
      ),
    ],
    prompts: [
      { prompt: '我会主动安排', answer: '找路线、订场馆和带一壶咖啡。' },
    ],
    verification: verified,
  },
  {
    entityType: FeedCardType.PERSON,
    id: 'person_ning',
    entityVersion: 3,
    profileStatus: ProfileStatus.RECOMMENDABLE,
    displayName: '宁宁',
    age: 26,
    city: '上海',
    occupation: '策展项目助理',
    bio: '在城市里找新空间，也收集每次散步听到的歌。',
    relationshipGoal: RelationshipGoal.OPEN_TO_EXPLORE,
    mbti: MbtiType.ENFP,
    zodiac: ZodiacSign.AQUARIUS,
    interests: ['艺术', '黑胶', '散步', '旧书店'],
    photos: [
      media(
        'ning_portrait',
        'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=900&q=84',
        '宁宁在街区散步的头像',
      ),
    ],
    prompts: [
      { prompt: '最近循环', answer: '一张适合夜里慢慢听完的城市流行专辑。' },
    ],
    verification: verified,
  },
  {
    entityType: FeedCardType.PERSON,
    id: 'person_chen',
    entityVersion: 6,
    profileStatus: ProfileStatus.RECOMMENDABLE,
    displayName: '陈一',
    age: 29,
    city: '上海',
    occupation: '建筑师',
    bio: '偏爱老街、胶片和不赶时间的旅行。',
    relationshipGoal: RelationshipGoal.LONG_TERM,
    mbti: MbtiType.INTJ,
    zodiac: ZodiacSign.CAPRICORN,
    interests: ['建筑', '胶片', 'City Walk', '爵士'],
    photos: [
      media(
        'chen_portrait',
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=900&q=84',
        '陈一的城市街景头像',
      ),
    ],
    prompts: [
      { prompt: '旅行偏好', answer: '一天只排一个目的地，其余交给路上遇到的街道。' },
    ],
    verification: verified,
  },
  {
    entityType: FeedCardType.PERSON,
    id: 'person_muye',
    entityVersion: 2,
    profileStatus: ProfileStatus.RECOMMENDABLE,
    displayName: '木野',
    age: 30,
    city: '上海',
    occupation: '纪录片剪辑师',
    bio: '爱看老电影，最近开始学做手冲。',
    relationshipGoal: RelationshipGoal.SERIOUS_DATING,
    mbti: MbtiType.ISFP,
    zodiac: ZodiacSign.TAURUS,
    interests: ['纪录片', '手冲咖啡', '徒步', '书店'],
    photos: [
      media(
        'muye_portrait',
        'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=900&q=84',
        '木野的自然光头像',
      ),
    ],
    prompts: [{ prompt: '想聊很久的话题', answer: '一部作品如何改变我们看待日常。' }],
    verification: verified,
  },
  {
    entityType: FeedCardType.PERSON,
    id: 'person_xiaoyu',
    entityVersion: 4,
    profileStatus: ProfileStatus.RECOMMENDABLE,
    displayName: '小雨',
    age: 27,
    city: '上海',
    occupation: '编辑',
    bio: '读小说、做饭，也愿意为一场日落临时改路线。',
    relationshipGoal: RelationshipGoal.LONG_TERM,
    mbti: MbtiType.ISFJ,
    zodiac: ZodiacSign.CANCER,
    interests: ['阅读', '做饭', '公园', '旅行'],
    photos: [
      media(
        'xiaoyu_portrait',
        'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=84',
        '小雨在公园里的头像',
      ),
    ],
    prompts: [{ prompt: '我珍惜的日常', answer: '一起做一顿不用拍照也很好吃的晚饭。' }],
    verification: verified,
  },
] as const satisfies readonly Person[];

export const currentUser: CurrentUser = {
  profile: currentUserProfile,
  account: { emailVerified: true, phoneVerified: true },
  consent: {
    aiCompatibility: true,
    publicExplanation: true,
    version: 'consent-2026-08',
    updatedAt: '2026-08-18T09:30:00+08:00',
  },
  privacy: {
    showAge: true,
    showZodiac: true,
    showInConfirmedParticipantLists: true,
    exactLocationSharing: 'CONFIRMED_ACTIVITY_ONLY',
    lockScreenMessagePreview: 'HIDDEN',
  },
  stats: { savedActivityCount: 3, activeActivityCount: 2, unreadThreadCount: 3 },
};

export const activities = [
  {
    entityType: FeedCardType.ACTIVITY,
    id: 'activity_monet_night',
    entityVersion: 8,
    sourceOpportunityId: 'opportunity_monet_exhibition',
    title: '莫奈夜展后，沿江散步 40 分钟',
    summary: '先看夜展，再沿徐汇滨江慢走；给第一次见面留出自然的停顿。',
    category: ActivityCategory.EXHIBITION,
    format: ActivityFormat.PAIR,
    participationMode: ParticipationMode.APPLICATION_REQUIRED,
    publicationStatus: ActivityPublicationStatus.PUBLISHED,
    fulfillmentStatus: ActivityFulfillmentStatus.RECRUITING,
    recruitmentStatus: ActivityRecruitmentStatus.OPEN,
    organizerId: 'person_lan',
    cover: media(
      'monet_cover',
      'https://images.unsplash.com/photo-1561214115-f2f134cc4912?auto=format&fit=crop&w=1200&q=86',
      '暖色展览空间',
      1200,
      900,
    ),
    schedule: {
      startsAt: '2026-08-29T18:30:00+08:00',
      endsAt: '2026-08-29T21:10:00+08:00',
      timeZone: 'Asia/Shanghai',
    },
    publicLocation: {
      city: '上海',
      district: '徐汇区',
      areaLabel: '徐汇滨江公共文化区域',
      exactLocationPolicy: 'CONFIRMED_PARTICIPANTS_ONLY',
    },
    price: { currency: 'CNY', amountInMinorUnits: 8800, display: '¥88' },
    capacity: { minimum: 2, maximum: 2, confirmedCount: 1, heldCount: 0 },
    visibleParticipants: [
      { personId: 'person_lan', displayAuthorization: 'GRANTED', role: 'ORGANIZER' },
    ],
    agenda: ['18:30–19:50 一起观展', '20:00–20:40 沿江散步', '20:40 后自然结束或自由续场'],
    atmosphereTags: ['双人同行', '慢节奏', '公共场所'],
    safetyNotice: '参加不代表表达好感；集合细节仅向确认参与者展示。',
  },
  {
    entityType: FeedCardType.ACTIVITY,
    id: 'activity_wutong_city_walk',
    entityVersion: 11,
    title: '梧桐区日落 City Walk',
    summary: '穿过几条安静街巷看日落，最后在公共空间自由交流。',
    category: ActivityCategory.CITY_WALK,
    format: ActivityFormat.GROUP,
    participationMode: ParticipationMode.OPEN_JOIN,
    publicationStatus: ActivityPublicationStatus.PUBLISHED,
    fulfillmentStatus: ActivityFulfillmentStatus.FORMED,
    recruitmentStatus: ActivityRecruitmentStatus.OPEN,
    organizerId: 'person_chen',
    cover: media(
      'wutong_cover',
      'https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=1200&q=86',
      '梧桐树下的城市街道',
      1200,
      900,
    ),
    schedule: {
      startsAt: '2026-08-30T16:30:00+08:00',
      endsAt: '2026-08-30T20:00:00+08:00',
      timeZone: 'Asia/Shanghai',
    },
    publicLocation: {
      city: '上海',
      district: '徐汇区',
      areaLabel: '衡复风貌区',
      exactLocationPolicy: 'CONFIRMED_PARTICIPANTS_ONLY',
    },
    price: null,
    capacity: { minimum: 4, maximum: 8, confirmedCount: 5, heldCount: 0 },
    visibleParticipants: [
      { personId: 'person_chen', displayAuthorization: 'GRANTED', role: 'ORGANIZER' },
      { personId: 'person_ning', displayAuthorization: 'GRANTED', role: 'PARTICIPANT' },
      { personId: 'person_zhou', displayAuthorization: 'GRANTED', role: 'PARTICIPANT' },
    ],
    agenda: ['16:30 梧桐街区漫步', '18:10 在公共观景区域看日落', '18:40 自由交流'],
    atmosphereTags: ['多人小组', '城市漫游', '低压力社交'],
    safetyNotice: '不劝酒、不强制交换联系方式；活动内拍摄需征得本人同意。',
  },
  {
    entityType: FeedCardType.ACTIVITY,
    id: 'activity_bouldering_intro',
    entityVersion: 5,
    title: '新手抱石：互相拍第一条完攀',
    summary: '从安全教学和最简单的线路开始，新手也可以随时停下。',
    category: ActivityCategory.SPORT,
    format: ActivityFormat.GROUP,
    participationMode: ParticipationMode.APPLICATION_REQUIRED,
    publicationStatus: ActivityPublicationStatus.PUBLISHED,
    fulfillmentStatus: ActivityFulfillmentStatus.RECRUITING,
    recruitmentStatus: ActivityRecruitmentStatus.WAITLIST_ONLY,
    organizerId: 'person_zhou',
    cover: media(
      'bouldering_cover',
      'https://images.unsplash.com/photo-1522163182402-834f871fd851?auto=format&fit=crop&w=1200&q=86',
      '室内抱石墙',
      1200,
      900,
    ),
    schedule: {
      startsAt: '2026-09-02T19:30:00+08:00',
      endsAt: '2026-09-02T21:30:00+08:00',
      timeZone: 'Asia/Shanghai',
    },
    publicLocation: {
      city: '上海',
      district: '静安区',
      areaLabel: '静安寺商圈',
      exactLocationPolicy: 'CONFIRMED_PARTICIPANTS_ONLY',
    },
    price: { currency: 'CNY', amountInMinorUnits: 9800, display: '¥98' },
    capacity: { minimum: 4, maximum: 6, confirmedCount: 6, heldCount: 0 },
    visibleParticipants: [
      { personId: 'person_zhou', displayAuthorization: 'GRANTED', role: 'ORGANIZER' },
      { personId: 'person_xiaoyu', displayAuthorization: 'GRANTED', role: 'PARTICIPANT' },
    ],
    agenda: ['安全教学与热身', '新手线路自由尝试', '拉伸与合影'],
    atmosphereTags: ['新手友好', '轻运动', '可候补'],
    safetyNotice: '请遵守场馆安全规则；是否参与每条线路始终由本人决定。',
  },
  {
    entityType: FeedCardType.ACTIVITY,
    id: 'activity_vinyl_night',
    entityVersion: 9,
    title: '黑胶试听夜：带一首最近循环',
    summary: '轮流播放一首歌，再留出安静、自由的换座交流时间。',
    category: ActivityCategory.MUSIC,
    format: ActivityFormat.GROUP,
    participationMode: ParticipationMode.MATCH_FORMATION,
    publicationStatus: ActivityPublicationStatus.PUBLISHED,
    fulfillmentStatus: ActivityFulfillmentStatus.FORMED,
    recruitmentStatus: ActivityRecruitmentStatus.CLOSED,
    organizerId: 'person_ning',
    cover: media(
      'vinyl_cover',
      'https://images.unsplash.com/photo-1461360228754-6e81c478b882?auto=format&fit=crop&w=1200&q=86',
      '唱盘上的黑胶唱片',
      1200,
      900,
    ),
    schedule: {
      startsAt: '2026-09-04T20:00:00+08:00',
      endsAt: '2026-09-04T22:30:00+08:00',
      timeZone: 'Asia/Shanghai',
    },
    publicLocation: {
      city: '上海',
      district: '长宁区',
      areaLabel: '愚园路文化街区',
      exactLocationPolicy: 'CONFIRMED_PARTICIPANTS_ONLY',
    },
    price: { currency: 'CNY', amountInMinorUnits: 8800, display: '¥88' },
    capacity: { minimum: 6, maximum: 10, confirmedCount: 8, heldCount: 0 },
    visibleParticipants: [
      { personId: 'person_ning', displayAuthorization: 'GRANTED', role: 'ORGANIZER' },
      { personId: 'person_lan', displayAuthorization: 'GRANTED', role: 'PARTICIPANT' },
    ],
    agenda: ['第一轮试听与分享', '自由换座交流', '活动收尾'],
    atmosphereTags: ['音乐分享', '弹性小组', '不强制发言'],
    safetyNotice: '不强制发言或交换联系方式；所有拍摄均需征得同意。',
  },
] as const satisfies readonly Activity[];

export const activityOpportunities = [
  {
    entityType: FeedCardType.ACTIVITY_OPPORTUNITY,
    id: 'opportunity_riverside_movie',
    entityVersion: 2,
    title: '江边露天电影：发起一个四人小组',
    summary: '公开放映场次已确认，等待一位真实用户补充时间偏好并发起同行。',
    category: ActivityCategory.FILM,
    cover: media(
      'riverside_movie',
      'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1200&q=86',
      '露天电影放映',
      1200,
      900,
    ),
    publicLocation: { city: '上海', district: '浦东新区', areaLabel: '滨江公共空间' },
    suggestedTimeWindow: '9月上旬周末晚间',
    estimatedPrice: null,
    organizerStatus: OpportunityOrganizerStatus.UNCLAIMED,
    authorizedInterestCount: 18,
    sourceLabel: '城市公共文化日历',
  },
  {
    entityType: FeedCardType.ACTIVITY_OPPORTUNITY,
    id: 'opportunity_ceramic_workshop',
    entityVersion: 3,
    title: '周末陶艺体验：一起做一只早餐杯',
    summary: '适合 4–6 人的小型手作机会，尚未形成具体组局。',
    category: ActivityCategory.CRAFT,
    cover: media(
      'ceramic_workshop',
      'https://images.unsplash.com/photo-1610701596007-11502861dcfa?auto=format&fit=crop&w=1200&q=86',
      '陶艺工作台上的杯子',
      1200,
      900,
    ),
    publicLocation: { city: '上海', district: '杨浦区', areaLabel: '大学路街区' },
    suggestedTimeWindow: '9月第二个周末下午',
    estimatedPrice: { currency: 'CNY', amountInMinorUnits: 16800, display: '约 ¥168' },
    organizerStatus: OpportunityOrganizerStatus.UNCLAIMED,
    authorizedInterestCount: 11,
    sourceLabel: '合作场馆公开课程',
  },
  {
    entityType: FeedCardType.ACTIVITY_OPPORTUNITY,
    id: 'opportunity_monet_exhibition',
    entityVersion: 4,
    title: '莫奈沉浸夜展',
    summary: '可被不同用户发起为独立场次的公开展览机会。',
    category: ActivityCategory.EXHIBITION,
    cover: media(
      'monet_opportunity',
      'https://images.unsplash.com/photo-1549490349-8643362247b5?auto=format&fit=crop&w=1200&q=86',
      '印象派风格画作',
      1200,
      900,
    ),
    publicLocation: { city: '上海', district: '徐汇区', areaLabel: '西岸文化走廊' },
    suggestedTimeWindow: '展期内每周五至周日晚间',
    estimatedPrice: { currency: 'CNY', amountInMinorUnits: 8800, display: '约 ¥88' },
    organizerStatus: OpportunityOrganizerStatus.CLAIM_IN_REVIEW,
    authorizedInterestCount: 26,
    sourceLabel: '展馆公开信息',
  },
] as const satisfies readonly ActivityOpportunity[];

const firstMeetingPositionOptions = [
  { id: 'walk', label: '边走边聊的散步' },
  { id: 'exhibition', label: '有内容可看的展览' },
  { id: 'coffee', label: '时间可控的咖啡' },
  { id: 'depends', label: '取决于彼此熟悉程度' },
] as const;

export const topics = [
  {
    entityType: FeedCardType.TOPIC,
    id: 'topic_first_meeting',
    entityVersion: 6,
    kind: TopicKind.RELATIONSHIP_SCENARIO,
    title: '第一次见面，什么活动最不容易冷场？',
    summary: '散步、看展还是咖啡？先说说你的选择与理由。',
    cover: media(
      'topic_first_meeting',
      'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1200&q=86',
      '两个人在公园散步',
      1200,
      900,
    ),
    moderationStatus: TopicModerationStatus.PUBLISHED,
    replyCount: 128,
    lastActivityAt: '2026-08-22T14:18:00+08:00',
    tags: ['第一次见面', '约会灵感'],
    scenario: '第一次线下见面，你们都希望降低正式约会的压力，又不想面对空白聊天。你会选哪一种活动？',
    primaryDimension: RelationshipDimension.COMMUNICATION_AND_CONFLICT,
    positionOptions: firstMeetingPositionOptions,
    reasonOptionsByPosition: {
      walk: [
        { id: 'walk_natural', label: '并肩走路比面对面更自然', dimension: RelationshipDimension.COMMUNICATION_AND_CONFLICT },
        { id: 'walk_flexible', label: '随时可以调整路线和时长', dimension: RelationshipDimension.RELATIONSHIP_PACING },
      ],
      exhibition: [
        { id: 'exhibition_context', label: '眼前的内容会自然产生话题', dimension: RelationshipDimension.COMMUNICATION_AND_CONFLICT },
      ],
      coffee: [
        { id: 'coffee_boundary', label: '时间边界明确，更有安全感', dimension: RelationshipDimension.PRIVACY_AND_AUTONOMY },
      ],
      depends: [
        { id: 'depends_familiarity', label: '线上熟悉程度会改变选择', dimension: RelationshipDimension.RELATIONSHIP_PACING },
      ],
    },
  },
  {
    entityType: FeedCardType.TOPIC,
    id: 'topic_seven_day_trip',
    entityVersion: 3,
    kind: TopicKind.LIFESTYLE_PROMPT,
    title: '突然多出 7 天假，你最想怎么过？',
    summary: '去很远的地方，还是留在城市重新认识日常？',
    cover: media(
      'topic_seven_day_trip',
      'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=86',
      '旅途中的山野和公路',
      1200,
      900,
    ),
    moderationStatus: TopicModerationStatus.PUBLISHED,
    replyCount: 94,
    lastActivityAt: '2026-08-22T13:52:00+08:00',
    tags: ['旅行', '生活方式'],
    prompt: '不用考虑工作安排，突然多出 7 天完整假期。',
    openingQuestion: '你会先订一张票，还是先列一张想做的小事清单？',
  },
  {
    entityType: FeedCardType.TOPIC,
    id: 'topic_reply_frequency',
    entityVersion: 4,
    kind: TopicKind.RELATIONSHIP_SCENARIO,
    title: '忙的时候，消息多久回才算舒服？',
    summary: '及时回应和保留个人节奏之间，你更看重什么？',
    cover: media(
      'topic_reply_frequency',
      'https://images.unsplash.com/photo-1521939094609-93aba1af40d7?auto=format&fit=crop&w=1200&q=86',
      '桌面上的手机与咖啡',
      1200,
      900,
    ),
    moderationStatus: TopicModerationStatus.PUBLISHED,
    replyCount: 211,
    lastActivityAt: '2026-08-22T12:40:00+08:00',
    tags: ['沟通', '联系频率'],
    scenario: '一方工作时很少看手机，另一方希望重要消息能有一句简短回应。双方都没有故意冷落对方。',
    primaryDimension: RelationshipDimension.COMPANIONSHIP_AND_CONTACT,
    positionOptions: [
      { id: 'brief_reply', label: '忙时也应简短回应' },
      { id: 'focus_first', label: '可以等忙完再集中回复' },
      { id: 'agree_window', label: '提前约定大致响应时间' },
      { id: 'depends_context', label: '取决于消息是否紧急' },
    ],
    reasonOptionsByPosition: {
      brief_reply: [{ id: 'feel_seen', label: '简短回应能让彼此被看见', dimension: RelationshipDimension.SUPPORT_AND_CARE }],
      focus_first: [{ id: 'respect_focus', label: '专注工作也是合理的个人边界', dimension: RelationshipDimension.PRIVACY_AND_AUTONOMY }],
      agree_window: [{ id: 'clear_expectation', label: '明确预期比猜测更重要', dimension: RelationshipDimension.COMMUNICATION_AND_CONFLICT }],
      depends_context: [{ id: 'urgency_matters', label: '紧急程度决定回应节奏', dimension: RelationshipDimension.COMPANIONSHIP_AND_CONTACT }],
    },
  },
  {
    entityType: FeedCardType.TOPIC,
    id: 'topic_weekend_breakfast',
    entityVersion: 2,
    kind: TopicKind.LIFESTYLE_PROMPT,
    title: '周末早餐，你愿意为哪一种早起？',
    summary: '街角小店、自己下厨，还是带着面包去公园。',
    cover: media(
      'topic_breakfast',
      'https://images.unsplash.com/photo-1533777857889-4be7c70b33f7?auto=format&fit=crop&w=1200&q=86',
      '阳光下的周末早餐',
      1200,
      900,
    ),
    moderationStatus: TopicModerationStatus.PUBLISHED,
    replyCount: 67,
    lastActivityAt: '2026-08-22T10:05:00+08:00',
    tags: ['周末', '早餐'],
    prompt: '不用赶路的周末早晨，挑一种最想共享的早餐方式。',
    openingQuestion: '你最拿手或最想尝试的一份早餐是什么？',
  },
] as const satisfies readonly Topic[];

export const activityApplications = [
  {
    id: 'application_me_wutong',
    entityVersion: 3,
    activityId: 'activity_wutong_city_walk',
    applicantId: 'person_me',
    state: ApplicationState.CONFIRMED,
    semantics: APPLICATION_STATE_SEMANTICS[ApplicationState.CONFIRMED],
    submittedAt: '2026-08-20T18:10:00+08:00',
    updatedAt: '2026-08-20T18:10:00+08:00',
  },
  {
    id: 'application_me_bouldering',
    entityVersion: 4,
    activityId: 'activity_bouldering_intro',
    applicantId: 'person_me',
    state: ApplicationState.WAITLISTED,
    semantics: APPLICATION_STATE_SEMANTICS[ApplicationState.WAITLISTED],
    submittedAt: '2026-08-19T19:40:00+08:00',
    updatedAt: '2026-08-20T09:12:00+08:00',
  },
] as const satisfies readonly ActivityApplication[];

export const messages = [
  {
    id: 'message_match_system',
    threadId: 'thread_match_lan',
    kind: MessageKind.SYSTEM,
    senderId: null,
    event: 'MATCH_CREATED',
    text: '你们都愿意进一步认识彼此，会话已开启。',
    createdAt: '2026-08-21T21:00:00+08:00',
    deliveryStatus: MessageDeliveryStatus.READ,
  },
  {
    id: 'message_match_icebreaker',
    threadId: 'thread_match_lan',
    kind: MessageKind.ICEBREAKER_SUGGESTION,
    senderId: null,
    text: '你们都提到了城市摄影，可以从最近想拍的一条街聊起。',
    sentOnBehalfOfUser: false,
    createdAt: '2026-08-21T21:00:01+08:00',
    deliveryStatus: MessageDeliveryStatus.READ,
  },
  {
    id: 'message_match_lan_hello',
    threadId: 'thread_match_lan',
    kind: MessageKind.TEXT,
    senderId: 'person_lan',
    text: '看到你也喜欢夜里散步。最近有拍到很喜欢的街景吗？',
    createdAt: '2026-08-21T21:08:00+08:00',
    deliveryStatus: MessageDeliveryStatus.READ,
  },
  {
    id: 'message_match_me_reply',
    threadId: 'thread_match_lan',
    kind: MessageKind.TEXT,
    senderId: 'person_me',
    text: '前几天在苏州河拍到一段很安静的蓝调时刻，你呢？',
    createdAt: '2026-08-21T21:11:00+08:00',
    deliveryStatus: MessageDeliveryStatus.DELIVERED,
  },
  {
    id: 'message_activity_update',
    threadId: 'thread_activity_wutong',
    kind: MessageKind.ACTIVITY_UPDATE,
    senderId: null,
    activityId: 'activity_wutong_city_walk',
    text: '活动已成行。集合细节将在活动前 24 小时向确认参与者展示。',
    createdAt: '2026-08-21T09:30:00+08:00',
    deliveryStatus: MessageDeliveryStatus.READ,
  },
  {
    id: 'message_topic_prompt',
    threadId: 'thread_topic_first_meeting',
    kind: MessageKind.STRUCTURED_PROMPT,
    senderId: null,
    promptStage: 'OPENING',
    text: '你最在意第一次见面活动里的哪一点？',
    createdAt: '2026-08-22T13:10:00+08:00',
    deliveryStatus: MessageDeliveryStatus.READ,
  },
  {
    id: 'message_topic_zhou',
    threadId: 'thread_topic_first_meeting',
    kind: MessageKind.TEXT,
    senderId: 'person_zhou',
    text: '我选散步，因为并肩走路时停顿也不会太尴尬。',
    createdAt: '2026-08-22T13:12:00+08:00',
    deliveryStatus: MessageDeliveryStatus.READ,
  },
] as const satisfies readonly Message[];

export const threads = [
  {
    id: 'thread_match_lan',
    entityVersion: 6,
    kind: ThreadKind.MATCH,
    title: '阿岚',
    participantIds: ['person_me', 'person_lan'],
    messageIds: [
      'message_match_system',
      'message_match_icebreaker',
      'message_match_lan_hello',
      'message_match_me_reply',
    ],
    createdAt: '2026-08-21T21:00:00+08:00',
    updatedAt: '2026-08-21T21:11:00+08:00',
    unreadCount: 0,
    allowedActions: [
      ThreadAction.SEND_MESSAGE,
      ThreadAction.VIEW_PROFILE,
      ThreadAction.UNMATCH,
      ThreadAction.BLOCK,
      ThreadAction.REPORT,
    ],
    matchId: 'match_me_lan',
    matchStatus: MatchStatus.ACTIVE,
    conversationStatus: ConversationStatus.READY,
  },
  {
    id: 'thread_activity_wutong',
    entityVersion: 2,
    kind: ThreadKind.ACTIVITY,
    title: '梧桐区日落 City Walk',
    participantIds: ['person_me', 'person_chen', 'person_ning', 'person_zhou'],
    messageIds: ['message_activity_update'],
    createdAt: '2026-08-20T18:10:00+08:00',
    updatedAt: '2026-08-21T09:30:00+08:00',
    unreadCount: 1,
    allowedActions: [
      ThreadAction.SEND_MESSAGE,
      ThreadAction.VIEW_ACTIVITY,
      ThreadAction.LEAVE,
      ThreadAction.REPORT,
    ],
    activityId: 'activity_wutong_city_walk',
    membershipApplicationId: 'application_me_wutong',
    roomStatus: ActivityRoomStatus.OPEN,
  },
  {
    id: 'thread_topic_first_meeting',
    entityVersion: 3,
    kind: ThreadKind.TOPIC_DISCUSSION,
    title: '第一次见面的话题讨论',
    participantIds: ['person_me', 'person_zhou'],
    messageIds: ['message_topic_prompt', 'message_topic_zhou'],
    createdAt: '2026-08-22T13:10:00+08:00',
    updatedAt: '2026-08-22T13:12:00+08:00',
    unreadCount: 2,
    allowedActions: [
      ThreadAction.SEND_MESSAGE,
      ThreadAction.VIEW_TOPIC,
      ThreadAction.LEAVE,
      ThreadAction.BLOCK,
      ThreadAction.REPORT,
    ],
    topicId: 'topic_first_meeting',
    discussionStatus: TopicDiscussionStatus.ACTIVE,
    matchMode: DiscussionMatchMode.SAME_POSITION_DIFFERENT_REASON,
    expiresAt: '2026-08-23T13:10:00+08:00',
  },
] as const satisfies readonly Thread[];

const feedRequestId = 'request_home_20260822_a1' as const;
const feedExpiresAt = '2026-08-22T23:59:59+08:00' as const;

/**
 * RFC acceptance fixture: the first eight cards contain exactly two of each
 * card type. The first four are intentionally Monet activity, Alan, first
 * meeting topic, and Wutong City Walk.
 */
export const homeFeed = [
  {
    schemaVersion: '1.0',
    cardId: 'feed_home_01_monet',
    cardType: FeedCardType.ACTIVITY,
    pathType: PathType.ACTIVITY,
    entityId: 'activity_monet_night',
    entityVersion: 8,
    requestId: feedRequestId,
    rankPosition: 1,
    reason: {
      code: FeedReasonCode.SHARED_INTEREST,
      headline: '你收藏过印象派展览',
      explanation: '这是一场正在招募的真实双人同行，时间也落在你的周末可用时段。',
      evidenceLabels: ['印象派展览', '周末晚间'],
    },
    expiresAt: feedExpiresAt,
    presentation: {
      template: FeedPresentationTemplate.ACTIVITY_EDITORIAL,
      image: activities[0].cover,
      eyebrow: '双人同行 · 正在招募',
      headline: '莫奈夜展后，沿江散步 40 分钟',
      supportingText: '8月29日 18:30 · 徐汇滨江',
      badges: [{ label: '需申请', tone: 'ACCENT' }],
      facts: [{ label: '费用', value: '¥88' }, { label: '席位', value: '1 / 2 已确认' }],
      primaryActionLabel: '申请参加',
    },
    allowedActions: [FeedAction.VIEW_DETAIL, FeedAction.APPLY_TO_ACTIVITY, FeedAction.SAVE, FeedAction.HIDE, FeedAction.REPORT],
  },
  {
    schemaVersion: '1.0',
    cardId: 'feed_home_02_lan',
    cardType: FeedCardType.PERSON,
    pathType: PathType.PERSON,
    entityId: 'person_lan',
    entityVersion: 7,
    requestId: feedRequestId,
    rankPosition: 2,
    reason: {
      code: FeedReasonCode.SHARED_INTEREST,
      headline: '你们都喜欢城市摄影与慢节奏散步',
      explanation: '推荐依据来自双方允许公开解释的兴趣和个人回答。',
      evidenceLabels: ['城市摄影', '慢节奏散步'],
    },
    expiresAt: feedExpiresAt,
    presentation: {
      template: FeedPresentationTemplate.PERSON_PORTRAIT,
      image: people[0].photos[0],
      eyebrow: '真人已认证',
      headline: '阿岚，28',
      supportingText: '品牌设计师 · 上海',
      badges: [{ label: '摄影', tone: 'ACCENT' }, { label: '夜游', tone: 'NEUTRAL' }],
      facts: [{ label: '想认识', value: '长期关系' }],
      primaryActionLabel: '表达红心',
    },
    allowedActions: [FeedAction.VIEW_DETAIL, FeedAction.HEART_PERSON, FeedAction.HIDE, FeedAction.REPORT],
  },
  {
    schemaVersion: '1.0',
    cardId: 'feed_home_03_first_meeting',
    cardType: FeedCardType.TOPIC,
    pathType: PathType.TOPIC,
    entityId: 'topic_first_meeting',
    entityVersion: 6,
    requestId: feedRequestId,
    rankPosition: 3,
    reason: {
      code: FeedReasonCode.FRESH_DISCUSSION,
      headline: '正在讨论第一次见面的舒适边界',
      explanation: '先表达选择和理由，再决定是否加入即时讨论。',
      evidenceLabels: ['第一次见面', '沟通方式'],
    },
    expiresAt: feedExpiresAt,
    presentation: {
      template: FeedPresentationTemplate.TOPIC_CONVERSATION,
      image: topics[0].cover,
      eyebrow: '关系话题 · 128 条讨论',
      headline: '第一次见面，什么活动最不容易冷场？',
      supportingText: '散步、看展还是咖啡？',
      badges: [{ label: '两阶段选择', tone: 'ACCENT' }],
      facts: [{ label: '讨论', value: '128 条' }],
      primaryActionLabel: '说说你的选择',
    },
    allowedActions: [FeedAction.VIEW_DETAIL, FeedAction.VOTE, FeedAction.JOIN_DISCUSSION, FeedAction.SAVE, FeedAction.HIDE, FeedAction.REPORT],
  },
  {
    schemaVersion: '1.0',
    cardId: 'feed_home_04_wutong',
    cardType: FeedCardType.ACTIVITY,
    pathType: PathType.ACTIVITY,
    entityId: 'activity_wutong_city_walk',
    entityVersion: 11,
    requestId: feedRequestId,
    rankPosition: 4,
    reason: {
      code: FeedReasonCode.NEARBY_AREA,
      headline: '在你常活动的街区附近',
      explanation: '活动已经成行，仍有公开席位可由你自主确认加入。',
      evidenceLabels: ['City Walk', '徐汇区'],
    },
    expiresAt: feedExpiresAt,
    presentation: {
      template: FeedPresentationTemplate.ACTIVITY_EDITORIAL,
      image: activities[1].cover,
      eyebrow: '多人小组 · 已成行',
      headline: '梧桐区日落 City Walk',
      supportingText: '8月30日 16:30 · 衡复风貌区',
      badges: [{ label: '可直接参加', tone: 'POSITIVE' }],
      facts: [{ label: '费用', value: '免费' }, { label: '席位', value: '5 / 8 已确认' }],
      primaryActionLabel: '确认参加',
    },
    allowedActions: [FeedAction.VIEW_DETAIL, FeedAction.JOIN_ACTIVITY, FeedAction.SAVE, FeedAction.HIDE, FeedAction.REPORT],
  },
  {
    schemaVersion: '1.0',
    cardId: 'feed_home_05_movie_opportunity',
    cardType: FeedCardType.ACTIVITY_OPPORTUNITY,
    pathType: PathType.ACTIVITY,
    entityId: 'opportunity_riverside_movie',
    entityVersion: 2,
    requestId: feedRequestId,
    rankPosition: 5,
    reason: {
      code: FeedReasonCode.INTEREST_EXPLORATION,
      headline: '把想看的电影变成一场真实同行',
      explanation: '这只是尚未发起的活动机会，不代表任何人已经参加。',
      evidenceLabels: ['露天电影', '周末晚间'],
    },
    expiresAt: feedExpiresAt,
    presentation: {
      template: FeedPresentationTemplate.OPPORTUNITY_EDITORIAL,
      image: activityOpportunities[0].cover,
      eyebrow: '活动机会 · 暂未发起',
      headline: '江边露天电影：发起一个四人小组',
      supportingText: '9月上旬周末 · 浦东滨江',
      badges: [{ label: '18 人授权表达兴趣', tone: 'NEUTRAL' }],
      facts: [{ label: '费用', value: '免费' }],
      primaryActionLabel: '发起活动',
    },
    allowedActions: [FeedAction.VIEW_DETAIL, FeedAction.START_ACTIVITY, FeedAction.EXPRESS_INTEREST, FeedAction.SAVE, FeedAction.HIDE, FeedAction.REPORT],
  },
  {
    schemaVersion: '1.0',
    cardId: 'feed_home_06_zhou',
    cardType: FeedCardType.PERSON,
    pathType: PathType.PERSON,
    entityId: 'person_zhou',
    entityVersion: 5,
    requestId: feedRequestId,
    rankPosition: 6,
    reason: {
      code: FeedReasonCode.SHARED_INTEREST,
      headline: '你们都愿意尝试轻运动',
      explanation: '共同点来自双方公开的兴趣标签，不代表对方已表达意愿。',
      evidenceLabels: ['轻运动', '城市骑行'],
    },
    expiresAt: feedExpiresAt,
    presentation: {
      template: FeedPresentationTemplate.PERSON_PORTRAIT,
      image: people[1].photos[0],
      eyebrow: '真人已认证',
      headline: '小周，27',
      supportingText: '产品经理 · 上海',
      badges: [{ label: '抱石', tone: 'ACCENT' }, { label: '咖啡', tone: 'NEUTRAL' }],
      facts: [{ label: '想认识', value: '认真约会' }],
      primaryActionLabel: '表达红心',
    },
    allowedActions: [FeedAction.VIEW_DETAIL, FeedAction.HEART_PERSON, FeedAction.HIDE, FeedAction.REPORT],
  },
  {
    schemaVersion: '1.0',
    cardId: 'feed_home_07_seven_days',
    cardType: FeedCardType.TOPIC,
    pathType: PathType.TOPIC,
    entityId: 'topic_seven_day_trip',
    entityVersion: 3,
    requestId: feedRequestId,
    rankPosition: 7,
    reason: {
      code: FeedReasonCode.FRESH_DISCUSSION,
      headline: '从旅行选择聊聊生活节奏',
      explanation: '这是轻量生活话题，可直接加入即时讨论。',
      evidenceLabels: ['旅行', '生活方式'],
    },
    expiresAt: feedExpiresAt,
    presentation: {
      template: FeedPresentationTemplate.TOPIC_CONVERSATION,
      image: topics[1].cover,
      eyebrow: '生活话题 · 94 条讨论',
      headline: '突然多出 7 天假，你最想怎么过？',
      supportingText: '去远方，还是重新认识日常？',
      badges: [{ label: '即时讨论', tone: 'ACCENT' }],
      facts: [{ label: '讨论', value: '94 条' }],
      primaryActionLabel: '加入讨论',
    },
    allowedActions: [FeedAction.VIEW_DETAIL, FeedAction.JOIN_DISCUSSION, FeedAction.SAVE, FeedAction.HIDE, FeedAction.REPORT],
  },
  {
    schemaVersion: '1.0',
    cardId: 'feed_home_08_ceramic_opportunity',
    cardType: FeedCardType.ACTIVITY_OPPORTUNITY,
    pathType: PathType.ACTIVITY,
    entityId: 'opportunity_ceramic_workshop',
    entityVersion: 3,
    requestId: feedRequestId,
    rankPosition: 8,
    reason: {
      code: FeedReasonCode.INTEREST_EXPLORATION,
      headline: '一件适合边做边聊的小事',
      explanation: '场馆信息真实可查，目前仍等待用户发起具体组局。',
      evidenceLabels: ['手作', '周末下午'],
    },
    expiresAt: feedExpiresAt,
    presentation: {
      template: FeedPresentationTemplate.OPPORTUNITY_EDITORIAL,
      image: activityOpportunities[1].cover,
      eyebrow: '活动机会 · 暂未发起',
      headline: '周末陶艺体验：一起做一只早餐杯',
      supportingText: '9月第二个周末 · 大学路街区',
      badges: [{ label: '11 人授权表达兴趣', tone: 'NEUTRAL' }],
      facts: [{ label: '预计费用', value: '约 ¥168' }],
      primaryActionLabel: '发起活动',
    },
    allowedActions: [FeedAction.VIEW_DETAIL, FeedAction.START_ACTIVITY, FeedAction.EXPRESS_INTEREST, FeedAction.SAVE, FeedAction.HIDE, FeedAction.REPORT],
  },
] as const satisfies readonly FeedCard[];

const defaultActivityCard = homeFeed[0];
const defaultTopicCard = homeFeed[2];

/** Complete vertical activity feed. Home recommendations remain independently ranked. */
export const activityFeed = activities.map((activity, index): ActivityFeedCard => {
  const ranked = (homeFeed as readonly FeedCard[]).find((card): card is ActivityFeedCard => card.cardType === FeedCardType.ACTIVITY && card.entityId === activity.id);
  const hasApplication = activityApplications.some((application) => application.activityId === activity.id);
  if (ranked) return { ...ranked, rankPosition: index + 1, allowedActions: ranked.allowedActions.filter((action) => !hasApplication || (action !== FeedAction.JOIN_ACTIVITY && action !== FeedAction.APPLY_TO_ACTIVITY)) };
  const canApply = !hasApplication && (activity.recruitmentStatus === ActivityRecruitmentStatus.OPEN || activity.recruitmentStatus === ActivityRecruitmentStatus.WAITLIST_ONLY);
  const action = activity.participationMode === ParticipationMode.OPEN_JOIN ? FeedAction.JOIN_ACTIVITY : FeedAction.APPLY_TO_ACTIVITY;
  return {
    ...defaultActivityCard,
    cardId: ('feed_activity_' + activity.id.slice('activity_'.length)) as ActivityFeedCard['cardId'],
    entityId: activity.id, entityVersion: activity.entityVersion, requestId: 'request_activity_vertical_20260822', rankPosition: index + 1,
    reason: { code: FeedReasonCode.SHARED_INTEREST, headline: '与你公开选择的兴趣相关', explanation: activity.summary, evidenceLabels: [activity.category] },
    presentation: { ...defaultActivityCard.presentation, image: activity.cover, eyebrow: (activity.format === ActivityFormat.PAIR ? '双人同行' : '多人小组') + ' · ' + (activity.recruitmentStatus === ActivityRecruitmentStatus.WAITLIST_ONLY ? '仅候补' : '可查看'), headline: activity.title, supportingText: new Date(activity.schedule.startsAt).toLocaleDateString('zh-CN') + ' · ' + activity.publicLocation.district, facts: [{ label: '费用', value: activity.price?.display ?? '免费' }, { label: '席位', value: activity.capacity.confirmedCount + ' / ' + activity.capacity.maximum + ' 已确认' }], primaryActionLabel: action === FeedAction.JOIN_ACTIVITY ? '确认参加' : '申请参加' },
    allowedActions: canApply ? [FeedAction.VIEW_DETAIL, action, FeedAction.SAVE, FeedAction.HIDE, FeedAction.REPORT] : [FeedAction.VIEW_DETAIL, FeedAction.SAVE, FeedAction.HIDE, FeedAction.REPORT],
  };
});

/** Complete vertical topic feed. */
export const topicFeed = topics.map((topic, index): TopicFeedCard => {
  const ranked = (homeFeed as readonly FeedCard[]).find((card): card is TopicFeedCard => card.cardType === FeedCardType.TOPIC && card.entityId === topic.id);
  if (ranked) return { ...ranked, rankPosition: index + 1 };
  return {
    ...defaultTopicCard,
    cardId: ('feed_topic_' + topic.id.slice('topic_'.length)) as TopicFeedCard['cardId'],
    entityId: topic.id, entityVersion: topic.entityVersion, requestId: 'request_topic_vertical_20260822', rankPosition: index + 1,
    reason: { code: FeedReasonCode.FRESH_DISCUSSION, headline: '一个仍在发生的真实讨论', explanation: topic.summary, evidenceLabels: [...topic.tags] },
    presentation: { ...defaultTopicCard.presentation, image: topic.cover, eyebrow: (topic.kind === TopicKind.RELATIONSHIP_SCENARIO ? '关系话题' : '生活话题') + ' · ' + topic.replyCount + ' 条讨论', headline: topic.title, supportingText: topic.summary, facts: [{ label: '讨论', value: topic.replyCount + ' 条' }], primaryActionLabel: topic.kind === TopicKind.RELATIONSHIP_SCENARIO ? '说说你的选择' : '加入讨论' },
    allowedActions: [FeedAction.VIEW_DETAIL, topic.kind === TopicKind.RELATIONSHIP_SCENARIO ? FeedAction.VOTE : FeedAction.JOIN_DISCUSSION, FeedAction.SAVE, FeedAction.HIDE, FeedAction.REPORT],
  };
});

export function findPersonById(id: PersonId): Person | undefined {
  if (id === currentUser.profile.id) return currentUser.profile;
  return people.find((person) => person.id === id);
}

export function findActivityById(id: ActivityId): Activity | undefined {
  return activities.find((activity) => activity.id === id);
}

export function findActivityOpportunityById(
  id: ActivityOpportunityId,
): ActivityOpportunity | undefined {
  return activityOpportunities.find((opportunity) => opportunity.id === id);
}

export function findTopicById(id: TopicId): Topic | undefined {
  return topics.find((topic) => topic.id === id);
}

export function findThreadById(id: ThreadId): Thread | undefined {
  return threads.find((thread) => thread.id === id);
}

export function findMessageById(id: MessageId): Message | undefined {
  return messages.find((message) => message.id === id);
}

export function findApplicationByActivityId(
  activityId: ActivityId,
): ActivityApplication | undefined {
  return activityApplications.find((application) => application.activityId === activityId);
}

export function getMessagesForThread(threadId: ThreadId): readonly Message[] {
  return messages.filter((message) => message.threadId === threadId);
}

export function resolveFeedCardEntity(card: FeedCard): FeedEntity | undefined {
  switch (card.cardType) {
    case FeedCardType.PERSON:
      return findPersonById(card.entityId);
    case FeedCardType.ACTIVITY:
      return findActivityById(card.entityId);
    case FeedCardType.ACTIVITY_OPPORTUNITY:
      return findActivityOpportunityById(card.entityId);
    case FeedCardType.TOPIC:
      return findTopicById(card.entityId);
  }
}
