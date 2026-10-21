import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', testMatch: '**/*.spec.ts', workers: 1, timeout: 90000,
  expect: { timeout: 15000 }, forbidOnly: !!process.env.CI, retries: 0,
  outputDir: 'e2e-results', reporter: [['list'], ['html', { outputFolder: 'e2e-report', open: 'never' }]],
  use: { actionTimeout: 15000, navigationTimeout: 15000, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 900 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 } } },
  ],
});
