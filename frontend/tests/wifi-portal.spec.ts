import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const html = readFileSync(fileURLToPath(new URL('../../device/src/static/page.html', import.meta.url)), 'utf8');
const names = ['Home', 'quote"back\\slash', 'line\n\r\t\u0001', 'Café 家', '<img src=x onerror="window.injected=true">'];

for (const name of names) {
  test(`network name is displayed as text: ${JSON.stringify(name)}`, async ({ page }) => {
    await page.route('http://setup.test/**', route => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/searchWifi') return route.fulfill({ json: [{ SSID: name, SignalStrength: -40 }] });
      return route.fulfill({ contentType: 'text/html', body: html });
    });
    await page.goto('http://setup.test/');
  await page.locator('#setup-code').fill('synthetic-setup-code');
    await page.getByRole('button', { name: 'Scan for WiFi networks' }).click();
    await expect(page.locator('.network p')).toHaveText(name);
    await page.locator('.network button').click();
    expect(await page.locator('#ssid-title').textContent()).toBe(name);
    expect(await page.locator('#ssid-input').inputValue()).toBe(name);
    await expect(page.locator('#ssid-title img, #ssid-title script, .network img')).toHaveCount(0);
    expect(await page.evaluate(() => (window as any).injected)).toBeUndefined();
    await page.locator('#password-input').fill('synthetic-wifi-password');
    const request = page.waitForRequest(request => request.url().endsWith('/setWifiCredentials'));
    await page.locator('#wifiForm button[type=submit]').click();
    const sent = await request;
    expect(sent.headers()['x-setup-code']).toBe('synthetic-setup-code');
    const fields = new URLSearchParams(sent.postData()!);
    expect(fields.get('ssid')).toBe(name);
    expect(fields.get('password')).toBe('synthetic-wifi-password');
  });
}

test('failed credential submission can be retried', async ({ page }) => {
  let submissions = 0;
  await page.route('http://setup.test/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/searchWifi') return route.fulfill({ json: [{ SSID: 'Home', SignalStrength: -40 }] });
    if (path === '/setWifiCredentials') return route.fulfill({ status: ++submissions === 1 ? 500 : 200, body: '' });
    return route.fulfill({ contentType: 'text/html', body: html });
  });
  await page.goto('http://setup.test/');
  await page.locator('#setup-code').fill('synthetic-setup-code');
  await page.getByRole('button', { name: 'Scan for WiFi networks' }).click();
  await page.locator('.network button').click();
  await page.locator('#password-input').fill('synthetic-wifi-password');
  await page.locator('#wifiForm button[type=submit]').click();
  const retry = page.getByRole('button', { name: 'Could not send settings. Try again.' });
  await expect(retry).toBeEnabled();
  await retry.click();
  await expect(page.getByRole('button', { name: 'Settings sent. Reconnect to your Wi-Fi.' })).toBeDisabled();
  expect(submissions).toBe(2);
});

for (const status of [403, 500]) {
  test(`manual setup shows failure ${status} and allows recovery`, async ({ page }) => {
    let submissions = 0;
    await page.route('http://setup.test/**', route => {
      if (route.request().url().endsWith('/setWifiCredentials')) {
        expect(route.request().headers()['x-setup-code']).toBe('synthetic-setup-code');
        const fields = new URLSearchParams(route.request().postData()!);
        expect(fields.get('ssid')).toBe(' Home ');
        expect(fields.get('password')).toBe(' password ');
        return route.fulfill({ status: ++submissions === 1 ? status : 200, body: 'Setup unavailable. Try again.' });
      }
      return route.fulfill({ contentType: 'text/html', body: html });
    });
    await page.goto('http://setup.test/');
    await page.locator('#setup-code').fill('synthetic-setup-code');
    await page.locator('#ssid').fill(' Home ');
    await page.locator('#password').fill(' password ');
    await page.locator('#manualForm button').click();
    await expect(page.getByRole('status')).toHaveText('Setup unavailable. Try again.');
    await expect(page.locator('#manualForm button')).toBeEnabled();
    await page.locator('#manualForm button').click();
    await expect(page.locator('#manualForm button')).toHaveText('Settings sent. Reconnect to your Wi-Fi.');
    await expect(page.locator('#manualForm button')).toBeDisabled();
  });
}

test('unauthorized scan shows the setup error', async ({ page }) => {
  await page.route('http://setup.test/**', route => route.request().url().endsWith('/searchWifi')
    ? route.fulfill({ status: 403, body: 'Setup code is incorrect or expired.' })
    : route.fulfill({ contentType: 'text/html', body: html }));
  await page.goto('http://setup.test/');
  await page.getByRole('button', { name: 'Scan for WiFi networks' }).click();
  await expect(page.getByRole('status')).toHaveText('Setup code is incorrect or expired.');
  await expect(page.locator('.network')).toHaveCount(0);
});
