import { test, expect } from '@playwright/test';

async function mockAccount(page, fail = false) {
  const user = { username: 'alice', firstName: 'Alice', lastName: 'Test', email: 'alice@example.test', admin: true };
  const updates: any[] = [];
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/auth')) return route.fulfill({ json: { data: user } });
    if (path.endsWith('/user/update')) {
      updates.push(route.request().postDataJSON());
      if (fail) return route.fulfill({ status: 500, json: { message: 'Save failed' } });
      Object.assign(user, updates.at(-1));
      return route.fulfill({ json: { user } });
    }
    if (path.endsWith('/device/all/admin')) return route.fulfill({ json: { data: [
      { id: 'frame-123456', uuid: '123456', name: 'Frame', isOnline: false, owner: null, softwareVersion: '1.0' },
    ] } });
    return route.fulfill({ json: { data: [] } });
  });
  return updates;
}
for (const width of [320, 390, 1280]) {
  test(`admin table scrolls to actions at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await mockAccount(page);
    await page.goto('/admin');
    const region = page.getByRole('region', { name: 'Frames table' });
    await expect(region).toBeVisible();
    await expect(region.getByText('Offline', { exact: true })).toBeVisible();
    const badge = region.getByText('Offline', { exact: true });
    expect(await badge.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await region.evaluate(el => { el.scrollLeft = el.scrollWidth; });
    await region.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });
}
