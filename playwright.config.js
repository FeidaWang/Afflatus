import { defineConfig, devices } from '@playwright/test';

const baseURL = 'http://127.0.0.1:4173';

/**
 * These are browser emulation profiles, not substitutes for physical-device
 * sign-off. The CSS viewports are calibrated from the flagship panel sizes:
 * iPhone 16 Pro Max 1320×2868 @3x and Galaxy S26 Ultra 1440×3120 @3.5x.
 */
const iPhone16ProMax = {
  ...devices['iPhone 15 Pro Max'],
  viewport: { width: 440, height: 956 },
  screen: { width: 440, height: 956 },
  deviceScaleFactor: 3,
};

const galaxyS26Ultra = {
  ...devices['Galaxy S24'],
  userAgent: devices['Galaxy S24'].userAgent.replace('SM-S921U', 'SM-S948B'),
  viewport: { width: 412, height: 892 },
  screen: { width: 412, height: 892 },
  deviceScaleFactor: 3.5,
};

export default defineConfig({
  testDir: './e2e',
  outputDir: 'test-results',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 45_000,
  expect: {
    timeout: 8_000,
  },
  reporter: process.env.CI
    ? [['line'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    colorScheme: 'dark',
    locale: 'en-AU',
    timezoneId: 'Australia/Melbourne',
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 1000 },
        screen: { width: 1440, height: 1000 },
      },
    },
    {
      name: 'iphone-16-pro-max-webkit',
      use: iPhone16ProMax,
    },
    {
      name: 'galaxy-s26-ultra-chromium',
      use: galaxyS26Ultra,
    },
  ],
  webServer: {
    command: 'npm run preview -- --port 4173',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
