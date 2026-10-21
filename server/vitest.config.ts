import { defineConfig } from 'vitest/config';
import { TEST_ENV } from './tests/test-env';

// Server tests run against their own SQLite file (prisma/test.db), never the development database.
export default defineConfig({
  test: {
    env: TEST_ENV,
    globalSetup: ['./tests/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
});
