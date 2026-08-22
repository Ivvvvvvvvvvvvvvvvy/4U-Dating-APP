import assert from 'node:assert/strict';
import test from 'node:test';

import { canonicalPair } from './recommendations.js';
import { hashJson, stableJson } from './util.js';

test('stableJson and hashJson ignore object insertion order', () => {
  assert.equal(stableJson({ b: 2, a: 1 }), stableJson({ a: 1, b: 2 }));
  assert.equal(hashJson({ b: 2, a: 1 }), hashJson({ a: 1, b: 2 }));
});

test('canonicalPair is symmetric and rejects self-pairs', () => {
  assert.deepEqual(canonicalPair('person_z', 'person_a'), {
    leftUserId: 'person_a',
    rightUserId: 'person_z',
    pairKey: '8:person_a|8:person_z',
  });
  assert.equal(
    canonicalPair('person_a|person_b', 'person_c').pairKey,
    '17:person_a|person_b|8:person_c',
  );
  assert.throws(() => canonicalPair('person_a', 'person_a'));
});

test('canonicalPair uses collision-safe length prefixes', () => {
  const ambiguousWithoutLengths = canonicalPair('a:b', 'c').pairKey;
  const differentPair = canonicalPair('a', 'b:c').pairKey;
  assert.notEqual(ambiguousWithoutLengths, differentPair);
});
