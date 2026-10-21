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
for (const fail of [false, true]) {
  test(`profile save ${fail ? 'failure remains editable' : 'persists across reload'}`, async ({ page }) => {
    const updates = await mockAccount(page, fail);
    await page.goto('/account');
    await page.getByLabel('First name', { exact: true }).fill('Changed');
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(page.getByText(fail ? 'Update failed' : 'Profile updated', { exact: true })).toBeVisible();
    expect(updates).toHaveLength(1);
    await expect(page.getByRole('button', { name: 'Save changes', exact: true })).toBeEnabled();
    if (!fail) {
      await page.reload();
      await expect(page.getByLabel('First name', { exact: true })).toHaveValue('Changed');
    }
  });
}

test('unavailable account actions are disabled', async ({ page }) => {
  await mockAccount(page);
  await page.goto('/account');
  await expect(page.getByLabel('Email', { exact: true })).toHaveAttribute('readonly', '');
  for (const name of ['Start reset', 'Request deletion']) await expect(page.getByRole('button', { name, exact: true })).toBeDisabled();
});
