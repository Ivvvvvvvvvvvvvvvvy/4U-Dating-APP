import type {
  AppendEventsInput,
  AppendEventsResult,
  ConsentRecord,
  ConsentUpsertInput,
  JsonValue,
  ProfileRecord,
  ProfileUpsertInput,
  ExpressHeartInput,
  HeartMutationReceipt,
  HeartView,
  MatchView,
  UnmatchInput,
  UnmatchReceipt,
  WithdrawHeartInput,
} from '../types/index.js';

export type { JsonObject, JsonPrimitive, JsonValue } from '../types/index.js';

export interface AiFieldPolicy {
  readonly fieldId: string;
  readonly useForEligibility: boolean;
  readonly useForRanking: boolean;
  readonly useForDisplayScore: boolean;
  readonly useForExplanation: boolean;
}

export type RecommendationState =
  | 'PENDING'
  | 'READY'
  | 'INSUFFICIENT_EVIDENCE'
  | 'AI_DISABLED'
  | 'UNAVAILABLE';

export interface RecommendationResult {
  readonly resultId: string;
  readonly state: RecommendationState;
  readonly [key: string]: JsonValue;
}

export interface RequestRecommendationInput {
  readonly viewerId: string;
  readonly candidateId: string;
  readonly locale: string;
}

export interface RequestRecommendationResult {
  readonly result: RecommendationResult;
  /** True only when an AI refinement was queued after persisting a safe base result. */
  readonly queued: boolean;
}

export type RecommendationFeedbackKind =
  | 'INACCURATE_REASON'
  | 'UNCOMFORTABLE'
  | 'DO_NOT_USE_MY_FACT'
  | 'NOT_HELPFUL';

export interface AddRecommendationFeedbackInput {
  readonly viewerId: string;
  readonly resultId: string;
  readonly idempotencyKey: string;
  readonly kind: RecommendationFeedbackKind;
  readonly evidenceId?: string;
}

export interface RecommendationFeedbackReceipt {
  readonly feedbackId: string;
  readonly duplicate: boolean;
  readonly createdAt: string;
}

export interface ApiServices {
  /** Throws or resolves false while required dependencies are unavailable. */
  readonly readiness: () => Promise<boolean>;
  readonly events: {
    appendBatch(input: AppendEventsInput): Promise<AppendEventsResult>;
    readAfter(input: {
      userId: string;
      cursor?: string;
      limit?: number;
      aggregateType?: string;
      aggregateId?: string;
    }): Promise<readonly {
      readonly eventId: string;
      readonly aggregateType: string;
      readonly aggregateId: string;
      readonly aggregateVersion: number;
      readonly globalPosition: string;
      readonly eventType: string;
      readonly actorUserId: string;
      readonly payload: import('../types/index.js').JsonObject;
      readonly metadata: import('../types/index.js').JsonObject;
      readonly occurredAt: string;
      readonly recordedAt: string;
    }[]>;
  };
  readonly profiles: {
    getByUserId(userId: string): Promise<ProfileRecord | null>;
    updateByUserId(input: ProfileUpsertInput): Promise<ProfileRecord>;
  };
  readonly consents: {
    getByUserId(userId: string): Promise<ConsentRecord | null>;
    updateByUserId(input: ConsentUpsertInput): Promise<ConsentRecord>;
  };
  readonly blocks: {
    get(blockerUserId: string, blockedUserId: string): Promise<import('../types/index.js').UserBlock | null>;
    listByBlocker(blockerUserId: string, limit?: number): Promise<readonly import('../types/index.js').UserBlock[]>;
    set(input: import('../types/index.js').SetUserBlockInput): Promise<import('../types/index.js').UserBlock>;
    remove(input: import('../types/index.js').RemoveUserBlockInput): Promise<{ removed: boolean; version: number }>;
  };
  readonly relationships: {
    expressHeart(input: ExpressHeartInput): Promise<HeartMutationReceipt>;
    withdrawHeart(input: WithdrawHeartInput): Promise<HeartMutationReceipt>;
    getOutgoingHeart(actorUserId: string, targetUserId: string): Promise<HeartView | null>;
    listOutgoingHearts(
      actorUserId: string, options?: { readonly limit?: number },
    ): Promise<readonly HeartView[]>;
    getMatch(viewerUserId: string, matchId: string): Promise<MatchView | null>;
    listMatches(
      viewerUserId: string, options?: { readonly limit?: number },
    ): Promise<readonly MatchView[]>;
    unmatch(input: UnmatchInput): Promise<UnmatchReceipt | null>;
  };
  readonly recommendations: {
    /** Loads authoritative profiles/consents, persists a deterministic result, then may queue AI. */
    request(input: RequestRecommendationInput): Promise<RequestRecommendationResult>;
    /** Must enforce viewer ownership and return null for absent or cross-viewer result IDs. */
    getForViewer(viewerId: string, resultId: string): Promise<RecommendationResult | null>;
    /** Must enforce viewer ownership and return null for absent or cross-viewer result IDs. */
    addFeedback(input: AddRecommendationFeedbackInput): Promise<RecommendationFeedbackReceipt | null>;
  };
}
