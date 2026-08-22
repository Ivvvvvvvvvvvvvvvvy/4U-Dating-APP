#!/usr/bin/env node
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const baseUrl = process.env.BASE_URL ?? 'http://127.0.0.1:4173';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await context.newPage();
const browserErrors = [];
page.on('pageerror', (error) => browserErrors.push(error.message));
page.on('console', (message) => { if (message.type() === 'error') browserErrors.push(message.text()); });

const storageKey = '4u:rfc:activity-draft';
const title = () => page.locator('#activity-title');
const summary = () => page.locator('#activity-summary');
const submit = () => page.getByRole('button', { name: '提交审核' });

await page.goto(`${baseUrl}/activities/new/test-draft/1`, { waitUntil: 'domcontentloaded' });
await page.evaluate((key) => localStorage.removeItem(key), storageKey);
await page.reload({ waitUntil: 'domcontentloaded' });

const next = page.getByRole('button', { name: '下一步：时间与规则' });
assert.equal(await next.isDisabled(), false, 'next button should allow validation feedback');
await next.click();
assert.match(await page.getByRole('alert').innerText(), /活动标题/);
assert.equal(await title().getAttribute('aria-invalid'), 'true');
await page.waitForFunction(() => document.activeElement?.id === 'activity-title');
assert.equal(await title().evaluate((element) => element === document.activeElement), true, 'title should receive focus');

await title().fill('周末滨江散步');
await next.click();
assert.match(await page.getByRole('alert').innerText(), /活动简介/);
await page.waitForFunction(() => document.activeElement?.id === 'activity-summary');
assert.equal(await summary().evaluate((element) => element === document.activeElement), true, 'summary should receive focus');
await summary().fill('一起散步聊天，活动节奏轻松。');
await page.getByRole('button', { name: '多人小组' }).click();
await page.getByRole('button', { name: '直接加入' }).click();
await next.click();
assert.equal(new URL(page.url()).pathname, '/activities/new/test-draft/2');
assert.equal(await submit().isDisabled(), false, 'submit should allow validation feedback');

await submit().click();
assert.match(await page.getByRole('alert').innerText(), /开始时间/);
await page.waitForFunction(() => document.activeElement?.id === 'activity-starts-at');
assert.equal(await page.locator('#activity-starts-at').evaluate((element) => element === document.activeElement), true, 'start time should receive focus');

await page.locator('#activity-starts-at').fill('2026-09-10T20:30');
await page.locator('#activity-ends-at').fill('2026-09-10T18:30');
await submit().click();
assert.match(await page.getByRole('alert').innerText(), /结束时间必须晚于开始时间/);
await page.waitForFunction(() => document.activeElement?.id === 'activity-ends-at');
assert.equal(await page.locator('#activity-ends-at').evaluate((element) => element === document.activeElement), true, 'end time should receive focus');

await page.locator('#activity-ends-at').fill('2026-09-10T22:00');
await page.locator('#activity-district').fill('徐汇区');
await page.locator('#activity-area-label').fill('徐汇滨江公共文化区域');
await page.getByRole('button', { name: '保存草稿' }).click();
await page.getByText('草稿已保存在当前设备').waitFor();
const snapshot = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), storageKey);
assert.equal(snapshot.schemaVersion, 1);
assert.equal(snapshot.draftId, 'test-draft');
assert.equal(snapshot.draft.title, '周末滨江散步');

await page.reload({ waitUntil: 'domcontentloaded' });
assert.equal(await page.locator('#activity-starts-at').inputValue(), '2026-09-10T20:30');
assert.equal(await page.locator('#activity-district').inputValue(), '徐汇区');
await page.getByRole('button', { name: '返回上一步' }).click();
assert.equal(await title().inputValue(), '周末滨江散步');
assert.equal(await summary().inputValue(), '一起散步聊天，活动节奏轻松。');
assert.equal(await page.getByRole('button', { name: '多人小组' }).getAttribute('aria-pressed'), 'true');
assert.equal(await page.getByRole('button', { name: '直接加入' }).getAttribute('aria-pressed'), 'true');
await next.click();

await submit().click();
assert.match(await page.getByRole('alert').innerText(), /请确认公开信息真实/);
await page.waitForFunction(() => document.activeElement?.id === 'activity-review-confirmed');
assert.equal(await page.locator('#activity-review-confirmed').evaluate((element) => element === document.activeElement), true, 'confirmation should receive focus');
await page.locator('#activity-review-confirmed').check();
await submit().click();
await page.getByRole('heading', { name: '活动已提交审核' }).waitFor();
assert.equal(await page.evaluate((key) => localStorage.getItem(key), storageKey), null, 'submitted draft should be cleared');
await page.getByRole('button', { name: '完成' }).click();
assert.equal(new URL(page.url()).pathname, '/home');
assert.equal(new URL(page.url()).search, '?primary=activities&secondary=all');

await page.goto(`${baseUrl}/activities/new/legacy-draft/1`, { waitUntil: 'domcontentloaded' });
await page.evaluate((key) => localStorage.setItem(key, JSON.stringify({ title: '旧格式草稿', summary: '旧格式也应该安全恢复。', city: '' })), storageKey);
await page.reload({ waitUntil: 'domcontentloaded' });
assert.equal(await title().inputValue(), '旧格式草稿');
assert.equal(await summary().inputValue(), '旧格式也应该安全恢复。');
assert.equal(await page.locator('#activity-title').inputValue(), '旧格式草稿');

await page.evaluate((key) => localStorage.setItem(key, '{broken json'), storageKey);
await page.reload({ waitUntil: 'domcontentloaded' });
assert.equal(await title().inputValue(), '');
assert.equal(await summary().inputValue(), '');

await page.evaluate((key) => localStorage.setItem(key, JSON.stringify({
  schemaVersion: 1,
  draftId: 'another-draft',
  savedAt: new Date().toISOString(),
  draft: { title: '不应跨草稿恢复' },
})), storageKey);
await page.reload({ waitUntil: 'domcontentloaded' });
assert.equal(await title().inputValue(), '', 'a snapshot for another draft ID must not be restored');

await page.goto(`${baseUrl}/activities/new/direct-step-two/2`, { waitUntil: 'domcontentloaded' });
await submit().click();
assert.equal(new URL(page.url()).pathname, '/activities/new/direct-step-two/1');
await page.waitForFunction(() => document.activeElement?.id === 'activity-title');
assert.match(await page.getByRole('alert').innerText(), /活动标题/);
assert.equal(browserErrors.length, 0, `browser errors: ${browserErrors.join(' | ')}`);

await browser.close();
console.log(JSON.stringify({ ok: true, validationFeedback: true, focusRouting: true, draftRestore: true, corruptFallback: true, submissionClearsDraft: true }));
