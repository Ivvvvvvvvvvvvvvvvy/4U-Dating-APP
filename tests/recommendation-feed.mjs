import assert from 'node:assert/strict';
import { createServer } from 'vite';

const vite = await createServer({
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
});

const countTypes = (cards) => Object.fromEntries(
  ['PERSON', 'ACTIVITY', 'TOPIC'].map((type) => [type, cards.filter((card) => card.cardType === type).length]),
);

try {
  const { personFeed, activityFeed, topicFeed } = await vite.ssrLoadModule('/src/mockData.ts');
  const { createRecommendationFeed, createSeededRandom } = await vite.ssrLoadModule('/src/recommendationFeed.ts');
  const pools = { people: personFeed, activities: activityFeed, topics: topicFeed };
  const originalIds = [...personFeed, ...activityFeed, ...topicFeed].map((card) => card.cardId);
  const originalOrder = {
    people: personFeed.map((card) => card.cardId),
    activities: activityFeed.map((card) => card.cardId),
    topics: topicFeed.map((card) => card.cardId),
  };

  const first = createRecommendationFeed(pools, createSeededRandom(433));
  const replay = createRecommendationFeed(pools, createSeededRandom(433));
  const different = createRecommendationFeed(pools, createSeededRandom(434));

  assert.deepEqual(first.map((card) => card.cardId), replay.map((card) => card.cardId), 'same seed must reproduce the feed');
  assert.notDeepEqual(first.map((card) => card.cardId), different.map((card) => card.cardId), 'different seeds should change the feed');
  assert.deepEqual(countTypes(first.slice(0, 10)), { PERSON: 4, ACTIVITY: 3, TOPIC: 3 }, 'first page must be 4:3:3');
  assert.deepEqual(countTypes(first.slice(10, 20)), { PERSON: 4, ACTIVITY: 3, TOPIC: 3 }, 'second page must be 4:3:3');
  assert.notEqual(first.slice(0, 10).map((card) => card.cardType).join(','), 'PERSON,PERSON,PERSON,PERSON,ACTIVITY,ACTIVITY,ACTIVITY,TOPIC,TOPIC,TOPIC', 'page types must be shuffled');
  assert.equal(first.length, originalIds.length, 'feed must include every source card');
  assert.equal(new Set(first.map((card) => card.cardId)).size, first.length, 'feed cards must not repeat');
  assert.deepEqual([...first.map((card) => card.cardId)].sort(), [...originalIds].sort(), 'feed must preserve the complete source-card set');
  assert.deepEqual(first.map((card) => card.rankPosition), Array.from({ length: first.length }, (_, index) => index + 1), 'rank positions must be globally continuous');
  assert.deepEqual(personFeed.map((card) => card.cardId), originalOrder.people, 'person input was mutated');
  assert.deepEqual(activityFeed.map((card) => card.cardId), originalOrder.activities, 'activity input was mutated');
  assert.deepEqual(topicFeed.map((card) => card.cardId), originalOrder.topics, 'topic input was mutated');
  const pages = Array.from({ length: Math.ceil(first.length / 10) }, (_, index) => first.slice(index * 10, index * 10 + 10));
  pages.forEach((page, index) => assert.ok(page.length > 0 && page.length <= 10, `page ${index + 1} has invalid size`));
  assert.equal(pages.at(-1).length, first.length % 10, 'last page size must match the remaining cards');
  assert.equal(first.slice(20).some((card) => card.cardType === 'TOPIC'), false, 'topics must not repeat after their pool is exhausted');
  assert.ok(pages.at(-1).every((card) => card.cardType === 'PERSON'), 'final page should use the only remaining pool');

  const undersized = createRecommendationFeed(
    { people: personFeed.slice(0, 2), activities: [], topics: topicFeed.slice(0, 1) },
    createSeededRandom(7),
  );
  assert.equal(undersized.length, 3, 'undersized pools must return every available card');
  assert.deepEqual(countTypes(undersized), { PERSON: 2, ACTIVITY: 0, TOPIC: 1 }, 'undersized pools must retain their types');
  assert.deepEqual(createRecommendationFeed({ people: [], activities: [], topics: [] }, createSeededRandom(7)), [], 'empty pools must return an empty feed');

  console.log(JSON.stringify({
    ok: true,
    cards: first.length,
    people: personFeed.length,
    activities: activityFeed.length,
    topics: topicFeed.length,
    firstPage: countTypes(first.slice(0, 10)),
    completePool: true,
  }));
} finally {
  await vite.close();
}
