/**
 * Synthetic profile extension contract.
 *
 * `Person` remains the canonical product-facing domain entity. This module
 * keeps generation-only/private inputs in a separate aggregate and exposes an
 * explicit, permission-aware public projection. Synthetic fixtures must never
 * contain real contact details, exact locations, financial status, or inferred
 * sensitive attributes.
 */
import {
  RelationshipDimension,
  RelationshipGoal,
  VerificationStatus,
  ZodiacSign,
} from './domain';
import type {
  ISODate,
  ISODateTime,
  MbtiType,
  Person,
  PromptAnswer,
} from './domain';

export type Scale1To5 = 1 | 2 | 3 | 4 | 5;
export type ExactlyThree<T> = readonly [T, T, T];
export type AtLeastThree<T> = readonly [T, T, T, ...T[]];
export type NonEmptyReadonlyArray<T> = readonly [T, ...T[]];

/** The five relationship goals from the profile PRD. */
export enum RelationshipGoal5 {
  LONG_TERM = 'LONG_TERM',
  SERIOUS_AND_NATURAL = 'SERIOUS_AND_NATURAL',
  CASUAL_DATING = 'CASUAL_DATING',
  FRIENDS_FIRST = 'FRIENDS_FIRST',
  UNSURE = 'UNSURE',
}

export const RELATIONSHIP_GOAL5_LABELS = {
  [RelationshipGoal5.LONG_TERM]: '稳定关系',
  [RelationshipGoal5.SERIOUS_AND_NATURAL]: '认真认识，顺其自然',
  [RelationshipGoal5.CASUAL_DATING]: '轻松约会',
  [RelationshipGoal5.FRIENDS_FIRST]: '先从朋友开始',
  [RelationshipGoal5.UNSURE]: '暂不确定',
} as const satisfies Readonly<Record<RelationshipGoal5, string>>;

/** Explicit self-identification choices; no gender is inferred by the system. */
export enum SelfGender4 {
  WOMAN = 'WOMAN',
  MAN = 'MAN',
  NON_BINARY = 'NON_BINARY',
  SELF_DESCRIBED = 'SELF_DESCRIBED',
}

export const SELF_GENDER4_LABELS = {
  [SelfGender4.WOMAN]: '女性',
  [SelfGender4.MAN]: '男性',
  [SelfGender4.NON_BINARY]: '非二元',
  [SelfGender4.SELF_DESCRIBED]: '自我描述',
} as const satisfies Readonly<Record<SelfGender4, string>>;

export enum ConnectionStart {
  CHAT_FIRST = 'CHAT_FIRST',
  MEET_EARLY = 'MEET_EARLY',
  SHARED_ACTIVITY_FIRST = 'SHARED_ACTIVITY_FIRST',
  NATURAL = 'NATURAL',
}

export const CONNECTION_START_LABELS = {
  [ConnectionStart.CHAT_FIRST]: '先线上多聊',
  [ConnectionStart.MEET_EARLY]: '尽早见面',
  [ConnectionStart.SHARED_ACTIVITY_FIRST]: '从共同活动开始',
  [ConnectionStart.NATURAL]: '顺其自然',
} as const satisfies Readonly<Record<ConnectionStart, string>>;

export enum RelationshipPace {
  SLOW_AND_STEADY = 'SLOW_AND_STEADY',
  PROACTIVE_WHEN_RIGHT = 'PROACTIVE_WHEN_RIGHT',
  NO_FIXED_PACE = 'NO_FIXED_PACE',
}

export const RELATIONSHIP_PACE_LABELS = {
  [RelationshipPace.SLOW_AND_STEADY]: '慢慢熟悉',
  [RelationshipPace.PROACTIVE_WHEN_RIGHT]: '合适就积极推进',
  [RelationshipPace.NO_FIXED_PACE]: '没有固定节奏',
} as const satisfies Readonly<Record<RelationshipPace, string>>;

/** Preferred per-person activity spend, never income or financial capacity. */
export enum BudgetBand {
  LOW = 'LOW',
  MODERATE = 'MODERATE',
  HIGH = 'HIGH',
  FLEXIBLE = 'FLEXIBLE',
}

export const BUDGET_BAND_LABELS = {
  [BudgetBand.LOW]: '偏好低预算活动',
  [BudgetBand.MODERATE]: '偏好适中预算活动',
  [BudgetBand.HIGH]: '可接受较高预算活动',
  [BudgetBand.FLEXIBLE]: '视活动灵活决定',
} as const satisfies Readonly<Record<BudgetBand, string>>;

export enum SpendingStyle {
  PLAN_AHEAD = 'PLAN_AHEAD',
  VALUE_CONSCIOUS = 'VALUE_CONSCIOUS',
  EXPERIENCE_FIRST = 'EXPERIENCE_FIRST',
  FLEXIBLE = 'FLEXIBLE',
}

export const SPENDING_STYLE_LABELS = {
  [SpendingStyle.PLAN_AHEAD]: '提前规划预算',
  [SpendingStyle.VALUE_CONSCIOUS]: '重视性价比',
  [SpendingStyle.EXPERIENCE_FIRST]: '更看重体验',
  [SpendingStyle.FLEXIBLE]: '视情况灵活安排',
} as const satisfies Readonly<Record<SpendingStyle, string>>;

/** How someone prefers to handle shared activity costs; never a wealth proxy. */
export enum CostSharingPreference {
  SPLIT_EQUALLY = 'SPLIT_EQUALLY',
  TAKE_TURNS = 'TAKE_TURNS',
  INVITER_OFFERS = 'INVITER_OFFERS',
  DISCUSS_EACH_TIME = 'DISCUSS_EACH_TIME',
}

export const COST_SHARING_PREFERENCE_LABELS = {
  [CostSharingPreference.SPLIT_EQUALLY]: '各自分担',
  [CostSharingPreference.TAKE_TURNS]: '轮流承担',
  [CostSharingPreference.INVITER_OFFERS]: '邀请方可主动承担',
  [CostSharingPreference.DISCUSS_EACH_TIME]: '每次提前商量',
} as const satisfies Readonly<Record<CostSharingPreference, string>>;

export enum Industry {
  TECHNOLOGY_AND_INTERNET = 'TECHNOLOGY_AND_INTERNET',
  FINANCE = 'FINANCE',
  PROFESSIONAL_SERVICES = 'PROFESSIONAL_SERVICES',
  EDUCATION_AND_RESEARCH = 'EDUCATION_AND_RESEARCH',
  HEALTHCARE = 'HEALTHCARE',
  MEDIA_AND_CONTENT = 'MEDIA_AND_CONTENT',
  DESIGN_AND_CREATIVE = 'DESIGN_AND_CREATIVE',
  CULTURE_AND_ARTS = 'CULTURE_AND_ARTS',
  CONSUMER_AND_RETAIL = 'CONSUMER_AND_RETAIL',
  MANUFACTURING = 'MANUFACTURING',
  TRANSPORTATION_AND_LOGISTICS = 'TRANSPORTATION_AND_LOGISTICS',
  HOSPITALITY_AND_TOURISM = 'HOSPITALITY_AND_TOURISM',
  PUBLIC_AND_NONPROFIT = 'PUBLIC_AND_NONPROFIT',
  STUDENT = 'STUDENT',
  FREELANCE = 'FREELANCE',
  OTHER = 'OTHER',
}

export type IndustryType = Industry;

export const INDUSTRY_LABELS = {
  [Industry.TECHNOLOGY_AND_INTERNET]: '科技与互联网',
  [Industry.FINANCE]: '金融',
  [Industry.PROFESSIONAL_SERVICES]: '专业服务',
  [Industry.EDUCATION_AND_RESEARCH]: '教育与研究',
  [Industry.HEALTHCARE]: '医疗健康',
  [Industry.MEDIA_AND_CONTENT]: '媒体与内容',
  [Industry.DESIGN_AND_CREATIVE]: '设计与创意',
  [Industry.CULTURE_AND_ARTS]: '文化与艺术',
  [Industry.CONSUMER_AND_RETAIL]: '消费与零售',
  [Industry.MANUFACTURING]: '制造业',
  [Industry.TRANSPORTATION_AND_LOGISTICS]: '交通与物流',
  [Industry.HOSPITALITY_AND_TOURISM]: '酒店与旅游',
  [Industry.PUBLIC_AND_NONPROFIT]: '公共服务与非营利',
  [Industry.STUDENT]: '学生',
  [Industry.FREELANCE]: '自由职业',
  [Industry.OTHER]: '其他',
} as const satisfies Readonly<Record<Industry, string>>;

export const LIFESTYLE_AXIS_KEYS = [
  'weekendActivity',
  'socialSetting',
  'planningStyle',
  'afterWorkSocialEnergy',
  'messageCadence',
] as const;

export type LifestyleAxisKey = (typeof LIFESTYLE_AXIS_KEYS)[number];

/** All axes use 1..5; endpoint meaning is exported for generator and UI use. */
export interface LifestyleAxes {
  readonly weekendActivity: Scale1To5;
  readonly socialSetting: Scale1To5;
  readonly planningStyle: Scale1To5;
  readonly afterWorkSocialEnergy: Scale1To5;
  readonly messageCadence: Scale1To5;
}

export const LIFESTYLE_AXIS_LABELS = {
  weekendActivity: '自由周末偏好',
  socialSetting: '社交场景偏好',
  planningStyle: '计划方式',
  afterWorkSocialEnergy: '下班后社交能量',
  messageCadence: '消息回复节奏',
} as const satisfies Readonly<Record<LifestyleAxisKey, string>>;

export const LIFESTYLE_AXIS_ENDPOINT_LABELS = {
  weekendActivity: { low: '安静居家', high: '积极外出' },
  socialSetting: { low: '独处或一对一', high: '多人热闹' },
  planningStyle: { low: '随性决定', high: '提前计划' },
  afterWorkSocialEnergy: { low: '更想独处', high: '更想见朋友' },
  messageCadence: { low: '集中回复', high: '即时聊天' },
} as const satisfies Readonly<
  Record<LifestyleAxisKey, { readonly low: string; readonly high: string }>
>;

export const RELATIONSHIP_DIMENSION_LABELS = {
  [RelationshipDimension.LOYALTY_AND_BOUNDARIES]: '忠诚与边界',
  [RelationshipDimension.PRIVACY_AND_AUTONOMY]: '隐私与自主',
  [RelationshipDimension.ECONOMICS_AND_RESPONSIBILITY]: '经济观与责任',
  [RelationshipDimension.COMMUNICATION_AND_CONFLICT]: '沟通与冲突',
  [RelationshipDimension.COMPANIONSHIP_AND_CONTACT]: '陪伴与联系',
  [RelationshipDimension.CAREER_AND_LIFESTYLE]: '事业与生活方式',
  [RelationshipDimension.RELATIONSHIP_PACING]: '关系推进节奏',
  [RelationshipDimension.SUPPORT_AND_CARE]: '支持与照顾',
} as const satisfies Readonly<Record<RelationshipDimension, string>>;

export enum RelationshipEvidenceSourceKind {
  STRUCTURED_ANSWER = 'STRUCTURED_ANSWER',
  LIFESTYLE_ANSWER = 'LIFESTYLE_ANSWER',
  PROMPT_ANSWER = 'PROMPT_ANSWER',
  USER_CONFIRMED_SUMMARY = 'USER_CONFIRMED_SUMMARY',
}

export interface RelationshipEvidenceItem {
  readonly sourceKind: RelationshipEvidenceSourceKind;
  readonly sourceId: string;
  /** Distinct scenario identity used to prevent repeated answers faking stability. */
  readonly scenarioId: string;
  readonly context: string;
  readonly summary: string;
  /** Synthetic source is authored as if the fictional person confirmed it. */
  readonly confirmedByUser: true;
}

export type RelationshipTraitConfidence = 'LOW' | 'MEDIUM' | 'HIGH';
export type RelationshipTraitStability = 'EMERGING' | 'STABLE';

export interface RelationshipDimensionEvidence {
  readonly stance: string;
  readonly context: string;
  readonly importance: Scale1To5;
  readonly confidence: RelationshipTraitConfidence;
  readonly evidenceCount: number;
  readonly evidenceSources: AtLeastThree<RelationshipEvidenceItem>;
  readonly updatedAt: ISODateTime;
  readonly confirmedByUser: true;
  /** STABLE is legal only after three distinct confirmed scenario sources. */
  readonly stability: RelationshipTraitStability;
  readonly permissions: FieldUsagePermission;
}

/** The complete eight-dimension evidence ledger required by the PRD. */
export type RelationshipTraitEvidence = Readonly<
  Record<RelationshipDimension, RelationshipDimensionEvidence>
>;

export enum CandidateLocationScope {
  NEARBY = 'NEARBY',
  SAME_CITY = 'SAME_CITY',
  NEARBY_CITIES = 'NEARBY_CITIES',
  ANYWHERE = 'ANYWHERE',
}

export const CANDIDATE_LOCATION_SCOPE_LABELS = {
  [CandidateLocationScope.NEARBY]: '附近',
  [CandidateLocationScope.SAME_CITY]: '同城',
  [CandidateLocationScope.NEARBY_CITIES]: '周边城市',
  [CandidateLocationScope.ANYWHERE]: '不限',
} as const satisfies Readonly<Record<CandidateLocationScope, string>>;

export interface CandidateAgeRange {
  readonly minimum: number;
  readonly maximum: number;
}

export interface CandidateLocationPreference {
  readonly scope: CandidateLocationScope;
  readonly isHardConstraint: boolean;
  /** Coarse city names only; exact coordinates and addresses are prohibited. */
  readonly allowedCities?: readonly string[];
}

/** Private, bilateral candidate filters. This object must never be projected. */
export interface PrivateCandidatePreferences {
  readonly desiredGenders: NonEmptyReadonlyArray<SelfGender4>;
  readonly ageRange: CandidateAgeRange;
  readonly location: CandidateLocationPreference;
  readonly acceptedRelationshipGoals: readonly RelationshipGoal5[];
  readonly relationshipGoalIsHardConstraint: boolean;
  readonly acceptedConnectionStarts: readonly ConnectionStart[];
  readonly connectionStartIsHardConstraint: boolean;
  readonly acceptedRelationshipPaces: readonly RelationshipPace[];
  readonly relationshipPaceIsHardConstraint: boolean;
  readonly requiresVerifiedPersonhood: boolean;
}

/** These are four independent permissions; none implies another. */
export interface FieldUsagePermission {
  readonly candidateEligibility: boolean;
  readonly recommendationRanking: boolean;
  readonly publicDisplay: boolean;
  readonly aiExplanation: boolean;
}

export enum ProfileFieldKey {
  DISPLAY_NAME = 'displayName',
  AGE = 'age',
  ZODIAC = 'zodiac',
  SELF_GENDER = 'selfGender',
  CITY = 'city',
  OCCUPATION = 'occupation',
  BIO = 'bio',
  RELATIONSHIP_GOAL = 'relationshipGoal',
  CONNECTION_START = 'connectionStart',
  RELATIONSHIP_PACE = 'relationshipPace',
  MBTI = 'mbti',
  INTERESTS = 'interests',
  FOCUS_INTERESTS = 'focusInterests',
  PHOTOS = 'photos',
  PROMPTS = 'prompts',
  LIFESTYLE_ANSWERS = 'lifestyleAnswers',
  LIFESTYLE_AXES = 'lifestyleAxes',
  RELATIONSHIP_TRAITS = 'relationshipTraitEvidence',
  INDUSTRY = 'industry',
  BUDGET_BAND = 'budgetBand',
  SPENDING_STYLE = 'spendingStyle',
  COST_SHARING_PREFERENCE = 'costSharingPreference',
  BIRTH_DATE = 'birthDate',
  CANDIDATE_PREFERENCES = 'candidatePreferences',
  DESIRED_GENDERS = 'desiredGenders',
  CANDIDATE_AGE_RANGE = 'candidateAgeRange',
  CANDIDATE_LOCATION = 'candidateLocation',
  ACCEPTED_RELATIONSHIP_GOALS = 'acceptedRelationshipGoals',
  ACCEPTED_CONNECTION_STARTS = 'acceptedConnectionStarts',
  ACCEPTED_RELATIONSHIP_PACES = 'acceptedRelationshipPaces',
  REQUIRES_VERIFIED_PERSONHOOD = 'requiresVerifiedPersonhood',
}

export const PROFILE_FIELD_KEYS = Object.values(ProfileFieldKey);

export const PROFILE_FIELD_LABELS = {
  [ProfileFieldKey.DISPLAY_NAME]: '展示昵称',
  [ProfileFieldKey.AGE]: '年龄',
  [ProfileFieldKey.ZODIAC]: '星座',
  [ProfileFieldKey.SELF_GENDER]: '自我性别',
  [ProfileFieldKey.CITY]: '当前城市',
  [ProfileFieldKey.OCCUPATION]: '职业描述',
  [ProfileFieldKey.BIO]: '自我介绍',
  [ProfileFieldKey.RELATIONSHIP_GOAL]: '关系目标',
  [ProfileFieldKey.CONNECTION_START]: '认识方式',
  [ProfileFieldKey.RELATIONSHIP_PACE]: '关系推进节奏',
  [ProfileFieldKey.MBTI]: 'MBTI',
  [ProfileFieldKey.INTERESTS]: '兴趣',
  [ProfileFieldKey.FOCUS_INTERESTS]: '重点兴趣',
  [ProfileFieldKey.PHOTOS]: '照片',
  [ProfileFieldKey.PROMPTS]: 'Prompt 回答',
  [ProfileFieldKey.LIFESTYLE_ANSWERS]: '生活方式回答',
  [ProfileFieldKey.LIFESTYLE_AXES]: '生活方式倾向',
  [ProfileFieldKey.RELATIONSHIP_TRAITS]: '关系维度证据',
  [ProfileFieldKey.INDUSTRY]: '行业',
  [ProfileFieldKey.BUDGET_BAND]: '活动预算偏好',
  [ProfileFieldKey.SPENDING_STYLE]: '活动消费风格',
  [ProfileFieldKey.COST_SHARING_PREFERENCE]: '费用分担偏好',
  [ProfileFieldKey.BIRTH_DATE]: '完整出生日期',
  [ProfileFieldKey.CANDIDATE_PREFERENCES]: '候选偏好',
  [ProfileFieldKey.DESIRED_GENDERS]: '希望认识的性别',
  [ProfileFieldKey.CANDIDATE_AGE_RANGE]: '候选年龄范围',
  [ProfileFieldKey.CANDIDATE_LOCATION]: '候选地域范围',
  [ProfileFieldKey.ACCEPTED_RELATIONSHIP_GOALS]: '可接受的关系目标',
  [ProfileFieldKey.ACCEPTED_CONNECTION_STARTS]: '可接受的认识方式',
  [ProfileFieldKey.ACCEPTED_RELATIONSHIP_PACES]: '可接受的关系节奏',
  [ProfileFieldKey.REQUIRES_VERIFIED_PERSONHOOD]: '真人认证要求',
} as const satisfies Readonly<Record<ProfileFieldKey, string>>;

export type ProfileFieldPermissions = Readonly<
  Record<ProfileFieldKey, FieldUsagePermission>
>;
export type PermissionsMap = ProfileFieldPermissions;

const permission = (
  candidateEligibility: boolean,
  recommendationRanking: boolean,
  publicDisplay: boolean,
  aiExplanation: boolean,
): FieldUsagePermission => ({
  candidateEligibility,
  recommendationRanking,
  publicDisplay,
  aiExplanation,
});

/** Safe defaults for synthetic fixtures. Private fields are structurally locked. */
export const DEFAULT_FIELD_PERMISSIONS = {
  [ProfileFieldKey.DISPLAY_NAME]: permission(false, false, true, false),
  [ProfileFieldKey.AGE]: permission(true, false, true, false),
  [ProfileFieldKey.ZODIAC]: permission(false, true, true, true),
  [ProfileFieldKey.SELF_GENDER]: permission(true, false, false, false),
  [ProfileFieldKey.CITY]: permission(true, true, true, true),
  [ProfileFieldKey.OCCUPATION]: permission(false, false, true, false),
  [ProfileFieldKey.BIO]: permission(false, true, true, true),
  [ProfileFieldKey.RELATIONSHIP_GOAL]: permission(true, true, true, true),
  [ProfileFieldKey.CONNECTION_START]: permission(true, true, true, true),
  [ProfileFieldKey.RELATIONSHIP_PACE]: permission(true, true, true, true),
  [ProfileFieldKey.MBTI]: permission(false, true, true, true),
  [ProfileFieldKey.INTERESTS]: permission(false, true, true, true),
  [ProfileFieldKey.FOCUS_INTERESTS]: permission(false, true, true, true),
  [ProfileFieldKey.PHOTOS]: permission(false, false, true, false),
  [ProfileFieldKey.PROMPTS]: permission(false, true, true, true),
  [ProfileFieldKey.LIFESTYLE_ANSWERS]: permission(false, true, false, false),
  [ProfileFieldKey.LIFESTYLE_AXES]: permission(false, true, true, true),
  [ProfileFieldKey.RELATIONSHIP_TRAITS]: permission(false, true, false, false),
  [ProfileFieldKey.INDUSTRY]: permission(false, false, true, false),
  [ProfileFieldKey.BUDGET_BAND]: permission(false, true, true, true),
  [ProfileFieldKey.SPENDING_STYLE]: permission(false, true, true, true),
  [ProfileFieldKey.COST_SHARING_PREFERENCE]: permission(false, true, true, true),
  [ProfileFieldKey.BIRTH_DATE]: permission(true, false, false, false),
  [ProfileFieldKey.CANDIDATE_PREFERENCES]: permission(true, false, false, false),
  [ProfileFieldKey.DESIRED_GENDERS]: permission(true, false, false, false),
  [ProfileFieldKey.CANDIDATE_AGE_RANGE]: permission(true, false, false, false),
  [ProfileFieldKey.CANDIDATE_LOCATION]: permission(true, false, false, false),
  [ProfileFieldKey.ACCEPTED_RELATIONSHIP_GOALS]: permission(true, false, false, false),
  [ProfileFieldKey.ACCEPTED_CONNECTION_STARTS]: permission(true, false, false, false),
  [ProfileFieldKey.ACCEPTED_RELATIONSHIP_PACES]: permission(true, false, false, false),
  [ProfileFieldKey.REQUIRES_VERIFIED_PERSONHOOD]: permission(true, false, false, false),
} as const satisfies ProfileFieldPermissions;

export interface LifestyleAnswer {
  readonly questionId: string;
  readonly answer: string;
}

export interface SyntheticPrivateProfile {
  /** Full date is stored only here; public consumers receive derived age/zodiac. */
  readonly birthDate: ISODate;
  /** Candidate filters are stored only here and evaluated bilaterally. */
  readonly candidatePreferences: PrivateCandidatePreferences;
}

export interface SyntheticUserRecord {
  readonly schemaVersion: '1.0';
  readonly isSynthetic: true;
  readonly generatedAt: ISODateTime;
  /** The deterministic date used to derive `person.age`. */
  readonly profileAsOf: ISODate;
  readonly person: Person;
  readonly private: SyntheticPrivateProfile;
  readonly selfGender: SelfGender4;
  readonly relationshipGoal: RelationshipGoal5;
  readonly connectionStart: ConnectionStart;
  readonly relationshipPace: RelationshipPace;
  readonly industry: Industry;
  readonly focusInterests: ExactlyThree<string>;
  readonly lifestyleAnswers: AtLeastThree<LifestyleAnswer>;
  readonly lifestyleAxes: LifestyleAxes;
  readonly budgetBand: BudgetBand;
  readonly spendingStyle: SpendingStyle;
  readonly costSharingPreference: CostSharingPreference;
  readonly relationshipTraitEvidence: RelationshipTraitEvidence;
  readonly permissions: ProfileFieldPermissions;
}

export type PublicPersonProjection = Pick<
  Person,
  'entityType' | 'id' | 'entityVersion' | 'profileStatus' | 'verification'
> &
  Partial<
    Pick<
      Person,
      | 'displayName'
      | 'age'
      | 'city'
      | 'occupation'
      | 'bio'
      | 'relationshipGoal'
      | 'mbti'
      | 'zodiac'
      | 'interests'
      | 'photos'
      | 'prompts'
    >
  >;

/** Public DTO by construction: no full birth date or candidate preferences. */
export interface PublicProfileProjection {
  readonly schemaVersion: '1.0';
  readonly isSynthetic: true;
  readonly person: PublicPersonProjection;
  readonly selfGender?: SelfGender4;
  readonly relationshipGoal?: RelationshipGoal5;
  readonly connectionStart?: ConnectionStart;
  readonly relationshipPace?: RelationshipPace;
  readonly industry?: Industry;
  readonly focusInterests?: readonly string[];
  readonly lifestyleAnswers?: readonly LifestyleAnswer[];
  readonly lifestyleAxes?: LifestyleAxes;
  readonly budgetBand?: BudgetBand;
  readonly spendingStyle?: SpendingStyle;
  readonly costSharingPreference?: CostSharingPreference;
}

/** Explicitly documents the lossy bridge to the existing three-value domain. */
export const RELATIONSHIP_GOAL5_TO_DOMAIN = {
  [RelationshipGoal5.LONG_TERM]: RelationshipGoal.LONG_TERM,
  [RelationshipGoal5.SERIOUS_AND_NATURAL]: RelationshipGoal.SERIOUS_DATING,
  [RelationshipGoal5.CASUAL_DATING]: RelationshipGoal.OPEN_TO_EXPLORE,
  [RelationshipGoal5.FRIENDS_FIRST]: RelationshipGoal.OPEN_TO_EXPLORE,
  [RelationshipGoal5.UNSURE]: RelationshipGoal.OPEN_TO_EXPLORE,
} as const satisfies Readonly<Record<RelationshipGoal5, RelationshipGoal>>;

export const toDomainRelationshipGoal = (
  goal: RelationshipGoal5,
): RelationshipGoal => RELATIONSHIP_GOAL5_TO_DOMAIN[goal];

const enumValues = <T extends string>(value: Record<string, T>): readonly T[] =>
  Object.values(value);

export const RELATIONSHIP_GOAL5_VALUES = enumValues(RelationshipGoal5);
export const SELF_GENDER4_VALUES = enumValues(SelfGender4);
export const CONNECTION_START_VALUES = enumValues(ConnectionStart);
export const RELATIONSHIP_PACE_VALUES = enumValues(RelationshipPace);
export const BUDGET_BAND_VALUES = enumValues(BudgetBand);
export const SPENDING_STYLE_VALUES = enumValues(SpendingStyle);
export const COST_SHARING_PREFERENCE_VALUES = enumValues(CostSharingPreference);
export const INDUSTRY_VALUES = enumValues(Industry);
export const RELATIONSHIP_DIMENSION_VALUES = enumValues(RelationshipDimension);

interface DateParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

const parseISODate = (value: string): DateParts => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    throw new RangeError(`Invalid ISO date: ${value}`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    throw new RangeError(`Invalid calendar date: ${value}`);
  }
  return { year, month, day };
};

const currentISODate = (): ISODate =>
  new Date().toISOString().slice(0, 10) as ISODate;

export const calculateAge = (
  birthDate: ISODate,
  asOf: ISODate = currentISODate(),
): number => {
  const birth = parseISODate(birthDate);
  const current = parseISODate(asOf);
  let age = current.year - birth.year;
  if (
    current.month < birth.month ||
    (current.month === birth.month && current.day < birth.day)
  ) {
    age -= 1;
  }
  if (age < 0) {
    throw new RangeError('Birth date cannot be after the reference date.');
  }
  return age;
};

export const calculateZodiacSign = (birthDate: ISODate): ZodiacSign => {
  const { month, day } = parseISODate(birthDate);
  const mmdd = month * 100 + day;
  if (mmdd >= 1222 || mmdd <= 119) return ZodiacSign.CAPRICORN;
  if (mmdd <= 218) return ZodiacSign.AQUARIUS;
  if (mmdd <= 320) return ZodiacSign.PISCES;
  if (mmdd <= 419) return ZodiacSign.ARIES;
  if (mmdd <= 520) return ZodiacSign.TAURUS;
  if (mmdd <= 621) return ZodiacSign.GEMINI;
  if (mmdd <= 722) return ZodiacSign.CANCER;
  if (mmdd <= 822) return ZodiacSign.LEO;
  if (mmdd <= 922) return ZodiacSign.VIRGO;
  if (mmdd <= 1023) return ZodiacSign.LIBRA;
  if (mmdd <= 1122) return ZodiacSign.SCORPIO;
  return ZodiacSign.SAGITTARIUS;
};

export const projectPublicProfile = (
  record: SyntheticUserRecord,
): PublicProfileProjection => {
  const { person, permissions } = record;
  const publicPerson: PublicPersonProjection = {
    entityType: person.entityType,
    id: person.id,
    entityVersion: person.entityVersion,
    profileStatus: person.profileStatus,
    verification: person.verification,
    ...(permissions.displayName.publicDisplay
      ? { displayName: person.displayName }
      : {}),
    ...(permissions.age.publicDisplay ? { age: person.age } : {}),
    ...(permissions.city.publicDisplay ? { city: person.city } : {}),
    ...(permissions.occupation.publicDisplay
      ? { occupation: person.occupation }
      : {}),
    ...(permissions.bio.publicDisplay ? { bio: person.bio } : {}),
    ...(permissions.relationshipGoal.publicDisplay
      ? { relationshipGoal: person.relationshipGoal }
      : {}),
    ...(permissions.mbti.publicDisplay ? { mbti: person.mbti } : {}),
    ...(permissions.zodiac.publicDisplay ? { zodiac: person.zodiac } : {}),
    ...(permissions.interests.publicDisplay
      ? { interests: [...person.interests] as Person['interests'] }
      : {}),
    ...(permissions.photos.publicDisplay
      ? { photos: [...person.photos] as Person['photos'] }
      : {}),
    ...(permissions.prompts.publicDisplay
      ? { prompts: [...person.prompts] }
      : {}),
  };

  return {
    schemaVersion: '1.0',
    isSynthetic: true,
    person: publicPerson,
    ...(permissions.selfGender.publicDisplay
      ? { selfGender: record.selfGender }
      : {}),
    ...(permissions.relationshipGoal.publicDisplay
      ? { relationshipGoal: record.relationshipGoal }
      : {}),
    ...(permissions.connectionStart.publicDisplay
      ? { connectionStart: record.connectionStart }
      : {}),
    ...(permissions.relationshipPace.publicDisplay
      ? { relationshipPace: record.relationshipPace }
      : {}),
    ...(permissions.industry.publicDisplay ? { industry: record.industry } : {}),
    ...(permissions.focusInterests.publicDisplay
      ? { focusInterests: [...record.focusInterests] }
      : {}),
    ...(permissions.lifestyleAnswers.publicDisplay
      ? { lifestyleAnswers: record.lifestyleAnswers.map((item) => ({ ...item })) }
      : {}),
    ...(permissions.lifestyleAxes.publicDisplay
      ? { lifestyleAxes: { ...record.lifestyleAxes } }
      : {}),
    ...(permissions.budgetBand.publicDisplay
      ? { budgetBand: record.budgetBand }
      : {}),
    ...(permissions.spendingStyle.publicDisplay
      ? { spendingStyle: record.spendingStyle }
      : {}),
    ...(permissions.costSharingPreference.publicDisplay
      ? { costSharingPreference: record.costSharingPreference }
      : {}),
  };
};

export enum CandidateFeasibilityReason {
  SAME_PERSON = 'SAME_PERSON',
  LEFT_GENDER_FILTER = 'LEFT_GENDER_FILTER',
  RIGHT_GENDER_FILTER = 'RIGHT_GENDER_FILTER',
  LEFT_AGE_FILTER = 'LEFT_AGE_FILTER',
  RIGHT_AGE_FILTER = 'RIGHT_AGE_FILTER',
  LEFT_LOCATION_FILTER = 'LEFT_LOCATION_FILTER',
  RIGHT_LOCATION_FILTER = 'RIGHT_LOCATION_FILTER',
  LEFT_RELATIONSHIP_GOAL_FILTER = 'LEFT_RELATIONSHIP_GOAL_FILTER',
  RIGHT_RELATIONSHIP_GOAL_FILTER = 'RIGHT_RELATIONSHIP_GOAL_FILTER',
  LEFT_CONNECTION_START_FILTER = 'LEFT_CONNECTION_START_FILTER',
  RIGHT_CONNECTION_START_FILTER = 'RIGHT_CONNECTION_START_FILTER',
  LEFT_RELATIONSHIP_PACE_FILTER = 'LEFT_RELATIONSHIP_PACE_FILTER',
  RIGHT_RELATIONSHIP_PACE_FILTER = 'RIGHT_RELATIONSHIP_PACE_FILTER',
  LEFT_VERIFICATION_FILTER = 'LEFT_VERIFICATION_FILTER',
  RIGHT_VERIFICATION_FILTER = 'RIGHT_VERIFICATION_FILTER',
}

export interface CandidateFeasibilityResult {
  readonly eligible: boolean;
  readonly reasons: readonly CandidateFeasibilityReason[];
  readonly checkedHardConstraints: number;
}

const isAgeAccepted = (range: CandidateAgeRange, age: number): boolean =>
  age >= range.minimum && age <= range.maximum;

const isLocationAccepted = (
  preference: CandidateLocationPreference,
  ownerCity: string,
  candidateCity: string,
): boolean => {
  if (!preference.isHardConstraint || preference.scope === CandidateLocationScope.ANYWHERE) {
    return true;
  }
  if (
    preference.scope === CandidateLocationScope.NEARBY ||
    preference.scope === CandidateLocationScope.SAME_CITY
  ) {
    return ownerCity === candidateCity;
  }
  return (preference.allowedCities ?? [ownerCity]).includes(candidateCity);
};

/** Applies explicit hard filters in both directions; it never computes a score. */
export const evaluateCandidateFeasibility = (
  left: SyntheticUserRecord,
  right: SyntheticUserRecord,
): CandidateFeasibilityResult => {
  const reasons: CandidateFeasibilityReason[] = [];
  let checkedHardConstraints = 0;
  const leftPreferences = left.private.candidatePreferences;
  const rightPreferences = right.private.candidatePreferences;

  if (left.person.id === right.person.id) {
    reasons.push(CandidateFeasibilityReason.SAME_PERSON);
  }

  checkedHardConstraints += 4;
  if (!leftPreferences.desiredGenders.includes(right.selfGender)) {
    reasons.push(CandidateFeasibilityReason.LEFT_GENDER_FILTER);
  }
  if (!rightPreferences.desiredGenders.includes(left.selfGender)) {
    reasons.push(CandidateFeasibilityReason.RIGHT_GENDER_FILTER);
  }
  if (!isAgeAccepted(leftPreferences.ageRange, right.person.age)) {
    reasons.push(CandidateFeasibilityReason.LEFT_AGE_FILTER);
  }
  if (!isAgeAccepted(rightPreferences.ageRange, left.person.age)) {
    reasons.push(CandidateFeasibilityReason.RIGHT_AGE_FILTER);
  }

  if (leftPreferences.location.isHardConstraint) checkedHardConstraints += 1;
  if (rightPreferences.location.isHardConstraint) checkedHardConstraints += 1;
  if (!isLocationAccepted(leftPreferences.location, left.person.city, right.person.city)) {
    reasons.push(CandidateFeasibilityReason.LEFT_LOCATION_FILTER);
  }
  if (!isLocationAccepted(rightPreferences.location, right.person.city, left.person.city)) {
    reasons.push(CandidateFeasibilityReason.RIGHT_LOCATION_FILTER);
  }

  if (leftPreferences.relationshipGoalIsHardConstraint) {
    checkedHardConstraints += 1;
    if (!leftPreferences.acceptedRelationshipGoals.includes(right.relationshipGoal)) {
      reasons.push(CandidateFeasibilityReason.LEFT_RELATIONSHIP_GOAL_FILTER);
    }
  }
  if (rightPreferences.relationshipGoalIsHardConstraint) {
    checkedHardConstraints += 1;
    if (!rightPreferences.acceptedRelationshipGoals.includes(left.relationshipGoal)) {
      reasons.push(CandidateFeasibilityReason.RIGHT_RELATIONSHIP_GOAL_FILTER);
    }
  }
  if (leftPreferences.connectionStartIsHardConstraint) {
    checkedHardConstraints += 1;
    if (!leftPreferences.acceptedConnectionStarts.includes(right.connectionStart)) {
      reasons.push(CandidateFeasibilityReason.LEFT_CONNECTION_START_FILTER);
    }
  }
  if (rightPreferences.connectionStartIsHardConstraint) {
    checkedHardConstraints += 1;
    if (!rightPreferences.acceptedConnectionStarts.includes(left.connectionStart)) {
      reasons.push(CandidateFeasibilityReason.RIGHT_CONNECTION_START_FILTER);
    }
  }
  if (leftPreferences.relationshipPaceIsHardConstraint) {
    checkedHardConstraints += 1;
    if (!leftPreferences.acceptedRelationshipPaces.includes(right.relationshipPace)) {
      reasons.push(CandidateFeasibilityReason.LEFT_RELATIONSHIP_PACE_FILTER);
    }
  }
  if (rightPreferences.relationshipPaceIsHardConstraint) {
    checkedHardConstraints += 1;
    if (!rightPreferences.acceptedRelationshipPaces.includes(left.relationshipPace)) {
      reasons.push(CandidateFeasibilityReason.RIGHT_RELATIONSHIP_PACE_FILTER);
    }
  }

  if (leftPreferences.requiresVerifiedPersonhood) {
    checkedHardConstraints += 1;
    if (right.person.verification.personhood !== VerificationStatus.VERIFIED) {
      reasons.push(CandidateFeasibilityReason.LEFT_VERIFICATION_FILTER);
    }
  }
  if (rightPreferences.requiresVerifiedPersonhood) {
    checkedHardConstraints += 1;
    if (left.person.verification.personhood !== VerificationStatus.VERIFIED) {
      reasons.push(CandidateFeasibilityReason.RIGHT_VERIFICATION_FILTER);
    }
  }

  return { eligible: reasons.length === 0, reasons, checkedHardConstraints };
};

export const areCandidatesMutuallyEligible = (
  left: SyntheticUserRecord,
  right: SyntheticUserRecord,
): boolean => evaluateCandidateFeasibility(left, right).eligible;

export interface SyntheticProfileValidationIssue {
  readonly path: string;
  readonly code: string;
  readonly message: string;
}

export type SyntheticProfileValidationResult =
  | { readonly valid: true; readonly issues: readonly [] }
  | { readonly valid: false; readonly issues: readonly SyntheticProfileValidationIssue[] };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isEnumValue = <T extends string>(values: readonly T[], value: unknown): value is T =>
  typeof value === 'string' && values.includes(value as T);

const isScale1To5 = (value: unknown): value is Scale1To5 =>
  Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 5;

/**
 * Canonicalizes key spelling before policy matching. NFKC handles full-width
 * Latin characters; removing non letter/number characters covers snake_case,
 * kebab-case, whitespace, punctuation, and zero-width separators.
 */
export const normalizeSensitiveFieldKey = (key: string): string =>
  key.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

export const PROHIBITED_SYNTHETIC_FIELD_NAMES = [
  'income',
  'salary',
  'annualIncome',
  'assets',
  'netWorth',
  'propertyOwnership',
  'phone',
  'phoneNumber',
  'email',
  'emailAddress',
  'contact',
  'contactDetails',
  'address',
  'homeAddress',
  'workAddress',
  'latitude',
  'longitude',
  'coordinates',
  'exactLocation',
  'preciseLocation',
  'ethnicity',
  'race',
  'religion',
  'politicalViews',
  'sexualOrientation',
  'medicalHistory',
  'healthStatus',
  'disability',
] as const;

const PROHIBITED_SYNTHETIC_FIELD_KEYS = new Set(
  PROHIBITED_SYNTHETIC_FIELD_NAMES.map(normalizeSensitiveFieldKey),
);

export const findProhibitedSyntheticFieldPaths = (value: unknown): readonly string[] => {
  const paths: string[] = [];
  const seen = new WeakSet<object>();
  const visit = (current: unknown, path: string): void => {
    if (typeof current !== 'object' || current === null) return;
    if (seen.has(current)) return;
    seen.add(current);
    if (Array.isArray(current)) {
      current.forEach((item, index) => visit(item, `${path}[${index}]`));
      return;
    }
    Object.entries(current).forEach(([key, child]) => {
      const childPath = path ? `${path}.${key}` : key;
      if (PROHIBITED_SYNTHETIC_FIELD_KEYS.has(normalizeSensitiveFieldKey(key))) {
        paths.push(childPath);
      }
      visit(child, childPath);
    });
  };
  visit(value, '');
  return paths;
};

export const validateSyntheticUserRecord = (
  value: unknown,
): SyntheticProfileValidationResult => {
  const issues: SyntheticProfileValidationIssue[] = [];
  const add = (path: string, code: string, message: string): void => {
    issues.push({ path, code, message });
  };

  if (!isRecord(value)) {
    return {
      valid: false,
      issues: [{ path: '', code: 'TYPE', message: 'Profile must be an object.' }],
    };
  }

  if (value.isSynthetic !== true) add('isSynthetic', 'LITERAL', 'Must be true.');
  if (value.schemaVersion !== '1.0') add('schemaVersion', 'VERSION', 'Must be 1.0.');
  if (!isRecord(value.person)) add('person', 'TYPE', 'Person is required.');
  if (!isRecord(value.private)) add('private', 'TYPE', 'Private profile is required.');
  if (!isRecord(value.permissions)) add('permissions', 'TYPE', 'Permissions map is required.');

  if (!isEnumValue(RELATIONSHIP_GOAL5_VALUES, value.relationshipGoal)) {
    add('relationshipGoal', 'ENUM', 'Unknown relationship goal.');
  }
  if (!isEnumValue(SELF_GENDER4_VALUES, value.selfGender)) {
    add('selfGender', 'ENUM', 'Unknown self gender.');
  }
  if (!isEnumValue(CONNECTION_START_VALUES, value.connectionStart)) {
    add('connectionStart', 'ENUM', 'Unknown connection start preference.');
  }
  if (!isEnumValue(RELATIONSHIP_PACE_VALUES, value.relationshipPace)) {
    add('relationshipPace', 'ENUM', 'Unknown relationship pace.');
  }
  if (!isEnumValue(BUDGET_BAND_VALUES, value.budgetBand)) {
    add('budgetBand', 'ENUM', 'Unknown activity budget band.');
  }
  if (!isEnumValue(SPENDING_STYLE_VALUES, value.spendingStyle)) {
    add('spendingStyle', 'ENUM', 'Unknown spending style.');
  }
  if (!isEnumValue(COST_SHARING_PREFERENCE_VALUES, value.costSharingPreference)) {
    add('costSharingPreference', 'ENUM', 'Unknown cost-sharing preference.');
  }
  if (!isEnumValue(INDUSTRY_VALUES, value.industry)) {
    add('industry', 'ENUM', 'Unknown industry.');
  }

  if (!Array.isArray(value.focusInterests) || value.focusInterests.length !== 3) {
    add('focusInterests', 'CARDINALITY', 'Exactly three focus interests are required.');
  } else if (new Set(value.focusInterests).size !== 3) {
    add('focusInterests', 'UNIQUE', 'Focus interests must be distinct.');
  }
  if (!Array.isArray(value.lifestyleAnswers) || value.lifestyleAnswers.length < 3) {
    add('lifestyleAnswers', 'CARDINALITY', 'At least three lifestyle answers are required.');
  } else {
    const scenarioIds = new Set<string>();
    value.lifestyleAnswers.forEach((answer, index) => {
      if (!isRecord(answer)) {
        add(`lifestyleAnswers[${index}]`, 'TYPE', 'Lifestyle answer must be an object.');
        return;
      }
      if (typeof answer.questionId !== 'string' || !answer.questionId.trim()) {
        add(`lifestyleAnswers[${index}].questionId`, 'REQUIRED', 'Scenario id is required.');
      } else {
        scenarioIds.add(answer.questionId.trim());
      }
      if (typeof answer.answer !== 'string' || !answer.answer.trim()) {
        add(`lifestyleAnswers[${index}].answer`, 'REQUIRED', 'Answer text is required.');
      }
    });
    if (scenarioIds.size < 3) {
      add('lifestyleAnswers', 'DISTINCT_SCENARIOS', 'At least three distinct lifestyle scenarios are required.');
    }
  }

  if (!isRecord(value.lifestyleAxes)) {
    add('lifestyleAxes', 'TYPE', 'Lifestyle axes are required.');
  } else {
    const lifestyleAxes = value.lifestyleAxes;
    LIFESTYLE_AXIS_KEYS.forEach((key) => {
      if (!isScale1To5(lifestyleAxes[key])) {
        add(`lifestyleAxes.${key}`, 'RANGE', 'Axis must be an integer from 1 to 5.');
      }
    });
  }

  if (!isRecord(value.relationshipTraitEvidence)) {
    add('relationshipTraitEvidence', 'TYPE', 'Eight-dimension evidence is required.');
  } else {
    const relationshipTraitEvidence = value.relationshipTraitEvidence;
    RELATIONSHIP_DIMENSION_VALUES.forEach((dimension) => {
      const trait = relationshipTraitEvidence[dimension];
      const path = `relationshipTraitEvidence.${dimension}`;
      if (!isRecord(trait)) {
        add(
          path,
          'DIMENSION',
          'Every PRD relationship dimension must have an evidence object.',
        );
        return;
      }
      if (typeof trait.stance !== 'string' || !trait.stance.trim()) add(`${path}.stance`, 'REQUIRED', 'Stance is required.');
      if (typeof trait.context !== 'string' || !trait.context.trim()) add(`${path}.context`, 'REQUIRED', 'Context is required.');
      if (!isScale1To5(trait.importance)) add(`${path}.importance`, 'RANGE', 'Importance must be 1 to 5.');
      if (!['LOW', 'MEDIUM', 'HIGH'].includes(String(trait.confidence))) add(`${path}.confidence`, 'ENUM', 'Unknown confidence.');
      if (trait.confirmedByUser !== true) add(`${path}.confirmedByUser`, 'CONFIRMATION', 'Trait must be confirmed.');
      if (typeof trait.updatedAt !== 'string' || Number.isNaN(Date.parse(trait.updatedAt))) add(`${path}.updatedAt`, 'DATE', 'Updated time must be ISO-like.');
      if (!Array.isArray(trait.evidenceSources) || trait.evidenceSources.length < 3) {
        add(`${path}.evidenceSources`, 'CARDINALITY', 'At least three evidence sources are required.');
        return;
      }
      const scenarioIds = new Set<string>();
      trait.evidenceSources.forEach((source, index) => {
        if (!isRecord(source)) {
          add(`${path}.evidenceSources[${index}]`, 'TYPE', 'Evidence source must be an object.');
          return;
        }
        if (typeof source.scenarioId !== 'string' || !source.scenarioId.trim()) add(`${path}.evidenceSources[${index}].scenarioId`, 'REQUIRED', 'Scenario id is required.');
        else scenarioIds.add(source.scenarioId.trim());
        if (typeof source.sourceId !== 'string' || !source.sourceId.trim()) add(`${path}.evidenceSources[${index}].sourceId`, 'REQUIRED', 'Source id is required.');
        if (typeof source.context !== 'string' || !source.context.trim()) add(`${path}.evidenceSources[${index}].context`, 'REQUIRED', 'Evidence context is required.');
        if (typeof source.summary !== 'string' || !source.summary.trim()) add(`${path}.evidenceSources[${index}].summary`, 'REQUIRED', 'Evidence summary is required.');
        if (source.confirmedByUser !== true) add(`${path}.evidenceSources[${index}].confirmedByUser`, 'CONFIRMATION', 'Evidence must be confirmed.');
        if (!isEnumValue(Object.values(RelationshipEvidenceSourceKind), source.sourceKind)) add(`${path}.evidenceSources[${index}].sourceKind`, 'ENUM', 'Unknown source kind.');
      });
      if (!Number.isInteger(trait.evidenceCount) || trait.evidenceCount !== trait.evidenceSources.length) {
        add(`${path}.evidenceCount`, 'DERIVATION', 'Evidence count must equal source count.');
      }
      if (trait.stability === 'STABLE' && scenarioIds.size < 3) {
        add(`${path}.stability`, 'EVIDENCE', 'Stable traits require three distinct scenarios.');
      }
      if (trait.stability !== 'STABLE' && trait.stability !== 'EMERGING') add(`${path}.stability`, 'ENUM', 'Unknown stability.');
      if (!isRecord(trait.permissions)) add(`${path}.permissions`, 'PERMISSION', 'Trait permissions are required.');
    });
  }

  if (isRecord(value.permissions)) {
    const permissions = value.permissions;
    PROFILE_FIELD_KEYS.forEach((field) => {
      const item = permissions[field];
      const path = `permissions.${field}`;
      if (!isRecord(item)) {
        add(path, 'PERMISSION', 'Permission entry is required.');
        return;
      }
      const keys = Object.keys(item).sort();
      const expected = [
        'aiExplanation',
        'candidateEligibility',
        'publicDisplay',
        'recommendationRanking',
      ];
      if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
        add(path, 'PERMISSION_SHAPE', 'Permission must contain exactly four usage booleans.');
      }
      expected.forEach((key) => {
        if (typeof item[key] !== 'boolean') {
          add(`${path}.${key}`, 'TYPE', 'Permission value must be boolean.');
        }
      });
    });
    const birthPermission = value.permissions[ProfileFieldKey.BIRTH_DATE];
    if (
      isRecord(birthPermission) &&
      (birthPermission.publicDisplay !== false || birthPermission.aiExplanation !== false)
    ) {
      add('permissions.birthDate', 'PRIVACY', 'Full birth date can never be public or explained.');
    }
    const privatePreferenceFields = [
      ProfileFieldKey.CANDIDATE_PREFERENCES,
      ProfileFieldKey.DESIRED_GENDERS,
      ProfileFieldKey.CANDIDATE_AGE_RANGE,
      ProfileFieldKey.CANDIDATE_LOCATION,
      ProfileFieldKey.ACCEPTED_RELATIONSHIP_GOALS,
      ProfileFieldKey.ACCEPTED_CONNECTION_STARTS,
      ProfileFieldKey.ACCEPTED_RELATIONSHIP_PACES,
      ProfileFieldKey.REQUIRES_VERIFIED_PERSONHOOD,
    ] as const;
    privatePreferenceFields.forEach((field) => {
      const preferencePermission = permissions[field];
      if (
        isRecord(preferencePermission) &&
        (preferencePermission.publicDisplay !== false ||
          preferencePermission.recommendationRanking !== false ||
          preferencePermission.aiExplanation !== false)
      ) {
        add(`permissions.${field}`, 'PRIVACY', 'Candidate preferences are private eligibility inputs only.');
      }
    });
  }

  if (isRecord(value.private)) {
    const birthDate = value.private.birthDate;
    if (typeof birthDate !== 'string') {
      add('private.birthDate', 'TYPE', 'Birth date is required.');
    } else {
      try {
        const asOf = typeof value.profileAsOf === 'string' ? value.profileAsOf : currentISODate();
        const age = calculateAge(birthDate as ISODate, asOf as ISODate);
        if (age < 18) add('private.birthDate', 'ADULT_ONLY', 'Synthetic dating profiles must be adults.');
        if (isRecord(value.person) && value.person.age !== age) {
          add('person.age', 'DERIVATION', 'Age must match the private birth date at profileAsOf.');
        }
        if (isRecord(value.person) && value.person.zodiac !== calculateZodiacSign(birthDate as ISODate)) {
          add('person.zodiac', 'DERIVATION', 'Zodiac must match the private birth date.');
        }
      } catch {
        add('private.birthDate', 'DATE', 'Birth date or profileAsOf is invalid.');
      }
    }
    if (!isRecord(value.private.candidatePreferences)) {
      add('private.candidatePreferences', 'TYPE', 'Candidate preferences are required.');
    } else {
      const preferences = value.private.candidatePreferences;
      if (!Array.isArray(preferences.desiredGenders) || preferences.desiredGenders.length === 0 || preferences.desiredGenders.some((item) => !isEnumValue(SELF_GENDER4_VALUES, item))) {
        add('private.candidatePreferences.desiredGenders', 'ENUM', 'At least one valid desired gender is required.');
      }
      if (!isRecord(preferences.ageRange) || !Number.isInteger(preferences.ageRange.minimum) || !Number.isInteger(preferences.ageRange.maximum) || Number(preferences.ageRange.minimum) < 18 || Number(preferences.ageRange.maximum) > 99 || Number(preferences.ageRange.minimum) > Number(preferences.ageRange.maximum)) {
        add('private.candidatePreferences.ageRange', 'RANGE', 'Candidate age range must be ordered adult integers.');
      }
      if (!isRecord(preferences.location) || !isEnumValue(Object.values(CandidateLocationScope), preferences.location.scope) || typeof preferences.location.isHardConstraint !== 'boolean') {
        add('private.candidatePreferences.location', 'TYPE', 'Candidate location preference is invalid.');
      }
    }
  }

  if (isRecord(value.person)) {
    const person = value.person;
    if (!Array.isArray(value.person.interests) || value.person.interests.length < 5 || value.person.interests.length > 8) {
      add('person.interests', 'CARDINALITY', 'Five to eight interests are required.');
    }
    if (!Array.isArray(value.person.photos) || value.person.photos.length < 2 || value.person.photos.length > 6) {
      add('person.photos', 'CARDINALITY', 'Two to six photos are required.');
    }
    if (!Array.isArray(value.person.prompts) || value.person.prompts.length < 1 || value.person.prompts.length > 3) {
      add('person.prompts', 'CARDINALITY', 'One to three prompt answers are required.');
    }
    if (
      isEnumValue(RELATIONSHIP_GOAL5_VALUES, value.relationshipGoal) &&
      value.person.relationshipGoal !== toDomainRelationshipGoal(value.relationshipGoal)
    ) {
      add('person.relationshipGoal', 'MAPPING', 'Domain relationship goal does not match the five-value goal.');
    }
    if (Array.isArray(value.person.interests) && Array.isArray(value.focusInterests)) {
      value.focusInterests.forEach((interest, index) => {
        if (!(person.interests as unknown[]).includes(interest)) {
          add(`focusInterests[${index}]`, 'SUBSET', 'Focus interest must also be in person.interests.');
        }
      });
    }
  }

  findProhibitedSyntheticFieldPaths(value).forEach((path) => {
    add(path, 'PROHIBITED_FIELD', 'Synthetic profiles cannot contain this field.');
  });

  return issues.length === 0 ? { valid: true, issues: [] } : { valid: false, issues };
};

export const isSyntheticUserRecord = (value: unknown): value is SyntheticUserRecord =>
  validateSyntheticUserRecord(value).valid;

export interface EnumCoverage<T extends string> {
  readonly counts: Readonly<Record<T, number>>;
  readonly missing: readonly T[];
}

export interface ScaleCoverage {
  readonly counts: Readonly<Record<Scale1To5, number>>;
  readonly missing: readonly Scale1To5[];
}

export interface RelationshipDimensionCoverage {
  readonly profilesWithEvidence: number;
  readonly evidenceItems: number;
}

export interface SyntheticCoverageReport {
  readonly schemaVersion: '1.0';
  readonly totalRecords: number;
  readonly validRecords: number;
  readonly invalidRecords: number;
  readonly uniquePersonIds: number;
  readonly relationshipGoals: EnumCoverage<RelationshipGoal5>;
  readonly selfGenders: EnumCoverage<SelfGender4>;
  readonly connectionStarts: EnumCoverage<ConnectionStart>;
  readonly relationshipPaces: EnumCoverage<RelationshipPace>;
  readonly budgetBands: EnumCoverage<BudgetBand>;
  readonly spendingStyles: EnumCoverage<SpendingStyle>;
  readonly costSharingPreferences: EnumCoverage<CostSharingPreference>;
  readonly industries: EnumCoverage<Industry>;
  readonly lifestyleAxes: Readonly<Record<LifestyleAxisKey, ScaleCoverage>>;
  readonly relationshipDimensions: Readonly<
    Record<RelationshipDimension, RelationshipDimensionCoverage>
  >;
  readonly validationIssues: readonly SyntheticProfileValidationIssue[];
}

const buildEnumCoverage = <T extends string>(
  values: readonly T[],
  selected: readonly T[],
): EnumCoverage<T> => {
  const counts = Object.fromEntries(values.map((value) => [value, 0])) as Record<T, number>;
  selected.forEach((value) => {
    if (value in counts) counts[value] += 1;
  });
  return { counts, missing: values.filter((value) => counts[value] === 0) };
};

const buildScaleCoverage = (selected: readonly Scale1To5[]): ScaleCoverage => {
  const values = [1, 2, 3, 4, 5] as const;
  const counts: Record<Scale1To5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  selected.forEach((value) => { counts[value] += 1; });
  return { counts, missing: values.filter((value) => counts[value] === 0) };
};

export const createSyntheticCoverageReport = (
  records: readonly SyntheticUserRecord[],
): SyntheticCoverageReport => {
  const validationIssues = records.flatMap((record, index) => {
    const result = validateSyntheticUserRecord(record);
    return result.valid
      ? []
      : result.issues.map((issue) => ({ ...issue, path: `[${index}].${issue.path}` }));
  });
  const validRecords = records.filter((record) => validateSyntheticUserRecord(record).valid).length;
  const lifestyleAxes = Object.fromEntries(
    LIFESTYLE_AXIS_KEYS.map((axis) => [
      axis,
      buildScaleCoverage(records.map((record) => record.lifestyleAxes[axis])),
    ]),
  ) as unknown as Readonly<Record<LifestyleAxisKey, ScaleCoverage>>;
  const relationshipDimensions = Object.fromEntries(
    RELATIONSHIP_DIMENSION_VALUES.map((dimension) => {
      const evidence = records.map((record) => record.relationshipTraitEvidence[dimension]);
      return [
        dimension,
        {
          profilesWithEvidence: evidence.filter((item) => item.evidenceSources.length > 0).length,
          evidenceItems: evidence.reduce((sum, item) => sum + item.evidenceSources.length, 0),
        },
      ];
    }),
  ) as unknown as Readonly<Record<RelationshipDimension, RelationshipDimensionCoverage>>;

  return {
    schemaVersion: '1.0',
    totalRecords: records.length,
    validRecords,
    invalidRecords: records.length - validRecords,
    uniquePersonIds: new Set(records.map((record) => record.person.id)).size,
    relationshipGoals: buildEnumCoverage(
      RELATIONSHIP_GOAL5_VALUES,
      records.map((record) => record.relationshipGoal),
    ),
    selfGenders: buildEnumCoverage(
      SELF_GENDER4_VALUES,
      records.map((record) => record.selfGender),
    ),
    connectionStarts: buildEnumCoverage(
      CONNECTION_START_VALUES,
      records.map((record) => record.connectionStart),
    ),
    relationshipPaces: buildEnumCoverage(
      RELATIONSHIP_PACE_VALUES,
      records.map((record) => record.relationshipPace),
    ),
    budgetBands: buildEnumCoverage(
      BUDGET_BAND_VALUES,
      records.map((record) => record.budgetBand),
    ),
    spendingStyles: buildEnumCoverage(
      SPENDING_STYLE_VALUES,
      records.map((record) => record.spendingStyle),
    ),
    costSharingPreferences: buildEnumCoverage(
      COST_SHARING_PREFERENCE_VALUES,
      records.map((record) => record.costSharingPreference),
    ),
    industries: buildEnumCoverage(
      INDUSTRY_VALUES,
      records.map((record) => record.industry),
    ),
    lifestyleAxes,
    relationshipDimensions,
    validationIssues,
  };
};

/** Re-exported for consumers that only import the profile extension module. */
export { RelationshipDimension, ZodiacSign };
export type { ISODate, ISODateTime, MbtiType, Person, PromptAnswer };
