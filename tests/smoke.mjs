import { chromium } from 'playwright';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const errors = [];
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
page.on('pageerror', (error) => errors.push(error.message));

await page.goto('http://127.0.0.1:4173', { waitUntil: 'networkidle' });
const assert = (value, message) => { if (!value) throw new Error(message); };

assert(await page.getByRole('navigation', { name: '主导航' }).isVisible(), 'bottom nav missing');
assert(await page.locator('.masonry-grid > article').count() === 4, 'home should render four cards');
assert((await page.locator('.mode-ticket--duo').count()) >= 1, 'duo card missing');
assert((await page.locator('.mode-ticket--group').count()) >= 1, 'group card missing');

await page.getByRole('button', { name: '活动', exact: true }).click();
await page.getByRole('button', { name: '双人同行', exact: true }).click();
assert(await page.locator('.activity-card').count() === 2, 'duo filter should show two activities');

await page.getByRole('button', { name: '推荐', exact: true }).click();
await page.locator('.activity-card').first().click();
assert(await page.getByRole('button', { name: '申请同行' }).isVisible(), 'duo detail CTA missing');
await page.getByRole('button', { name: '申请同行' }).click();
assert(await page.getByText('确认你的参与意愿').isVisible(), 'join confirmation missing');
await page.getByRole('button', { name: '确认并提交申请' }).click();
assert(await page.getByText('申请已提交', { exact: true }).isVisible(), 'joined state missing');
await page.getByRole('button', { name: '返回' }).click();

await page.getByRole('button', { name: '寻觅' }).click();
assert(await page.getByRole('heading', { name: '寻觅' }).isVisible(), 'discover page missing');
await page.getByRole('button', { name: '找活动' }).click();
await page.getByRole('button', { name: '本周末' }).click();

await page.getByRole('button', { name: '消息' }).click();
assert(await page.getByRole('heading', { name: '消息' }).isVisible(), 'messages page missing');
await page.getByRole('button', { name: '系统通知' }).click();
assert(await page.getByText('真人认证已通过').isVisible(), 'system messages missing');

await page.getByRole('button', { name: '我的' }).click();
assert(await page.getByRole('heading', { name: '林川' }).isVisible(), 'profile page missing');

await page.getByRole('button', { name: '首页' }).click();
await page.getByRole('button', { name: '搜索' }).click();
assert(await page.getByPlaceholder('搜活动、地点或话题').isVisible(), 'search panel missing');
await page.getByPlaceholder('搜活动、地点或话题').fill('看展');
assert(await page.locator('.search-result').count() === 1, 'search result mismatch');
await page.getByRole('button', { name: '关闭搜索' }).click();

await page.getByRole('button', { name: '发起' }).click();
assert(await page.getByText('发起一场').isVisible(), 'create flow missing');
await page.getByLabel('活动标题').fill('周日下午，一起去看新展');
await page.getByRole('button', { name: '两人成行，可继续招募', exact: false }).click();
await page.getByRole('button', { name: '下一步' }).click();
assert(await page.getByText('2 人成行 · 可继续招募').isVisible(), 'flexible mode summary missing');
await page.getByRole('button', { name: '保存活动草稿' }).click();
assert(await page.getByRole('heading', { name: '活动已保存' }).isVisible(), 'create success missing');

assert(errors.length === 0, `browser errors: ${errors.join(' | ')}`);
await page.screenshot({ path: '/tmp/4u-final.png', fullPage: false });
console.log(JSON.stringify({ ok: true, interactions: 16, consoleErrors: errors.length }));
await browser.close();
