import { chromium } from 'playwright';

const baseUrl = process.env.BASE_URL ?? 'http://127.0.0.1:4173';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const viewports = [
  { width: 320, height: 568 },
  { width: 360, height: 640 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
];
const routes = [
  '/home?primary=recommend&secondary=for-you',
  '/home?primary=activities&secondary=all',
  '/home?primary=topics&secondary=hot',
  '/home?primary=topics&secondary=relationship',
  '/home?primary=topics&secondary=lifestyle',
  '/home?primary=topics&secondary=expression',
  '/discover?segment=for-you',
  '/messages?category=matches',
  '/messages?category=activities',
  '/messages?category=notifications',
  '/messages/match/thread_match_lan',
  '/messages/activity/thread_activity_wutong',
  '/messages/discussion/thread_topic_first_meeting',
  '/me/profile',
  '/me/relationship',
  '/me/assets',
  '/me/permissions',
  '/search?q=%E7%9C%8B%E5%B1%95',
  '/activities/new/local-draft/1',
  '/activities/new/local-draft/2',
  '/activities/activity_monet_night',
  '/people/person_lan',
  '/topics/topic_first_meeting',
  '/topics/topic_reply_frequency',
  '/topics/topic_seven_day_trip',
  '/topics/topic_weekend_breakfast',
  '/activities/opportunity_monet_exhibition',
];

const failures = [];
let checks = 0;
const closeEnough = (left, right) => Math.abs(left - right) <= 1;

for (const viewport of viewports) {
  for (const route of routes) {
    const page = await browser.newPage({ viewport, isMobile: true, hasTouch: true });
    const browserErrors = [];
    page.on('pageerror', (error) => browserErrors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') browserErrors.push(message.text()); });
    const response = await page.goto(baseUrl + route, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForTimeout(300);

    const context = `${viewport.width}x${viewport.height} ${route}`;
    const fail = (message) => failures.push(`${context}: ${message}`);
    if (response?.status() !== 200) fail(`HTTP ${response?.status()}`);
    if (browserErrors.length) fail(`browser errors: ${browserErrors.join(' | ')}`);

    const pageGeometry = await page.evaluate(() => ({
      viewportWidth: innerWidth,
      documentWidth: document.documentElement.scrollWidth,
    }));
    if (pageGeometry.documentWidth > pageGeometry.viewportWidth) {
      fail(`horizontal overflow ${pageGeometry.documentWidth}px > ${pageGeometry.viewportWidth}px`);
    }

    const fixedSelector = route.startsWith('/messages/')
      ? '.chat-composer'
      : route.startsWith('/activities/activity_') || route.startsWith('/people/') || route.includes('opportunity_') || route.includes('topic_seven_day_trip') || route.includes('topic_weekend_breakfast')
        ? '.sticky-action'
        : route.startsWith('/home')
            ? '.floating-create'
            : null;

    if (fixedSelector) {
      const fixed = page.locator(fixedSelector);
      if (await fixed.count()) {
        const before = await fixed.boundingBox();
        if (!before) fail(`${fixedSelector} is not visible`);
        else {
          if (before.y < -1 || before.y + before.height > viewport.height + 1) {
            fail(`${fixedSelector} is outside viewport at ${before.y}-${before.y + before.height}`);
          }
          if (route.startsWith('/home') && before.y + before.height > viewport.height - 70) {
            fail(`${fixedSelector} overlaps bottom navigation`);
          }
          if (route.startsWith('/activities/') || route.startsWith('/people/') || route.startsWith('/topics/')) {
            await page.locator('.detail-rail').evaluate((element) => { element.scrollTop = element.scrollHeight; });
            await page.waitForTimeout(100);
            const after = await fixed.boundingBox();
            if (!after || !closeEnough(before.y, after.y) || !closeEnough(before.y + before.height, after.y + after.height)) {
              fail(`${fixedSelector} moved while detail scrolled (${before.y}-${before.y + before.height} -> ${after?.y}-${after ? after.y + after.height : undefined})`);
            }
          }
        }
      }
    }

    if (route.startsWith('/search')) {
      const clear = await page.locator('.search-clear').boundingBox();
      const input = await page.locator('input[type=search]').boundingBox();
      if (!clear || !input || clear.x + clear.width > input.x + input.width + 1 || clear.x < input.x) {
        fail('custom search clear button is outside input');
      }
    }

    if (route.includes('/activities/new/') && route.endsWith('/2')) {
      const actionRow = page.locator('.form-actions');
      await actionRow.scrollIntoViewIfNeeded();
      const actionBox = await actionRow.boundingBox();
      if (!actionBox || actionBox.x < -1 || actionBox.x + actionBox.width > viewport.width + 1) {
        fail('create step 2 actions overflow horizontally');
      }
    }

    if (route === '/messages/discussion/thread_topic_first_meeting') {
      const tools = page.locator('.discussion-tools');
      if (await tools.count() !== 1) fail('discussion tools are missing');
      else {
        const composerBox = await page.locator('.chat-composer').boundingBox();
        const toolsBox = await tools.boundingBox();
        if (!composerBox || !toolsBox || toolsBox.x < composerBox.x - 1 || toolsBox.x + toolsBox.width > composerBox.x + composerBox.width + 1) {
          fail('discussion tools overflow the composer');
        }
      }
    }

    checks += 1;
    await page.close();
  }
}

for (const viewport of viewports) {
  const page = await browser.newPage({ viewport, isMobile: true, hasTouch: true });
  const context = `${viewport.width}x${viewport.height} modal`;
  const fail = (message) => failures.push(`${context}: ${message}`);
  await page.goto(baseUrl + '/discover?segment=for-you', { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.evaluate(() => localStorage.removeItem('4u:rfc:heart-education'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: '心动', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: '心动只属于你' });
  const dialogBox = await dialog.boundingBox();
  if (!dialogBox || dialogBox.y < -1 || dialogBox.y + dialogBox.height > viewport.height + 1) fail('heart dialog is clipped');
  const bodyOverflow = await page.evaluate(() => getComputedStyle(document.body).overflow);
  if (bodyOverflow !== 'hidden') fail(`background scroll is not locked (${bodyOverflow})`);
  await page.getByRole('button', { name: '关闭' }).click();
  await page.goto(baseUrl + '/activities/activity_monet_night', { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.getByRole('button', { name: '申请同行' }).click();
  const joinDialog = page.getByRole('dialog', { name: '确认你的参与申请' });
  const joinBox = await joinDialog.boundingBox();
  if (!joinBox || joinBox.y < -1 || joinBox.y + joinBox.height > viewport.height + 1) fail('join dialog is clipped');
  checks += 2;
  await page.close();
}

for (const viewport of viewports) {
  const context = await browser.newContext({ viewport, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.goto(baseUrl + '/messages/match/thread_match_lan', { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await page.waitForTimeout(250);
  const composer = await page.locator('.chat-composer').boundingBox();
  const banner = await page.locator('.offline-banner').boundingBox();
  if (!composer || composer.y < -1 || composer.y + composer.height > viewport.height + 1) {
    failures.push(`${viewport.width}x${viewport.height} offline chat: composer is clipped`);
  }
  if (!banner || banner.y < -1 || banner.y + banner.height > viewport.height + 1) {
    failures.push(`${viewport.width}x${viewport.height} offline chat: banner is clipped`);
  }
  if (await page.locator('.composer-status').count() !== 1) {
    failures.push(`${viewport.width}x${viewport.height} offline chat: status message missing`);
  }
  checks += 1;
  await context.setOffline(false);
  await context.close();
}

for (const viewport of viewports) {
  const page = await browser.newPage({ viewport, isMobile: true, hasTouch: true });
  const contextLabel = `${viewport.width}x${viewport.height} topic vote`;
  const fail = (message) => failures.push(`${contextLabel}: ${message}`);
  await page.goto(baseUrl + '/topics/topic_first_meeting', { waitUntil: 'domcontentloaded', timeout: 30_000 });
  const stageOne = page.locator('.topic-option').first();
  if (await stageOne.count() !== 1) fail('stage-one choices are missing');
  else {
    await stageOne.click();
    const actions = page.locator('.topic-vote-actions');
    await actions.scrollIntoViewIfNeeded();
    const actionBox = await actions.boundingBox();
    if (!actionBox || actionBox.x < -1 || actionBox.x + actionBox.width > viewport.width + 1) fail('stage-two actions overflow');
    await page.locator('.topic-option').first().click();
    await page.getByRole('button', { name: '确认', exact: true }).click();
    const entries = page.locator('.topic-match-entry');
    if (await entries.count() !== 3) fail('result match entries are incomplete');
    else {
      await entries.first().click();
      const dialog = page.getByRole('dialog');
      const searchingBox = await dialog.boundingBox();
      if (!searchingBox || searchingBox.y < -1 || searchingBox.y + searchingBox.height > viewport.height + 1) fail('searching match dialog is clipped');
      await page.waitForTimeout(1900);
      const matchedBox = await dialog.boundingBox();
      if (!matchedBox || matchedBox.y < -1 || matchedBox.y + matchedBox.height > viewport.height + 1) fail('matched dialog is clipped');
    }
  }
  checks += 1;
  await page.close();
}

await browser.close();
if (failures.length) throw new Error(`mobile overlap audit failed (${failures.length}):\n${failures.join('\n')}`);
console.log(JSON.stringify({ ok: true, viewports: viewports.length, routes: routes.length, checks }));
