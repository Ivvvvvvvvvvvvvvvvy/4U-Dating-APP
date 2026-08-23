import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('../src/mockData.ts', import.meta.url), 'utf8');
const domain = fs.readFileSync(new URL('../src/domain.ts', import.meta.url), 'utf8');

for (const cardType of ['PERSON', 'ACTIVITY', 'ACTIVITY_OPPORTUNITY', 'TOPIC']) {
  assert.match(domain, new RegExp(cardType + " = '" + cardType + "'"), 'missing card type ' + cardType);
}
for (const field of ['schemaVersion', 'cardId', 'cardType', 'pathType', 'entityId', 'entityVersion', 'requestId', 'rankPosition', 'reason', 'expiresAt', 'presentation', 'allowedActions']) {
  assert.match(domain, new RegExp('readonly ' + field), 'missing FeedCard field ' + field);
}
for (const forbidden of ['incomingHeart', 'mutualOnHeart', 'exactMeetingPoint', 'compatibilityScore']) {
  assert.equal(source.includes(forbidden), false, 'public fixtures leak forbidden field ' + forbidden);
}
assert.match(domain, /DRAFT[\s\S]*REVIEWING[\s\S]*PUBLISHED[\s\S]*FROZEN/, 'activity publication states incomplete');
assert.match(domain, /PENDING_REVIEW[\s\S]*WAITLISTED[\s\S]*SEAT_OFFERED[\s\S]*CONFIRMED/, 'application states incomplete');

console.log(JSON.stringify({ ok: true, feedCardTypes: 4, envelopeFields: 12, privacyFixtureScan: 'passed' }));
