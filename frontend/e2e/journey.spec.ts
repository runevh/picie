import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

async function register(page: Page, url: string, username = 'alice') {
  await page.goto(`${url}login`);
  await page.getByText("Don't have an account? Register", { exact: true }).click();
  await page.getByLabel('Full name').fill('Alice Test');
  await page.getByRole('textbox', { name: 'Username', exact: true }).fill(username);
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(`${username}@example.test`);
  await page.getByPlaceholder('Your password').fill('synthetic-password');
  await page.getByRole('button', { name: 'Register', exact: true }).click();
  await expect(page).not.toHaveURL(/login$/);
}
async function login(page: Page) {
  await page.getByLabel('Email or username').fill('alice');
  await page.getByPlaceholder('Your password').fill('synthetic-password');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).not.toHaveURL(/login$/);
}
async function enterCode(page: Page, label: string, code: string) {
  for (let i = 0; i < code.length; i++) await page.getByRole('group', { name: label, exact: true }).getByRole('textbox').nth(i).fill(code[i]);
}
async function beginPairing(page: Page, url: string) {
  await page.goto(`${url}frames`);
  await page.getByTitle('Add frame', { exact: true }).click();
  await enterCode(page, 'Frame code', '123456');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
}
async function pair(page: Page, app: any) {
  await beginPairing(page, app.url);
  await expect(page.getByText('A pairing code should appear on your frame. Enter it below.')).toBeVisible();
  const pin = await app.command('pin');
  expect((await app.command('snapshot')).transfers.at(-1)).toBe(pin.hash);
  await enterCode(page, 'Pairing code', pin.value);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText('🎉 Frame successfully linked!')).toBeVisible();
  await page.getByRole('button', { name: 'Finish', exact: true }).click();
}
async function prepareUpload(page: Page, app: any) {
  await page.goto(`${app.url}photos`);
  await page.getByRole('button', { name: 'New album', exact: true }).click();
  await page.getByLabel('Album name').fill('Private memories');
  await page.getByRole('button', { name: 'Create album', exact: true }).click();
  await expect(page.getByLabel('Album name')).toHaveCount(0);
  await page.getByRole('button', { name: 'Open album Private memories', exact: true }).click();
  await page.getByRole('button', { name: 'Add photo', exact: true }).first().click();
  const image = await app.command('image');
  await page.locator('input[type=file]').setInputFiles({ name: 'synthetic.png', mimeType: 'image/png', buffer: Buffer.from(image, 'base64') });
}
async function albumWithPhoto(page: Page, app: any) {
  await prepareUpload(page, app);
  await page.getByRole('button', { name: 'Add Photo', exact: true }).click();
  await expect.poll(async () => (await app.command('snapshot')).photos.length).toBe(1);
}
async function assign(page: Page, app: any) {
  await page.goto(`${app.url}frames`);
  await page.getByText('Test frame', { exact: true }).click();
  await page.getByRole('button', { name: 'Change', exact: true }).click();
  await page.getByRole('dialog', { name: 'Choose album' }).getByText('Private memories', { exact: true }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
}

test('first-time journey confirms pixels and isolates another account', async ({ page, app, browser }) => {
  await register(page, app.url);
  await page.goto(`${app.url}account`);
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Log out', exact: true }).click();
  await expect(page).toHaveURL(/login$/);
  await login(page);
  await pair(page, app);
  await albumWithPhoto(page, app);
  await app.command('mode', 'hold');
  await assign(page, app);
  await expect.poll(async () => (await app.command('snapshot')).transfers.length).toBe(2);
  const pending = await app.command('snapshot');
  expect(pending.state.currentPhotoId).toBeNull();
  expect(pending.pending).toBe(true);
  expect(pending.transfers[1]).toBe(pending.photos[0].hash);
  await app.command('acknowledge');
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();
  await expect.poll(async () => (await app.command('snapshot')).state.currentPhotoId).toBe(pending.photos[0].id);
  await page.reload();
  await expect(page.getByText('Test frame', { exact: true })).toBeVisible();
  const other = await browser.newContext();
  try {
    const bob = await other.newPage();
    await register(bob, app.url, 'bobtest');
    const albumsLoaded = bob.waitForResponse(response => response.url().includes('/api/photo/albums/get') && response.ok());
    await bob.goto(`${app.url}photos`);
    await albumsLoaded;
    await expect(bob.getByText('Private memories', { exact: true })).toHaveCount(0);
    const denied = await other.request.get(`${app.url}api/photo/get/${pending.photos[0].id}.png`);
    expect([403, 404]).toContain(denied.status());
    const framesLoaded = bob.waitForResponse(response => response.url().includes('/api/device/all') && response.ok());
    await bob.goto(`${app.url}frames`);
    await framesLoaded;
    await expect(bob.getByText('Test frame', { exact: true })).toHaveCount(0);
  } finally { await other.close(); }
});


test('incorrect and expired pairing codes can be retried', async ({ page, app }) => {
  await register(page, app.url);
  await beginPairing(page, app.url);
  await expect(page.getByText('A pairing code should appear on your frame. Enter it below.')).toBeVisible();
  const pin = await app.command('pin');
  const wrong = pin.value === '0000' ? '1111' : '0000';
  await enterCode(page, 'Pairing code', wrong);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText(/Incorrect pairing code/)).toBeVisible();
  expect((await app.command('snapshot')).links).toBe(0);
  await app.command('advance', 301000);
  await enterCode(page, 'Pairing code', pin.value);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText('Pairing expired. Try again.')).toBeVisible();
  expect((await app.command('snapshot')).links).toBe(0);
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await enterCode(page, 'Frame code', '123456');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText('A pairing code should appear on your frame. Enter it below.')).toBeVisible();
  await enterCode(page, 'Pairing code', (await app.command('pin')).value);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText('🎉 Frame successfully linked!')).toBeVisible();
  expect((await app.command('snapshot')).links).toBe(1);
});

test('offline pairing recovers when the frame reconnects', async ({ page, app }) => {
  await register(page, app.url);
  await app.command('disconnect');
  await expect.poll(async () => (await app.command('snapshot')).connected).toBe(false);
  await beginPairing(page, app.url);
  await expect(page.getByText('Device is offline. Please power it on and try again.')).toBeVisible();
  expect((await app.command('snapshot')).links).toBe(0);
  await app.command('reconnect');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText('A pairing code should appear on your frame. Enter it below.')).toBeVisible();
  await enterCode(page, 'Pairing code', (await app.command('pin')).value);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText('🎉 Frame successfully linked!')).toBeVisible();
});

test('failed upload keeps the editor open and supports retry', async ({ page, app }) => {
  await register(page, app.url);
  await prepareUpload(page, app);
  await app.command('uploadsWritable', false);
  await page.getByRole('button', { name: 'Add Photo', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Could not upload the photo. Please try again.');
  expect((await app.command('snapshot')).photos).toHaveLength(0);
  await app.command('uploadsWritable', true);
  await page.getByRole('button', { name: 'Add Photo', exact: true }).click();
  await expect.poll(async () => (await app.command('snapshot')).photos.length).toBe(1);
  await expect(page.getByRole('button', { name: 'Add Photo', exact: true })).toHaveCount(0);
});

test('interrupted transfer does not advance the frame and can be delivered again', async ({ page, app }) => {
  await register(page, app.url);
  await pair(page, app);
  await albumWithPhoto(page, app);
  await app.command('mode', 'disconnect');
  await assign(page, app);
  await expect.poll(async () => (await app.command('snapshot')).connected).toBe(false);
  const failed = await app.command('snapshot');
  expect(failed.state.currentPhotoId).toBeNull();
  expect(failed.transfers).toHaveLength(1);
  expect(failed.state.nextPhotoId).toBe(failed.photos[0].id);
  await page.reload();
  await expect(page.getByText('Offline', { exact: true }).first()).toBeVisible();
  await app.command('mode', 'confirm');
  await app.command('reconnect');
  await app.command('retry');
  await expect.poll(async () => (await app.command('snapshot')).state.currentPhotoId).toBe(failed.photos[0].id);
  expect((await app.command('snapshot')).transfers.at(-1)).toBe(failed.photos[0].hash);
  await page.reload();
  await expect(page.getByText('Test frame', { exact: true })).toBeVisible();
});

test('expired login returns to sign-in and preserves the account after login', async ({ page, app }) => {
  await register(page, app.url);
  await albumWithPhoto(page, app);
  await app.command('advance', 8 * 24 * 60 * 60 * 1000);
  await page.reload();
  await expect(page).toHaveURL(/login$/);
  await expect(page.getByText('Private memories', { exact: true })).toHaveCount(0);
  await login(page);
  await page.goto(`${app.url}photos`);
  await expect(page.getByText('Private memories', { exact: true })).toBeVisible();
});
