import assert from 'node:assert/strict';
import { createServer } from 'vite';

const vite = await createServer({
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
});

try {
  const { activities, activityFeed, people } = await vite.ssrLoadModule('/src/mockData.ts');
  const activityIds = activities.map((activity) => activity.id);
  const feedCardIds = activityFeed.map((card) => card.cardId);
  const personIds = new Set(people.map((person) => person.id));

  assert.equal(activities.length, 20, 'activity fixture must contain exactly 20 real activities');
  assert.equal(activityFeed.length, activities.length, 'activity feed must contain one card per activity');
  assert.equal(new Set(activityIds).size, activityIds.length, 'activity fixture IDs must be unique');
  assert.equal(new Set(feedCardIds).size, feedCardIds.length, 'activity feed card IDs must be unique');

  for (const [index, activity] of activities.entries()) {
    assert.equal(activity.publicationStatus, 'PUBLISHED', `${activity.id} must be published`);
    assert.ok(Date.parse(activity.schedule.startsAt) < Date.parse(activity.schedule.endsAt), `${activity.id} must end after it starts`);
    assert.ok(activity.capacity.minimum > 0, `${activity.id} must have a positive minimum capacity`);
    assert.ok(activity.capacity.minimum <= activity.capacity.maximum, `${activity.id} has an invalid capacity range`);
    assert.ok(
      activity.capacity.confirmedCount + activity.capacity.heldCount <= activity.capacity.maximum,
      `${activity.id} has more confirmed and held seats than its maximum`,
    );
    if (activity.fulfillmentStatus === 'FORMED') {
      assert.ok(activity.capacity.confirmedCount >= activity.capacity.minimum, `${activity.id} is formed before reaching its minimum`);
    }
    if (activity.format === 'PAIR') {
      assert.equal(activity.capacity.minimum, 2, `${activity.id} pair activity must require two people`);
      assert.equal(activity.capacity.maximum, 2, `${activity.id} pair activity must allow two people`);
    }
    assert.ok(personIds.has(activity.organizerId), `${activity.id} organizer must reference an existing person`);
    assert.ok(activity.visibleParticipants.some((participant) => participant.personId === activity.organizerId && participant.role === 'ORGANIZER'), `${activity.id} organizer must appear in the authorized preview`);
    for (const participant of activity.visibleParticipants) {
      assert.ok(personIds.has(participant.personId), `${activity.id} participant must reference an existing person`);
    }
    assert.equal(activityFeed[index].entityId, activity.id, `${activity.id} must resolve from its feed card`);
  }

  console.log(JSON.stringify({
    ok: true,
    activityFixtures: activities.length,
    activityFeedCards: activityFeed.length,
    uniqueActivityIds: activityIds.length,
    dataIntegrity: 'passed',
  }));
} finally {
  await vite.close();
}
