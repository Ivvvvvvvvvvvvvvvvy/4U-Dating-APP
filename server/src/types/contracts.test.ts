import assert from 'node:assert/strict';
import test from 'node:test';

import { consentDataSchema, recommendationResultWriteSchema } from './index.js';

test('consent persistence independently enforces global and field explanation permission', () => {
  const base = {
    policyVersion: 'consent-v1',
    modelTraining: false,
    privacy: {},
    extensions: {},
  };
  assert.equal(consentDataSchema.safeParse({
    ...base, aiCompatibility: false, publicExplanation: true, fieldPolicies: [],
  }).success, false);
  assert.equal(consentDataSchema.safeParse({
    ...base,
    aiCompatibility: true,
    publicExplanation: true,
    fieldPolicies: [{
      fieldId: 'interests',
      useForEligibility: false,
      useForRanking: true,
      useForDisplayScore: false,
      useForExplanation: true,
    }],
  }).success, false);
});

test('numeric recommendation artifacts require the product evidence threshold', () => {
  const result = recommendationResultWriteSchema.safeParse({
    resultId: 'rec_1',
    pairKey: '8:person_a|8:person_b',
    leftUserId: 'person_a',
    rightUserId: 'person_b',
    viewerUserId: 'person_a',
    candidateUserId: 'person_b',
    leftProfileVersion: 1,
    rightProfileVersion: 1,
    leftConsentVersion: 1,
    rightConsentVersion: 1,
    rulesVersion: 'rules-v1',
    modelVersion: 'none',
    promptVersion: 'none',
    score: 80,
    displayMode: 'numeric',
    evidenceCount: 2,
    coreEvidenceCount: 1,
    evidenceIds: ['evidence_1', 'evidence_2'],
    explanation: {},
    source: 'rule_fallback',
    validationStatus: 'fallback',
    generatedAt: '2026-08-22T00:00:00.000Z',
    expiresAt: '2026-08-23T00:00:00.000Z',
  });
  assert.equal(result.success, false);
});
