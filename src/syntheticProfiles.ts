/**
 * Deterministic, entirely fictional adult profiles for local product demos.
 *
 * The private records in this module are generation fixtures. UI consumers
 * must use `syntheticPeople`, `syntheticPublicProfiles`, and the feed cards,
 * all of which are produced through the permission-aware public projection.
 * Portraits use public celebrity photography as mock-only visual material.
 * The fictional profile data does not describe the pictured celebrity.
 */
import {
  FeedAction,
  FeedCardType,
  FeedPresentationTemplate,
  FeedReasonCode,
  MbtiType,
  PathType,
  ProfileStatus,
  RelationshipDimension,
  VerificationStatus,
  ZodiacSign,
} from './domain';
import type {
  FeedCard,
  ISODate,
  MediaAsset,
  Person,
  PersonFeedCard,
  PersonId,
  PromptAnswer,
} from './domain';
import {
  BUDGET_BAND_VALUES,
  BudgetBand,
  CandidateLocationScope,
  CONNECTION_START_VALUES,
  ConnectionStart,
  COST_SHARING_PREFERENCE_VALUES,
  CostSharingPreference,
  createSyntheticCoverageReport,
  DEFAULT_FIELD_PERMISSIONS,
  INDUSTRY_VALUES,
  Industry,
  LIFESTYLE_AXIS_KEYS,
  PROFILE_FIELD_KEYS,
  ProfileFieldKey,
  RELATIONSHIP_DIMENSION_VALUES,
  RELATIONSHIP_GOAL5_LABELS,
  RELATIONSHIP_GOAL5_VALUES,
  RelationshipEvidenceSourceKind,
  RELATIONSHIP_PACE_VALUES,
  RelationshipPace,
  SELF_GENDER4_VALUES,
  SelfGender4,
  SPENDING_STYLE_VALUES,
  SpendingStyle,
  calculateAge,
  calculateZodiacSign,
  evaluateCandidateFeasibility,
  projectPublicProfile,
  toDomainRelationshipGoal,
} from './profileSchema';
import type {
  AtLeastThree,
  FieldUsagePermission,
  LifestyleAnswer,
  LifestyleAxes,
  ProfileFieldPermissions,
  PublicPersonProjection,
  PublicProfileProjection,
  RelationshipGoal5,
  RelationshipTraitEvidence,
  Scale1To5,
  SyntheticCoverageReport,
  SyntheticUserRecord,
} from './profileSchema';
import {
  selectCelebrityPortrait,
  toCelebrityMedia,
  type MockProfileGender,
} from './celebrityPortraits';

export const SYNTHETIC_PROFILE_SEED = '4u-fictional-adults-v1-20260822';
export const SYNTHETIC_PROFILE_AS_OF = '2026-08-22' as const satisfies ISODate;
export const SYNTHETIC_PROFILE_GENERATED_AT =
  '2026-08-22T09:00:00+08:00' as const;
/** 49 candidates plus the separate Lin Chuan experience account = 50 mock users. */
export const SYNTHETIC_PROFILE_COUNT = 49;

const LEGACY_IDENTITIES = [
  { id: 'person_lan', displayName: '阿岚' },
  { id: 'person_zhou', displayName: '小周' },
  { id: 'person_ning', displayName: '宁宁' },
  { id: 'person_chen', displayName: '陈一' },
  { id: 'person_muye', displayName: '木野' },
  { id: 'person_xiaoyu', displayName: '小雨' },
] as const;

const NAME_STEMS = [
  '青禾', '星野', '云川', '听澜', '知夏', '南乔', '林深', '朝颜',
  '远汀', '初晴', '望舒', '清和', '鹿鸣', '江月', '明溪', '白榆',
  '向晚', '临风', '青屿', '予安', '简宁', '新橙', '一苇', '微岚',
] as const;

const CITIES = [
  '上海', '北京', '广州', '深圳', '杭州', '成都',
  '南京', '武汉', '苏州', '西安', '厦门', '重庆',
] as const;

const INTERESTS = [
  '城市摄影', '独立电影', 'City Walk', '逛展', '抱石', '骑行',
  '手冲咖啡', '现场音乐', '黑胶', '旧书店', '建筑观察', '胶片摄影',
  '爵士', '纪录片', '徒步', '小说', '家常料理', '公园散步',
  '旅行规划', '陶艺', '羽毛球', '游泳', '桌游', '播客',
  '剧场', '插画', '写作', '烘焙', '露营', '植物养护',
  '博物馆', '古典音乐', '即兴喜剧', '观鸟', '跑步', '瑜伽',
  '茶文化', '语言交换', '科普阅读', '天文观测', '木工', '拼图',
  '街区探店', '二手市集', '公共艺术', '自然笔记', '室内攀岩', '合唱',
] as const;

const OCCUPATIONS_BY_INDUSTRY = {
  [Industry.TECHNOLOGY_AND_INTERNET]: ['产品设计师', '前端工程师', '数据产品经理'],
  [Industry.FINANCE]: ['风险分析师', '支付产品经理', '金融科技研究员'],
  [Industry.PROFESSIONAL_SERVICES]: ['咨询顾问', '法律运营专员', '人才发展顾问'],
  [Industry.EDUCATION_AND_RESEARCH]: ['课程研发', '实验室协调员', '科普编辑'],
  [Industry.HEALTHCARE]: ['健康产品运营', '康复治疗师', '医学内容编辑'],
  [Industry.MEDIA_AND_CONTENT]: ['纪录片剪辑师', '播客策划', '内容编辑'],
  [Industry.DESIGN_AND_CREATIVE]: ['品牌设计师', '交互设计师', '插画师'],
  [Industry.CULTURE_AND_ARTS]: ['策展项目助理', '剧场制作人', '文化项目策划'],
  [Industry.CONSUMER_AND_RETAIL]: ['零售空间策划', '消费研究员', '商品体验设计师'],
  [Industry.MANUFACTURING]: ['工业设计师', '质量工程师', '供应链计划员'],
  [Industry.TRANSPORTATION_AND_LOGISTICS]: ['交通规划师', '物流产品经理', '航线运营'],
  [Industry.HOSPITALITY_AND_TOURISM]: ['旅行产品策划', '酒店体验经理', '目的地运营'],
  [Industry.PUBLIC_AND_NONPROFIT]: ['公益项目经理', '社区营造师', '公共文化专员'],
  [Industry.STUDENT]: ['研究生', '访问学生', '联合培养学生'],
  [Industry.FREELANCE]: ['自由摄影师', '独立撰稿人', '自由视觉设计师'],
  [Industry.OTHER]: ['独立项目协调员', '职业探索者', '跨领域研究者'],
} as const satisfies Readonly<Record<Industry, readonly string[]>>;

const ZODIAC_VALUES = [
  ZodiacSign.ARIES, ZodiacSign.TAURUS, ZodiacSign.GEMINI, ZodiacSign.CANCER,
  ZodiacSign.LEO, ZodiacSign.VIRGO, ZodiacSign.LIBRA, ZodiacSign.SCORPIO,
  ZodiacSign.SAGITTARIUS, ZodiacSign.CAPRICORN, ZodiacSign.AQUARIUS,
  ZodiacSign.PISCES,
] as const;

const ZODIAC_ANCHORS = {
  [ZodiacSign.ARIES]: [4, 10],
  [ZodiacSign.TAURUS]: [5, 10],
  [ZodiacSign.GEMINI]: [6, 10],
  [ZodiacSign.CANCER]: [7, 10],
  [ZodiacSign.LEO]: [8, 10],
  [ZodiacSign.VIRGO]: [9, 10],
  [ZodiacSign.LIBRA]: [10, 10],
  [ZodiacSign.SCORPIO]: [11, 10],
  [ZodiacSign.SAGITTARIUS]: [12, 10],
  [ZodiacSign.CAPRICORN]: [1, 10],
  [ZodiacSign.AQUARIUS]: [2, 10],
  [ZodiacSign.PISCES]: [3, 10],
} as const satisfies Readonly<Record<ZodiacSign, readonly [number, number]>>;

const MBTI_VALUES = Object.values(MbtiType);
const MOCK_PROFILE_GENDER_VALUES = [
  SelfGender4.WOMAN,
  SelfGender4.MAN,
] as const satisfies readonly MockProfileGender[];
const SCALE_VALUES = [1, 2, 3, 4, 5] as const;
const PHOTO_COUNTS = [2, 3, 4, 5, 6] as const;
const PROMPT_COUNTS = [1, 2, 3] as const;
const LIFESTYLE_ANSWER_COUNTS = [3, 4, 5] as const;
const AGE_VALUES = Array.from({ length: 41 }, (_, index) => index + 18);
const INTEREST_STEPS = [5, 7, 11, 13, 17, 19] as const;

const RELATIONSHIP_EVIDENCE_COPY = {
  [RelationshipDimension.LOYALTY_AND_BOUNDARIES]: '重视提前说清边界，也尊重彼此已有的社交关系。',
  [RelationshipDimension.PRIVACY_AND_AUTONOMY]: '愿意分享日常，同时保留各自独立安排的空间。',
  [RelationshipDimension.ECONOMICS_AND_RESPONSIBILITY]: '共同活动会提前确认安排与分工，不涉及收入或资产信息。',
  [RelationshipDimension.COMMUNICATION_AND_CONFLICT]: '出现分歧时倾向先确认事实，再表达自己的感受。',
  [RelationshipDimension.COMPANIONSHIP_AND_CONTACT]: '联系频率可以协商，重要的是回应稳定且彼此舒服。',
  [RelationshipDimension.CAREER_AND_LIFESTYLE]: '支持彼此的工作节奏，也愿意共同安排可持续的相处时间。',
  [RelationshipDimension.RELATIONSHIP_PACING]: '关系推进以双方明确表达和持续沟通为前提。',
  [RelationshipDimension.SUPPORT_AND_CARE]: '需要支持时会直接说，也会先询问对方希望被怎样陪伴。',
} as const satisfies Readonly<Record<RelationshipDimension, string>>;

const RELATIONSHIP_EVIDENCE_SCENARIOS = [
  { id: 'shared-plan', context: '共同规划一次周末活动时' },
  { id: 'schedule-change', context: '原定安排临时发生变化时' },
  { id: 'different-view', context: '双方对同一件事看法不同时' },
] as const;

const hashText = (value: string): number => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 0x01000193);
  }
  return hash >>> 0;
};

const fieldHash = (seed: string, index: number, field: string): number =>
  hashText(`${seed}|${field}|${index}`);

/** Builds an exactly balanced allocation, then independently shuffles a field. */
const balancedAssignment = <T>(
  values: readonly T[],
  count: number,
  seed: string,
  field: string,
): T[] => {
  if (values.length === 0) throw new RangeError('Balanced assignment needs values.');
  const result = Array.from({ length: count }, (_, index) => values[index % values.length]);
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = hashText(`${seed}|shuffle|${field}|${index}`) % (index + 1);
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
};

const pad2 = (value: number): string => String(value).padStart(2, '0');

const birthDateFor = (age: number, zodiac: ZodiacSign): ISODate => {
  const [month, day] = ZODIAC_ANCHORS[zodiac];
  const birthdayHasPassed = month < 8 || (month === 8 && day <= 22);
  const year = 2026 - age - (birthdayHasPassed ? 0 : 1);
  return `${year}-${pad2(month)}-${pad2(day)}` as ISODate;
};

const profileIdentity = (index: number): { readonly id: PersonId; readonly displayName: string } => {
  const legacy = LEGACY_IDENTITIES[index];
  if (legacy) return legacy;
  const serial = String(index + 1).padStart(3, '0');
  return {
    id: `person_synth_${serial}`,
    displayName: NAME_STEMS[fieldHash(SYNTHETIC_PROFILE_SEED, index, 'name') % NAME_STEMS.length],
  };
};

const chooseInterests = (seed: string, index: number, count: number): [string, ...string[]] => {
  const start = fieldHash(seed, index, 'interest-start') % INTERESTS.length;
  const step = INTEREST_STEPS[fieldHash(seed, index, 'interest-step') % INTEREST_STEPS.length];
  const selected = Array.from(
    { length: count },
    (_, offset) => INTERESTS[(start + offset * step) % INTERESTS.length],
  );
  return selected as [string, ...string[]];
};

const makePhotos = (
  index: number,
  displayName: string,
  selfGender: MockProfileGender,
  genderOrdinal: number,
  count: number,
): [MediaAsset, ...MediaAsset[]] => {
  const artwork = selectCelebrityPortrait(selfGender, genderOrdinal);
  return Array.from(
    { length: count },
    (_, ordinal) => toCelebrityMedia(index, ordinal, displayName, artwork),
  ) as [MediaAsset, ...MediaAsset[]];
};

const makePrompts = (
  interests: readonly string[],
  count: number,
): readonly PromptAnswer[] => {
  const candidates: readonly PromptAnswer[] = [
    { prompt: '理想的周末', answer: `留半天给${interests[0]}，再和朋友慢慢吃一顿饭。` },
    { prompt: '最近想完成的小事', answer: `认真体验一次${interests[1]}，把过程记在自己的小本子里。` },
    { prompt: '舒服的相处方式', answer: `能分享${interests[2]}这样的兴趣，也尊重彼此安静独处的时间。` },
  ];
  return candidates.slice(0, count);
};

const makeLifestyleAnswers = (
  interests: readonly string[],
  axes: LifestyleAxes,
  count: number,
): AtLeastThree<LifestyleAnswer> => {
  const candidates: readonly LifestyleAnswer[] = [
    { questionId: 'weekend-plan', answer: `周末通常会安排${interests[0]}，也会留出临时改变计划的空间。` },
    { questionId: 'social-setting', answer: axes.socialSetting <= 2 ? '更喜欢一对一或小范围聊天。' : '小组活动和一对一相处都可以。' },
    { questionId: 'planning-style', answer: axes.planningStyle >= 4 ? '重要安排会提前确认，轻松活动可以随性一点。' : '通常先确定大方向，再边走边决定。' },
    { questionId: 'after-work', answer: axes.afterWorkSocialEnergy >= 4 ? '下班后偶尔愿意见朋友或参加轻量活动。' : '下班后通常先恢复精力，再安排社交。' },
    { questionId: 'message-cadence', answer: axes.messageCadence >= 4 ? '看到重要消息会及时回复。' : '习惯集中回复，但不会让重要沟通没有着落。' },
  ];
  return candidates.slice(0, count) as unknown as AtLeastThree<LifestyleAnswer>;
};

const makeRelationshipEvidence = (index: number): RelationshipTraitEvidence =>
  Object.fromEntries(RELATIONSHIP_DIMENSION_VALUES.map((dimension, dimensionIndex) => {
    const evidenceSources = RELATIONSHIP_EVIDENCE_SCENARIOS.map((scenario, scenarioIndex) => ({
      sourceKind: Object.values(RelationshipEvidenceSourceKind)[
        (index * 3 + dimensionIndex + scenarioIndex) % 4
      ],
      sourceId: `synthetic_evidence_${String(index + 1).padStart(3, '0')}_${dimensionIndex + 1}_${scenarioIndex + 1}`,
      scenarioId: `synthetic_scenario_${scenario.id}`,
      context: scenario.context,
      summary: `${scenario.context}，${RELATIONSHIP_EVIDENCE_COPY[dimension]}`,
      confirmedByUser: true as const,
    })) as unknown as RelationshipTraitEvidence[typeof dimension]['evidenceSources'];
    return [dimension, {
      stance: RELATIONSHIP_EVIDENCE_COPY[dimension],
      context: '由三个不同生活情境中的本人确认回答形成。',
      importance: SCALE_VALUES[(index + dimensionIndex * 2) % SCALE_VALUES.length],
      confidence: 'HIGH' as const,
      evidenceCount: evidenceSources.length,
      evidenceSources,
      updatedAt: SYNTHETIC_PROFILE_GENERATED_AT,
      confirmedByUser: true as const,
      stability: 'STABLE' as const,
      permissions: { ...DEFAULT_FIELD_PERMISSIONS.relationshipTraitEvidence },
    }];
  })) as unknown as RelationshipTraitEvidence;

const permissionWith = (
  base: FieldUsagePermission,
  overrides: Partial<FieldUsagePermission>,
): FieldUsagePermission => ({ ...base, ...overrides });

const makePermissions = (index: number): ProfileFieldPermissions =>
  Object.fromEntries(PROFILE_FIELD_KEYS.map((field) => {
    const base = DEFAULT_FIELD_PERMISSIONS[field];
    if (field === ProfileFieldKey.LIFESTYLE_AXES && index % 4 === 0) {
      return [field, permissionWith(base, { publicDisplay: false, aiExplanation: false })];
    }
    if (field === ProfileFieldKey.INDUSTRY && index % 5 === 0) {
      return [field, permissionWith(base, { publicDisplay: false, aiExplanation: false })];
    }
    if (field === ProfileFieldKey.BUDGET_BAND && index % 6 === 0) {
      return [field, permissionWith(base, { publicDisplay: false, aiExplanation: false })];
    }
    if (field === ProfileFieldKey.SPENDING_STYLE && index % 7 === 0) {
      return [field, permissionWith(base, { publicDisplay: false, aiExplanation: false })];
    }
    if (field === ProfileFieldKey.COST_SHARING_PREFERENCE && index % 8 === 0) {
      return [field, permissionWith(base, { publicDisplay: false, aiExplanation: false })];
    }
    if (field === ProfileFieldKey.BIO && index % 5 === 1) {
      return [field, permissionWith(base, { aiExplanation: false })];
    }
    if (field === ProfileFieldKey.PROMPTS && index % 5 === 2) {
      return [field, permissionWith(base, { aiExplanation: false })];
    }
    return [field, { ...base }];
  })) as ProfileFieldPermissions;

const adjacentValues = <T>(values: readonly T[], value: T): readonly [T, T, T] => {
  const position = values.indexOf(value);
  return [
    value,
    values[(position + 1) % values.length],
    values[(position + values.length - 1) % values.length],
  ];
};

type DesiredGenderPattern = readonly [SelfGender4, ...SelfGender4[]];

/**
 * Every non-empty preference combination, balanced independently from the
 * profile's self-identified gender. Keeping this as its own field-addressed
 * pool prevents a fictional preference from being inferred from selfGender.
 */
const DESIRED_GENDER_PATTERNS: readonly DesiredGenderPattern[] = Array.from(
  { length: (1 << SELF_GENDER4_VALUES.length) - 1 },
  (_, patternIndex): DesiredGenderPattern => {
    const mask = patternIndex + 1;
    const selected = SELF_GENDER4_VALUES.filter((_, genderIndex) =>
      (mask & (1 << genderIndex)) !== 0,
    );
    if (selected.length === 0) throw new Error('Desired gender pattern cannot be empty.');
    return selected as [SelfGender4, ...SelfGender4[]];
  },
);

const makeCandidatePreferences = (
  index: number,
  desiredGenderPattern: DesiredGenderPattern,
  relationshipGoal: RelationshipGoal5,
  city: string,
) => {
  const desiredGenders = [...desiredGenderPattern] as [SelfGender4, ...SelfGender4[]];
  const acceptedRelationshipGoals = index % 4 === 0
    ? [...RELATIONSHIP_GOAL5_VALUES]
    : adjacentValues(RELATIONSHIP_GOAL5_VALUES, relationshipGoal);
  return {
    desiredGenders,
    ageRange: { minimum: 18, maximum: 58 },
    location: {
      scope: index % 3 === 0 ? CandidateLocationScope.SAME_CITY : CandidateLocationScope.ANYWHERE,
      isHardConstraint: false,
      allowedCities: [city],
    },
    acceptedRelationshipGoals,
    relationshipGoalIsHardConstraint: index % 3 !== 0,
    acceptedConnectionStarts: [...CONNECTION_START_VALUES],
    connectionStartIsHardConstraint: false,
    acceptedRelationshipPaces: [...RELATIONSHIP_PACE_VALUES],
    relationshipPaceIsHardConstraint: false,
    requiresVerifiedPersonhood: true,
  } as const;
};

function assertCompletePublicPerson(person: PublicPersonProjection): asserts person is Person {
  const complete =
    typeof person.displayName === 'string' &&
    typeof person.age === 'number' &&
    typeof person.city === 'string' &&
    typeof person.occupation === 'string' &&
    typeof person.bio === 'string' &&
    person.relationshipGoal !== undefined &&
    person.mbti !== undefined &&
    person.zodiac !== undefined &&
    Array.isArray(person.interests) && person.interests.length > 0 &&
    Array.isArray(person.photos) && person.photos.length > 0 &&
    Array.isArray(person.prompts);
  if (!complete) {
    throw new Error(`Synthetic public Person ${person.id} is missing a required displayed field.`);
  }
}

/** The only supported conversion from a private fixture record to domain Person. */
export const toPublicPerson = (record: SyntheticUserRecord): Person => {
  const projection = projectPublicProfile(record);
  assertCompletePublicPerson(projection.person);
  return projection.person;
};

export const generateSyntheticUserRecords = (
  count = SYNTHETIC_PROFILE_COUNT,
  seed = SYNTHETIC_PROFILE_SEED,
): readonly SyntheticUserRecord[] => {
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new RangeError('Synthetic profile count must be a non-negative safe integer.');
  }

  // Every demographic/profile dimension gets its own independently seeded shuffle.
  const ages = balancedAssignment(AGE_VALUES, count, seed, 'age');
  if (count > LEGACY_IDENTITIES.length) ages[LEGACY_IDENTITIES.length] = 18;
  if (count > LEGACY_IDENTITIES.length + 1) ages[LEGACY_IDENTITIES.length + 1] = 58;
  const genders = balancedAssignment(MOCK_PROFILE_GENDER_VALUES, count, seed, 'self-gender');
  const desiredGenderPatterns = balancedAssignment(
    DESIRED_GENDER_PATTERNS, count, seed, 'desired-gender-pattern',
  );
  const relationshipGoals = balancedAssignment(RELATIONSHIP_GOAL5_VALUES, count, seed, 'relationship-goal');
  const connectionStarts = balancedAssignment(CONNECTION_START_VALUES, count, seed, 'connection-start');
  const relationshipPaces = balancedAssignment(RELATIONSHIP_PACE_VALUES, count, seed, 'relationship-pace');
  const industries = balancedAssignment(INDUSTRY_VALUES, count, seed, 'industry');
  const mbtis = balancedAssignment(MBTI_VALUES, count, seed, 'mbti');
  const zodiacs = balancedAssignment(ZODIAC_VALUES, count, seed, 'zodiac');
  const cities = balancedAssignment(CITIES, count, seed, 'city');
  const budgetBands = balancedAssignment(BUDGET_BAND_VALUES, count, seed, 'budget-band');
  const spendingStyles = balancedAssignment(SPENDING_STYLE_VALUES, count, seed, 'spending-style');
  const costSharingPreferences = balancedAssignment(
    COST_SHARING_PREFERENCE_VALUES, count, seed, 'cost-sharing-preference',
  );
  const photoCounts = balancedAssignment(PHOTO_COUNTS, count, seed, 'photo-count');
  const promptCounts = balancedAssignment(PROMPT_COUNTS, count, seed, 'prompt-count');
  const lifestyleAnswerCounts = balancedAssignment(LIFESTYLE_ANSWER_COUNTS, count, seed, 'lifestyle-answer-count');
  const axesByKey = Object.fromEntries(LIFESTYLE_AXIS_KEYS.map((axis) => [
    axis, balancedAssignment(SCALE_VALUES, count, seed, `lifestyle-axis-${axis}`),
  ])) as Record<(typeof LIFESTYLE_AXIS_KEYS)[number], Scale1To5[]>;

  const genderOrdinals: Record<MockProfileGender, number> = { WOMAN: 0, MAN: 0 };

  return Array.from({ length: count }, (_, index): SyntheticUserRecord => {
    const identity = profileIdentity(index);
    const age = ages[index];
    const selfGender = genders[index];
    const relationshipGoal = relationshipGoals[index];
    const connectionStart = connectionStarts[index];
    const relationshipPace = relationshipPaces[index];
    const industry = industries[index];
    const zodiac = zodiacs[index];
    const city = cities[index];
    const birthDate = birthDateFor(age, zodiac);
    const interestCount = 5 + (fieldHash(seed, index, 'interest-count') % 4);
    const interests = chooseInterests(seed, index, interestCount);
    const focusInterests = [interests[0], interests[1], interests[2]] as const;
    const lifestyleAxes: LifestyleAxes = {
      weekendActivity: axesByKey.weekendActivity[index],
      socialSetting: axesByKey.socialSetting[index],
      planningStyle: axesByKey.planningStyle[index],
      afterWorkSocialEnergy: axesByKey.afterWorkSocialEnergy[index],
      messageCadence: axesByKey.messageCadence[index],
    };
    const occupations = OCCUPATIONS_BY_INDUSTRY[industry];
    const occupation = occupations[fieldHash(seed, index, 'occupation') % occupations.length];
    const genderOrdinal = genderOrdinals[selfGender];
    genderOrdinals[selfGender] += 1;
    const photos = makePhotos(
      index, identity.displayName, selfGender, genderOrdinal, photoCounts[index],
    );
    const prompts = makePrompts(interests, promptCounts[index]);
    const permissions = makePermissions(index);

    const person: Person = {
      entityType: FeedCardType.PERSON,
      id: identity.id,
      entityVersion: 1 + (fieldHash(seed, index, 'entity-version') % 9),
      profileStatus: ProfileStatus.RECOMMENDABLE,
      displayName: identity.displayName,
      age: calculateAge(birthDate, SYNTHETIC_PROFILE_AS_OF),
      city,
      occupation,
      bio: `空闲时喜欢${focusInterests[0]}和${focusInterests[1]}。期待${RELATIONSHIP_GOAL5_LABELS[relationshipGoal]}，也尊重彼此清晰表达的边界。`,
      relationshipGoal: toDomainRelationshipGoal(relationshipGoal),
      mbti: mbtis[index],
      zodiac: calculateZodiacSign(birthDate),
      interests,
      photos,
      prompts,
      verification: {
        account: VerificationStatus.VERIFIED,
        personhood: VerificationStatus.VERIFIED,
        profileReview: VerificationStatus.VERIFIED,
      },
    };

    return {
      schemaVersion: '1.0',
      isSynthetic: true,
      generatedAt: SYNTHETIC_PROFILE_GENERATED_AT,
      profileAsOf: SYNTHETIC_PROFILE_AS_OF,
      person,
      private: {
        birthDate,
        candidatePreferences: makeCandidatePreferences(
          index, desiredGenderPatterns[index], relationshipGoal, city,
        ),
      },
      selfGender,
      relationshipGoal,
      connectionStart,
      relationshipPace,
      industry,
      focusInterests,
      lifestyleAnswers: makeLifestyleAnswers(
        interests, lifestyleAxes, lifestyleAnswerCounts[index],
      ),
      lifestyleAxes,
      budgetBand: budgetBands[index],
      spendingStyle: spendingStyles[index],
      costSharingPreference: costSharingPreferences[index],
      relationshipTraitEvidence: makeRelationshipEvidence(index),
      permissions,
    };
  });
};

/** Private fixture records. Never pass this export directly to UI components. */
export const syntheticUserRecords = generateSyntheticUserRecords();

/** Compatibility alias for tooling that calls the complete fixture a profile. */
export const syntheticProfiles = syntheticUserRecords;

/** Permission-aware extension projections; contains no birth date or preferences. */
export const syntheticPublicProfiles: readonly PublicProfileProjection[] =
  syntheticUserRecords.map(projectPublicProfile);

/** Canonical UI/domain projection. Every item passed through projectPublicProfile. */
export const syntheticPeople: readonly Person[] = syntheticUserRecords.map(toPublicPerson);

interface PublicExplanationContext {
  readonly interests: readonly string[];
  readonly relationshipGoal?: RelationshipGoal5;
}

/**
 * Produces a deliberately tiny input for recommendation copy. Values are read
 * from the public projection only after both display and explanation consent
 * have been checked on the private fixture.
 */
const toPublicExplanationContext = (
  record: SyntheticUserRecord,
  projection: PublicProfileProjection,
): PublicExplanationContext => {
  const canExplain = (field: ProfileFieldKey): boolean => {
    const permission = record.permissions[field];
    return permission.publicDisplay && permission.aiExplanation;
  };
  const focusInterests = canExplain(ProfileFieldKey.FOCUS_INTERESTS)
    ? projection.focusInterests ?? []
    : [];
  const interests = focusInterests.length > 0
    ? focusInterests
    : canExplain(ProfileFieldKey.INTERESTS)
      ? projection.person.interests ?? []
      : [];
  return {
    interests,
    ...(canExplain(ProfileFieldKey.RELATIONSHIP_GOAL) && projection.relationshipGoal
      ? { relationshipGoal: projection.relationshipGoal }
      : {}),
  };
};

const syntheticExplanationContexts = syntheticUserRecords.map((record, index) =>
  toPublicExplanationContext(record, syntheticPublicProfiles[index]),
);

/** Private lookup for server-side fixture evaluation; UI code should use findSyntheticPersonById. */
export const syntheticProfileById: ReadonlyMap<PersonId, SyntheticUserRecord> =
  new Map(syntheticUserRecords.map((record) => [record.person.id, record]));

export const findSyntheticProfileById = (
  id: PersonId | string,
): SyntheticUserRecord | undefined => syntheticProfileById.get(id as PersonId);

const syntheticPersonById: ReadonlyMap<PersonId, Person> =
  new Map(syntheticPeople.map((person) => [person.id, person]));

export const findSyntheticPersonById = (id: PersonId | string): Person | undefined =>
  syntheticPersonById.get(id as PersonId);

export const getMutualCandidateIds = (personId: PersonId | string): readonly PersonId[] => {
  const record = syntheticProfileById.get(personId as PersonId);
  if (!record) return [];
  return syntheticUserRecords
    .filter((candidate) =>
      candidate.person.id !== record.person.id &&
      evaluateCandidateFeasibility(record, candidate).eligible,
    )
    .map((candidate) => candidate.person.id);
};

const feedExpiresAt = '2027-08-22T23:59:59+08:00' as const;
const feedRequestId = 'request_synthetic_people_20260822' as const;

export const syntheticPersonFeedCards: readonly PersonFeedCard[] = syntheticPeople.map(
  (person, index): PersonFeedCard => {
    const explanationContext = syntheticExplanationContexts[index];
    const leadInterest = explanationContext.interests[0];
    return {
      schemaVersion: '1.0',
      cardId: `feed_synthetic_person_${String(index + 1).padStart(3, '0')}`,
      cardType: FeedCardType.PERSON,
      pathType: PathType.PERSON,
      entityId: person.id,
      entityVersion: person.entityVersion,
      requestId: feedRequestId,
      rankPosition: index + 1,
      reason: {
        code: leadInterest ? FeedReasonCode.SHARED_INTEREST : FeedReasonCode.INTEREST_EXPLORATION,
        headline: leadInterest ? `可以从${leadInterest}聊起` : '看看彼此公开分享的资料',
        explanation: '推荐依据仅来自双方授权公开的资料。',
        evidenceLabels: explanationContext.interests.slice(0, 2),
      },
      expiresAt: feedExpiresAt,
      presentation: {
        template: FeedPresentationTemplate.PERSON_PORTRAIT,
        image: person.photos[0],
        eyebrow: '资料完整',
        headline: `${person.displayName}，${person.age}`,
        supportingText: `${person.occupation} · ${person.city}`,
        badges: person.interests.slice(0, 2).map((label, badgeIndex) => ({
          label, tone: badgeIndex === 0 ? 'ACCENT' as const : 'NEUTRAL' as const,
        })),
        facts: explanationContext.relationshipGoal
          ? [{ label: '想认识', value: RELATIONSHIP_GOAL5_LABELS[explanationContext.relationshipGoal] }]
          : [],
        primaryActionLabel: '表达红心',
      },
      allowedActions: [
        FeedAction.VIEW_DETAIL, FeedAction.HEART_PERSON, FeedAction.HIDE, FeedAction.REPORT,
      ],
    };
  },
);

/** Resolver compatible with ContentCard's resolveEntity callback. */
export const resolveSyntheticFeedCardEntity = (card: FeedCard): Person | undefined =>
  card.cardType === FeedCardType.PERSON
    ? findSyntheticPersonById(card.entityId)
    : undefined;

const countValues = <T extends string>(values: readonly T[], selected: readonly T[]) =>
  Object.fromEntries(values.map((value) => [
    value, selected.filter((candidate) => candidate === value).length,
  ])) as Readonly<Record<T, number>>;

const countMutualPairs = (records: readonly SyntheticUserRecord[]): number => {
  let total = 0;
  for (let left = 0; left < records.length; left += 1) {
    for (let right = left + 1; right < records.length; right += 1) {
      if (evaluateCandidateFeasibility(records[left], records[right]).eligible) total += 1;
    }
  }
  return total;
};

export interface SyntheticGeneratorCoverageReport extends SyntheticCoverageReport {
  readonly seed: string;
  readonly age: { readonly minimum: number; readonly maximum: number };
  readonly mbtiCounts: Readonly<Record<MbtiType, number>>;
  readonly zodiacCounts: Readonly<Record<ZodiacSign, number>>;
  readonly costSharingPreferenceCounts: Readonly<Record<CostSharingPreference, number>>;
  readonly interestCount: { readonly minimum: number; readonly maximum: number };
  readonly photoCount: { readonly minimum: number; readonly maximum: number };
  readonly promptCount: { readonly minimum: number; readonly maximum: number };
  readonly uniqueMediaAssetIds: number;
  readonly mutualCandidatePairs: number;
  /** Includes structurally private fields whose policy is always false. */
  readonly recordsWithPublicDisplayOptOut: number;
  /** Includes structurally non-explainable fields whose policy is always false. */
  readonly recordsWithAiExplanationOptOut: number;
  /** User-controlled opt-outs among fields that are public by default. */
  readonly recordsWithUserPublicDisplayOptOut: number;
  /** User-controlled opt-outs among fields that are explainable by default. */
  readonly recordsWithUserAiExplanationOptOut: number;
}

const rangeOf = (values: readonly number[]): { readonly minimum: number; readonly maximum: number } => ({
  minimum: values.length === 0 ? 0 : Math.min(...values),
  maximum: values.length === 0 ? 0 : Math.max(...values),
});

const baseCoverageReport = createSyntheticCoverageReport(syntheticUserRecords);
const allMediaIds = syntheticUserRecords.flatMap((record) =>
  record.person.photos.map((photo) => photo.id),
);
const userControllablePublicFields = [
  ProfileFieldKey.DISPLAY_NAME, ProfileFieldKey.AGE, ProfileFieldKey.ZODIAC,
  ProfileFieldKey.CITY, ProfileFieldKey.OCCUPATION, ProfileFieldKey.BIO,
  ProfileFieldKey.RELATIONSHIP_GOAL, ProfileFieldKey.CONNECTION_START,
  ProfileFieldKey.RELATIONSHIP_PACE, ProfileFieldKey.MBTI, ProfileFieldKey.INTERESTS,
  ProfileFieldKey.FOCUS_INTERESTS, ProfileFieldKey.PHOTOS, ProfileFieldKey.PROMPTS,
  ProfileFieldKey.LIFESTYLE_AXES, ProfileFieldKey.INDUSTRY, ProfileFieldKey.BUDGET_BAND,
  ProfileFieldKey.SPENDING_STYLE, ProfileFieldKey.COST_SHARING_PREFERENCE,
] as const;
const userControllableExplanationFields = [
  ProfileFieldKey.ZODIAC, ProfileFieldKey.CITY, ProfileFieldKey.BIO,
  ProfileFieldKey.RELATIONSHIP_GOAL, ProfileFieldKey.CONNECTION_START,
  ProfileFieldKey.RELATIONSHIP_PACE, ProfileFieldKey.MBTI, ProfileFieldKey.INTERESTS,
  ProfileFieldKey.FOCUS_INTERESTS, ProfileFieldKey.PROMPTS, ProfileFieldKey.LIFESTYLE_AXES,
  ProfileFieldKey.BUDGET_BAND, ProfileFieldKey.SPENDING_STYLE,
  ProfileFieldKey.COST_SHARING_PREFERENCE,
] as const;

export const syntheticCoverageReport: SyntheticGeneratorCoverageReport = {
  ...baseCoverageReport,
  seed: SYNTHETIC_PROFILE_SEED,
  age: rangeOf(syntheticPeople.map((person) => person.age)),
  mbtiCounts: countValues(MBTI_VALUES, syntheticPeople.map((person) => person.mbti)),
  zodiacCounts: countValues(ZODIAC_VALUES, syntheticPeople.map((person) => person.zodiac)),
  costSharingPreferenceCounts: countValues(
    COST_SHARING_PREFERENCE_VALUES,
    syntheticUserRecords.map((record) => record.costSharingPreference),
  ),
  interestCount: rangeOf(syntheticPeople.map((person) => person.interests.length)),
  photoCount: rangeOf(syntheticPeople.map((person) => person.photos.length)),
  promptCount: rangeOf(syntheticPeople.map((person) => person.prompts.length)),
  uniqueMediaAssetIds: new Set(allMediaIds).size,
  mutualCandidatePairs: countMutualPairs(syntheticUserRecords),
  recordsWithPublicDisplayOptOut: syntheticUserRecords.filter((record) =>
    Object.values(record.permissions).some((item) => !item.publicDisplay),
  ).length,
  recordsWithAiExplanationOptOut: syntheticUserRecords.filter((record) =>
    Object.values(record.permissions).some((item) => !item.aiExplanation),
  ).length,
  recordsWithUserPublicDisplayOptOut: syntheticUserRecords.filter((record) =>
    userControllablePublicFields.some((field) => !record.permissions[field].publicDisplay),
  ).length,
  recordsWithUserAiExplanationOptOut: syntheticUserRecords.filter((record) =>
    userControllableExplanationFields.some((field) => !record.permissions[field].aiExplanation),
  ).length,
};
