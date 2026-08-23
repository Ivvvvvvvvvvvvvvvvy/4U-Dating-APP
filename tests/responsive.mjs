import { chromium } from 'playwright';

const baseUrl = process.env.BASE_URL ?? 'http://127.0.0.1:4173';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
const expectedColumns = new Map([[320,2],[360,2],[390,2],[430,2],[768,3],[1024,4],[1280,4],[1440,5]]);

for (const width of expectedColumns.keys()) {
  const page = await browser.newPage({ viewport: { width, height: 900 }, isMobile: width < 768, hasTouch: width < 768 });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${baseUrl}/home?primary=recommend&secondary=for-you`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  const metrics = await page.evaluate(() => ({
    viewport: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    columns: Number(document.querySelector('.masonry-feed')?.getAttribute('data-columns')),
    cards: document.querySelectorAll('[data-card-type]').length,
    sideNav: getComputedStyle(document.querySelector('.side-nav')).display,
    bottomNav: getComputedStyle(document.querySelector('.bottom-nav')).display,
  }));
  if (metrics.documentWidth > metrics.viewport) throw new Error(width + 'px viewport overflows to ' + metrics.documentWidth + 'px');
  if (metrics.columns !== expectedColumns.get(width)) throw new Error(width + 'px has ' + metrics.columns + ' columns, expected ' + expectedColumns.get(width));
  if (metrics.cards !== 10) throw new Error(width + 'px renders ' + metrics.cards + ' cards');
  if (width < 768 && metrics.bottomNav === 'none') throw new Error(width + 'px mobile navigation missing');
  if (width >= 768 && metrics.sideNav === 'none') throw new Error(width + 'px desktop navigation missing');
  if (errors.length) throw new Error(width + 'px page errors: ' + errors.join(' | '));
  await page.screenshot({ path: '/tmp/4u-responsive-' + width + '.png', fullPage: false });
  results.push(metrics);
  await page.close();
}

const detailPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await detailPage.goto(`${baseUrl}/home?primary=recommend&secondary=for-you`, { waitUntil: 'networkidle' });
await detailPage.getByRole('button', { name: /查看活动：/ }).first().click();
const detailMetrics = await detailPage.evaluate(() => ({ detail: document.querySelector('.detail-rail')?.getBoundingClientRect().width, backgroundCards: document.querySelectorAll('[data-card-type]').length, url: location.pathname }));
if (!detailMetrics.detail || detailMetrics.backgroundCards < 1 || !detailMetrics.url.startsWith('/activities/')) throw new Error('desktop detail rail contract failed');
await detailPage.close();

const appPages = ['/discover?segment=for-you','/messages?category=notifications','/me/permissions','/activities/new/local-draft/1','/search?q=%E7%9C%8B%E5%B1%95'];
for (const path of appPages) {
  const page = await browser.newPage({ viewport: { width: 390, height: 900 }, isMobile: true, hasTouch: true });
  await page.goto(baseUrl + path, { waitUntil: 'networkidle' });
  if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)) throw new Error(path + ' has horizontal overflow');
  await page.close();
}

const fixedDetailActions = [
  { viewport: { width: 390, height: 844 }, mobile: true, route: '/people/person_lan', action: 'person', cta: '心动' },
  { viewport: { width: 390, height: 844 }, mobile: true, route: '/activities/activity_monet_night', action: 'activity', cta: '申请同行' },
  { viewport: { width: 1280, height: 900 }, mobile: false, route: '/people/person_lan', action: 'person', cta: '心动' },
  { viewport: { width: 1280, height: 900 }, mobile: false, route: '/activities/activity_monet_night', action: 'activity', cta: '申请同行' },
];
const fixedActionResults = [];

for (const testCase of fixedDetailActions) {
  const page = await browser.newPage({
    viewport: testCase.viewport,
    isMobile: testCase.mobile,
    hasTouch: testCase.mobile,
  });
  await page.goto(baseUrl + testCase.route, { waitUntil: 'networkidle' });

  const rail = page.locator('.detail-rail');
  const action = page.locator('body > .sticky-action[data-detail-action="' + testCase.action + '"]');
  if (await rail.count() !== 1) throw new Error(testCase.route + ' detail rail missing or duplicated');
  if (await action.count() !== 1) throw new Error(testCase.route + ' fixed action missing or not portaled to body');
  if (await action.getByRole('button', { name: testCase.cta, exact: true }).count() !== 1) {
    throw new Error(testCase.route + ' expected CTA "' + testCase.cta + '" missing');
  }

  const before = await action.boundingBox();
  const railBox = await rail.boundingBox();
  if (!before || !railBox) throw new Error(testCase.route + ' detail rail or fixed action is not visible');
  if (Math.abs(before.y + before.height - testCase.viewport.height) > 1) {
    throw new Error(testCase.route + ' fixed action is not anchored to viewport bottom');
  }
  if (Math.abs(before.x - railBox.x) > 1 || Math.abs(before.width - railBox.width) > 1) {
    throw new Error(testCase.route + ' fixed action is not aligned with detail rail');
  }

  const scroll = await rail.evaluate(async (element) => {
    const scrollHeight = element.scrollHeight;
    const clientHeight = element.clientHeight;
    element.scrollTop = scrollHeight;
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
    return { scrollHeight, clientHeight, scrollTop: element.scrollTop };
  });
  if (scroll.scrollHeight <= scroll.clientHeight || scroll.scrollTop <= 0) {
    throw new Error(testCase.route + ' detail rail did not actually scroll');
  }

  const after = await action.boundingBox();
  if (!after
    || Math.abs(before.x - after.x) > 1
    || Math.abs(before.y - after.y) > 1
    || Math.abs(before.width - after.width) > 1
    || Math.abs(before.height - after.height) > 1
    || Math.abs(after.y + after.height - testCase.viewport.height) > 1) {
    throw new Error(testCase.route + ' fixed action moved while detail rail scrolled');
  }

  fixedActionResults.push({ route: testCase.route, viewport: testCase.viewport, scrollTop: scroll.scrollTop });
  await page.close();
}

await browser.close();
console.log(JSON.stringify({ ok: true, results, desktopDetail: detailMetrics, mobilePages: appPages.length, fixedDetailActions: fixedActionResults }));
