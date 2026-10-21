import os from 'node:os';
import path from 'node:path';

/**
 * Every test run uses a brand-new SQLite file in the OS temp directory, so tests never touch the
 * development database and never need a destructive reset. The path is fixed per process through
 * an environment variable, so the Vitest config and the global setup agree on it.
 */
process.env.SKANS_TEST_DB ??= path.join(os.tmpdir(), 'skans-qb-tests', `run-${process.pid}-${Date.now()}.db`);
export const TEST_DB_FILE = process.env.SKANS_TEST_DB;

export const TEST_ENV = {
  NODE_ENV: 'test',
  DATABASE_URL: `file:${TEST_DB_FILE.split(path.sep).join('/')}`,
  SESSION_SECRET: 'test-only-session-secret-not-used-anywhere-else-0123456789',
  MAX_FAILED_LOGINS: '5',
  LOCKOUT_MINUTES: '15',
};
