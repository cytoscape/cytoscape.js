// @ts-check
import { defineConfig, devices } from '@playwright/test';
import os from 'node:os';

const parallelism = typeof os.availableParallelism === 'function'
  ? os.availableParallelism()
  : os.cpus().length;

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import dotenv from 'dotenv';
// import path from 'path';
// dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './playwright-tests',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Use all available system threads locally and on CI. */
  workers: parallelism,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'list',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    // baseURL: 'http://127.0.0.1:3000/playwright-page',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      testIgnore: /webgpu\.spec\.js/,
      use: { ...devices['Desktop Chrome'] },
    },

    /*
     * WebGPU prototype (src/gpu).  channel 'chromium' is the new headless
     * mode with real GPU adapters (Metal on macOS); the swiftshader flag
     * gives a deterministic software fallback on CI.  Specs soft-skip when
     * no adapter is available.  Pages must load via http://127.0.0.1:3333 —
     * navigator.gpu is unavailable on about:blank.
     */
    {
      name: 'webgpu',
      testMatch: /webgpu\.spec\.js/,
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chromium',
        launchOptions: {
          args: ['--enable-unsafe-webgpu', '--enable-unsafe-swiftshader'],
        },
      },
    },

    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },

    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },

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
  webServer: {
    command: 'npm run test:playwright:setup',
    url: 'http://127.0.0.1:3333',
    reuseExistingServer: !process.env.CI,
  },
});

