import { createHash } from 'node:crypto';

import { z } from 'zod';

import {
  buildRuleFallback,
  projectSafeEvidence,
  validateGeneratedExplanation,
  type ExplanationGenerator,
  type ExplanationEvidence,
  type SafeExplanationEvidence,
} from '../ai/index.js';
import type {
  ConsentRecord,
  JsonObject,
  JsonValue,
  ProfileRecord,
  RecommendationFeedback,
  RecommendationFeedbackInput,
  RecommendationJob,
  RecommendationLookup,
  RecommendationResult as StoredRecommendationResult,
  RecommendationResultWrite,
} from '../types/index.js';
import { assessEligibility } from './eligibility.js';
import { buildAuthorizedEvidence } from './evidence.js';
import { canonicalPairKey, canonicalizeUserIds } from './pair.js';
import { scoreCompatibility } from './scorer.js';
import type {
  AuthorizedEvidenceItem,
  EvidenceCandidate,
  EvidenceDimension,
  EligibilityPreferences,
  EligibilityProfile,
} from './types.js';

const DAY_MS = 86_400_000;

export interface RecommendationServiceRepositories {
  readonly profiles: {
    getByUserId(userId: string): Promise<ProfileRecord | null>;
  };
  readonly consents: {
    getByUserId(userId: string): Promise<ConsentRecord | null>;
  };
  readonly recommendations: {
    create(input: RecommendationResultWrite): Promise<StoredRecommendationResult>;
    getByResultId(resultId: string, viewerUserId?: string): Promise<StoredRecommendationResult | null>;
    getFreshByPairAndVersions(input: RecommendationLookup): Promise<StoredRecommendationResult | null>;
    markStaleByUser(userId: string, reason?: string): Promise<number>;
    enqueueJob(input: {
      jobId?: string;
      dedupeKey: string;
      leftUserId: string;
      rightUserId: string;
      payload: JsonObject;
      maxAttempts?: number;
      availableAt?: string;
    }): Promise<{ job: RecommendationJob; created: boolean }>;
    completeJob(
      jobId: string, workerId: string, resultId: string, outcome?: 'succeeded' | 'fallback',
    ): Promise<RecommendationJob>;
    completeJobWithResult(
      jobId: string, workerId: string, result: RecommendationResultWrite,
      outcome?: 'succeeded' | 'fallback',
    ): Promise<{ job: RecommendationJob; result: StoredRecommendationResult }>;
    failJob(
      jobId: string, workerId: string,
      input: { code: string; retryable: boolean; retryAt?: string },
    ): Promise<RecommendationJob>;
    addFeedback(input: RecommendationFeedbackInput): Promise<{
      feedback: RecommendationFeedback;
      duplicate: boolean;
    }>;
  };
}

export interface RecommendationServiceConfig {
  readonly rulesVersion: string;
  readonly promptVersion: string;
  readonly modelVersion: string;
  /** Allows the API to enqueue work without receiving or constructing an AI provider. */
  readonly aiRefinementEnabled?: boolean;
  readonly resultTtlMs?: number;
  readonly maxJobAttempts?: number;
}

export interface CreateRecommendationServiceOptions {
  readonly repositories: RecommendationServiceRepositories;
  readonly config: RecommendationServiceConfig;
  readonly aiProvider?: ExplanationGenerator;
  readonly now?: () => Date;
  /** Authoritative bilateral block lookup. If omitted or unavailable, access fails closed. */
  readonly isBlocked?: (leftUserId: string, rightUserId: string) => Promise<boolean>;
}

export interface RequestRecommendationInput {
  readonly viewerId: string;
  readonly candidateId: string;
  readonly locale: string;
}

export type RecommendationViewState =
  | 'PENDING'
  | 'READY'
  | 'INSUFFICIENT_EVIDENCE'
  | 'AI_DISABLED'
  | 'UNAVAILABLE';

/** Viewer-scoped DTO. It is intentionally separate from the public Person DTO. */
export interface RecommendationView {
  readonly resultId: string;
  readonly state: RecommendationViewState;
  readonly schemaVersion: '1.0';
  readonly pairKey: string;
  readonly score: JsonObject | null;
  readonly explanation: JsonObject;
  readonly evidenceCount: number;
  readonly coreEvidenceCount: number;
  readonly source: 'ai' | 'rule_fallback';
  readonly disclaimer: string;
  readonly generatedAt: string;
  readonly expiresAt: string;
  readonly [key: string]: JsonValue;
}

export interface RequestRecommendationResult {
  readonly result: RecommendationView;
  readonly queued: boolean;
}

export interface AddRecommendationFeedbackInput {
  readonly viewerId: string;
  readonly resultId: string;
  readonly idempotencyKey: string;
  readonly kind: RecommendationFeedbackInput['kind'];
  readonly evidenceId?: string;
}

export interface RecommendationFeedbackReceipt {
  readonly feedbackId: string;
  readonly duplicate: boolean;
  readonly createdAt: string;
}

export type RecommendationJobProcessResult =
  | { readonly outcome: 'succeeded'; readonly resultId: string }
  | { readonly outcome: 'fallback'; readonly resultId: string; readonly reason: string }
  | { readonly outcome: 'retrying' | 'failed'; readonly reason: string };

export interface RecommendationService {
  request(input: RequestRecommendationInput): Promise<RequestRecommendationResult>;
  getForViewer(viewerId: string, resultId: string): Promise<RecommendationView | null>;
  addFeedback(input: AddRecommendationFeedbackInput): Promise<RecommendationFeedbackReceipt | null>;
  processJob(
    job: RecommendationJob, workerId?: string, signal?: AbortSignal,
  ): Promise<RecommendationJobProcessResult>;
}

export class RecommendationEligibilityError extends Error {
  readonly code = 'CANDIDATE_NOT_ELIGIBLE';
  readonly statusCode = 404;

  constructor(readonly rejectionCodes: readonly string[]) {
    super('The requested candidate is not eligible for this viewer.');
    this.name = 'RecommendationEligibilityError';
  }
}

const jobPayloadSchema = z.object({
  schemaVersion: z.literal('1.0'),
  baseResultId: z.string().min(1),
  viewerId: z.string().min(1),
  candidateId: z.string().min(1),
  leftUserId: z.string().min(1),
  rightUserId: z.string().min(1),
  leftProfileVersion: z.number().int().nonnegative(),
  rightProfileVersion: z.number().int().nonnegative(),
  leftConsentVersion: z.number().int().nonnegative(),
  rightConsentVersion: z.number().int().nonnegative(),
  locale: z.string().min(1).max(35),
  score: z.number().int().min(0).max(100).nullable(),
  displayMode: z.enum(['numeric', 'common_points', 'insufficient']),
  evidenceCount: z.number().int().nonnegative(),
  coreEvidenceCount: z.number().int().nonnegative(),
  evidence: z.array(z.object({
    evidenceId: z.string().min(1).max(200),
    dimension: z.enum(['RELATIONSHIP', 'LIFESTYLE', 'COMMUNICATION', 'INTERESTS', 'MBTI', 'ZODIAC']),
    leftLabel: z.string().min(1).max(120),
    rightLabel: z.string().min(1).max(120),
    similarity: z.number().min(0).max(1),
  }).strict()).max(100),
}).strict();

type JobPayload = z.infer<typeof jobPayloadSchema>;

function jsonObject(value: unknown): JsonObject {
  return JSON.parse(JSON.stringify(value)) as JsonObject;
}

function normalizeLocale(locale: string): string {
  return locale.trim().toLowerCase();
}

async function isBlockedFailClosed(
  lookup: CreateRecommendationServiceOptions['isBlocked'],
  leftUserId: string,
  rightUserId: string,
): Promise<boolean> {
  if (!lookup) return true;
  try {
    return await lookup(leftUserId, rightUserId);
  } catch {
    return true;
  }
}

function persistedExplanation(explanation: unknown, locale: string): JsonObject {
  return { ...jsonObject(explanation), locale: normalizeLocale(locale) };
}

function localizedPromptVersion(promptVersion: string, locale: string): string {
  return `${promptVersion}@${normalizeLocale(locale)}`;
}

function publicExplanation(explanation: JsonObject): JsonObject {
  return Object.fromEntries(
    Object.entries(explanation).filter(([key]) => key !== '_evidenceManifest'),
  );
}

function stableHash(...values: readonly unknown[]): string {
  return createHash('sha256').update(JSON.stringify(values)).digest('hex');
}

function safeScalar(value: JsonValue | undefined): string | number | boolean | undefined {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
    ? value
    : undefined;
}

function recordValue(value: JsonValue | undefined): Record<string, JsonValue> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, JsonValue>
    : undefined;
}

function stringArray(value: JsonValue | undefined): readonly string[] | undefined {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
    ? value as string[]
    : undefined;
}

function normalizedLabel(value: string | number | boolean): string {
  return String(value).replaceAll('_', ' ').trim();
}

function exactSimilarity(left: string | number | boolean, right: string | number | boolean): number {
  return String(left).toLocaleLowerCase() === String(right).toLocaleLowerCase() ? 1 : 0;
}

function scaleSimilarity(left: number, right: number): number {
  const span = Math.max(4, Math.abs(left), Math.abs(right));
  return Math.max(0, 1 - Math.abs(left - right) / span);
}

function fieldAllowed(consent: ConsentRecord, ...fieldIds: readonly string[]): boolean {
  for (const fieldId of fieldIds) {
    const exactPolicy = consent.data.fieldPolicies.find((policy) => policy.fieldId === fieldId);
    if (exactPolicy) return exactPolicy.useForDisplayScore && exactPolicy.useForExplanation;
  }
  return false;
}

function eligibilityFieldAllowed(consent: ConsentRecord, ...fieldIds: readonly string[]): boolean {
  for (const fieldId of fieldIds) {
    const exactPolicy = consent.data.fieldPolicies.find((policy) => policy.fieldId === fieldId);
    if (exactPolicy) return exactPolicy.useForEligibility;
  }
  return false;
}

function candidate(
  pairKey: string,
  dimension: EvidenceDimension,
  sourceKey: string,
  left: string | number | boolean,
  right: string | number | boolean,
  similarity: number,
  leftConsent: ConsentRecord,
  rightConsent: ConsentRecord,
  policyIds: readonly string[],
): EvidenceCandidate {
  const leftAllowed = fieldAllowed(leftConsent, ...policyIds);
  const rightAllowed = fieldAllowed(rightConsent, ...policyIds);
  return {
    evidenceId: `ev_${stableHash(pairKey, sourceKey).slice(0, 24)}`,
    dimension,
    sourceKey,
    similarity,
    current: true,
    left: {
      safeLabel: normalizedLabel(left), safeValue: left,
      useForScore: leftAllowed, useForExplanation: leftAllowed,
    },
    right: {
      safeLabel: normalizedLabel(right), safeValue: right,
      useForScore: rightAllowed, useForExplanation: rightAllowed,
    },
  };
}

function deriveEvidenceCandidates(
  left: ProfileRecord,
  right: ProfileRecord,
  leftConsent: ConsentRecord,
  rightConsent: ConsentRecord,
  pairKey: string,
): readonly EvidenceCandidate[] {
  const items: EvidenceCandidate[] = [];
  const addCategorical = (
    dimension: EvidenceDimension, sourceKey: string,
    leftValue: string | number | boolean | undefined,
    rightValue: string | number | boolean | undefined,
    ...policyIds: readonly string[]
  ): void => {
    if (leftValue === undefined || rightValue === undefined) return;
    items.push(candidate(
      pairKey, dimension, sourceKey, leftValue, rightValue,
      typeof leftValue === 'number' && typeof rightValue === 'number'
        ? scaleSimilarity(leftValue, rightValue)
        : exactSimilarity(leftValue, rightValue),
      leftConsent, rightConsent, policyIds,
    ));
  };

  addCategorical(
    'relationship', 'relationshipGoal', left.data.relationshipGoal, right.data.relationshipGoal,
    'relationshipGoal',
  );
  const leftAttributes = left.data.attributes;
  const rightAttributes = right.data.attributes;
  addCategorical(
    'relationship', 'relationshipPace',
    safeScalar(leftAttributes.relationshipPace), safeScalar(rightAttributes.relationshipPace),
    'relationshipPace',
  );
  addCategorical(
    'relationship', 'connectionStart',
    safeScalar(leftAttributes.connectionStart), safeScalar(rightAttributes.connectionStart),
    'connectionStart',
  );

  const leftAxes = recordValue(leftAttributes.lifestyleAxes);
  const rightAxes = recordValue(rightAttributes.lifestyleAxes);
  for (const axis of ['weekendActivity', 'socialSetting', 'planningStyle', 'afterWorkSocialEnergy'] as const) {
    addCategorical(
      'lifestyle', `lifestyleAxes.${axis}`, safeScalar(leftAxes?.[axis]), safeScalar(rightAxes?.[axis]),
      `lifestyleAxes.${axis}`, 'lifestyleAxes',
    );
  }
  addCategorical(
    'communication', 'lifestyleAxes.messageCadence',
    safeScalar(leftAxes?.messageCadence), safeScalar(rightAxes?.messageCadence),
    'lifestyleAxes.messageCadence', 'lifestyleAxes',
  );
  for (const fieldId of ['communicationStyle', 'communicationCadence'] as const) {
    addCategorical(
      'communication', fieldId,
      safeScalar(leftAttributes[fieldId]), safeScalar(rightAttributes[fieldId]), fieldId,
    );
  }

  const fullInterestsAllowed = fieldAllowed(leftConsent, 'interests')
    && fieldAllowed(rightConsent, 'interests');
  const focusInterestsAllowed = fieldAllowed(leftConsent, 'focusInterests')
    && fieldAllowed(rightConsent, 'focusInterests');
  const leftFocusInterests = stringArray(leftAttributes.focusInterests);
  const rightFocusInterests = stringArray(rightAttributes.focusInterests);
  const leftInterests = focusInterestsAllowed && leftFocusInterests && rightFocusInterests
    ? leftFocusInterests
    : fullInterestsAllowed ? left.data.interests : undefined;
  const rightInterests = focusInterestsAllowed && leftFocusInterests && rightFocusInterests
    ? rightFocusInterests
    : fullInterestsAllowed ? right.data.interests : undefined;
  const interestPolicyId = focusInterestsAllowed && leftFocusInterests && rightFocusInterests
    ? 'focusInterests'
    : 'interests';
  if (leftInterests && rightInterests && leftInterests.length > 0 && rightInterests.length > 0) {
    const rightNormalized = new Set(rightInterests.map((value) => value.toLocaleLowerCase()));
    const common = [...new Set(leftInterests.filter((value) => rightNormalized.has(value.toLocaleLowerCase())))];
    const union = new Set([...leftInterests, ...rightInterests].map((value) => value.toLocaleLowerCase()));
    if (common.length > 0) {
      items.push(candidate(
        pairKey, 'interests', interestPolicyId, common.slice(0, 3).join('、'), common.slice(0, 3).join('、'),
        common.length / union.size, leftConsent, rightConsent, [interestPolicyId],
      ));
    }
  }

  if (left.data.mbti && right.data.mbti && left.data.mbti !== 'UNSURE' && right.data.mbti !== 'UNSURE') {
    const matchingLetters = [...left.data.mbti].filter((letter, index) => right.data.mbti?.[index] === letter).length;
    items.push(candidate(
      pairKey, 'mbti', 'mbti', left.data.mbti, right.data.mbti, matchingLetters / 4,
      leftConsent, rightConsent, ['mbti'],
    ));
  }
  addCategorical('zodiac', 'zodiac', left.data.zodiac, right.data.zodiac, 'zodiac');
  return items;
}

function ageAt(birthDate: string | undefined, now: Date): number | undefined {
  if (!birthDate) return undefined;
  const [year, month, day] = birthDate.split('-').map(Number);
  if (!year || !month || !day) return undefined;
  let age = now.getUTCFullYear() - year;
  if (now.getUTCMonth() + 1 < month || (now.getUTCMonth() + 1 === month && now.getUTCDate() < day)) age -= 1;
  return age;
}

function eligibilityPreferences(
  profile: ProfileRecord,
  consent: ConsentRecord,
): { readonly preferences?: EligibilityPreferences; readonly authorized: boolean } {
  const raw = recordValue(profile.data.attributes.candidatePreferences);
  if (!raw) return { authorized: true };
  const range = recordValue(raw.ageRange);
  const location = recordValue(raw.location);
  const hardLocation = location?.isHardConstraint === true;
  const hardGoal = raw.relationshipGoalIsHardConstraint === true;
  // Specific policy wins; aggregate permission is only a fallback when there is
  // no child policy. This prevents a broad allow from overriding an explicit deny.
  const ageRangeAllowed = eligibilityFieldAllowed(consent, 'candidateAgeRange', 'candidatePreferences');
  const gendersAllowed = eligibilityFieldAllowed(consent, 'desiredGenders', 'candidatePreferences');
  const locationAllowed = eligibilityFieldAllowed(consent, 'candidateLocation', 'candidatePreferences');
  const goalsAllowed = eligibilityFieldAllowed(consent, 'acceptedRelationshipGoals', 'candidatePreferences');
  const hasAgeRange = typeof range?.minimum === 'number' || typeof range?.maximum === 'number';
  const desiredGenders = stringArray(raw.desiredGenders);
  const allowedCities = hardLocation ? stringArray(location?.allowedCities) : undefined;
  const allowedGoals = hardGoal ? stringArray(raw.acceptedRelationshipGoals) : undefined;
  const authorized = (!hasAgeRange || ageRangeAllowed)
    && (!desiredGenders || gendersAllowed)
    && (!allowedCities || locationAllowed)
    && (!allowedGoals || goalsAllowed);
  const acceptedGenders = stringArray(raw.desiredGenders);
  const acceptedRegions = hardLocation ? stringArray(location?.allowedCities) : undefined;
  const acceptedRelationshipGoals = hardGoal
    ? stringArray(raw.acceptedRelationshipGoals)
    : undefined;
  return {
    authorized,
    preferences: {
      ...(typeof range?.minimum === 'number' && ageRangeAllowed ? { minAge: range.minimum } : {}),
      ...(typeof range?.maximum === 'number' && ageRangeAllowed ? { maxAge: range.maximum } : {}),
      ...(acceptedGenders && gendersAllowed ? { acceptedGenders } : {}),
      ...(acceptedRegions && locationAllowed ? { acceptedRegions } : {}),
      ...(acceptedRelationshipGoals && goalsAllowed ? { acceptedRelationshipGoals } : {}),
    },
  };
}

function eligibilityProfile(profile: ProfileRecord, consent: ConsentRecord, now: Date): EligibilityProfile {
  const personhood = profile.data.verification?.personhood;
  const ageAllowed = eligibilityFieldAllowed(consent, 'age', 'birthDate');
  const genderAllowed = eligibilityFieldAllowed(consent, 'selfGender');
  const regionAllowed = eligibilityFieldAllowed(consent, 'city');
  const relationshipGoalAllowed = eligibilityFieldAllowed(consent, 'relationshipGoal');
  const age = ageAllowed ? ageAt(profile.data.birthDate, now) : undefined;
  const preferenceProjection = eligibilityPreferences(profile, consent);
  return {
    userId: profile.userId,
    isAdult: (age ?? -1) >= 18,
    isActive: profile.data.profileStatus === 'RECOMMENDABLE',
    isVerified: personhood === 'VERIFIED',
    eligibilityConsent: ageAllowed
      && preferenceProjection.authorized
      && (profile.data.attributes.selfGender === undefined || genderAllowed)
      && (profile.data.city === undefined || regionAllowed)
      && (profile.data.relationshipGoal === undefined || relationshipGoalAllowed),
    ...(age !== undefined ? { age } : {}),
    ...(genderAllowed && typeof profile.data.attributes.selfGender === 'string'
      ? { gender: profile.data.attributes.selfGender } : {}),
    ...(regionAllowed && profile.data.city ? { region: profile.data.city } : {}),
    ...(relationshipGoalAllowed && profile.data.relationshipGoal
      ? { relationshipGoal: profile.data.relationshipGoal } : {}),
    ...(preferenceProjection.preferences ? { preferences: preferenceProjection.preferences } : {}),
  };
}

function toAiEvidence(evidence: readonly AuthorizedEvidenceItem[]): readonly ExplanationEvidence[] {
  return evidence.flatMap((item): readonly ExplanationEvidence[] => {
    const leftLabel = item.leftLabel ?? (item.leftValue === undefined ? undefined : String(item.leftValue));
    const rightLabel = item.rightLabel ?? (item.rightValue === undefined ? undefined : String(item.rightValue));
    if (!leftLabel || !rightLabel) return [];
    return [{
      evidenceId: item.evidenceId,
      dimension: item.dimension,
      sourceKey: item.sourceKey,
      leftLabel,
      rightLabel,
      similarity: item.similarity,
      scoreAllowed: true, explanationAllowed: true, current: true,
    }];
  });
}

function canonicalRecords<T extends { userId: string }>(left: T, right: T): readonly [T, T] {
  const [first] = canonicalizeUserIds(left.userId, right.userId);
  return first === left.userId ? [left, right] : [right, left];
}

function recommendationState(result: StoredRecommendationResult, pending = false): RecommendationViewState {
  if (pending) return 'PENDING';
  if (result.displayMode !== 'numeric') {
    return result.evidenceCount > 0 ? 'INSUFFICIENT_EVIDENCE' : 'AI_DISABLED';
  }
  return result.validationStatus === 'rejected' ? 'UNAVAILABLE' : 'READY';
}

function toView(result: StoredRecommendationResult, pending = false): RecommendationView {
  return {
    resultId: result.resultId,
    state: recommendationState(result, pending),
    schemaVersion: '1.0',
    pairKey: result.pairKey,
    score: result.score === null ? null : { value: result.score, label: '资料契合度' },
    explanation: publicExplanation(result.explanation),
    evidenceCount: result.evidenceCount,
    coreEvidenceCount: result.coreEvidenceCount,
    source: result.source,
    disclaimer: '仅基于双方当前授权资料，不代表成功率或对方意愿。',
    generatedAt: result.generatedAt,
    expiresAt: result.expiresAt,
  };
}

function recommendationLookup(
  viewerId: string, candidateId: string,
  leftProfile: ProfileRecord, rightProfile: ProfileRecord,
  leftConsent: ConsentRecord, rightConsent: ConsentRecord,
  rulesVersion: string, modelVersion: string, promptVersion: string, now: string,
): RecommendationLookup {
  return {
    pairKey: canonicalPairKey(leftProfile.userId, rightProfile.userId),
    viewerUserId: viewerId, candidateUserId: candidateId,
    leftProfileVersion: leftProfile.version, rightProfileVersion: rightProfile.version,
    leftConsentVersion: leftConsent.version, rightConsentVersion: rightConsent.version,
    rulesVersion, modelVersion, promptVersion, now,
  };
}

function makeResultWrite(
  input: {
    viewerId: string; candidateId: string; leftProfile: ProfileRecord; rightProfile: ProfileRecord;
    leftConsent: ConsentRecord; rightConsent: ConsentRecord; score: ReturnType<typeof scoreCompatibility>;
    safeEvidence: readonly SafeExplanationEvidence[]; authorizedEvidence: readonly AuthorizedEvidenceItem[];
    explanation: unknown; source: 'ai' | 'rule_fallback';
    validationStatus: 'approved' | 'fallback'; generatedAt: string; expiresAt: string; resultId: string;
    locale: string;
  },
  config: RecommendationServiceConfig,
): RecommendationResultWrite {
  const evidenceManifest = input.safeEvidence.map((item) => {
    const authorized = input.authorizedEvidence.find((candidate) => candidate.evidenceId === item.evidenceId);
    return {
    evidenceId: item.evidenceId,
    dimension: item.dimension,
    sourceKeyHash: stableHash(authorized?.sourceKey ?? item.evidenceId).slice(0, 24),
    snapshotHash: stableHash(item.leftLabel, item.rightLabel, item.similarity),
    leftUserId: input.leftProfile.userId,
    rightUserId: input.rightProfile.userId,
    leftFieldVersion: input.leftProfile.version,
    rightFieldVersion: input.rightProfile.version,
    leftConsentVersion: input.leftConsent.version,
    rightConsentVersion: input.rightConsent.version,
    };
  });
  return {
    resultId: input.resultId, pairKey: input.score.pairKey,
    leftUserId: input.leftProfile.userId, rightUserId: input.rightProfile.userId,
    viewerUserId: input.viewerId, candidateUserId: input.candidateId,
    leftProfileVersion: input.leftProfile.version, rightProfileVersion: input.rightProfile.version,
    leftConsentVersion: input.leftConsent.version, rightConsentVersion: input.rightConsent.version,
    rulesVersion: config.rulesVersion,
    modelVersion: input.source === 'ai' ? config.modelVersion : 'none',
    promptVersion: input.source === 'ai'
      ? localizedPromptVersion(config.promptVersion, input.locale)
      : 'none',
    score: input.score.score,
    displayMode: input.score.canDisplayNumericScore
      ? 'numeric'
      : input.score.independentEvidenceCount > 0 ? 'common_points' : 'insufficient',
    evidenceCount: input.score.independentEvidenceCount,
    coreEvidenceCount: input.score.coreEvidenceCount,
    evidenceIds: input.safeEvidence.map((item) => item.evidenceId),
    explanation: {
      ...persistedExplanation(input.explanation, input.locale),
      _evidenceManifest: jsonObject(evidenceManifest),
    },
    source: input.source,
    validationStatus: input.validationStatus, generatedAt: input.generatedAt, expiresAt: input.expiresAt,
  };
}

async function loadPair(
  repositories: RecommendationServiceRepositories, viewerId: string, candidateId: string,
): Promise<{ viewer: ProfileRecord; candidate: ProfileRecord; viewerConsent: ConsentRecord; candidateConsent: ConsentRecord }> {
  const [viewer, candidate, viewerConsent, candidateConsent] = await Promise.all([
    repositories.profiles.getByUserId(viewerId), repositories.profiles.getByUserId(candidateId),
    repositories.consents.getByUserId(viewerId), repositories.consents.getByUserId(candidateId),
  ]);
  if (!viewer || !candidate || !viewerConsent || !candidateConsent) {
    throw new RecommendationEligibilityError(['MISSING_PROFILE_OR_CONSENT']);
  }
  return { viewer, candidate, viewerConsent, candidateConsent };
}

async function createOrGetResult(
  repositories: RecommendationServiceRepositories,
  write: RecommendationResultWrite,
): Promise<StoredRecommendationResult> {
  try {
    return await repositories.recommendations.create(write);
  } catch (error) {
    const existing = await repositories.recommendations.getByResultId(write.resultId, write.viewerUserId);
    if (existing
      && existing.leftProfileVersion === write.leftProfileVersion
      && existing.rightProfileVersion === write.rightProfileVersion
      && existing.leftConsentVersion === write.leftConsentVersion
      && existing.rightConsentVersion === write.rightConsentVersion
      && existing.rulesVersion === write.rulesVersion) return existing;
    throw error;
  }
}

function rebuildEvidence(
  viewer: ProfileRecord, candidate: ProfileRecord, viewerConsent: ConsentRecord, candidateConsent: ConsentRecord,
): { leftProfile: ProfileRecord; rightProfile: ProfileRecord; leftConsent: ConsentRecord; rightConsent: ConsentRecord; authorized: readonly AuthorizedEvidenceItem[]; safe: readonly SafeExplanationEvidence[] } {
  const [leftProfile, rightProfile] = canonicalRecords(viewer, candidate);
  const [leftConsent, rightConsent] = canonicalRecords(viewerConsent, candidateConsent);
  const pairKey = canonicalPairKey(leftProfile.userId, rightProfile.userId);
  const candidates = deriveEvidenceCandidates(leftProfile, rightProfile, leftConsent, rightConsent, pairKey);
  const authorized = buildAuthorizedEvidence({
    leftConsent: leftConsent.data, rightConsent: rightConsent.data, items: candidates,
  });
  const safe = projectSafeEvidence(toAiEvidence(authorized)).evidence;
  const safeIds = new Set(safe.map((item) => item.evidenceId));
  const safeAuthorized = authorized.filter((item) => safeIds.has(item.evidenceId));
  return { leftProfile, rightProfile, leftConsent, rightConsent, authorized: safeAuthorized, safe };
}

function assertConfig(config: RecommendationServiceConfig): void {
  if (!config.rulesVersion.trim() || !config.promptVersion.trim() || !config.modelVersion.trim()) {
    throw new TypeError('rulesVersion, promptVersion, and modelVersion are required');
  }
  if (config.resultTtlMs !== undefined && (!Number.isInteger(config.resultTtlMs) || config.resultTtlMs <= 0)) {
    throw new RangeError('resultTtlMs must be a positive integer');
  }
}

export function createRecommendationService(options: CreateRecommendationServiceOptions): RecommendationService {
  assertConfig(options.config);
  const now = options.now ?? (() => new Date());
  const ttlMs = options.config.resultTtlMs ?? DAY_MS;
  const aiRefinementEnabled = options.config.aiRefinementEnabled ?? Boolean(options.aiProvider);

  const service: RecommendationService = {
    async request(input) {
      if (input.viewerId === input.candidateId) throw new RecommendationEligibilityError(['SELF_PAIR']);
      const pair = await loadPair(options.repositories, input.viewerId, input.candidateId);
      const blockedEither = await isBlockedFailClosed(options.isBlocked, input.viewerId, input.candidateId);
      const eligibility = assessEligibility({
        left: eligibilityProfile(pair.viewer, pair.viewerConsent, now()),
        right: eligibilityProfile(pair.candidate, pair.candidateConsent, now()),
        blockedEither,
      });
      if (!eligibility.eligible) throw new RecommendationEligibilityError(eligibility.rejectionCodes);

      const evidence = rebuildEvidence(pair.viewer, pair.candidate, pair.viewerConsent, pair.candidateConsent);
      const generatedAt = now();
      const lookup = recommendationLookup(
        input.viewerId, input.candidateId, evidence.leftProfile, evidence.rightProfile,
        evidence.leftConsent, evidence.rightConsent, options.config.rulesVersion,
        aiRefinementEnabled ? options.config.modelVersion : 'none',
        aiRefinementEnabled
          ? localizedPromptVersion(options.config.promptVersion, input.locale)
          : 'none',
        generatedAt.toISOString(),
      );
      const fresh = await options.repositories.recommendations.getFreshByPairAndVersions(lookup);
      const freshVersionMatches = fresh?.source === 'ai'
        ? fresh.modelVersion === options.config.modelVersion
          && fresh.promptVersion === localizedPromptVersion(options.config.promptVersion, input.locale)
        : !aiRefinementEnabled;
      if (fresh && freshVersionMatches && fresh.explanation.locale === normalizeLocale(input.locale)) {
        return { result: toView(fresh), queued: false };
      }

      const compatibility = scoreCompatibility({
        leftUserId: evidence.leftProfile.userId, rightUserId: evidence.rightProfile.userId,
        evidence: evidence.authorized,
      });
      const fallback = buildRuleFallback({ evidence: evidence.safe, locale: input.locale });
      const generationIdentity = stableHash(
        input.viewerId, input.candidateId, evidence.leftProfile.version, evidence.rightProfile.version,
        evidence.leftConsent.version, evidence.rightConsent.version, options.config.rulesVersion,
        aiRefinementEnabled ? options.config.modelVersion : 'none',
        aiRefinementEnabled ? options.config.promptVersion : 'none', normalizeLocale(input.locale),
      );
      const resultId = `rec_${generationIdentity.slice(0, 32)}`;
      const expiresAt = new Date(generatedAt.getTime() + ttlMs).toISOString();
      const persisted = await createOrGetResult(options.repositories, makeResultWrite({
        viewerId: input.viewerId, candidateId: input.candidateId,
        ...evidence, score: compatibility, safeEvidence: evidence.safe,
        authorizedEvidence: evidence.authorized, explanation: fallback,
        source: 'rule_fallback', validationStatus: 'fallback',
        generatedAt: generatedAt.toISOString(), expiresAt, resultId, locale: input.locale,
      }, options.config));

      const canQueue = aiRefinementEnabled
        && pair.viewerConsent.data.aiCompatibility && pair.candidateConsent.data.aiCompatibility
        && pair.viewerConsent.data.publicExplanation && pair.candidateConsent.data.publicExplanation
        && evidence.safe.length > 0;
      if (!canQueue) return { result: toView(persisted), queued: false };

      const payload: JobPayload = {
        schemaVersion: '1.0', baseResultId: persisted.resultId,
        viewerId: input.viewerId, candidateId: input.candidateId,
        leftUserId: evidence.leftProfile.userId, rightUserId: evidence.rightProfile.userId,
        leftProfileVersion: evidence.leftProfile.version, rightProfileVersion: evidence.rightProfile.version,
        leftConsentVersion: evidence.leftConsent.version, rightConsentVersion: evidence.rightConsent.version,
        locale: input.locale, score: compatibility.score, displayMode: persisted.displayMode,
        evidenceCount: compatibility.independentEvidenceCount, coreEvidenceCount: compatibility.coreEvidenceCount,
        evidence: [...evidence.safe],
      };
      const dedupeKey = stableHash(
        payload.viewerId, payload.candidateId, payload.leftUserId, payload.rightUserId,
        payload.leftProfileVersion, payload.rightProfileVersion,
        payload.leftConsentVersion, payload.rightConsentVersion,
        options.config.rulesVersion, options.config.modelVersion, options.config.promptVersion,
        normalizeLocale(payload.locale), payload.evidence.map((item) => item.evidenceId).sort(),
      );
      const queued = await options.repositories.recommendations.enqueueJob({
        dedupeKey, leftUserId: evidence.leftProfile.userId, rightUserId: evidence.rightProfile.userId,
        payload: jsonObject(payload), maxAttempts: options.config.maxJobAttempts ?? 3,
      });
      // The deterministic result is usable immediately. AI refinement is never
      // presented as a prerequisite or an unresolved browser-visible promise.
      return { result: toView(persisted), queued: queued.created };
    },

    async getForViewer(viewerId, resultId) {
      const stored = await options.repositories.recommendations.getByResultId(resultId, viewerId);
      if (!stored || stored.status !== 'active') return null;
      const pair = await loadPair(options.repositories, stored.viewerUserId, stored.candidateUserId).catch(() => null);
      if (!pair) return null;
      if (stored.rulesVersion !== options.config.rulesVersion || Date.parse(stored.expiresAt) <= now().getTime()) {
        return null;
      }
      const [leftProfile, rightProfile] = canonicalRecords(pair.viewer, pair.candidate);
      const [leftConsent, rightConsent] = canonicalRecords(pair.viewerConsent, pair.candidateConsent);
      if (
        leftProfile.version !== stored.leftProfileVersion || rightProfile.version !== stored.rightProfileVersion
        || leftConsent.version !== stored.leftConsentVersion || rightConsent.version !== stored.rightConsentVersion
      ) return null;
      const blockedEither = await isBlockedFailClosed(
        options.isBlocked, stored.viewerUserId, stored.candidateUserId,
      );
      const eligibility = assessEligibility({
        left: eligibilityProfile(pair.viewer, pair.viewerConsent, now()),
        right: eligibilityProfile(pair.candidate, pair.candidateConsent, now()),
        blockedEither,
      });
      if (!eligibility.eligible) return null;
      const currentEvidenceIds = new Set(
        rebuildEvidence(pair.viewer, pair.candidate, pair.viewerConsent, pair.candidateConsent)
          .safe.map((item) => item.evidenceId),
      );
      if (stored.evidenceIds.some((evidenceId) => !currentEvidenceIds.has(evidenceId))) return null;
      return toView(stored);
    },

    async addFeedback(input) {
      const result = await service.getForViewer(input.viewerId, input.resultId);
      if (!result) return null;
      const stored = await options.repositories.recommendations.getByResultId(
        input.resultId, input.viewerId,
      );
      if (!stored) return null;
      if (input.evidenceId) {
        const manifest = stored.explanation._evidenceManifest;
        const manifestIds = Array.isArray(manifest)
          ? manifest.flatMap((entry) => {
              const record = recordValue(entry);
              return typeof record?.evidenceId === 'string' ? [record.evidenceId] : [];
            })
          : [];
        if (!manifestIds.includes(input.evidenceId)) return null;
      }
      const receipt = await options.repositories.recommendations.addFeedback({
        resultId: result.resultId, viewerUserId: input.viewerId, idempotencyKey: input.idempotencyKey,
        kind: input.kind, ...(input.evidenceId ? { evidenceId: input.evidenceId } : {}),
      });
      return {
        feedbackId: receipt.feedback.feedbackId, duplicate: receipt.duplicate, createdAt: receipt.feedback.createdAt,
      };
    },

    async processJob(job, explicitWorkerId, signal) {
      const workerId = explicitWorkerId ?? job.workerId;
      if (!workerId) throw new TypeError('A claimed recommendation job must have a workerId');
      const parsed = jobPayloadSchema.safeParse(job.payload);
      if (!parsed.success) {
        await options.repositories.recommendations.failJob(job.jobId, workerId, { code: 'INVALID_JOB_PAYLOAD', retryable: false });
        return { outcome: 'failed', reason: 'INVALID_JOB_PAYLOAD' };
      }
      const payload = parsed.data;
      if (!options.aiProvider) {
        await options.repositories.recommendations.completeJob(job.jobId, workerId, payload.baseResultId, 'fallback');
        return { outcome: 'fallback', resultId: payload.baseResultId, reason: 'AI_DISABLED' };
      }

      try {
        const pair = await loadPair(options.repositories, payload.viewerId, payload.candidateId);
        const blockedEither = await isBlockedFailClosed(
          options.isBlocked, payload.viewerId, payload.candidateId,
        );
        const eligibility = assessEligibility({
          left: eligibilityProfile(pair.viewer, pair.viewerConsent, now()),
          right: eligibilityProfile(pair.candidate, pair.candidateConsent, now()),
          blockedEither,
        });
        if (!eligibility.eligible) {
          await options.repositories.recommendations.completeJob(job.jobId, workerId, payload.baseResultId, 'fallback');
          return { outcome: 'fallback', resultId: payload.baseResultId, reason: 'CANDIDATE_NO_LONGER_ELIGIBLE' };
        }
        const evidence = rebuildEvidence(pair.viewer, pair.candidate, pair.viewerConsent, pair.candidateConsent);
        const versionsMatch = evidence.leftProfile.version === payload.leftProfileVersion
          && evidence.rightProfile.version === payload.rightProfileVersion
          && evidence.leftConsent.version === payload.leftConsentVersion
          && evidence.rightConsent.version === payload.rightConsentVersion;
        const payloadIds = payload.evidence.map((item) => item.evidenceId).sort();
        const currentIds = evidence.safe.map((item) => item.evidenceId).sort();
        if (!versionsMatch || JSON.stringify(payloadIds) !== JSON.stringify(currentIds)) {
          await options.repositories.recommendations.completeJob(job.jobId, workerId, payload.baseResultId, 'fallback');
          return { outcome: 'fallback', resultId: payload.baseResultId, reason: 'STALE_OR_REVOKED_EVIDENCE' };
        }

        const generated = await options.aiProvider.generate({
          evidence: evidence.safe, locale: payload.locale, promptVersion: options.config.promptVersion,
          ...(signal ? { signal } : {}),
        });
        const validation = validateGeneratedExplanation(generated, evidence.safe);
        if (!validation.valid) {
          await options.repositories.recommendations.completeJob(job.jobId, workerId, payload.baseResultId, 'fallback');
          return { outcome: 'fallback', resultId: payload.baseResultId, reason: validation.issues[0]?.code ?? 'VALIDATION_REJECTED' };
        }

        // Re-read mutable authority after the provider call: blocking, profile
        // edits, or consent revocation during generation must prevent publish.
        const finalPair = await loadPair(options.repositories, payload.viewerId, payload.candidateId);
        const finalEvidence = rebuildEvidence(
          finalPair.viewer, finalPair.candidate, finalPair.viewerConsent, finalPair.candidateConsent,
        );
        const finallyBlocked = await isBlockedFailClosed(
          options.isBlocked, payload.viewerId, payload.candidateId,
        );
        const finalEligibility = assessEligibility({
          left: eligibilityProfile(finalPair.viewer, finalPair.viewerConsent, now()),
          right: eligibilityProfile(finalPair.candidate, finalPair.candidateConsent, now()),
          blockedEither: finallyBlocked,
        });
        const finalIds = finalEvidence.safe.map((item) => item.evidenceId).sort();
        const remainsCurrent = finalEvidence.leftProfile.version === payload.leftProfileVersion
          && finalEvidence.rightProfile.version === payload.rightProfileVersion
          && finalEvidence.leftConsent.version === payload.leftConsentVersion
          && finalEvidence.rightConsent.version === payload.rightConsentVersion
          && JSON.stringify(finalIds) === JSON.stringify(payloadIds);
        if (!finalEligibility.eligible || !remainsCurrent) {
          await options.repositories.recommendations.completeJob(
            job.jobId, workerId, payload.baseResultId, 'fallback',
          );
          return {
            outcome: 'fallback', resultId: payload.baseResultId,
            reason: finalEligibility.eligible ? 'STALE_OR_REVOKED_EVIDENCE' : 'CANDIDATE_NO_LONGER_ELIGIBLE',
          };
        }

        const compatibility = scoreCompatibility({
          leftUserId: finalEvidence.leftProfile.userId, rightUserId: finalEvidence.rightProfile.userId,
          evidence: finalEvidence.authorized,
        });
        const generatedAt = now();
        const resultId = payload.baseResultId;
        const resultWrite = makeResultWrite({
          viewerId: payload.viewerId, candidateId: payload.candidateId, ...finalEvidence,
          score: compatibility, safeEvidence: finalEvidence.safe,
          authorizedEvidence: finalEvidence.authorized,
          explanation: validation.value,
          source: 'ai', validationStatus: 'approved', generatedAt: generatedAt.toISOString(),
          expiresAt: new Date(generatedAt.getTime() + ttlMs).toISOString(), resultId,
          locale: payload.locale,
        }, options.config);
        const persisted = (await options.repositories.recommendations.completeJobWithResult(
          job.jobId, workerId, resultWrite, 'succeeded',
        )).result;
        return { outcome: 'succeeded', resultId: persisted.resultId };
      } catch (error) {
        const retryable = Boolean(error && typeof error === 'object' && 'retryable' in error && error.retryable === true);
        const reason = error instanceof Error && 'code' in error && typeof error.code === 'string'
          ? error.code : 'AI_PROCESSING_FAILED';
        const retryAt = new Date(now().getTime() + Math.min(30_000, 1_000 * 2 ** Math.max(0, job.attempts - 1))).toISOString();
        const failedJob = await options.repositories.recommendations.failJob(
          job.jobId, workerId, retryable ? { code: reason, retryable, retryAt } : { code: reason, retryable },
        );
        return { outcome: failedJob.status === 'queued' ? 'retrying' : 'failed', reason };
      }
    },
  };

  return Object.freeze(service);
}

/** Convenient worker-level function for callers that keep the service opaque. */
export function processRecommendationJob(
  service: Pick<RecommendationService, 'processJob'>,
  job: RecommendationJob,
  workerId?: string,
  signal?: AbortSignal,
): Promise<RecommendationJobProcessResult> {
  return service.processJob(job, workerId, signal);
}
