import { canonicalPairKey, canonicalizeUserIds } from './pair.js';
import { ELIGIBILITY_REJECTION_CODES } from './types.js';
import type {
  AssessEligibilityInput,
  EligibilityAssessment,
  EligibilityPreferences,
  EligibilityProfile,
  EligibilityRejection,
  EligibilityRejectionCode,
} from './types.js';

const rejectionOrder = new Map<EligibilityRejectionCode, number>(
  ELIGIBILITY_REJECTION_CODES.map((code, index) => [code, index]),
);

function validateProfile(profile: EligibilityProfile, name: string): void {
  if (!profile.userId || profile.userId.trim() !== profile.userId) {
    throw new TypeError(`${name}.userId must be a non-empty, trimmed string`);
  }
  if (profile.age !== undefined && (!Number.isInteger(profile.age) || profile.age < 0)) {
    throw new RangeError(`${name}.age must be a non-negative integer`);
  }

  const { minAge, maxAge } = profile.preferences ?? {};
  if (minAge !== undefined && (!Number.isInteger(minAge) || minAge < 0)) {
    throw new RangeError(`${name}.preferences.minAge must be a non-negative integer`);
  }
  if (maxAge !== undefined && (!Number.isInteger(maxAge) || maxAge < 0)) {
    throw new RangeError(`${name}.preferences.maxAge must be a non-negative integer`);
  }
  if (minAge !== undefined && maxAge !== undefined && minAge > maxAge) {
    throw new RangeError(`${name}.preferences.minAge must not exceed maxAge`);
  }
}

function addUserRejection(
  rejections: EligibilityRejection[],
  code: EligibilityRejectionCode,
  user: EligibilityProfile,
  counterparty?: EligibilityProfile,
): void {
  rejections.push({
    code,
    userId: user.userId,
    ...(counterparty ? { counterpartyUserId: counterparty.userId } : {}),
  });
}

function isOutsideAgePreference(
  preferences: EligibilityPreferences | undefined,
  candidateAge: number | undefined,
): boolean {
  if (preferences?.minAge === undefined && preferences?.maxAge === undefined) return false;
  if (candidateAge === undefined) return true;
  return (preferences.minAge !== undefined && candidateAge < preferences.minAge)
    || (preferences.maxAge !== undefined && candidateAge > preferences.maxAge);
}

function rejectsAllowedValue(
  accepted: readonly string[] | undefined,
  candidateValue: string | undefined,
): boolean {
  if (accepted === undefined) return false;
  if (candidateValue === undefined) return true;
  return !accepted.includes(candidateValue);
}

function assessPreferenceDirection(
  selector: EligibilityProfile,
  candidate: EligibilityProfile,
  rejections: EligibilityRejection[],
): void {
  const preferences = selector.preferences;
  if (isOutsideAgePreference(preferences, candidate.age)) {
    addUserRejection(rejections, 'AGE_MISMATCH', selector, candidate);
  }
  if (rejectsAllowedValue(preferences?.acceptedGenders, candidate.gender)) {
    addUserRejection(rejections, 'GENDER_MISMATCH', selector, candidate);
  }
  if (rejectsAllowedValue(preferences?.acceptedRegions, candidate.region)) {
    addUserRejection(rejections, 'REGION_MISMATCH', selector, candidate);
  }
  if (rejectsAllowedValue(
    preferences?.acceptedRelationshipGoals,
    candidate.relationshipGoal,
  )) {
    addUserRejection(rejections, 'RELATIONSHIP_GOAL_MISMATCH', selector, candidate);
  }
}

function compareRejections(left: EligibilityRejection, right: EligibilityRejection): number {
  return (rejectionOrder.get(left.code) ?? Number.MAX_SAFE_INTEGER)
      - (rejectionOrder.get(right.code) ?? Number.MAX_SAFE_INTEGER)
    || (left.userId ?? '').localeCompare(right.userId ?? '', 'en')
    || (left.counterpartyUserId ?? '').localeCompare(right.counterpartyUserId ?? '', 'en');
}

/** Evaluates hard gates and both preference directions without computing compatibility. */
export function assessEligibility(input: AssessEligibilityInput): EligibilityAssessment {
  validateProfile(input.left, 'left');
  validateProfile(input.right, 'right');

  const rejections: EligibilityRejection[] = [];
  if (input.left.userId === input.right.userId) {
    rejections.push({ code: 'SELF_PAIR' });
  }

  for (const profile of [input.left, input.right]) {
    if (!profile.isAdult) addUserRejection(rejections, 'UNDERAGE', profile);
    if (!profile.isActive) addUserRejection(rejections, 'INACTIVE', profile);
    if (!profile.isVerified) addUserRejection(rejections, 'UNVERIFIED', profile);
    if (!profile.eligibilityConsent) {
      addUserRejection(rejections, 'MISSING_ELIGIBILITY_CONSENT', profile);
    }
  }

  assessPreferenceDirection(input.left, input.right, rejections);
  assessPreferenceDirection(input.right, input.left, rejections);

  if (input.blockedEither === true) rejections.push({ code: 'BLOCKED' });
  if (input.left.blockedEither === true) {
    addUserRejection(rejections, 'BLOCKED', input.left, input.right);
  }
  if (input.right.blockedEither === true) {
    addUserRejection(rejections, 'BLOCKED', input.right, input.left);
  }
  if (input.left.blockedUserIds?.includes(input.right.userId)) {
    addUserRejection(rejections, 'BLOCKED', input.left, input.right);
  }
  if (input.right.blockedUserIds?.includes(input.left.userId)) {
    addUserRejection(rejections, 'BLOCKED', input.right, input.left);
  }

  rejections.sort(compareRejections);
  const rejectionCodes = ELIGIBILITY_REJECTION_CODES.filter(
    (code) => rejections.some((rejection) => rejection.code === code),
  );

  return {
    pairKey: canonicalPairKey(input.left.userId, input.right.userId),
    canonicalUserIds: canonicalizeUserIds(input.left.userId, input.right.userId),
    eligible: rejectionCodes.length === 0,
    rejectionCodes,
    rejections,
  };
}
