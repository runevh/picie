import { test, expect, Page } from '@playwright/test';

const user = (username: string) => ({ username, firstName: username, lastName: 'Test', email: `${username}@example.test`, admin: false });
const albums = (username: string) => [{ id: `${username}-album`, name: `${username} private album`, photos: [], collaborators: [] }];

async function server(page: Page, initial: string | null = null) {
  const state = { account: initial, logoutFailure: '' as '' | 'network' | 'server', holdAlbums: false, albumRequests: 0 };
  let release: (() => void) | undefined;
  let arrived: (() => void) | undefined;
  const pending = new Promise<void>(resolve => { arrived = resolve; });
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/auth')) {
      return state.account ? route.fulfill({ json: { data: user(state.account) } }) : route.fulfill({ status: 401, json: { message: 'Unauthorized' } });
    }
    if (path.endsWith('/login')) {
      state.account = route.request().postDataJSON().username;
      return route.fulfill({ json: { success: true, user: user(state.account!) } });
    }
    if (path.endsWith('/logout')) {
      if (state.logoutFailure === 'network') return route.abort('failed');
      if (state.logoutFailure === 'server') return route.fulfill({ status: 500, json: { message: 'Failed' } });
      state.account = null;
      return route.fulfill({ json: { success: true } });
    }
    if (path.endsWith('/photo/albums/get')) {
      state.albumRequests++;
      const account = state.account;
      if (state.holdAlbums && account === 'alice') {
        await new Promise<void>(resolve => { release = resolve; arrived!(); });
      }
      return route.fulfill({ json: { data: account ? albums(account) : [] } });
    }
    return route.fulfill({ json: { data: [] } });
  });
  return { state, pending, release: () => release!() };
}
async function login(page: Page, name: string) {
  await page.getByLabel('Email or username').fill(name);
  await page.getByPlaceholder('Your password').fill('synthetic-password');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login$/);
}
async function logout(page: Page) {
  await page.getByRole('button', { name: 'Account', exact: true }).click();
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Log out', exact: true }).click();
}

test('loads albums after login and clears them when switching accounts', async ({ page }) => {
  const { state } = await server(page);
  await page.goto('/login');
  await expect(page.getByLabel('Email or username')).toBeVisible();
  expect(state.albumRequests).toBe(0);
  await login(page, 'alice');
  await page.getByRole('button', { name: 'Photos', exact: true }).click();
  await expect(page.getByText('alice private album', { exact: true })).toBeVisible();
  await logout(page);
  await expect(page).toHaveURL(/\/login$/);
  await login(page, 'bob');
  await page.getByRole('button', { name: 'Photos', exact: true }).click();
  await expect(page.getByText('bob private album', { exact: true })).toBeVisible();
  await expect(page.getByText('alice private album', { exact: true })).toHaveCount(0);
});

test('ignores an album response from the previous account', async ({ page }) => {
  const api = await server(page, 'alice');
  api.state.holdAlbums = true;
  await page.goto('/photos');
  await api.pending;
  await logout(page);
  await expect(page).toHaveURL(/\/login$/);
  await login(page, 'bob');
  await page.getByRole('button', { name: 'Photos', exact: true }).click();
  await expect(page.getByText('bob private album', { exact: true })).toBeVisible();
  const oldResponse = page.waitForResponse(response => response.url().endsWith('/photo/albums/get'));
  api.release();
  await (await oldResponse).finished();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expect(page.getByText('alice private album', { exact: true })).toHaveCount(0);
  await expect(page.getByText('bob private album', { exact: true })).toBeVisible();
});

for (const failure of ['network', 'server'] as const) {
  test(`failed logout (${failure}) retains the session and can be retried`, async ({ page }) => {
    const { state } = await server(page, 'alice');
    state.logoutFailure = failure;
    await page.goto('/photos');
    await expect(page.getByText('alice private album', { exact: true })).toBeVisible();
    await logout(page);
    await expect(page.getByText('You are still signed in. Please try again.', { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/account$/);
    await expect(page.getByRole('dialog')).toBeVisible();
    state.logoutFailure = '';
    await page.getByRole('dialog').getByRole('button', { name: 'Log out', exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByText("You are still signed in. Please try again.", { exact: true })).toHaveCount(0);
    await page.reload();
    await expect(page.getByLabel('Email or username')).toBeVisible();
    await page.goto('/photos');
    await expect(page).toHaveURL(/\/login$/);
  });
}
