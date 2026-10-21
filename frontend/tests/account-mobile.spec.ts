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
  test(`account inputs and actions fit at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await mockAccount(page);
    await page.goto('/account');
    const first = page.getByLabel('First name', { exact: true });
    const last = page.getByLabel('Last name', { exact: true });
    await expect(first).toBeVisible();
    const a = await first.boundingBox(), b = await last.boundingBox();
    if (width < 768) expect(b!.y).toBeGreaterThan(a!.y);
    else expect(Math.abs(a!.y - b!.y)).toBeLessThan(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    for (const name of ['Start reset', 'Request deletion']) {
      const button = page.getByRole('button', { name, exact: true });
      expect(await button.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    }
  });
}
