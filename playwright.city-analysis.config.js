import { defineConfig } from '@playwright/test';
import baseConfig from './playwright.config.js';

const baseURL = 'http://127.0.0.1:4174';
const desktopChromium = baseConfig.projects.find(({ name }) => name === 'desktop-chromium');
const requestedStabilityMs = Number.parseInt(process.env.CITY_ANALYSIS_STABILITY_MS ?? '0', 10);
const isLongStabilityRun = Number.isFinite(requestedStabilityMs) && requestedStabilityMs >= 60_000;

export default defineConfig({
  ...baseConfig,
  testMatch: '**/city-analysis-candidate.spec.js',
  testIgnore: [],
  fullyParallel: false,
  workers: 1,
  use: {
    ...baseConfig.use,
    baseURL,
    colorScheme: 'light',
    reducedMotion: 'no-preference',
    // Continuous WebGL screencast frames can create gigabytes of trace data and
    // perturb the heap/cache measurements that a long soak is meant to observe.
    trace: isLongStabilityRun ? 'off' : 'retain-on-failure',
  },
  projects: [desktopChromium],
  webServer: {
    // Preserve DEV-only candidate isolation, but remove Vite's websocket reload
    // path so a long-running soak measures one uninterrupted page lifetime.
    command: 'npm run dev -- --config vite.city-analysis.config.js --port 4174',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
