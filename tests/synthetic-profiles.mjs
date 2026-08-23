import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const exported = spawnSync(
  process.execPath,
  [path.join(root, 'scripts/export-synthetic-profiles.mjs')],
  { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
);
assert.equal(
  exported.status,
  0,
  'synthetic TypeScript export failed: ' + (exported.stderr || exported.error?.message || ''),
);
assert.ok(exported.stdout.trim(), 'synthetic TypeScript export produced no JSON');

let payload;
try {
  payload = JSON.parse(exported.stdout);
} catch (error) {
  assert.fail('synthetic TypeScript export was not valid JSON: ' + error.message);
}

const {
  syntheticUserRecords: records,
  syntheticProfiles: profiles,
  syntheticPeople: people,
  syntheticPersonFeedCards: cards,
  publicFixturePeople,
  publicFixtureCards,
  syntheticCoverageReport: report,
  celebrityPortraitsByGender: portraitPools,
  candidateCelebrityPortraits,
  currentUserCelebrityPortrait,
  currentUser,
  publicProfileProjections: projections,
  schemaValidationResults,
  schemaMutualCandidateIds,
  generatorMutualCandidateIds,
  schemaSensitiveKeyProbeResults,
  schemaSensitiveKeyAllowedProbePaths,
  schemaConstants: constants,
} = payload;

const EXPECTED_COUNT = 49;
const EXPECTED_TOTAL_MOCK_USERS = 50;
const REQUIRED_PERSON_IDS = ['person_lan', 'person_zhou', 'person_ning', 'person_chen'];
const MBTI_VALUES = [
  'INTJ', 'INTP', 'ENTJ', 'ENTP', 'INFJ', 'INFP', 'ENFJ', 'ENFP',
  'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ', 'ISTP', 'ISFP', 'ESTP', 'ESFP', 'UNSURE',
];
const ZODIAC_VALUES = [
  'ARIES', 'TAURUS', 'GEMINI', 'CANCER', 'LEO', 'VIRGO',
  'LIBRA', 'SCORPIO', 'SAGITTARIUS', 'CAPRICORN', 'AQUARIUS', 'PISCES',
];
const SELF_GENDERS = ['WOMAN', 'MAN', 'NON_BINARY', 'SELF_DESCRIBED'];
const GENERATED_SELF_GENDERS = ['WOMAN', 'MAN'];
const RELATIONSHIP_GOALS = [
  'LONG_TERM', 'SERIOUS_AND_NATURAL', 'CASUAL_DATING', 'FRIENDS_FIRST', 'UNSURE',
];
const PERMISSION_KEYS = [
  'aiExplanation', 'candidateEligibility', 'publicDisplay', 'recommendationRanking',
];

const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const sorted = (values) => [...values].sort();
const unique = (values) => new Set(values);
const nonBlank = (value) => typeof value === 'string' && value.trim().length > 0;
const sum = (values) => values.reduce((total, value) => total + value, 0);
const range = (values) => ({ minimum: Math.min(...values), maximum: Math.max(...values) });
const counts = (values, expectedValues) => Object.fromEntries(
  expectedValues.map((value) => [value, values.filter((item) => item === value).length]),
);

const assertSameSet = (actual, expected, label) => {
  assert.deepEqual(sorted(unique(actual)), sorted(unique(expected)), label);
};

const assertUniqueIds = (values, getId, prefix, label) => {
  const ids = values.map(getId);
  ids.forEach((id, index) => {
    assert.ok(nonBlank(id), label + '[' + index + '] has no ID');
    assert.ok(id.startsWith(prefix), label + '[' + index + '] has invalid ID ' + id);
  });
  assert.equal(unique(ids).size, values.length, label + ' IDs must be unique');
  return ids;
};

for (const [label, value] of Object.entries({
  syntheticUserRecords: records,
  syntheticProfiles: profiles,
  syntheticPeople: people,
  syntheticPersonFeedCards: cards,
  publicProfileProjections: projections,
  schemaValidationResults,
})) {
  assert.ok(Array.isArray(value), label + ' must be an array');
  assert.equal(value.length, EXPECTED_COUNT, label + ' must contain exactly 49 candidate items');
}
assert.deepEqual(profiles, records, 'syntheticProfiles must be the complete-record alias');
assert.deepEqual(publicFixturePeople, people, 'public-only people fixture differs from private projection');
assert.deepEqual(publicFixtureCards, cards, 'public-only card fixture differs from private projection');
assert.equal(records.length + 1, EXPECTED_TOTAL_MOCK_USERS, 'candidate plus experience-account total must be 50');
assert.equal(currentUser.profile.displayName, '林川', 'experience account name must be Lin Chuan');
assert.equal(currentUser.profile.photos[0].url, currentUserCelebrityPortrait.url, 'experience account portrait drifted');
assert.equal(candidateCelebrityPortraits.length, EXPECTED_COUNT, 'candidate portrait registry must contain 49 images');
assert.equal(unique(candidateCelebrityPortraits.map((portrait) => portrait.id)).size, EXPECTED_COUNT, 'celebrity portrait IDs must be unique');
assert.equal(unique(candidateCelebrityPortraits.map((portrait) => portrait.url)).size, EXPECTED_COUNT, 'candidate celebrity portrait URLs must be unique');
assert.equal(candidateCelebrityPortraits.some((portrait) => portrait.url === currentUserCelebrityPortrait.url), false, 'experience account portrait must be unique');
assert.equal(currentUserCelebrityPortrait.gender, 'MAN', 'Lin Chuan portrait must use the male pool');
assert.deepEqual(
  sorted(candidateCelebrityPortraits.map((portrait) => portrait.url)),
  sorted(records.map((record) => record.person.photos[0].url)),
  'every candidate portrait must be used exactly once',
);
for (const gender of GENERATED_SELF_GENDERS) {
  assert.ok(portraitPools[gender].every((portrait) => portrait.gender === gender), gender + ' portrait pool contains a gender mismatch');
}
assert.ok(
  records.every((record) => !candidateCelebrityPortraits.some((portrait) =>
    record.person.displayName === portrait.celebrityName)),
  'fictional profile names must not impersonate pictured celebrities',
);

const recordIds = assertUniqueIds(records, (record) => record.person.id, 'person_', 'records');
const profileIds = assertUniqueIds(profiles, (record) => record.person.id, 'person_', 'profiles');
const personIds = assertUniqueIds(people, (person) => person.id, 'person_', 'people');
const projectionIds = assertUniqueIds(
  projections, (projection) => projection.person.id, 'person_', 'public projections',
);
const cardIds = assertUniqueIds(cards, (card) => card.cardId, 'feed_', 'feed cards');
assertSameSet(recordIds, profileIds, 'record/profile IDs differ');
assertSameSet(recordIds, personIds, 'record/person IDs differ');
assertSameSet(recordIds, projectionIds, 'record/projection IDs differ');
assert.equal(unique(cardIds).size, EXPECTED_COUNT, 'card IDs must not be reused');
REQUIRED_PERSON_IDS.forEach((id) => {
  assert.ok(recordIds.includes(id), 'missing required profile ' + id);
  assert.equal(cards.filter((card) => card.entityId === id).length, 1, id + ' needs one card');
});

const recordById = new Map(records.map((record) => [record.person.id, record]));
const personById = new Map(people.map((person) => [person.id, person]));
const projectionById = new Map(projections.map((item) => [item.person.id, item]));
const cardByPersonId = new Map(cards.map((card) => [card.entityId, card]));
assert.equal(recordById.size, EXPECTED_COUNT, 'record lookup lost an ID');
assert.equal(personById.size, EXPECTED_COUNT, 'person lookup lost an ID');
assert.equal(projectionById.size, EXPECTED_COUNT, 'projection lookup lost an ID');
assert.equal(cardByPersonId.size, EXPECTED_COUNT, 'each person must have exactly one feed card');
assertSameSet(cardByPersonId.keys(), personIds, 'cards must reference every person exactly once');

const parseDateOnly = (value, label) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  assert.ok(match, label + ' must be YYYY-MM-DD: ' + value);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  assert.equal(date.getUTCFullYear(), year, label + ' has an invalid year');
  assert.equal(date.getUTCMonth() + 1, month, label + ' has an invalid month');
  assert.equal(date.getUTCDate(), day, label + ' has an invalid day');
  return { year, month, day };
};

const independentAge = (birthDate, asOf) => {
  const birth = parseDateOnly(birthDate, 'birthDate');
  const current = parseDateOnly(asOf, 'profileAsOf');
  const beforeBirthday = current.month < birth.month ||
    (current.month === birth.month && current.day < birth.day);
  return current.year - birth.year - (beforeBirthday ? 1 : 0);
};

const independentZodiac = (birthDate) => {
  const { month, day } = parseDateOnly(birthDate, 'birthDate');
  const mmdd = month * 100 + day;
  if (mmdd >= 1222 || mmdd <= 119) return 'CAPRICORN';
  if (mmdd <= 218) return 'AQUARIUS';
  if (mmdd <= 320) return 'PISCES';
  if (mmdd <= 419) return 'ARIES';
  if (mmdd <= 520) return 'TAURUS';
  if (mmdd <= 621) return 'GEMINI';
  if (mmdd <= 722) return 'CANCER';
  if (mmdd <= 822) return 'LEO';
  if (mmdd <= 922) return 'VIRGO';
  if (mmdd <= 1023) return 'LIBRA';
  if (mmdd <= 1122) return 'SCORPIO';
  return 'SAGITTARIUS';
};

const profileFieldKeys = constants.PROFILE_FIELD_KEYS;
const lifestyleAxisKeys = constants.LIFESTYLE_AXIS_KEYS;
const dimensionValues = constants.RELATIONSHIP_DIMENSION_VALUES;
assert.ok(Array.isArray(profileFieldKeys) && profileFieldKeys.length > 0, 'field keys missing');
assert.deepEqual(sorted(Object.keys(constants.DEFAULT_FIELD_PERMISSIONS)), sorted(profileFieldKeys));
assert.deepEqual(lifestyleAxisKeys, [
  'weekendActivity', 'socialSetting', 'planningStyle',
  'afterWorkSocialEnergy', 'messageCadence',
]);
assert.equal(dimensionValues.length, 8, 'all eight relationship dimensions are required');

const allMediaIds = [];
records.forEach((record, index) => {
  const label = 'record ' + (record.person?.id ?? index);
  assert.equal(record.schemaVersion, '1.0', label + ' schema version');
  assert.equal(record.isSynthetic, true, label + ' must be marked synthetic');
  assert.ok(nonBlank(record.generatedAt), label + ' generatedAt missing');
  parseDateOnly(record.profileAsOf, label + '.profileAsOf');
  assert.ok(record.private && typeof record.private === 'object', label + ' private profile missing');
  assert.ok(record.private.candidatePreferences, label + ' candidate preferences missing');

  const derivedAge = independentAge(record.private.birthDate, record.profileAsOf);
  assert.equal(record.person.age, derivedAge, label + ' age does not match birthday');
  assert.ok(Number.isInteger(record.person.age) && record.person.age >= 18, label + ' is not adult');
  assert.equal(
    record.person.zodiac, independentZodiac(record.private.birthDate),
    label + ' zodiac does not match birthday',
  );

  assert.ok(MBTI_VALUES.includes(record.person.mbti), label + ' has invalid MBTI');
  assert.ok(ZODIAC_VALUES.includes(record.person.zodiac), label + ' has invalid zodiac');
  assert.ok(SELF_GENDERS.includes(record.selfGender), label + ' has invalid gender');
  assert.ok(RELATIONSHIP_GOALS.includes(record.relationshipGoal), label + ' has invalid goal');
  assert.ok(Object.values(constants.Industry).includes(record.industry), label + ' has invalid industry');

  assert.ok(
    record.person.interests.length >= 5 && record.person.interests.length <= 8,
    label + ' must have 5-8 interests',
  );
  assert.equal(unique(record.person.interests).size, record.person.interests.length, label + ' interests repeat');
  assert.equal(record.focusInterests.length, 3, label + ' must have three focus interests');
  assert.equal(unique(record.focusInterests).size, 3, label + ' focus interests repeat');
  record.focusInterests.forEach((interest) => {
    assert.ok(record.person.interests.includes(interest), label + ' focus interest is not selected');
  });

  assert.ok(
    record.person.photos.length >= 2 && record.person.photos.length <= 6,
    label + ' must have 2-6 photos',
  );
  record.person.photos.forEach((photo) => {
    assert.ok(photo.id.startsWith('media_'), label + ' has invalid media ID');
    assert.ok(photo.url.startsWith('https://image.tmdb.org/'), label + ' photo is not approved celebrity artwork');
    assert.equal(photo.alt, record.person.displayName + '的示例头像', label + ' photo alt must describe only the fictional user');
    assert.ok(nonBlank(photo.alt), label + ' photo alt text missing');
    assert.ok(photo.width > 0 && photo.height > 0, label + ' photo dimensions invalid');
    allMediaIds.push(photo.id);
  });

  assert.ok(record.lifestyleAnswers.length >= 3, label + ' needs at least three lifestyle answers');
  assert.equal(
    unique(record.lifestyleAnswers.map((answer) => answer.questionId)).size,
    record.lifestyleAnswers.length,
    label + ' lifestyle questions repeat',
  );
  record.lifestyleAnswers.forEach((answer) => {
    assert.ok(nonBlank(answer.questionId) && nonBlank(answer.answer), label + ' has empty lifestyle answer');
  });
  assert.ok(record.person.prompts.length >= 1, label + ' needs at least one prompt');
  record.person.prompts.forEach((prompt) => {
    assert.ok(nonBlank(prompt.prompt) && nonBlank(prompt.answer), label + ' has an empty prompt');
  });

  assert.deepEqual(sorted(Object.keys(record.lifestyleAxes)), sorted(lifestyleAxisKeys));
  lifestyleAxisKeys.forEach((axis) => {
    const value = record.lifestyleAxes[axis];
    assert.ok(Number.isInteger(value) && value >= 1 && value <= 5, label + '.' + axis + ' is outside 1-5');
  });
  assert.deepEqual(sorted(Object.keys(record.relationshipTraitEvidence)), sorted(dimensionValues));
  dimensionValues.forEach((dimension) => {
    const evidence = record.relationshipTraitEvidence[dimension];
    assert.ok(evidence && typeof evidence === 'object', label + '.' + dimension + ' has no evidence');
    assert.ok(nonBlank(evidence.stance) && nonBlank(evidence.context), label + '.' + dimension + ' trait text empty');
    assert.ok(Number.isInteger(evidence.importance) && evidence.importance >= 1 && evidence.importance <= 5,
      label + '.' + dimension + ' importance is outside 1-5');
    assert.ok(['LOW', 'MEDIUM', 'HIGH'].includes(evidence.confidence), label + '.' + dimension + ' confidence invalid');
    assert.equal(evidence.stability, 'STABLE', label + '.' + dimension + ' must be stable');
    assert.equal(evidence.confirmedByUser, true, label + '.' + dimension + ' trait is unconfirmed');
    assert.ok(nonBlank(evidence.updatedAt), label + '.' + dimension + ' updatedAt empty');
    assert.deepEqual(sorted(Object.keys(evidence.permissions)), PERMISSION_KEYS, label + '.' + dimension + ' permissions');
    PERMISSION_KEYS.forEach((key) => assert.equal(typeof evidence.permissions[key], 'boolean'));
    assert.ok(Array.isArray(evidence.evidenceSources) && evidence.evidenceSources.length >= 3,
      label + '.' + dimension + ' needs at least three scenario sources');
    assert.equal(evidence.evidenceCount, evidence.evidenceSources.length, label + '.' + dimension + ' evidence count');
    assert.equal(unique(evidence.evidenceSources.map((item) => item.scenarioId)).size,
      evidence.evidenceSources.length, label + '.' + dimension + ' scenarios repeat');
    evidence.evidenceSources.forEach((item) => {
      assert.equal(item.confirmedByUser, true, label + '.' + dimension + ' evidence is unconfirmed');
      assert.ok(nonBlank(item.sourceId) && nonBlank(item.scenarioId) && nonBlank(item.context) && nonBlank(item.summary),
        label + '.' + dimension + ' evidence is empty');
    });
  });

  assert.ok(Object.values(constants.CostSharingPreference).includes(record.costSharingPreference),
    label + ' cost-sharing preference invalid');

  assert.deepEqual(sorted(Object.keys(record.permissions)), sorted(profileFieldKeys));
  profileFieldKeys.forEach((field) => {
    const permission = record.permissions[field];
    assert.deepEqual(sorted(Object.keys(permission)), PERMISSION_KEYS, label + '.' + field + ' permission shape');
    PERMISSION_KEYS.forEach((key) => {
      assert.equal(typeof permission[key], 'boolean', label + '.' + field + '.' + key + ' must be boolean');
    });
  });
  assert.equal(record.permissions.birthDate.publicDisplay, false, label + ' exposes full birthday');
  assert.equal(record.permissions.birthDate.aiExplanation, false, label + ' explains full birthday');
  assert.equal(record.permissions.candidatePreferences.publicDisplay, false, label + ' exposes preferences');
  assert.equal(record.permissions.candidatePreferences.recommendationRanking, false, label + ' ranks on preferences');
  assert.equal(record.permissions.candidatePreferences.aiExplanation, false, label + ' explains preferences');

  const prefs = record.private.candidatePreferences;
  assert.ok(prefs.desiredGenders.length > 0, label + ' desired genders empty');
  assert.equal(unique(prefs.desiredGenders).size, prefs.desiredGenders.length, label + ' desired genders repeat');
  prefs.desiredGenders.forEach((value) => assert.ok(SELF_GENDERS.includes(value), label + ' desired gender invalid'));
  assert.ok(
    Number.isInteger(prefs.ageRange.minimum) && Number.isInteger(prefs.ageRange.maximum) &&
      prefs.ageRange.minimum >= 18 && prefs.ageRange.minimum <= prefs.ageRange.maximum,
    label + ' candidate age range invalid',
  );
  assert.equal(typeof prefs.location.isHardConstraint, 'boolean');
  assert.ok(Object.values(constants.CandidateLocationScope).includes(prefs.location.scope));
  for (const [values, allowed, field] of [
    [prefs.acceptedRelationshipGoals, RELATIONSHIP_GOALS, 'acceptedRelationshipGoals'],
    [prefs.acceptedConnectionStarts, Object.values(constants.ConnectionStart), 'acceptedConnectionStarts'],
    [prefs.acceptedRelationshipPaces, Object.values(constants.RelationshipPace), 'acceptedRelationshipPaces'],
  ]) {
    assert.equal(unique(values).size, values.length, label + '.' + field + ' repeats values');
    values.forEach((value) => assert.ok(allowed.includes(value), label + '.' + field + ' has invalid value'));
  }
});

records.forEach((record) => {
  const urls = new Set(record.person.photos.map((photo) => photo.url));
  assert.equal(urls.size, 1, record.person.id + ' photos must stay on one celebrity portrait');
  assert.ok(GENERATED_SELF_GENDERS.includes(record.selfGender), record.person.id + ' has no gender-matched portrait pool');
  const allowedUrls = new Set(portraitPools[record.selfGender].map((portrait) => portrait.url));
  assert.ok(allowedUrls.has(record.person.photos[0].url), record.person.id + ' portrait does not match its explicit gender');
});
assert.equal(unique(records.map((record) => record.person.photos[0].url)).size, EXPECTED_COUNT, 'candidate profiles must not reuse celebrity portraits');
assert.equal(unique(allMediaIds).size, allMediaIds.length, 'media asset IDs must be globally unique');

assertSameSet(records.map((record) => record.person.mbti), MBTI_VALUES, 'must cover 16 MBTI plus UNSURE');
assertSameSet(records.map((record) => record.person.zodiac), ZODIAC_VALUES, 'must cover all 12 zodiac signs');
assertSameSet(records.map((record) => record.selfGender), GENERATED_SELF_GENDERS, 'mock profiles must cover both gender-matched portrait pools');
assertSameSet(records.map((record) => record.relationshipGoal), RELATIONSHIP_GOALS, 'must cover five relationship goals');

const desiredGenderSignature = (values) => sorted(values).join('|');
const expectedDesiredGenderPatterns = Array.from(
  { length: (1 << SELF_GENDERS.length) - 1 },
  (_, patternIndex) => desiredGenderSignature(
    SELF_GENDERS.filter((_, genderIndex) => ((patternIndex + 1) & (1 << genderIndex)) !== 0),
  ),
);
const actualDesiredGenderSignatures = records.map((record) =>
  desiredGenderSignature(record.private.candidatePreferences.desiredGenders),
);
assertSameSet(
  actualDesiredGenderSignatures,
  expectedDesiredGenderPatterns,
  'desired genders must cover every non-empty preference pattern',
);
const desiredGenderPatternCounts = counts(
  actualDesiredGenderSignatures, expectedDesiredGenderPatterns,
);
const desiredGenderPatternCountValues = Object.values(desiredGenderPatternCounts);
assert.ok(
  Math.max(...desiredGenderPatternCountValues) - Math.min(...desiredGenderPatternCountValues) <= 1,
  'desired-gender preference patterns must be globally balanced',
);
const preferenceAssociationBySelfGender = Object.fromEntries(GENERATED_SELF_GENDERS.map((selfGender) => {
  const groupSignatures = records
    .filter((record) => record.selfGender === selfGender)
    .map((record) => desiredGenderSignature(record.private.candidatePreferences.desiredGenders));
  const groupCounts = [...unique(groupSignatures)].map((signature) =>
    groupSignatures.filter((candidate) => candidate === signature).length,
  );
  const dominantShare = Math.max(...groupCounts) / groupSignatures.length;
  assert.ok(
    groupCounts.length >= Math.ceil(expectedDesiredGenderPatterns.length / 2),
    selfGender + ' maps to too few desired-gender patterns: ' + groupCounts.length,
  );
  assert.ok(
    dominantShare < 0.5,
    selfGender + ' is nearly fixed to one desired-gender pattern: ' + dominantShare,
  );
  return [selfGender, { distinctPatterns: groupCounts.length, dominantShare }];
}));
assert.ok(
  Object.values(preferenceAssociationBySelfGender).every((item) =>
    item.distinctPatterns >= Math.ceil(expectedDesiredGenderPatterns.length / 2)),
  'each generated self-gender must retain varied candidate preferences',
);
assertSameSet(
  records.map((record) => record.costSharingPreference),
  Object.values(constants.CostSharingPreference),
  'must cover every cost-sharing preference',
);
const coveredIndustries = unique(records.map((record) => record.industry));
assert.ok(coveredIndustries.size >= 12, 'must cover at least 12 industries, got ' + coveredIndustries.size);
assertSameSet(coveredIndustries, Object.values(constants.Industry), 'generated industries differ from schema');
lifestyleAxisKeys.forEach((axis) => {
  assertSameSet(records.map((record) => record.lifestyleAxes[axis]), [1, 2, 3, 4, 5], axis + ' scale coverage');
});

schemaValidationResults.forEach((result, index) => {
  assert.equal(result.valid, true, 'schema rejected ' + recordIds[index] + ': ' + JSON.stringify(result.issues));
  assert.deepEqual(result.issues, [], 'valid schema result ' + index + ' must have no issues');
});

const PUBLIC_PRIVATE_KEYS = new Set([
  'birthdate', 'dateofbirth', 'fullbirthday', 'candidatepreferences', 'preferences',
  'desiredgenders', 'preferredgenders', 'agerange', 'candidateagerange',
  'mincandidateage', 'maxcandidateage', 'acceptedrelationshipgoals',
  'acceptedconnectionstarts', 'acceptedrelationshippaces', 'locationpreference',
  'permissions', 'relationshiptraits', 'relationshiptraitevidence', 'privateprofile', 'private',
]);
const UNIVERSALLY_PROHIBITED_KEYS = new Set([
  'income', 'annualincome', 'salary', 'assets', 'networth', 'propertyownership',
  'phone', 'phonenumber', 'email', 'emailaddress', 'contact', 'contactdetails',
  'address', 'homeaddress', 'workaddress', 'exactaddress', 'preciseaddress',
  'latitude', 'longitude', 'coordinates', 'exactlocation', 'preciselocation',
  'incomingheart', 'incominghearts', 'receivedheart', 'receivedhearts',
  'inboundheart', 'inboundonewayheart', 'onewayheart', 'unilateralheart',
  'mutualonheart', 'incominglike', 'receivedlike', 'exactmeetingpoint',
  'incomeband', 'monthlyincome', 'financialassets', 'assetvalue',
  'mobile', 'mobilenumber', 'contactemail', 'homelocation', 'worklocation',
  'ethnicity', 'race', 'religion', 'politicalviews', 'sexualorientation',
  'medicalhistory', 'healthstatus', 'disability',
  '收入', '资产', '手机号', '邮箱', '精确地址', '单向心动', '收到的红心',
]);
const normalizeKey = (key) =>
  key.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
const findForbiddenPaths = (value, forbidden, rootPath) => {
  const paths = [];
  const visit = (item, currentPath) => {
    if (item === null || typeof item !== 'object') return;
    if (Array.isArray(item)) {
      item.forEach((child, index) => visit(child, currentPath + '[' + index + ']'));
      return;
    }
    Object.entries(item).forEach(([key, child]) => {
      const nextPath = currentPath + '.' + key;
      if (forbidden.has(normalizeKey(key))) paths.push(nextPath);
      visit(child, nextPath);
    });
  };
  visit(value, rootPath);
  return paths;
};

const universalLeaks = findForbiddenPaths(
  { records, projections, people, cards, report },
  UNIVERSALLY_PROHIBITED_KEYS,
  'syntheticData',
);
assert.deepEqual(universalLeaks, [], 'prohibited synthetic fields found: ' + universalLeaks.join(', '));

const SENSITIVE_ATTRIBUTE_KEYS = [
  'ethnicity', 'race', 'religion', 'politicalViews',
  'sexualOrientation', 'medicalHistory', 'healthStatus', 'disability',
];
assert.ok(Array.isArray(schemaSensitiveKeyProbeResults), 'schema scanner probes missing');
assertSameSet(
  schemaSensitiveKeyProbeResults.map((probe) => probe.canonical),
  SENSITIVE_ATTRIBUTE_KEYS,
  'schema scanner probes must cover every prohibited sensitive attribute',
);
schemaSensitiveKeyProbeResults.forEach((probe) => {
  assert.deepEqual(
    probe.scannerPaths,
    ['probe.' + probe.variant],
    'schema scanner missed normalized sensitive key ' + probe.variant,
  );
  assert.deepEqual(
    probe.validationPaths,
    [probe.variant],
    'schema validator accepted normalized sensitive key ' + probe.variant,
  );
});
assert.deepEqual(
  schemaSensitiveKeyAllowedProbePaths,
  [],
  'normalized sensitive-key scan must not use broad substring matching',
);
const normalizedSensitiveVariantFixture = {
  ethnicity_case: { ETHNICITY: true },
  race_kebab: { 'r-a-c-e': true },
  religion_snake: [{ re_li_gion: true }],
  political_case: { POLITICALVIEWS: true },
  orientation_kebab: { 'sexual-orientation': true },
  medical_snake: { medical_history: true },
  health_fullwidth: { 'ｈｅａｌｔｈ＿ｓｔａｔｕｓ': true },
  disability_zero_width: { 'dis\u200bability': true },
};
assert.equal(
  findForbiddenPaths(
    normalizedSensitiveVariantFixture, UNIVERSALLY_PROHIBITED_KEYS, 'variants',
  ).length,
  SENSITIVE_ATTRIBUTE_KEYS.length,
  'test privacy scanner missed a normalized sensitive-key variant',
);
const publicBundle = { projections, people, cards, report };
const publicLeaks = findForbiddenPaths(publicBundle, PUBLIC_PRIVATE_KEYS, 'public');
assert.deepEqual(publicLeaks, [], 'private fields leaked into public data: ' + publicLeaks.join(', '));
const publicJson = JSON.stringify(publicBundle);
records.forEach((record) => {
  assert.equal(
    publicJson.includes(record.private.birthDate),
    false,
    record.person.id + ' full birthday leaked into public serialization',
  );
});
const allStringValues = [];
const collectStrings = (value) => {
  if (typeof value === 'string') {
    allStringValues.push(value);
    return;
  }
  if (value === null || typeof value !== 'object') return;
  Object.values(value).forEach(collectStrings);
};
collectStrings({ records, projections, people, cards });
assert.equal(
  allStringValues.some((value) => /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(value)),
  false,
  'synthetic data contains an email-like value',
);
assert.equal(
  allStringValues.some((value) => /(?:^|\D)1[3-9]\d{9}(?:$|\D)/.test(value)),
  false,
  'synthetic data contains a phone-like value',
);

const PUBLIC_PERSON_TOP_LEVEL_FORBIDDEN = [
  'birthDate', 'desiredGenders', 'ageRange', 'permissions',
  'relationshipTraits', 'relationshipTraitEvidence', 'privateProfile',
];
people.forEach((person) => {
  PUBLIC_PERSON_TOP_LEVEL_FORBIDDEN.forEach((key) => {
    assert.equal(own(person, key), false, person.id + ' public Person contains ' + key);
  });
});

const projectionMappings = [
  ['displayName', (item) => item.person, 'displayName', (record) => record.person.displayName],
  ['age', (item) => item.person, 'age', (record) => record.person.age],
  ['zodiac', (item) => item.person, 'zodiac', (record) => record.person.zodiac],
  ['selfGender', (item) => item, 'selfGender', (record) => record.selfGender],
  ['city', (item) => item.person, 'city', (record) => record.person.city],
  ['occupation', (item) => item.person, 'occupation', (record) => record.person.occupation],
  ['bio', (item) => item.person, 'bio', (record) => record.person.bio],
  ['connectionStart', (item) => item, 'connectionStart', (record) => record.connectionStart],
  ['relationshipPace', (item) => item, 'relationshipPace', (record) => record.relationshipPace],
  ['mbti', (item) => item.person, 'mbti', (record) => record.person.mbti],
  ['interests', (item) => item.person, 'interests', (record) => record.person.interests],
  ['focusInterests', (item) => item, 'focusInterests', (record) => record.focusInterests],
  ['photos', (item) => item.person, 'photos', (record) => record.person.photos],
  ['prompts', (item) => item.person, 'prompts', (record) => record.person.prompts],
  ['lifestyleAnswers', (item) => item, 'lifestyleAnswers', (record) => record.lifestyleAnswers],
  ['lifestyleAxes', (item) => item, 'lifestyleAxes', (record) => record.lifestyleAxes],
  ['industry', (item) => item, 'industry', (record) => record.industry],
  ['budgetBand', (item) => item, 'budgetBand', (record) => record.budgetBand],
  ['spendingStyle', (item) => item, 'spendingStyle', (record) => record.spendingStyle],
  ['costSharingPreference', (item) => item, 'costSharingPreference', (record) => record.costSharingPreference],
];
records.forEach((record) => {
  const projection = projectionById.get(record.person.id);
  assert.ok(projection, record.person.id + ' projection missing');
  assert.equal(projection.schemaVersion, '1.0');
  assert.equal(projection.isSynthetic, true);
  assert.equal(projection.person.id, record.person.id);
  projectionMappings.forEach(([field, getContainer, key, getExpected]) => {
    const container = getContainer(projection);
    const mayDisplay = record.permissions[field].publicDisplay;
    assert.equal(own(container, key), mayDisplay, record.person.id + '.' + field + ' projection permission mismatch');
    if (mayDisplay) assert.deepEqual(container[key], getExpected(record), record.person.id + '.' + field + ' projection value');
  });
  const projectedGoal = record.permissions.relationshipGoal.publicDisplay;
  assert.equal(own(projection, 'relationshipGoal'), projectedGoal);
  assert.equal(own(projection.person, 'relationshipGoal'), projectedGoal);
  if (projectedGoal) {
    assert.equal(projection.relationshipGoal, record.relationshipGoal);
    assert.equal(projection.person.relationshipGoal, record.person.relationshipGoal);
  }
  assert.deepEqual(personById.get(record.person.id), projection.person, record.person.id + ' Person differs from projection');
});

cards.forEach((card) => {
  const person = personById.get(card.entityId);
  const record = recordById.get(card.entityId);
  assert.ok(person, card.cardId + ' has dangling entityId ' + card.entityId);
  assert.ok(record, card.cardId + ' has no private fixture counterpart');
  assert.equal(card.cardType, 'PERSON', card.cardId + ' has wrong card type');
  assert.equal(card.pathType, 'PERSON', card.cardId + ' has wrong path type');
  assert.equal(card.entityVersion, person.entityVersion, card.cardId + ' entity version mismatch');
  assert.equal(card.presentation.image.id, person.photos[0].id, card.cardId + ' cover mismatch');
  const explainableEvidence = new Set([
    ...(record.permissions.focusInterests.publicDisplay && record.permissions.focusInterests.aiExplanation
      ? record.focusInterests
      : []),
    ...(record.permissions.interests.publicDisplay && record.permissions.interests.aiExplanation
      ? record.person.interests
      : []),
  ]);
  card.reason.evidenceLabels.forEach((label) => {
    assert.ok(explainableEvidence.has(label), card.cardId + ' reason uses unauthorized evidence ' + label);
  });
  const mayExplainGoal = record.permissions.relationshipGoal.publicDisplay &&
    record.permissions.relationshipGoal.aiExplanation;
  assert.equal(card.presentation.facts.length > 0, mayExplainGoal, card.cardId + ' goal fact permission mismatch');
  assert.ok(Number.isInteger(card.rankPosition) && card.rankPosition >= 1);
});
assert.equal(unique(cards.map((card) => card.rankPosition)).size, EXPECTED_COUNT, 'rank positions repeat');

const fieldsPublicByDefault = profileFieldKeys.filter(
  (field) => constants.DEFAULT_FIELD_PERMISSIONS[field].publicDisplay,
);
const fieldsExplainableByDefault = profileFieldKeys.filter(
  (field) => constants.DEFAULT_FIELD_PERMISSIONS[field].aiExplanation,
);
const publicOptOuts = records.filter((record) =>
  fieldsPublicByDefault.some((field) => !record.permissions[field].publicDisplay),
).length;
const aiExplanationOptOuts = records.filter((record) =>
  fieldsExplainableByDefault.some((field) => !record.permissions[field].aiExplanation),
).length;
assert.ok(publicOptOuts >= EXPECTED_COUNT * 0.1, 'public opt-outs too rare: ' + publicOptOuts);
assert.ok(aiExplanationOptOuts >= EXPECTED_COUNT * 0.1, 'AI explanation opt-outs too rare: ' + aiExplanationOptOuts);

assert.equal(report.totalRecords, EXPECTED_COUNT);
assert.equal(report.validRecords, EXPECTED_COUNT);
assert.equal(report.invalidRecords, 0);
assert.equal(report.uniquePersonIds, EXPECTED_COUNT);
assert.deepEqual(report.validationIssues, []);
for (const [reportKey, values, expected] of [
  ['relationshipGoals', records.map((record) => record.relationshipGoal), RELATIONSHIP_GOALS],
  ['selfGenders', records.map((record) => record.selfGender), SELF_GENDERS],
  ['connectionStarts', records.map((record) => record.connectionStart), Object.values(constants.ConnectionStart)],
  ['relationshipPaces', records.map((record) => record.relationshipPace), Object.values(constants.RelationshipPace)],
  ['budgetBands', records.map((record) => record.budgetBand), Object.values(constants.BudgetBand)],
  ['spendingStyles', records.map((record) => record.spendingStyle), Object.values(constants.SpendingStyle)],
  ['industries', records.map((record) => record.industry), Object.values(constants.Industry)],
]) {
  assert.deepEqual(report[reportKey].counts, counts(values, expected), reportKey + ' report counts');
  const expectedMissing = reportKey === 'selfGenders'
    ? SELF_GENDERS.filter((value) => !GENERATED_SELF_GENDERS.includes(value))
    : [];
  assert.deepEqual(report[reportKey].missing, expectedMissing, reportKey + ' report missing values');
  assert.equal(sum(Object.values(report[reportKey].counts)), EXPECTED_COUNT, reportKey + ' denominator');
}
assert.deepEqual(report.mbtiCounts, counts(records.map((record) => record.person.mbti), MBTI_VALUES));
assert.deepEqual(report.zodiacCounts, counts(records.map((record) => record.person.zodiac), ZODIAC_VALUES));
assert.deepEqual(
  report.costSharingPreferenceCounts,
  counts(records.map((record) => record.costSharingPreference), Object.values(constants.CostSharingPreference)),
);
assert.deepEqual(report.age, range(records.map((record) => record.person.age)));
assert.deepEqual(report.interestCount, range(records.map((record) => record.person.interests.length)));
assert.deepEqual(report.photoCount, range(records.map((record) => record.person.photos.length)));
assert.deepEqual(report.promptCount, range(records.map((record) => record.person.prompts.length)));
assert.equal(report.uniqueMediaAssetIds, unique(allMediaIds).size);
assert.equal(
  report.recordsWithPublicDisplayOptOut,
  records.filter((record) => Object.values(record.permissions).some((permission) => !permission.publicDisplay)).length,
);
assert.equal(
  report.recordsWithAiExplanationOptOut,
  records.filter((record) => Object.values(record.permissions).some((permission) => !permission.aiExplanation)).length,
);
lifestyleAxisKeys.forEach((axis) => {
  const expected = counts(records.map((record) => record.lifestyleAxes[axis]), [1, 2, 3, 4, 5]);
  assert.deepEqual(report.lifestyleAxes[axis].counts, expected, axis + ' coverage report');
  assert.deepEqual(report.lifestyleAxes[axis].missing, []);
  assert.equal(sum(Object.values(expected)), EXPECTED_COUNT);
});
dimensionValues.forEach((dimension) => {
  const evidence = records.map((record) => record.relationshipTraitEvidence[dimension]);
  assert.equal(report.relationshipDimensions[dimension].profilesWithEvidence,
    evidence.filter((item) => item.evidenceSources.length > 0).length);
  assert.equal(report.relationshipDimensions[dimension].evidenceItems,
    sum(evidence.map((item) => item.evidenceSources.length)));
});

const locationAccepts = (owner, candidate) => {
  const preference = owner.private.candidatePreferences.location;
  if (!preference.isHardConstraint || preference.scope === 'ANYWHERE') return true;
  if (preference.scope === 'NEARBY' || preference.scope === 'SAME_CITY') {
    return owner.person.city === candidate.person.city;
  }
  return (preference.allowedCities ?? [owner.person.city]).includes(candidate.person.city);
};
const independentlyAccepts = (owner, candidate) => {
  if (owner.person.id === candidate.person.id) return false;
  const preference = owner.private.candidatePreferences;
  if (!preference.desiredGenders.includes(candidate.selfGender)) return false;
  if (candidate.person.age < preference.ageRange.minimum || candidate.person.age > preference.ageRange.maximum) return false;
  if (!locationAccepts(owner, candidate)) return false;
  if (
    preference.relationshipGoalIsHardConstraint &&
    !preference.acceptedRelationshipGoals.includes(candidate.relationshipGoal)
  ) return false;
  if (
    preference.connectionStartIsHardConstraint &&
    !preference.acceptedConnectionStarts.includes(candidate.connectionStart)
  ) return false;
  if (
    preference.relationshipPaceIsHardConstraint &&
    !preference.acceptedRelationshipPaces.includes(candidate.relationshipPace)
  ) return false;
  if (preference.requiresVerifiedPersonhood && candidate.person.verification.personhood !== 'VERIFIED') return false;
  return true;
};
const independentlyMutual = (left, right) =>
  independentlyAccepts(left, right) && independentlyAccepts(right, left);

const independentCandidateIds = Object.fromEntries(records.map((left) => [
  left.person.id,
  records.filter((right) => independentlyMutual(left, right)).map((right) => right.person.id),
]));
let independentPairCount = 0;
for (let left = 0; left < records.length; left += 1) {
  for (let right = left + 1; right < records.length; right += 1) {
    if (independentlyMutual(records[left], records[right])) independentPairCount += 1;
  }
}
assert.ok(independentPairCount > 0, 'no mutually feasible candidate pair exists');
assert.equal(report.mutualCandidatePairs, independentPairCount, 'reported feasible pair count is wrong');
assert.ok(schemaMutualCandidateIds && generatorMutualCandidateIds, 'candidate maps were not exported');
assertSameSet(Object.keys(schemaMutualCandidateIds), recordIds, 'schema candidate map keys');
assertSameSet(Object.keys(generatorMutualCandidateIds), recordIds, 'generator candidate map keys');
recordIds.forEach((id) => {
  const expected = independentCandidateIds[id];
  assert.deepEqual(sorted(schemaMutualCandidateIds[id]), sorted(expected), id + ' schema candidates differ');
  assert.deepEqual(sorted(generatorMutualCandidateIds[id]), sorted(expected), id + ' generator candidates differ');
  assert.equal(unique(schemaMutualCandidateIds[id]).size, schemaMutualCandidateIds[id].length, id + ' candidates repeat');
  assert.equal(schemaMutualCandidateIds[id].includes(id), false, id + ' is its own candidate');
  schemaMutualCandidateIds[id].forEach((candidateId) => {
    assert.ok(recordById.has(candidateId), id + ' has dangling candidate ' + candidateId);
    assert.ok(schemaMutualCandidateIds[candidateId].includes(id), id + '/' + candidateId + ' is not symmetric');
  });
});
assert.equal(
  sum(Object.values(schemaMutualCandidateIds).map((ids) => ids.length)) / 2,
  independentPairCount,
  'directed candidate map does not represent unordered pairs exactly twice',
);

console.log(JSON.stringify({
  ok: true,
  records: records.length,
  uniquePeople: unique(personIds).size,
  mbtiValues: unique(records.map((record) => record.person.mbti)).size,
  zodiacValues: unique(records.map((record) => record.person.zodiac)).size,
  genderValues: unique(records.map((record) => record.selfGender)).size,
  relationshipGoals: unique(records.map((record) => record.relationshipGoal)).size,
  industries: coveredIndustries.size,
  publicOptOuts,
  aiExplanationOptOuts,
  mutualCandidatePairs: independentPairCount,
  desiredGenderPatterns: unique(actualDesiredGenderSignatures).size,
  preferenceAssociationBySelfGender,
  privacyScan: 'passed',
}));
