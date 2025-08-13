import { defineConfig, devices } from '@playwright/test';

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests/e2e',
  /* Set global timeout to prevent hanging tests */
  timeout: process.env.CI ? 60000 : 30000, // 1 minute in CI, 30 seconds locally
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Reduce retries in CI for faster feedback */
  retries: process.env.CI ? 1 : 0,
  /* Use multiple workers in CI for parallel execution */
  workers: process.env.CI ? 2 : undefined,
  /* Use simple reporter in CI, HTML locally */
  reporter: process.env.CI ? 'github' : 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://localhost:3000',

    /* Collect trace only on retry failures */
    trace: 'on-first-retry',

    /* Screenshots only on failure, optimized for CI */
    screenshot: process.env.CI ? 'only-on-failure' : 'only-on-failure',

    /* Disable video in CI to speed up tests, enable locally for debugging */
    video: process.env.CI ? 'off' : 'retain-on-failure',

    /* Increase timeout for slower CI environment */
    actionTimeout: process.env.CI ? 10000 : 5000,
  },

  /* Configure projects for major browsers - limit to chromium in CI for speed */
  projects: process.env.CI ? [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ] : [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests */
  webServer: [
    {
      command: 'npm start',
      url: 'http://localhost:3000',
      reuseExistingServer: true,
      timeout: process.env.CI ? 180000 : 120000, // 3 minutes in CI, 2 minutes locally
      ignoreHTTPSErrors: true,
    },
    {
      command: 'cd ../backend && TEST_MODE=true SKIP_DOMAIN_VERIFICATION=true cargo run',
      url: 'http://localhost:8080/health',
      reuseExistingServer: true,
      timeout: process.env.CI ? 600000 : 300000, // 10 minutes in CI, 5 minutes locally  
      env: {
        TEST_MODE: 'true',
        SKIP_DOMAIN_VERIFICATION: 'true',
        DATABASE_URL: process.env.DATABASE_URL || 'Server=localhost,1433;Database=ThaloraTestDB;User=sa;Password=YourPassword123!;TrustServerCertificate=true;',
      },
    },
  ],

  /* Global test setup and teardown */
  globalSetup: require.resolve('./tests/e2e/global-setup.ts'),
  globalTeardown: require.resolve('./tests/e2e/global-teardown.ts'),
});