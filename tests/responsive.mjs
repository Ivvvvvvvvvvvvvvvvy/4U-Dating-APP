import { chromium } from 'playwright';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];

for (const width of [360, 390, 430]) {
  const page = await browser.newPage({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true });
  await page.goto('http://127.0.0.1:4173', { waitUntil: 'networkidle' });
  const metrics = await page.evaluate(() => ({
    viewport: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    navItems: document.querySelectorAll('.bottom-nav button').length,
    cards: document.querySelectorAll('.masonry-grid > article').length,
  }));
  if (metrics.documentWidth > metrics.viewport) throw new Error(`${width}px viewport overflows to ${metrics.documentWidth}px`);
  if (metrics.navItems !== 4) throw new Error(`${width}px viewport has ${metrics.navItems} nav items`);
  if (metrics.cards !== 4) throw new Error(`${width}px viewport has ${metrics.cards} home cards`);
  results.push(metrics);
  await page.close();
}

await browser.close();
console.log(JSON.stringify({ ok: true, results }));
