import { chromium } from 'playwright';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const errors = [];
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
page.on('pageerror', (error) => errors.push(error.message));
const assert = (value, message) => { if (!value) throw new Error(message); };

await page.goto('http://127.0.0.1:4173/home?primary=recommend&secondary=for-you', { waitUntil: 'networkidle' });
assert(await page.getByRole('navigation', { name: '主导航' }).isVisible(), 'mobile navigation missing');
assert(await page.locator('[data-card-type]').count() === 8, 'home should render eight contract cards');
assert(JSON.stringify(await page.locator('[data-card-type]').evaluateAll((nodes) => nodes.slice(0, 4).map((node) => node.dataset.cardType))) === JSON.stringify(['ACTIVITY','PERSON','TOPIC','ACTIVITY']), 'first four card order mismatch');
await page.locator('[data-card-type="TOPIC"] h2').first().click();
assert(page.url().includes('/topics/'), 'visible topic title should open detail');
await page.getByRole('button', { name: '返回' }).click();

await page.getByRole('tab', { name: '活动', exact: true }).click();
assert(page.url().includes('primary=activities'), 'activity channel should write URL');
assert(await page.locator('[data-card-type]').evaluateAll((nodes) => nodes.every((node) => node.dataset.cardType === 'ACTIVITY')), 'activity channel leaked another card type');
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

await page.getByRole('button', { name: '消息' }).click();
await page.getByRole('tab', { name: '通知' }).click();
assert(await page.getByText('请在 12 小时内确认席位').isVisible(), 'actionable notification missing');
await page.getByRole('tab', { name: '匹配' }).click();
await page.getByRole('button', { name: /打开阿岚/ }).click();
assert(await page.getByText('WebSocket').isVisible(), 'transport status missing');
await page.getByLabel('消息草稿').fill('你好，很高兴认识你');
await page.getByRole('button', { name: '明确发送' }).click();
await page.waitForTimeout(450);
assert(await page.getByText('你好，很高兴认识你').isVisible(), 'explicitly sent message missing');

await page.goto('http://127.0.0.1:4173/activities/activity_vinyl_night', { waitUntil: 'networkidle' });
assert(await page.getByRole('button', { name: '当前不可申请' }).isDisabled(), 'closed activity must not accept applications');
await page.goto('http://127.0.0.1:4173/activities/activity_wutong_city_walk', { waitUntil: 'networkidle' });
assert(await page.getByRole('button', { name: '查看申请' }).isVisible(), 'existing application must not be submitted twice');
await page.goto('http://127.0.0.1:4173/activities/activity_monet_night', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: '申请同行' }).click();
assert(await page.getByRole('dialog', { name: '确认你的参与申请' }).isVisible(), 'application confirmation missing');
await page.keyboard.press('Escape');
assert(page.url().includes('/activities/activity_monet_night'), 'Escape on confirmation must keep activity detail open');
assert(await page.getByRole('dialog').count() === 0, 'Escape should close only the top modal');
await page.getByRole('button', { name: '申请同行' }).click();
await page.getByRole('button', { name: '确认并提交申请' }).click();
await page.waitForTimeout(450);
assert(await page.getByRole('button', { name: '查看申请' }).isVisible(), 'submitted application state missing');
await page.goto('http://127.0.0.1:4173/activities/activity_missing', { waitUntil: 'networkidle' });
assert(await page.getByRole('heading', { name: '内容暂不可用' }).isVisible(), 'invalid detail route must show not-found state');

assert(errors.length === 0, 'browser errors: ' + errors.join(' | '));
await page.screenshot({ path: '/tmp/4u-final.png', fullPage: false });
console.log(JSON.stringify({ ok: true, contractCards: 8, privacyEducation: true, groupedSearch: true, consoleErrors: errors.length }));
await browser.close();
