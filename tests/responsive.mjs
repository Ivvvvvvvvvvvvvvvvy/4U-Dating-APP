import { chromium } from 'playwright';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
const expectedColumns = new Map([[320,2],[360,2],[390,2],[430,2],[768,3],[1024,4],[1280,4],[1440,5]]);

for (const width of expectedColumns.keys()) {
  const page = await browser.newPage({ viewport: { width, height: 900 }, isMobile: width < 768, hasTouch: width < 768 });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('http://127.0.0.1:4173/home?primary=recommend&secondary=for-you', { waitUntil: 'networkidle' });
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
  if (metrics.cards !== 8) throw new Error(width + 'px renders ' + metrics.cards + ' cards');
  if (width < 768 && metrics.bottomNav === 'none') throw new Error(width + 'px mobile navigation missing');
  if (width >= 768 && metrics.sideNav === 'none') throw new Error(width + 'px desktop navigation missing');
  if (errors.length) throw new Error(width + 'px page errors: ' + errors.join(' | '));
  await page.screenshot({ path: '/tmp/4u-responsive-' + width + '.png', fullPage: false });
  results.push(metrics);
  await page.close();
}

const detailPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await detailPage.goto('http://127.0.0.1:4173/home?primary=recommend&secondary=for-you', { waitUntil: 'networkidle' });
await detailPage.getByRole('button', { name: /查看活动：/ }).first().click();
const detailMetrics = await detailPage.evaluate(() => ({ detail: document.querySelector('.detail-rail')?.getBoundingClientRect().width, backgroundCards: document.querySelectorAll('[data-card-type]').length, url: location.pathname }));
if (!detailMetrics.detail || detailMetrics.backgroundCards < 1 || !detailMetrics.url.startsWith('/activities/')) throw new Error('desktop detail rail contract failed');
await detailPage.close();

const appPages = ['/discover?segment=for-you','/messages?category=notifications','/me/permissions','/activities/new/local-draft/1','/search?q=%E7%9C%8B%E5%B1%95'];
for (const path of appPages) {
  const page = await browser.newPage({ viewport: { width: 390, height: 900 }, isMobile: true, hasTouch: true });
  await page.goto('http://127.0.0.1:4173' + path, { waitUntil: 'networkidle' });
  if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)) throw new Error(path + ' has horizontal overflow');
  await page.close();
}

await browser.close();
console.log(JSON.stringify({ ok: true, results, desktopDetail: detailMetrics, mobilePages: appPages.length }));
