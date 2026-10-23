import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';
import { E2E_BASE_URL, E2E_SERVER_ENV } from './e2e-env';

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Browser walkthrough of the whole system (npm run test:e2e). The real server is started on its
 * own port with its own temporary PostgreSQL database and serves the built client (client/dist),
 * which `npm run test:e2e` builds first. Tests run one after another because each step builds on
 * the previous one (users created, questions written, reviewed, put on a paper ...).
 */
export default defineConfig({
  testDir: here,
  testMatch: '*.spec.ts',
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { outputFolder: path.join(here, '..', 'e2e-report'), open: 'never' }]],
  outputDir: path.join(here, '..', 'e2e-results'),
  globalSetup: path.join(here, 'global-setup.ts'),
  use: {
    baseURL: E2E_BASE_URL,
    viewport: { width: 1280, height: 860 },
    acceptDownloads: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npx tsx src/index.ts',
    cwd: path.join(here, '..'),
    url: `${E2E_BASE_URL}/api/health`,
    env: E2E_SERVER_ENV,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
