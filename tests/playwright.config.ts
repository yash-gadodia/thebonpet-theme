import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.TBP_BASE_URL || 'https://thebonpet.com';

export default defineConfig({
  testDir: './specs',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // Live site has Cloudflare bot-detection + 429 rate-limiting that occasionally serves a
  // verification page or rate-limit response to headless Chromium / WebKit. Bumped local
  // retries 1→2 so env-flaky tests pass cleanly and the deploy gate stops aborting on
  // transient failures (2026-04-30).
  retries: 2,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
  },
  projects: [
    {
      name: 'desktop-chrome',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 13'] },
    },
  ],
});
