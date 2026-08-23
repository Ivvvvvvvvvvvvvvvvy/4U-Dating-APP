import { chromium } from 'playwright';

const baseUrl = process.env.BASE_URL ?? 'http://127.0.0.1:4173';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const errors = [];
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
page.on('pageerror', (error) => errors.push(error.message));
const assert = (value, message) => { if (!value) throw new Error(message); };

await page.goto(`${baseUrl}/home?primary=recommend&secondary=for-you`, { waitUntil: 'networkidle' });
assert(await page.getByRole('navigation', { name: '主导航' }).isVisible(), 'mobile navigation missing');
assert(await page.locator('[data-card-type]').count() === 10, 'home should render one recommendation page');
const recommendationCounts = await page.locator('[data-card-type]').evaluateAll((nodes) => nodes.reduce((counts, node) => ({ ...counts, [node.dataset.cardType]: (counts[node.dataset.cardType] ?? 0) + 1 }), {}));
assert(recommendationCounts.PERSON === 4 && recommendationCounts.ACTIVITY === 3 && recommendationCounts.TOPIC === 3, 'home recommendation ratio must be 4:3:3');
assert(await page.locator('[data-card-id]').evaluateAll((nodes) => new Set(nodes.map((node) => node.dataset.cardId)).size === nodes.length), 'home recommendation page contains duplicates');
const firstPageIds = await page.locator('[data-card-id]').evaluateAll((nodes) => nodes.map((node) => node.dataset.cardId));
await page.locator('[data-card-type="TOPIC"] h2').first().click();
assert(page.url().includes('/topics/'), 'visible topic title should open detail');
await page.getByRole('button', { name: '返回' }).click();
assert(JSON.stringify(await page.locator('[data-card-id]').evaluateAll((nodes) => nodes.map((node) => node.dataset.cardId))) === JSON.stringify(firstPageIds), 'recommendations changed after returning from detail');
assert(await page.getByRole('button', { name: '加载更多推荐' }).count() === 0, 'recommendations should not require a load-more button');
await page.mouse.wheel(0, 100_000);
await page.waitForFunction(() => document.querySelectorAll('[data-card-type]').length >= 20);
assert(await page.locator('[data-card-type]').count() === 20, 'load more should append one recommendation page');
const twoPageCounts = await page.locator('[data-card-type]').evaluateAll((nodes) => nodes.reduce((counts, node) => ({ ...counts, [node.dataset.cardType]: (counts[node.dataset.cardType] ?? 0) + 1 }), {}));
assert(twoPageCounts.PERSON === 8 && twoPageCounts.ACTIVITY === 6 && twoPageCounts.TOPIC === 6, 'first two recommendation pages must preserve 4:3:3');
const twoPageIds = await page.locator('[data-card-id]').evaluateAll((nodes) => nodes.map((node) => node.dataset.cardId));
await page.locator('[data-card-type]').nth(14).locator('.card-main-action').click();
await page.getByRole('button', { name: '返回' }).click();
assert(await page.locator('[data-card-type]').count() === 20, 'detail return should preserve loaded recommendation pages');
assert(JSON.stringify(await page.locator('[data-card-id]').evaluateAll((nodes) => nodes.map((node) => node.dataset.cardId))) === JSON.stringify(twoPageIds), 'loaded recommendations changed after detail return');

await page.getByRole('tab', { name: '活动', exact: true }).click();
assert(page.url().includes('primary=activities'), 'activity channel should write URL');
assert(await page.locator('[data-card-type]').evaluateAll((nodes) => nodes.every((node) => node.dataset.cardType === 'ACTIVITY')), 'activity channel leaked another card type');
assert(await page.locator('[data-card-type="ACTIVITY"]').count() === 20, 'activity channel should render 20 real activities');
await page.getByRole('tab', { name: '话题', exact: true }).click();
assert(await page.locator('[data-card-type]').evaluateAll((nodes) => nodes.every((node) => node.dataset.cardType === 'TOPIC')), 'topic channel leaked another card type');

await page.getByRole('button', { name: '寻觅' }).click();
assert(page.url().includes('/discover'), 'discover route missing');
assert(await page.locator('[data-card-type]').evaluateAll((nodes) => nodes.every((node) => node.dataset.cardType === 'PERSON')), 'discover must contain only people');
assert(await page.getByText('找活动').count() === 0, 'discover must not expose find-activity mode');

await page.getByRole('button', { name: '心动', exact: true }).first().click();
assert(await page.getByRole('dialog', { name: '心动只属于你' }).isVisible(), 'one-time heart privacy education missing');
await page.getByRole('button', { name: '知道了，继续心动' }).click();
await page.waitForTimeout(450);
assert(await page.getByText('已心动，仅你可见').isVisible(), 'private heart result missing');

await page.getByRole('button', { name: /查看个人：/ }).first().click();
assert(page.url().includes('/people/'), 'person detail URL missing');
assert(await page.locator('#person-detail-title').isVisible(), 'person detail missing');
await page.getByRole('button', { name: '返回' }).click();
assert(page.url().includes('/discover'), 'back should restore discover URL');

await page.getByRole('button', { name: '首页' }).click();
await page.getByRole('button', { name: '搜索' }).click();
assert(page.url().includes('/search'), 'search route missing');
await page.getByRole('searchbox').fill('看展');
assert(await page.getByRole('heading', { name: '活动' }).isVisible(), 'grouped activity search results missing');
await page.getByRole('button', { name: '关闭搜索' }).click();

await page.locator('.bottom-nav').getByRole('button', { name: /^消息/ }).click();
await page.getByRole('tab', { name: '通知' }).click();
assert(await page.getByText('请在 12 小时内确认席位').isVisible(), 'actionable notification missing');
await page.getByRole('tab', { name: '匹配' }).click();
await page.getByRole('button', { name: /打开阿岚/ }).click();
assert(await page.getByText('连接正常').isVisible(), 'connection status missing');
await page.getByLabel('消息草稿').fill('你好，很高兴认识你');
await page.getByRole('button', { name: '发送', exact: true }).click();
await page.waitForTimeout(450);
assert(await page.getByText('你好，很高兴认识你').isVisible(), 'explicitly sent message missing');

await page.goto(`${baseUrl}/activities/activity_vinyl_night`, { waitUntil: 'networkidle' });
assert(await page.getByRole('button', { name: '当前不可申请' }).isDisabled(), 'closed activity must not accept applications');
await page.goto(`${baseUrl}/activities/activity_badminton_rotation`, { waitUntil: 'networkidle' });
assert(await page.getByRole('heading', { name: '羽毛球搭子轮转局：每 15 分钟换搭档' }).isVisible(), 'expanded activity detail missing');
await page.goto(`${baseUrl}/activities/activity_wutong_city_walk`, { waitUntil: 'networkidle' });
assert(await page.getByRole('button', { name: '查看申请' }).isVisible(), 'existing application must not be submitted twice');
await page.goto(`${baseUrl}/activities/activity_monet_night`, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: '申请同行' }).click();
assert(await page.getByRole('dialog', { name: '确认你的参与申请' }).isVisible(), 'application confirmation missing');
await page.keyboard.press('Escape');
assert(page.url().includes('/activities/activity_monet_night'), 'Escape on confirmation must keep activity detail open');
assert(await page.getByRole('dialog').count() === 0, 'Escape should close only the top modal');
await page.getByRole('button', { name: '申请同行' }).click();
await page.getByRole('button', { name: '确认并提交申请' }).click();
await page.waitForTimeout(450);
assert(await page.getByRole('button', { name: '查看申请' }).isVisible(), 'submitted application state missing');
await page.goto(`${baseUrl}/activities/activity_missing`, { waitUntil: 'networkidle' });
assert(await page.getByRole('heading', { name: '内容暂不可用' }).isVisible(), 'invalid detail route must show not-found state');

assert(errors.length === 0, 'browser errors: ' + errors.join(' | '));
await page.screenshot({ path: '/tmp/4u-final.png', fullPage: false });
console.log(JSON.stringify({ ok: true, recommendationCards: 20, recommendationRatio: '4:3:3', privacyEducation: true, groupedSearch: true, consoleErrors: errors.length }));
await browser.close();
