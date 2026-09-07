import { defineConfig, devices } from '@playwright/test';

/**
 * Headless Chromium has no real GPU, so WebGL falls back to SwiftShader. These flags make that
 * fallback available at all (recent Chromium refuses it otherwise) and unlock audio.
 */
const HEADLESS_GL_ARGS = [
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
  '--autoplay-policy=no-user-gesture-required',
];

const PERF_SPECS = ['**/perf.spec.ts', '**/afk.spec.ts'];
const MOBILE_SPECS = ['**/mobile.spec.ts'];
const IPHONE_SPECS = ['**/iphone.spec.ts'];

export default defineConfig({
  testDir: 'tests/e2e',
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
    // functional specs; safe to parallelise
    { name: 'default', testIgnore: [...PERF_SPECS, ...MOBILE_SPECS, ...IPHONE_SPECS], workers: 4 },
    // a phone held landscape, with a real touchscreen and no keyboard
    {
      name: 'mobile',
      testMatch: MOBILE_SPECS,
      workers: 2,
      use: {
        ...devices['Pixel 7 landscape'],
        launchOptions: { args: HEADLESS_GL_ARGS },
      },
    },
    // timing-sensitive specs: one worker, because measuring CPU time next to three other browsers
    // measures the machine's load, not the game
    { name: 'perf', testMatch: PERF_SPECS, workers: 1, timeout: 10 * 60_000 },
    // the only place a frame-time gate is meaningful: a real GPU through Metal
    // a real iPhone in landscape: the smallest canvas the game has to stay usable on
    {
      name: 'iphone',
      testMatch: IPHONE_SPECS,
      workers: 1,
      use: { ...devices['iPhone 14 landscape'] },
    },
    {
      name: 'bench',
      testMatch: ['**/perf.spec.ts'],
      workers: 1,
      timeout: 10 * 60_000,
      use: { headless: false, launchOptions: { args: ['--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] } },
    },
  ],
});
