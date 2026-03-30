import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './',
  fullyParallel: false,
  timeout: 60_000,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
  ],
  use: {
    baseURL: 'http://localhost:3000',
    headless: process.env.PW_HEADED !== '1',
    channel: 'chrome',
    launchOptions: {
      slowMo: process.env.PW_HEADED === '1' ? 250 : 0,
      env: {
        ...process.env,
        PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS: '1',
      },
    },
    video: 'off',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    viewport: { width: 1440, height: 900 },
  },
  projects: [
    {
      name: 'admin-auth-setup',
      testMatch: '**/setup/auth.setup.ts',
      use: {
        storageState: undefined,
      },
    },
    {
      name: 'admin-tests',
      dependencies: ['admin-auth-setup'],
      testMatch: '**/admin/**/*.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/setup/.auth/admin.json',
      },
    },
  ],
});
