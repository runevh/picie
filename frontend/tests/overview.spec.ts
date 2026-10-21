import { test, expect } from '@playwright/test';

async function mockAccount(page, count = 0) {
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    const data = path.endsWith('/auth')
      ? { username: 'testuser', firstName: 'Test', email: 'test@example.test', admin: false }
      : path.endsWith('/device/all')
        ? Array.from({ length: count }, (_, i) => ({ id: String(123456 + i), name: `Frame ${i}`, isOnline: false }))
        : [];
    return route.fulfill({ json: { data } });
  });
}
for (const count of [0, 1, 2]) {
  test(`frame count wording for ${count}`, async ({ page }) => {
    await mockAccount(page, count);
    await page.goto('/frames');
    await expect(page.getByText(`${count} ${count === 1 ? 'frame' : 'frames'}`, { exact: true })).toBeVisible();
  });
}
for (const width of [390, 1280]) {
  test(`album statistics fill the overview at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await mockAccount(page);
    await page.goto('/photos');
    const grid = page.getByTestId('album-statistics');
    await expect(grid).toBeVisible();
    const tiles = grid.locator(':scope > *');
    await expect(tiles).toHaveCount(2);
    const first = await tiles.nth(0).boundingBox();
    const second = await tiles.nth(1).boundingBox();
    const bounds = await grid.boundingBox();
    expect(Math.abs(first!.width - second!.width)).toBeLessThan(2);
    if (width === 390) {
      expect(second!.y).toBeGreaterThan(first!.y);
      expect(Math.abs(first!.width - bounds!.width)).toBeLessThan(2);
    } else {
      expect(Math.abs(first!.y - second!.y)).toBeLessThan(2);
      expect(Math.abs(second!.x + second!.width - bounds!.x - bounds!.width)).toBeLessThan(2);
    }
  });
}
