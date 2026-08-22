/**
 * RFC-first domain contract for the for U client.
 *
 * Public feed entities intentionally exclude private ranking signals, incoming
 * one-way hearts, exact meeting points, and non-consenting participants.
 */

export type ISODate = `${number}-${number}-${number}`;
export type ISODateTime = `${ISODate}T${string}`;
export type IanaTimeZone = string;

export type PersonId = `person_${string}`;
export type ActivityId = `activity_${string}`;
export type ActivityOpportunityId = `opportunity_${string}`;
export type TopicId = `topic_${string}`;
export type ThreadId = `thread_${string}`;
export type MessageId = `message_${string}`;
export type ApplicationId = `application_${string}`;
export type MatchId = `match_${string}`;
export type FeedCardId = `feed_${string}`;
export type FeedRequestId = `request_${string}`;

export type NonEmptyReadonlyArray<T> = readonly [T, ...T[]];

export enum FeedCardType {
  PERSON = 'PERSON',
  ACTIVITY = 'ACTIVITY',
  ACTIVITY_OPPORTUNITY = 'ACTIVITY_OPPORTUNITY',
  TOPIC = 'TOPIC',
}

export enum PathType {
  PERSON = 'PERSON',
  ACTIVITY = 'ACTIVITY',
  TOPIC = 'TOPIC',
}

export enum ProfileStatus {
  DRAFT = 'DRAFT',
  REVIEWING = 'REVIEWING',
  RECOMMENDABLE = 'RECOMMENDABLE',
  PAUSED = 'PAUSED',
  REJECTED = 'REJECTED',
  BANNED = 'BANNED',
  DELETED = 'DELETED',
}

export enum HeartStatus {
  ACTIVE = 'ACTIVE',
  WITHDRAWN = 'WITHDRAWN',
  EXPIRED = 'EXPIRED',
}

export enum MatchStatus {
  ACTIVE = 'ACTIVE',
  UNMATCHED = 'UNMATCHED',
}

export enum ConversationStatus {
  CREATING = 'CREATING',
  READY = 'READY',
  CLOSED = 'CLOSED',
}

export enum ActivityPublicationStatus {
  DRAFT = 'DRAFT',
  REVIEWING = 'REVIEWING',
  PUBLISHED = 'PUBLISHED',
  NEEDS_CHANGE = 'NEEDS_CHANGE',
  REJECTED = 'REJECTED',
  FROZEN = 'FROZEN',
}

export enum ActivityFulfillmentStatus {
  RECRUITING = 'RECRUITING',
  FORMED = 'FORMED',
  REFILLING = 'REFILLING',
  IN_PROGRESS = 'IN_PROGRESS',
  FINISHED = 'FINISHED',
  NOT_FORMED = 'NOT_FORMED',
  CANCELLED = 'CANCELLED',
}

export enum ActivityRecruitmentStatus {
  OPEN = 'OPEN',
  PAUSED = 'PAUSED',
  WAITLIST_ONLY = 'WAITLIST_ONLY',
  CLOSED = 'CLOSED',
}

export enum ApplicationState {
  PENDING_REVIEW = 'PENDING_REVIEW',
  NEED_MORE_INFO = 'NEED_MORE_INFO',
  WAITLISTED = 'WAITLISTED',
  REJECTED = 'REJECTED',
  SEAT_OFFERED = 'SEAT_OFFERED',
  CONFIRMED = 'CONFIRMED',
  CHECKED_IN = 'CHECKED_IN',
  ATTENDED = 'ATTENDED',
  FEEDBACK_DONE = 'FEEDBACK_DONE',
  OFFER_EXPIRED = 'OFFER_EXPIRED',
  WITHDRAWN = 'WITHDRAWN',
  REMOVED = 'REMOVED',
  ACTIVITY_CANCELLED = 'ACTIVITY_CANCELLED',
}

export interface ApplicationStateSemantics {
  readonly occupiesHold: boolean;
  readonly countsAsConfirmed: boolean;
  readonly canAccessRoom: boolean;
  readonly canViewExactLocation: boolean;
}

/** Canonical UI authorization semantics for every RFC Application state. */
export const APPLICATION_STATE_SEMANTICS = {
  [ApplicationState.PENDING_REVIEW]: {
    occupiesHold: false,
    countsAsConfirmed: false,
    canAccessRoom: false,
    canViewExactLocation: false,
  },
  [ApplicationState.NEED_MORE_INFO]: {
    occupiesHold: false,
    countsAsConfirmed: false,
    canAccessRoom: false,
    canViewExactLocation: false,
  },
  [ApplicationState.WAITLISTED]: {
    occupiesHold: false,
    countsAsConfirmed: false,
    canAccessRoom: false,
    canViewExactLocation: false,
  },
  [ApplicationState.REJECTED]: {
    occupiesHold: false,
    countsAsConfirmed: false,
    canAccessRoom: false,
    canViewExactLocation: false,
  },
  [ApplicationState.SEAT_OFFERED]: {
    occupiesHold: true,
    countsAsConfirmed: false,
    canAccessRoom: false,
    canViewExactLocation: false,
  },
  [ApplicationState.CONFIRMED]: {
    occupiesHold: false,
    countsAsConfirmed: true,
    canAccessRoom: true,
    canViewExactLocation: true,
  },
  [ApplicationState.CHECKED_IN]: {
    occupiesHold: false,
    countsAsConfirmed: true,
    canAccessRoom: true,
    canViewExactLocation: true,
  },
  [ApplicationState.ATTENDED]: {
    occupiesHold: false,
    countsAsConfirmed: true,
    canAccessRoom: true,
    canViewExactLocation: true,
  },
  [ApplicationState.FEEDBACK_DONE]: {
    occupiesHold: false,
    countsAsConfirmed: true,
    canAccessRoom: true,
    canViewExactLocation: true,
  },
  [ApplicationState.OFFER_EXPIRED]: {
    occupiesHold: false,
    countsAsConfirmed: false,
    canAccessRoom: false,
    canViewExactLocation: false,
  },
  [ApplicationState.WITHDRAWN]: {
    occupiesHold: false,
    countsAsConfirmed: false,
    canAccessRoom: false,
    canViewExactLocation: false,
  },
  [ApplicationState.REMOVED]: {
    occupiesHold: false,
    countsAsConfirmed: false,
    canAccessRoom: false,
    canViewExactLocation: false,
  },
  [ApplicationState.ACTIVITY_CANCELLED]: {
    occupiesHold: false,
    countsAsConfirmed: false,
    canAccessRoom: false,
    canViewExactLocation: false,
  },
} as const satisfies Readonly<Record<ApplicationState, ApplicationStateSemantics>>;

export const APPLICATION_STATE_TRANSITIONS = {
  [ApplicationState.PENDING_REVIEW]: [
    ApplicationState.NEED_MORE_INFO,
    ApplicationState.WAITLISTED,
    ApplicationState.REJECTED,
    ApplicationState.SEAT_OFFERED,
    ApplicationState.WITHDRAWN,
    ApplicationState.ACTIVITY_CANCELLED,
  ],
  [ApplicationState.NEED_MORE_INFO]: [
    ApplicationState.PENDING_REVIEW,
    ApplicationState.REJECTED,
    ApplicationState.WITHDRAWN,
    ApplicationState.ACTIVITY_CANCELLED,
  ],
  [ApplicationState.WAITLISTED]: [
    ApplicationState.SEAT_OFFERED,
    ApplicationState.REJECTED,
    ApplicationState.WITHDRAWN,
    ApplicationState.REMOVED,
    ApplicationState.ACTIVITY_CANCELLED,
  ],
  [ApplicationState.REJECTED]: [],
  [ApplicationState.SEAT_OFFERED]: [
    ApplicationState.CONFIRMED,
    ApplicationState.OFFER_EXPIRED,
    ApplicationState.WITHDRAWN,
    ApplicationState.ACTIVITY_CANCELLED,
  ],
  [ApplicationState.CONFIRMED]: [
    ApplicationState.CHECKED_IN,
    ApplicationState.WITHDRAWN,
    ApplicationState.REMOVED,
    ApplicationState.ACTIVITY_CANCELLED,
  ],
  [ApplicationState.CHECKED_IN]: [
    ApplicationState.ATTENDED,
    ApplicationState.REMOVED,
    ApplicationState.ACTIVITY_CANCELLED,
  ],
  [ApplicationState.ATTENDED]: [ApplicationState.FEEDBACK_DONE],
  [ApplicationState.FEEDBACK_DONE]: [],
  [ApplicationState.OFFER_EXPIRED]: [],
  [ApplicationState.WITHDRAWN]: [],
  [ApplicationState.REMOVED]: [],
  [ApplicationState.ACTIVITY_CANCELLED]: [],
} as const satisfies Readonly<Record<ApplicationState, readonly ApplicationState[]>>;

export const getApplicationStateSemantics = (
  state: ApplicationState,
): ApplicationStateSemantics => APPLICATION_STATE_SEMANTICS[state];

export enum VerificationStatus {
  UNVERIFIED = 'UNVERIFIED',
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  FAILED = 'FAILED',
}

export enum RelationshipGoal {
  LONG_TERM = 'LONG_TERM',
  SERIOUS_DATING = 'SERIOUS_DATING',
  OPEN_TO_EXPLORE = 'OPEN_TO_EXPLORE',
}

export enum MbtiType {
  INTJ = 'INTJ', INTP = 'INTP', ENTJ = 'ENTJ', ENTP = 'ENTP',
  INFJ = 'INFJ', INFP = 'INFP', ENFJ = 'ENFJ', ENFP = 'ENFP',
  ISTJ = 'ISTJ', ISFJ = 'ISFJ', ESTJ = 'ESTJ', ESFJ = 'ESFJ',
  ISTP = 'ISTP', ISFP = 'ISFP', ESTP = 'ESTP', ESFP = 'ESFP',
  UNSURE = 'UNSURE',
}

export enum ZodiacSign {
  ARIES = 'ARIES',
  TAURUS = 'TAURUS',
  GEMINI = 'GEMINI',
  CANCER = 'CANCER',
  LEO = 'LEO',
  VIRGO = 'VIRGO',
  LIBRA = 'LIBRA',
  SCORPIO = 'SCORPIO',
  SAGITTARIUS = 'SAGITTARIUS',
  CAPRICORN = 'CAPRICORN',
  AQUARIUS = 'AQUARIUS',
  PISCES = 'PISCES',
}

export interface MediaAsset {
  readonly id: `media_${string}`;
  readonly url: string;
  readonly alt: string;
  readonly width: number;
  readonly height: number;
}

export interface PromptAnswer {
  readonly prompt: string;
  readonly answer: string;
}

export interface PersonVerification {
  readonly account: VerificationStatus;
  readonly personhood: VerificationStatus;
  readonly profileReview: VerificationStatus;
}

/** Public and recommendation-safe person projection. */
export interface Person {
  readonly entityType: FeedCardType.PERSON;
  readonly id: PersonId;
  readonly entityVersion: number;
  readonly profileStatus: ProfileStatus;
  readonly displayName: string;
  readonly age: number;
  readonly city: string;
  readonly occupation: string;
  readonly bio: string;
  readonly relationshipGoal: RelationshipGoal;
  readonly mbti: MbtiType;
  readonly zodiac: ZodiacSign;
  readonly interests: NonEmptyReadonlyArray<string>;
  readonly photos: NonEmptyReadonlyArray<MediaAsset>;
  readonly prompts: readonly PromptAnswer[];
  readonly verification: PersonVerification;
}

export enum ActivityCategory {
  EXHIBITION = 'EXHIBITION',
  CITY_WALK = 'CITY_WALK',
  SPORT = 'SPORT',
  MUSIC = 'MUSIC',
  FILM = 'FILM',
  FOOD = 'FOOD',
  CRAFT = 'CRAFT',
  OUTDOOR = 'OUTDOOR',
}

export enum ActivityFormat {
  PAIR = 'PAIR',
  GROUP = 'GROUP',
}

export enum ParticipationMode {
  OPEN_JOIN = 'OPEN_JOIN',
  APPLICATION_REQUIRED = 'APPLICATION_REQUIRED',
  MATCH_FORMATION = 'MATCH_FORMATION',
}

export interface PublicLocation {
  readonly city: string;
  readonly district: string;
  readonly areaLabel: string;
  /** Exact meeting point is intentionally absent from this public DTO. */
  readonly exactLocationPolicy: 'CONFIRMED_PARTICIPANTS_ONLY';
}

export interface ActivitySchedule {
  readonly startsAt: ISODateTime;
  readonly endsAt: ISODateTime;
  readonly timeZone: IanaTimeZone;
}

export interface Money {
  readonly currency: 'CNY';
  readonly amountInMinorUnits: number;
  readonly display: string;
}

export interface ActivityCapacity {
  readonly minimum: number;
  readonly maximum: number;
  readonly confirmedCount: number;
  readonly heldCount: number;
}

export interface AuthorizedParticipantPreview {
  readonly personId: PersonId;
  readonly displayAuthorization: 'GRANTED';
  readonly role: 'ORGANIZER' | 'PARTICIPANT';
}

export interface Activity {
  readonly entityType: FeedCardType.ACTIVITY;
  readonly id: ActivityId;
  readonly entityVersion: number;
  readonly sourceOpportunityId?: ActivityOpportunityId;
  readonly title: string;
  readonly summary: string;
  readonly category: ActivityCategory;
  readonly format: ActivityFormat;
  readonly participationMode: ParticipationMode;
  readonly publicationStatus: ActivityPublicationStatus;
  readonly fulfillmentStatus: ActivityFulfillmentStatus;
  readonly recruitmentStatus: ActivityRecruitmentStatus;
  readonly organizerId: PersonId;
  readonly cover: MediaAsset;
  readonly schedule: ActivitySchedule;
  readonly publicLocation: PublicLocation;
  readonly price: Money | null;
  readonly capacity: ActivityCapacity;
  /** Only confirmed people who explicitly allowed this activity-level display. */
  readonly visibleParticipants: readonly AuthorizedParticipantPreview[];
  readonly agenda: readonly string[];
  readonly atmosphereTags: readonly string[];
  readonly safetyNotice: string;
}

export interface ActivityApplication {
  readonly id: ApplicationId;
  readonly entityVersion: number;
  readonly activityId: ActivityId;
  readonly applicantId: PersonId;
  readonly state: ApplicationState;
  readonly semantics: ApplicationStateSemantics;
  readonly submittedAt: ISODateTime;
  readonly updatedAt: ISODateTime;
  readonly offerExpiresAt?: ISODateTime;
}

export enum OpportunityOrganizerStatus {
  UNCLAIMED = 'UNCLAIMED',
  CLAIM_IN_REVIEW = 'CLAIM_IN_REVIEW',
}

export interface ActivityOpportunity {
  readonly entityType: FeedCardType.ACTIVITY_OPPORTUNITY;
  readonly id: ActivityOpportunityId;
  readonly entityVersion: number;
  readonly title: string;
  readonly summary: string;
  readonly category: ActivityCategory;
  readonly cover: MediaAsset;
  readonly publicLocation: Omit<PublicLocation, 'exactLocationPolicy'>;
  readonly suggestedTimeWindow: string;
  readonly estimatedPrice: Money | null;
  readonly organizerStatus: OpportunityOrganizerStatus;
  /** Aggregate from users who consented to contribute to a displayed count. */
  readonly authorizedInterestCount: number;
  readonly sourceLabel: string;
}

export enum TopicKind {
  RELATIONSHIP_SCENARIO = 'RELATIONSHIP_SCENARIO',
  LIFESTYLE_PROMPT = 'LIFESTYLE_PROMPT',
}

export enum TopicModerationStatus {
  PUBLISHED = 'PUBLISHED',
  LIMITED = 'LIMITED',
}

export enum RelationshipDimension {
  LOYALTY_AND_BOUNDARIES = 'LOYALTY_AND_BOUNDARIES',
  PRIVACY_AND_AUTONOMY = 'PRIVACY_AND_AUTONOMY',
  ECONOMICS_AND_RESPONSIBILITY = 'ECONOMICS_AND_RESPONSIBILITY',
  COMMUNICATION_AND_CONFLICT = 'COMMUNICATION_AND_CONFLICT',
  COMPANIONSHIP_AND_CONTACT = 'COMPANIONSHIP_AND_CONTACT',
  CAREER_AND_LIFESTYLE = 'CAREER_AND_LIFESTYLE',
  RELATIONSHIP_PACING = 'RELATIONSHIP_PACING',
  SUPPORT_AND_CARE = 'SUPPORT_AND_CARE',
}

export interface TopicOption {
  readonly id: string;
  readonly label: string;
}

export interface TopicReasonOption extends TopicOption {
  readonly dimension: RelationshipDimension;
}

interface TopicBase {
  readonly entityType: FeedCardType.TOPIC;
  readonly id: TopicId;
  readonly entityVersion: number;
  readonly title: string;
  readonly summary: string;
  readonly cover: MediaAsset;
  readonly moderationStatus: TopicModerationStatus;
  readonly replyCount: number;
  readonly lastActivityAt: ISODateTime;
  readonly tags: NonEmptyReadonlyArray<string>;
}

export interface RelationshipTopic extends TopicBase {
  readonly kind: TopicKind.RELATIONSHIP_SCENARIO;
  readonly scenario: string;
  readonly primaryDimension: RelationshipDimension;
  readonly positionOptions: NonEmptyReadonlyArray<TopicOption>;
  readonly reasonOptionsByPosition: Readonly<Record<string, readonly TopicReasonOption[]>>;
}

export interface LifestyleTopic extends TopicBase {
  readonly kind: TopicKind.LIFESTYLE_PROMPT;
  readonly prompt: string;
  readonly openingQuestion: string;
}

export type Topic = RelationshipTopic | LifestyleTopic;

export enum FeedAction {
  VIEW_DETAIL = 'VIEW_DETAIL',
  HEART_PERSON = 'HEART_PERSON',
  SAVE = 'SAVE',
  HIDE = 'HIDE',
  REPORT = 'REPORT',
  JOIN_ACTIVITY = 'JOIN_ACTIVITY',
  APPLY_TO_ACTIVITY = 'APPLY_TO_ACTIVITY',
  WITHDRAW_APPLICATION = 'WITHDRAW_APPLICATION',
  LEAVE_ACTIVITY = 'LEAVE_ACTIVITY',
  EXPRESS_INTEREST = 'EXPRESS_INTEREST',
  START_ACTIVITY = 'START_ACTIVITY',
  VOTE = 'VOTE',
  JOIN_DISCUSSION = 'JOIN_DISCUSSION',
}

export type PersonFeedAction =
  | FeedAction.VIEW_DETAIL
  | FeedAction.HEART_PERSON
  | FeedAction.HIDE
  | FeedAction.REPORT;

export type ActivityFeedAction =
  | FeedAction.VIEW_DETAIL
  | FeedAction.SAVE
  | FeedAction.JOIN_ACTIVITY
  | FeedAction.APPLY_TO_ACTIVITY
  | FeedAction.WITHDRAW_APPLICATION
  | FeedAction.LEAVE_ACTIVITY
  | FeedAction.HIDE
  | FeedAction.REPORT;

export type ActivityOpportunityFeedAction =
  | FeedAction.VIEW_DETAIL
  | FeedAction.SAVE
  | FeedAction.EXPRESS_INTEREST
  | FeedAction.START_ACTIVITY
  | FeedAction.HIDE
  | FeedAction.REPORT;

export type TopicFeedAction =
  | FeedAction.VIEW_DETAIL
  | FeedAction.SAVE
  | FeedAction.VOTE
  | FeedAction.JOIN_DISCUSSION
  | FeedAction.HIDE
  | FeedAction.REPORT;

export enum FeedReasonCode {
  SHARED_INTEREST = 'SHARED_INTEREST',
  SCHEDULE_FIT = 'SCHEDULE_FIT',
  NEARBY_AREA = 'NEARBY_AREA',
  FRESH_DISCUSSION = 'FRESH_DISCUSSION',
  INTEREST_EXPLORATION = 'INTEREST_EXPLORATION',
}

export interface FeedReason {
  readonly code: FeedReasonCode;
  readonly headline: string;
  readonly explanation: string;
  readonly evidenceLabels: readonly string[];
}

export enum FeedPresentationTemplate {
  PERSON_PORTRAIT = 'PERSON_PORTRAIT',
  ACTIVITY_EDITORIAL = 'ACTIVITY_EDITORIAL',
  OPPORTUNITY_EDITORIAL = 'OPPORTUNITY_EDITORIAL',
  TOPIC_CONVERSATION = 'TOPIC_CONVERSATION',
}

export interface PresentationBadge {
  readonly label: string;
  readonly tone: 'NEUTRAL' | 'ACCENT' | 'POSITIVE' | 'WARNING';
}

export interface PresentationFact {
  readonly label: string;
  readonly value: string;
}

export interface FeedPresentation {
  readonly template: FeedPresentationTemplate;
  readonly image: MediaAsset;
  readonly eyebrow: string;
  readonly headline: string;
  readonly supportingText: string;
  readonly badges: readonly PresentationBadge[];
  readonly facts: readonly PresentationFact[];
  readonly primaryActionLabel: string;
}

interface FeedCardEnvelope<
  TCardType extends FeedCardType,
  TPathType extends PathType,
  TEntityId extends string,
  TAction extends FeedAction,
> {
  readonly schemaVersion: '1.0';
  readonly cardId: FeedCardId;
  readonly cardType: TCardType;
  readonly pathType: TPathType;
  readonly entityId: TEntityId;
  readonly entityVersion: number;
  readonly requestId: FeedRequestId;
  /** One-based position in the returned feed request. */
  readonly rankPosition: number;
  readonly reason: FeedReason;
  readonly expiresAt: ISODateTime;
  readonly presentation: FeedPresentation;
  /** Server-derived capabilities; clients must not infer these from statuses. */
  readonly allowedActions: readonly TAction[];
}

export type PersonFeedCard = FeedCardEnvelope<
  FeedCardType.PERSON,
  PathType.PERSON,
  PersonId,
  PersonFeedAction
>;

export type ActivityFeedCard = FeedCardEnvelope<
  FeedCardType.ACTIVITY,
  PathType.ACTIVITY,
  ActivityId,
  ActivityFeedAction
>;

export type ActivityOpportunityFeedCard = FeedCardEnvelope<
  FeedCardType.ACTIVITY_OPPORTUNITY,
  PathType.ACTIVITY,
  ActivityOpportunityId,
  ActivityOpportunityFeedAction
>;

export type TopicFeedCard = FeedCardEnvelope<
  FeedCardType.TOPIC,
  PathType.TOPIC,
  TopicId,
  TopicFeedAction
>;

export type FeedCard =
  | PersonFeedCard
  | ActivityFeedCard
  | ActivityOpportunityFeedCard
  | TopicFeedCard;

export type FeedEntity = Person | Activity | ActivityOpportunity | Topic;

export enum ThreadKind {
  MATCH = 'MATCH',
  ACTIVITY = 'ACTIVITY',
  TOPIC_DISCUSSION = 'TOPIC_DISCUSSION',
}

export enum ThreadAction {
  SEND_MESSAGE = 'SEND_MESSAGE',
  VIEW_PROFILE = 'VIEW_PROFILE',
  VIEW_ACTIVITY = 'VIEW_ACTIVITY',
  VIEW_TOPIC = 'VIEW_TOPIC',
  LEAVE = 'LEAVE',
  UNMATCH = 'UNMATCH',
  BLOCK = 'BLOCK',
  REPORT = 'REPORT',
}

export enum ActivityRoomStatus {
  OPEN = 'OPEN',
  READ_ONLY = 'READ_ONLY',
  CLOSED = 'CLOSED',
}

export enum TopicDiscussionStatus {
  ACTIVE = 'ACTIVE',
  TEMPORARILY_LEFT = 'TEMPORARILY_LEFT',
  ENDED = 'ENDED',
  CONVERTED_TO_MATCH = 'CONVERTED_TO_MATCH',
  BLOCKED = 'BLOCKED',
}

interface ThreadBase {
  readonly id: ThreadId;
  readonly entityVersion: number;
  readonly title: string;
  readonly participantIds: NonEmptyReadonlyArray<PersonId>;
  readonly messageIds: readonly MessageId[];
  readonly createdAt: ISODateTime;
  readonly updatedAt: ISODateTime;
  readonly unreadCount: number;
  readonly allowedActions: readonly ThreadAction[];
}

export interface MatchThread extends ThreadBase {
  readonly kind: ThreadKind.MATCH;
  readonly matchId: MatchId;
  readonly matchStatus: MatchStatus;
  readonly conversationStatus: ConversationStatus;
}

export interface ActivityThread extends ThreadBase {
  readonly kind: ThreadKind.ACTIVITY;
  readonly activityId: ActivityId;
  readonly membershipApplicationId: ApplicationId;
  readonly roomStatus: ActivityRoomStatus;
}

export enum DiscussionMatchMode {
  SAME_POSITION_SAME_REASON = 'SAME_POSITION_SAME_REASON',
  SAME_POSITION_DIFFERENT_REASON = 'SAME_POSITION_DIFFERENT_REASON',
  DIFFERENT_POSITION_SHARED_VALUE = 'DIFFERENT_POSITION_SHARED_VALUE',
}

export interface TopicDiscussionThread extends ThreadBase {
  readonly kind: ThreadKind.TOPIC_DISCUSSION;
  readonly topicId: TopicId;
  readonly discussionStatus: TopicDiscussionStatus;
  readonly matchMode: DiscussionMatchMode;
  readonly expiresAt: ISODateTime;
}

export type Thread = MatchThread | ActivityThread | TopicDiscussionThread;

export enum MessageKind {
  TEXT = 'TEXT',
  SYSTEM = 'SYSTEM',
  ICEBREAKER_SUGGESTION = 'ICEBREAKER_SUGGESTION',
  STRUCTURED_PROMPT = 'STRUCTURED_PROMPT',
  ACTIVITY_UPDATE = 'ACTIVITY_UPDATE',
}

export enum MessageDeliveryStatus {
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  READ = 'READ',
  FAILED = 'FAILED',
}

interface MessageBase {
  readonly id: MessageId;
  readonly threadId: ThreadId;
  readonly createdAt: ISODateTime;
  readonly deliveryStatus: MessageDeliveryStatus;
}

export interface TextMessage extends MessageBase {
  readonly kind: MessageKind.TEXT;
  readonly senderId: PersonId;
  readonly text: string;
}

export interface SystemMessage extends MessageBase {
  readonly kind: MessageKind.SYSTEM;
  readonly senderId: null;
  readonly event: 'MATCH_CREATED' | 'THREAD_OPENED' | 'THREAD_CLOSED' | 'SAFETY_REMINDER';
  readonly text: string;
}

export interface IcebreakerSuggestion extends MessageBase {
  readonly kind: MessageKind.ICEBREAKER_SUGGESTION;
  readonly senderId: null;
  readonly text: string;
  readonly sentOnBehalfOfUser: false;
}

export interface StructuredPromptMessage extends MessageBase {
  readonly kind: MessageKind.STRUCTURED_PROMPT;
  readonly senderId: null;
  readonly promptStage: 'OPENING' | 'UNDERSTANDING' | 'CONDITION' | 'REFLECTION' | 'CLOSING';
  readonly text: string;
}

export interface ActivityUpdateMessage extends MessageBase {
  readonly kind: MessageKind.ACTIVITY_UPDATE;
  readonly senderId: null;
  readonly activityId: ActivityId;
  readonly text: string;
}

export type Message =
  | TextMessage
  | SystemMessage
  | IcebreakerSuggestion
  | StructuredPromptMessage
  | ActivityUpdateMessage;

export interface CurrentUserPrivacySettings {
  readonly showAge: boolean;
  readonly showZodiac: boolean;
  readonly showInConfirmedParticipantLists: boolean;
  readonly exactLocationSharing: 'CONFIRMED_ACTIVITY_ONLY';
  readonly lockScreenMessagePreview: 'HIDDEN';
}

export interface CurrentUser {
  readonly profile: Person;
  readonly account: {
    readonly emailVerified: boolean;
    readonly phoneVerified: boolean;
  };
  readonly consent: {
    readonly aiCompatibility: boolean;
    readonly publicExplanation: boolean;
    readonly version: string;
    readonly updatedAt: ISODateTime;
  };
  readonly privacy: CurrentUserPrivacySettings;
  readonly stats: {
    readonly savedActivityCount: number;
    readonly activeActivityCount: number;
    readonly unreadThreadCount: number;
  };
}
