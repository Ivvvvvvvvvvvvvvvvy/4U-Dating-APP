import assert from 'node:assert/strict';
import test from 'node:test';

import {
  COMPATIBILITY_WEIGHTS,
  assessEligibility,
  buildAuthorizedEvidence,
  canonicalPairKey,
  canonicalizeUserIds,
  scoreCompatibility,
} from '../src/recommendations/index.js';
import type {
  AuthorizedEvidenceItem,
  EligibilityProfile,
  EvidenceCandidate,
  EvidenceDimension,
  EvidenceProfileConsent,
} from '../src/recommendations/index.js';

const publicAiConsent: EvidenceProfileConsent = {
  aiCompatibility: true,
  publicExplanation: true,
};

function candidate(
  evidenceId: string,
  dimension: EvidenceDimension,
  sourceKey: string,
  similarity: number,
): EvidenceCandidate {
  return {
    evidenceId,
    dimension,
    sourceKey,
    similarity,
    left: {
      safeLabel: `left ${evidenceId}`,
      safeValue: [`left-${evidenceId}`],
      useForScore: true,
      useForExplanation: true,
    },
    right: {
      safeLabel: `right ${evidenceId}`,
      safeValue: [`right-${evidenceId}`],
      useForScore: true,
      useForExplanation: true,
    },
  };
}

function authorize(items: readonly EvidenceCandidate[]): readonly AuthorizedEvidenceItem[] {
  return buildAuthorizedEvidence({
    leftConsent: publicAiConsent,
    rightConsent: publicAiConsent,
    items,
  });
}

function eligibleProfile(
  userId: string,
  overrides: Partial<EligibilityProfile> = {},
): EligibilityProfile {
  return {
    userId,
    isAdult: true,
    isActive: true,
    isVerified: true,
    eligibilityConsent: true,
    age: 28,
    gender: 'woman',
    region: 'shanghai',
    relationshipGoal: 'long-term',
    ...overrides,
  };
}

test('uses the exact compatibility weights and keeps them immutable', () => {
  assert.deepEqual(COMPATIBILITY_WEIGHTS, {
    relationship: 35,
    lifestyle: 25,
    communication: 20,
    interests: 15,
    mbti: 5,
    zodiac: 0,
  });
  assert.equal(
    Object.values(COMPATIBILITY_WEIGHTS).reduce((sum, weight) => sum + weight, 0),
    100,
  );
  assert.equal(Object.isFrozen(COMPATIBILITY_WEIGHTS), true);
});

test('uses the repository-compatible canonical pair identity for either input order', () => {
  assert.deepEqual(canonicalizeUserIds('person_Z', 'person_a'), ['person_a', 'person_Z']);
  assert.equal(canonicalPairKey('person_Z', 'person_a'), '8:person_a|8:person_Z');
  assert.equal(
    canonicalPairKey('person_a', 'person_Z'),
    canonicalPairKey('person_Z', 'person_a'),
  );
});

test('buildAuthorizedEvidence requires bilateral profile and item permissions', () => {
  const allowed = candidate('ev_allowed', 'relationship', 'relationship.goal', 0.9);
  const deniedForScore = {
    ...candidate('ev_score_denied', 'lifestyle', 'lifestyle.weekend', 0.8),
    right: {
      ...candidate('unused', 'lifestyle', 'unused', 0).right,
      useForScore: false,
    },
  };
  const deniedForExplanation = {
    ...candidate('ev_explanation_denied', 'communication', 'communication.conflict', 0.7),
    left: {
      ...candidate('unused', 'communication', 'unused', 0).left,
      useForExplanation: false,
    },
  };
  const stale = {
    ...candidate('ev_stale', 'interests', 'interests.focus', 0.6),
    current: false,
  };
  const input = [allowed, deniedForScore, deniedForExplanation, stale] as const;

  const authorized = authorize(input);
  assert.equal(authorized.length, 1);
  assert.deepEqual(authorized[0], {
    id: 'ev_allowed',
    evidenceId: 'ev_allowed',
    dimension: 'relationship',
    sourceKey: 'relationship.goal',
    similarity: 0.9,
    left: { safeLabel: 'left ev_allowed', safeValue: ['left-ev_allowed'] },
    right: { safeLabel: 'right ev_allowed', safeValue: ['right-ev_allowed'] },
    leftLabel: 'left ev_allowed',
    rightLabel: 'right ev_allowed',
    leftValue: ['left-ev_allowed'],
    rightValue: ['right-ev_allowed'],
    scoreAllowed: true,
    explanationAllowed: true,
    scoreAuthorized: true,
    explanationAuthorized: true,
    authorized: true,
    explainable: true,
    current: true,
  });
  assert.equal(input[0].left.safeLabel, 'left ev_allowed');

  assert.deepEqual(buildAuthorizedEvidence({
    leftConsent: { ...publicAiConsent, publicExplanation: false },
    rightConsent: publicAiConsent,
    items: [allowed],
  }), []);
  assert.deepEqual(buildAuthorizedEvidence({
    leftConsent: publicAiConsent,
    rightConsent: { ...publicAiConsent, aiCompatibility: false },
    items: [allowed],
  }), []);
});

test('rejects duplicate authorized evidence IDs before they can inflate independent sources', () => {
  const duplicateAcrossSources = [
    candidate('duplicate', 'relationship', 'source.1', 0.9),
    candidate('duplicate', 'lifestyle', 'source.2', 0.8),
  ];

  assert.throws(
    () => authorize(duplicateAcrossSources),
    /Duplicate authorized evidenceId: duplicate/,
  );

  const first = authorize([duplicateAcrossSources[0] as EvidenceCandidate])[0];
  const second = authorize([{
    ...(duplicateAcrossSources[1] as EvidenceCandidate),
    evidenceId: 'temporary-unique-id',
  }])[0];
  assert.ok(first);
  assert.ok(second);
  const forgedDuplicate = { ...second, id: first.id, evidenceId: first.evidenceId };

  assert.throws(
    () => scoreCompatibility({
      leftUserId: 'person_a',
      rightUserId: 'person_b',
      evidence: [first, forgedDuplicate],
    }),
    /Duplicate authorized evidenceId: duplicate/,
  );
});

test('scores exact weighted dimensions and reports dimension invariants', () => {
  const evidence = authorize([
    candidate('relationship', 'relationship', 'source.relationship', 1),
    candidate('lifestyle', 'lifestyle', 'source.lifestyle', 0.8),
    candidate('communication', 'communication', 'source.communication', 0.6),
    candidate('interests', 'interests', 'source.interests', 0.4),
    candidate('mbti', 'mbti', 'source.mbti', 0.2),
    candidate('zodiac', 'zodiac', 'source.zodiac', 1),
  ]);

  const result = scoreCompatibility({
    leftUserId: 'person_b',
    rightUserId: 'person_a',
    evidence,
  });

  assert.equal(result.score, 74);
  assert.equal(result.availableWeight, 100);
  assert.equal(result.canDisplayNumericScore, true);
  assert.equal(result.displayReason, 'SUFFICIENT_EVIDENCE');
  assert.deepEqual(result.canonicalUserIds, ['person_a', 'person_b']);
  assert.equal(result.pairKey, '8:person_a|8:person_b');
  assert.equal(result.dimensionScores.relationship.weightedPoints, 35);
  assert.equal(result.dimensionScores.lifestyle.weightedPoints, 20);
  assert.equal(result.dimensionScores.communication.weightedPoints, 12);
  assert.equal(result.dimensionScores.interests.weightedPoints, 6);
  assert.equal(result.dimensionScores.mbti.weightedPoints, 1);
  assert.equal(result.dimensionScores.zodiac.weightedPoints, 0);
  assert.equal(result.dimensionScores.zodiac.includedInScore, false);
});

test('is symmetric and deterministic across user, evidence, and side order', () => {
  const forwardCandidates = [
    candidate('rel', 'relationship', 'source.3', 0.9),
    candidate('life', 'lifestyle', 'source.1', 0.4),
    candidate('talk', 'communication', 'source.2', 0.7),
  ] as const;
  const reverseCandidates = [...forwardCandidates].reverse().map((item) => ({
    ...item,
    left: item.right,
    right: item.left,
  }));

  const forward = scoreCompatibility({
    leftUserId: 'person_a',
    rightUserId: 'person_b',
    evidence: authorize(forwardCandidates),
  });
  const reverse = scoreCompatibility({
    leftUserId: 'person_b',
    rightUserId: 'person_a',
    evidence: authorize(reverseCandidates),
  });

  assert.equal(forward.pairKey, reverse.pairKey);
  assert.equal(forward.score, reverse.score);
  assert.deepEqual(forward.dimensionScores, reverse.dimensionScores);
  assert.equal(forward.score, 69);
});

test('treats missing dimensions as neutral by removing their weights from the denominator', () => {
  const result = scoreCompatibility({
    leftUserId: 'person_a',
    rightUserId: 'person_b',
    evidence: authorize([
      candidate('rel-1', 'relationship', 'source.1', 0.8),
      candidate('rel-2', 'relationship', 'source.2', 0.8),
      candidate('rel-3', 'relationship', 'source.3', 0.8),
    ]),
  });

  assert.equal(result.availableWeight, 35);
  assert.equal(result.score, 80);
  assert.equal(result.dimensionScores.relationship.score, 80);
  assert.equal(result.dimensionScores.lifestyle.score, null);
  assert.equal(result.dimensionScores.mbti.score, null);
});

test('requires three independent weighted sources and at least one core source for display', () => {
  const repeatedSource = scoreCompatibility({
    leftUserId: 'person_a',
    rightUserId: 'person_b',
    evidence: authorize([
      candidate('interest-1', 'interests', 'same-source', 1),
      candidate('interest-2', 'interests', 'same-source', 1),
      candidate('interest-3', 'interests', 'same-source', 1),
    ]),
  });
  assert.equal(repeatedSource.independentEvidenceCount, 1);
  assert.equal(repeatedSource.score, null);
  assert.equal(repeatedSource.displayReason, 'INSUFFICIENT_INDEPENDENT_EVIDENCE');

  const noCoreEvidence = scoreCompatibility({
    leftUserId: 'person_a',
    rightUserId: 'person_b',
    evidence: authorize([
      candidate('interest-1', 'interests', 'source.1', 1),
      candidate('interest-2', 'interests', 'source.2', 1),
      candidate('mbti', 'mbti', 'source.3', 1),
    ]),
  });
  assert.equal(noCoreEvidence.independentEvidenceCount, 3);
  assert.equal(noCoreEvidence.coreEvidenceCount, 0);
  assert.equal(noCoreEvidence.score, null);
  assert.equal(noCoreEvidence.displayReason, 'MISSING_CORE_EVIDENCE');

  const sufficient = scoreCompatibility({
    leftUserId: 'person_a',
    rightUserId: 'person_b',
    evidence: authorize([
      candidate('interest', 'interests', 'source.1', 1),
      candidate('mbti', 'mbti', 'source.2', 1),
      candidate('communication', 'communication', 'source.3', 1),
    ]),
  });
  assert.equal(sufficient.score, 100);
  assert.equal(sufficient.canDisplayNumericScore, true);
});

test('zodiac is reported at zero weight and cannot affect or unlock a score', () => {
  const base = [
    candidate('rel', 'relationship', 'source.1', 0.6),
    candidate('life', 'lifestyle', 'source.2', 0.6),
    candidate('talk', 'communication', 'source.3', 0.6),
  ] as const;
  const withoutZodiac = scoreCompatibility({
    leftUserId: 'person_a',
    rightUserId: 'person_b',
    evidence: authorize(base),
  });
  const withZodiac = scoreCompatibility({
    leftUserId: 'person_a',
    rightUserId: 'person_b',
    evidence: authorize([
      ...base,
      candidate('zodiac', 'zodiac', 'source.zodiac', 1),
    ]),
  });

  assert.equal(withZodiac.score, withoutZodiac.score);
  assert.equal(withZodiac.availableWeight, withoutZodiac.availableWeight);
  assert.equal(withZodiac.independentEvidenceCount, withoutZodiac.independentEvidenceCount);
  assert.equal(withZodiac.dimensionScores.zodiac.score, 100);
  assert.equal(withZodiac.dimensionScores.zodiac.weight, 0);
});

test('zero-similarity comparisons do not unlock numeric display', () => {
  const result = scoreCompatibility({
    leftUserId: 'person_a',
    rightUserId: 'person_b',
    evidence: authorize([
      candidate('rel', 'relationship', 'source.1', 0),
      candidate('life', 'lifestyle', 'source.2', 0),
      candidate('talk', 'communication', 'source.3', 0),
    ]),
  });
  assert.equal(result.score, null);
  assert.equal(result.independentEvidenceCount, 0);
});

test('assesses hard eligibility bilaterally and independently from scoring', () => {
  const left = eligibleProfile('person_a', {
    age: 29,
    gender: 'woman',
    preferences: {
      minAge: 25,
      maxAge: 35,
      acceptedGenders: ['man'],
      acceptedRegions: ['shanghai'],
      acceptedRelationshipGoals: ['long-term'],
    },
  });
  const right = eligibleProfile('person_b', {
    age: 31,
    gender: 'man',
    preferences: {
      minAge: 28,
      maxAge: 32,
      acceptedGenders: ['woman'],
      acceptedRegions: ['shanghai'],
      acceptedRelationshipGoals: ['long-term'],
    },
  });

  const forward = assessEligibility({ left, right });
  const reverse = assessEligibility({ left: right, right: left });
  assert.equal(forward.eligible, true);
  assert.deepEqual(forward.rejectionCodes, []);
  assert.deepEqual(forward, reverse);

  const mismatch = assessEligibility({
    left: { ...left, preferences: { ...left.preferences, maxAge: 30 } },
    right: {
      ...right,
      preferences: { ...right.preferences, acceptedRegions: ['beijing'] },
    },
  });
  assert.equal(mismatch.eligible, false);
  assert.deepEqual(mismatch.rejectionCodes, ['AGE_MISMATCH', 'REGION_MISMATCH']);
  assert.deepEqual(
    mismatch.rejections.map(({ code, userId, counterpartyUserId }) => ({
      code,
      userId,
      counterpartyUserId,
    })),
    [
      { code: 'AGE_MISMATCH', userId: 'person_a', counterpartyUserId: 'person_b' },
      { code: 'REGION_MISMATCH', userId: 'person_b', counterpartyUserId: 'person_a' },
    ],
  );
});

test('reports every hard rejection code, including blocks and self-pairs', () => {
  const left = eligibleProfile('same', {
    isAdult: false,
    isActive: false,
    isVerified: false,
    eligibilityConsent: false,
  });
  const right = eligibleProfile('same');
  const result = assessEligibility({ left, right, blockedEither: true });

  assert.equal(result.eligible, false);
  assert.deepEqual(result.rejectionCodes, [
    'SELF_PAIR',
    'UNDERAGE',
    'INACTIVE',
    'UNVERIFIED',
    'MISSING_ELIGIBILITY_CONSENT',
    'BLOCKED',
  ]);
});

test('rejects each bilateral preference mismatch and either side blocking the pair', () => {
  const left = eligibleProfile('person_a', {
    blockedUserIds: ['person_b'],
    preferences: {
      acceptedGenders: ['nonbinary'],
      acceptedRegions: ['beijing'],
      acceptedRelationshipGoals: ['exploring'],
    },
  });
  const right = eligibleProfile('person_b', { gender: 'man' });

  const result = assessEligibility({ left, right });
  assert.deepEqual(result.rejectionCodes, [
    'GENDER_MISMATCH',
    'REGION_MISMATCH',
    'RELATIONSHIP_GOAL_MISMATCH',
    'BLOCKED',
  ]);
});
