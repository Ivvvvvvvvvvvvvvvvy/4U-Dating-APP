import { chromium } from 'playwright';

const baseUrl = process.env.BASE_URL ?? 'http://127.0.0.1:4173';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const assert = (value, message) => { if (!value) throw new Error(message); };

for (const width of [320, 390, 430]) {
  const page = await browser.newPage({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true });
  await page.goto(`${baseUrl}/home?primary=recommend&secondary=for-you`, { waitUntil: 'networkidle' });
  const header = await page.evaluate(() => {
    const rect = (selector) => document.querySelector(selector)?.getBoundingClientRect().toJSON();
    return {
      brand: rect('.mobile-brand-bar .brand'),
      tabs: rect('.mobile-brand-bar .primary-tabs'),
      actions: rect('.mobile-brand-actions'),
      overflow: document.documentElement.scrollWidth - innerWidth,
      secondaryTabs: document.querySelectorAll('.secondary-tabs').length,
    };
  });
  assert(header.brand && header.tabs && header.actions, `${width}px unified header missing`);
  assert(Math.abs(header.brand.y + header.brand.height / 2 - (header.tabs.y + header.tabs.height / 2)) < 6, `${width}px brand and tabs are not aligned`);
  assert(header.brand.x + header.brand.width <= header.tabs.x + 1, `${width}px brand overlaps tabs`);
  assert(header.tabs.x + header.tabs.width <= header.actions.x + 1, `${width}px tabs overlap actions`);
  assert(header.overflow <= 0, `${width}px header overflows horizontally`);
  assert(header.secondaryTabs === 0, `${width}px secondary filter bubbles remain`);
  assert(await page.locator('[data-card-type="PERSON"] .compatibility-badge').count() > 0, `${width}px home person compatibility is missing`);
  await page.getByRole('tab', { name: '话题', exact: true }).click();
  assert(await page.getByText('先聊话题，再决定是否认识').count() === 0, `${width}px topic lead copy remains`);
  await page.close();
}

const likePage = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await likePage.goto(`${baseUrl}/discover?segment=for-you`, { waitUntil: 'networkidle' });
assert(await likePage.locator('.compatibility-badge').count() === 0, 'compatibility should only be exposed on home recommendations');
await likePage.evaluate(() => localStorage.removeItem('4u:rfc:heart-education'));
await likePage.reload({ waitUntil: 'networkidle' });
const likeButton = likePage.getByRole('button', { name: '心动', exact: true }).first();
const likeBox = await likeButton.boundingBox();
assert(likeBox && likeBox.height <= 36, 'like control was not visually reduced');
await likeButton.click();
await likePage.getByRole('button', { name: '知道了，继续心动' }).click();
await likePage.waitForTimeout(500);
assert(await likePage.getByRole('button', { name: '取消喜欢' }).first().getByText('已喜欢').isVisible(), 'like control did not change to 已喜欢');
await likePage.close();

for (const route of [
  '/messages/match/thread_match_lan',
  '/messages/activity/thread_activity_wutong',
  '/messages/discussion/thread_topic_first_meeting',
]) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await page.goto(baseUrl + route, { waitUntil: 'networkidle' });
  const geometry = await page.evaluate(() => {
    const buttons = [...document.querySelectorAll('.discussion-end-actions button')].map((button) => ({
      text: button.textContent?.trim(),
      box: button.getBoundingClientRect().toJSON(),
    }));
    const composer = document.querySelector('.chat-composer')?.getBoundingClientRect().toJSON();
    const textarea = document.querySelector('.chat-composer textarea')?.getBoundingClientRect().toJSON();
    return { buttons, composer, textarea, viewportHeight: innerHeight };
  });
  assert(geometry.buttons.length === 3, `${route} does not show three conversation actions`);
  assert(geometry.buttons.map((item) => item.text).join('|') === '继续认识|结束讨论|举报', `${route} action labels differ`);
  assert(Math.max(...geometry.buttons.map((item) => item.box.y)) - Math.min(...geometry.buttons.map((item) => item.box.y)) <= 1, `${route} actions are not on one row`);
  assert(geometry.composer && Math.abs(geometry.composer.bottom - geometry.viewportHeight) <= 1, `${route} composer is not attached to viewport bottom`);
  assert(geometry.textarea && geometry.textarea.y >= Math.max(...geometry.buttons.map((item) => item.box.bottom)), `${route} input is not below the action row`);
  await page.close();
}

const flow = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await flow.goto(`${baseUrl}/people/person_muye`, { waitUntil: 'networkidle' });
assert(await flow.getByRole('button', { name: '发起对话' }).count() === 0, 'ordinary public profile must not expose direct conversation');
await flow.evaluate(() => {
  history.pushState({ __key: 'forged-activity-state', activityId: 'activity_wutong_city_walk', canStartConversation: true }, '', '/people/person_muye');
  dispatchEvent(new PopStateEvent('popstate'));
});
await flow.waitForTimeout(200);
assert(await flow.getByRole('button', { name: '发起对话' }).count() === 0, 'non-participant gained messaging through forged activity state');
await flow.goto(`${baseUrl}/activities/activity_wutong_city_walk`, { waitUntil: 'networkidle' });
await flow.getByRole('button', { name: '查看参与者：宁宁' }).click();
assert(flow.url().includes('/people/person_ning'), 'participant avatar did not open the person profile');
await flow.getByRole('button', { name: '发起对话' }).click();
assert(flow.url().includes('/messages/match/thread_direct_'), 'starting a conversation did not open chat');
await flow.getByLabel('消息草稿').fill('活动见，很高兴认识你');
await flow.getByRole('button', { name: '发送', exact: true }).click();
await flow.waitForTimeout(500);
assert(await flow.getByText('活动见，很高兴认识你').isVisible(), 'direct conversation message was not sent');
await flow.getByRole('button', { name: '举报', exact: true }).click();
const reportDialog = flow.getByRole('dialog', { name: '举报这次会话' });
assert(await reportDialog.isVisible(), 'report form did not open');
assert(await reportDialog.getByRole('button', { name: /下一步/ }).isDisabled(), 'report should require a reason');
await reportDialog.getByRole('radio', { name: /骚扰或持续冒犯/ }).click();
await reportDialog.getByRole('button', { name: '下一步' }).click();
assert(await flow.getByRole('dialog', { name: '确认提交举报？' }).isVisible(), 'report review step is missing');
await flow.getByRole('button', { name: '返回修改' }).click();
await flow.getByRole('button', { name: '关闭' }).click();
await flow.goto(`${baseUrl}/activities/activity_bouldering_intro`, { waitUntil: 'networkidle' });
await flow.getByRole('button', { name: /查看参与者：/ }).first().click();
assert(await flow.getByRole('button', { name: '发起对话' }).count() === 0, 'waitlisted activity must not grant participant messaging');
await flow.close();

const safety = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await safety.goto(`${baseUrl}/messages/match/thread_match_lan`, { waitUntil: 'networkidle' });
await safety.getByRole('button', { name: '举报', exact: true }).click();
await safety.getByRole('radio', { name: /骚扰或持续冒犯/ }).click();
await safety.getByRole('button', { name: '下一步' }).click();
await safety.getByRole('button', { name: '确认举报并结束会话' }).click();
await safety.goto(`${baseUrl}/messages/match/thread_match_lan`, { waitUntil: 'domcontentloaded' });
assert(await safety.getByText('这个会话当前为只读').isVisible(), 'submitted report did not close the conversation');
await safety.goto(`${baseUrl}/people/person_lan`, { waitUntil: 'domcontentloaded' });
assert(await safety.getByRole('button', { name: '发起对话' }).count() === 1, 'existing conversation action should remain visible');
await safety.getByRole('button', { name: '发起对话' }).click();
assert(await safety.getByText('你已停止接收该成员的消息，可在安全设置中管理').isVisible(), 'blocked member could start a new conversation');
await safety.close();

await browser.close();
console.log(JSON.stringify({ ok: true, headerWidths: 3, unifiedChatRoutes: 3, likedState: true, participantConversation: true, reportReview: true, reportClosesConversation: true }));
