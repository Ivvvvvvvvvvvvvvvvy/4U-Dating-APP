import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const baseUrl = process.env.BASE_URL ?? 'http://127.0.0.1:4173';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const failures = [];

page.on('pageerror', (error) => failures.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error') failures.push(message.text());
});

await page.goto(`${baseUrl}/me/profile`, { waitUntil: 'networkidle' });
assert.equal(await page.locator('#profile-name').textContent(), '林川');
assert.equal(await page.locator('.side-profile b').textContent(), '林川');
assert.equal(await page.locator('.side-profile small').textContent(), '体验账号');
const profileImage = page.locator('.profile-identity .safe-image img');
const sideImage = page.locator('.side-profile .safe-image img');
await Promise.all([profileImage.waitFor(), sideImage.waitFor()]);
assert.equal(await profileImage.getAttribute('src'), await sideImage.getAttribute('src'));
assert.equal(await profileImage.evaluate((image) => image.complete && image.naturalWidth > 0), true);
assert.equal(await sideImage.evaluate((image) => image.complete && image.naturalWidth > 0), true);

await page.goto(`${baseUrl}/discover?segment=for-you`, { waitUntil: 'networkidle' });
const cards = page.locator('[data-card-type="PERSON"]');
const candidateCount = await cards.count();
assert.equal(candidateCount, 49, 'discover must expose all 49 candidate profiles');
for (let index = 0; index < candidateCount; index += 1) {
  const image = cards.nth(index).locator('.safe-image img');
  await image.scrollIntoViewIfNeeded();
  await image.waitFor();
  assert.equal(
    await image.evaluate((node) => node.complete && node.naturalWidth > 0),
    true,
    `candidate image ${index + 1} did not load`,
  );
}
assert.equal(await page.locator('.safe-image--failed').count(), 0, 'a visible profile image fell back');

await page.goto(`${baseUrl}/topics/topic_first_meeting`, { waitUntil: 'networkidle' });
assert.equal(await page.getByText('小满', { exact: true }).count(), 0, 'legacy experience-account name is still visible');
assert.ok(await page.getByText('林川', { exact: true }).count() > 0, 'Lin Chuan is missing from topic comments');

const favicon = await page.locator('link[rel="icon"]').getAttribute('href');
assert.ok(favicon?.endsWith('favicon.png'), 'PNG favicon is not linked');
const faviconResponse = await page.request.get(new URL(favicon, page.url()).href);
assert.equal(faviconResponse.ok(), true, 'favicon request failed');
assert.ok(
  (faviconResponse.headers()['content-type'] ?? '').startsWith('image/png'),
  'favicon response is not PNG',
);
assert.deepEqual(failures, [], 'browser errors: ' + failures.join(' | '));

console.log(JSON.stringify({ ok: true, totalMockUsers: candidateCount + 1, currentUser: '林川', candidateImagesChecked: candidateCount, favicon: 'png' }));
await browser.close();
