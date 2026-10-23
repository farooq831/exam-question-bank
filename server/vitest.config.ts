import { defineConfig } from 'vitest/config';
import { TEST_ENV } from './tests/test-env';

// Server tests run against their own temporary PostgreSQL database (see tests/test-env.ts), never the development database.
export default defineConfig({
  test: {
    // Browser tests in e2e/ belong to Playwright (npm run test:e2e).
    include: ['tests/**/*.test.ts'],
    env: TEST_ENV,
    globalSetup: ['./tests/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
});
