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
    const fields = new URLSearchParams((await request).postData()!);
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
