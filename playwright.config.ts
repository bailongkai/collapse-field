import { defineConfig } from '@playwright/test';

const HEADLESS_GL_ARGS = [
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
  '--autoplay-policy=no-user-gesture-required',
];

export default defineConfig({
  testDir: 'tests/e2e',
  testIgnore: ['**/perf.spec.ts', '**/afk.spec.ts'],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  outputDir: 'test-results',
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 180_000,
  },
  use: {
    baseURL: 'http://localhost:4173',
    viewport: { width: 1280, height: 720 },
    launchOptions: { args: HEADLESS_GL_ARGS },
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'default', workers: 4 },
    {
      name: 'perf',
      testIgnore: [],
      testMatch: ['**/perf.spec.ts', '**/afk.spec.ts'],
      timeout: 10 * 60_000,
      workers: 1,
    },
    {
      name: 'bench',
      testIgnore: [],
      testMatch: ['**/perf.spec.ts'],
      timeout: 10 * 60_000,
      workers: 1,
      use: { headless: false, launchOptions: { args: ['--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] } },
    },
  ],
});
