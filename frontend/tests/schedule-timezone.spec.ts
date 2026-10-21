import { test, expect } from '@playwright/test';

for (const width of [390, 1280]) {
  test(`schedule timezone persists and is displayed at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const frame = { id: '123456', name: 'Kitchen frame', isOnline: false, scheduleMode: 'times',
      timesOfDay: ['09:00'], timeZone: 'UTC', intervalMinutes: 60, albumId: null };
    const updates: any[] = [];
    await page.route('**/api/**', route => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/auth')) return route.fulfill({ json: { data: { username: 'alice', firstName: 'Alice', email: 'alice@example.test', admin: false } } });
      if (path.endsWith('/device/all')) return route.fulfill({ json: { data: [frame] } });
      if (path.endsWith('/device/update')) {
        const body = route.request().postDataJSON();
        updates.push(body);
        Object.assign(frame, { scheduleMode: body.schedule.mode, ...body.schedule });
        return route.fulfill({ json: { success: true, data: frame } });
      }
      if (path.endsWith('/device/status')) return route.fulfill({ json: { success: true, data: { status: 'offline' } } });
      return route.fulfill({ json: { data: [] } });
    });
    await page.goto('/frames');
    await page.getByText('Kitchen frame', { exact: true }).click();
    const zone = page.getByRole('textbox', { name: 'Schedule timezone' });
    await expect(zone).toHaveValue('UTC');
    await zone.fill('Europe/Brussels');
    await page.getByRole('option', { name: 'Europe/Brussels', exact: true }).click();
    await expect(page.getByText('Times of day (Europe/Brussels)', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('Saved', { exact: true })).toBeVisible();
    expect(updates).toHaveLength(1);
    expect(updates[0].schedule).toMatchObject({ mode: 'times', timeZone: 'Europe/Brussels', timesOfDay: ['09:00'] });
    await page.reload();
    await page.getByText('Kitchen frame', { exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Schedule timezone' })).toHaveValue('Europe/Brussels');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
