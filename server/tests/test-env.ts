import 'dotenv/config';

/**
 * Every test run uses a brand-new PostgreSQL database (skans_test_<pid>_<time>), so tests never
 * touch the development database and never need a destructive reset. It is created by the global
 * setup on the same server as DATABASE_URL (or TEST_DATABASE_URL, for CI) and dropped afterwards.
 * The connecting user needs the CREATEDB right. The name is fixed per process through an
 * environment variable, so the Vitest config and the global setup agree on it.
 */
const base = process.env.TEST_DATABASE_URL ?? process.env.SKANS_TEST_BASE_URL ?? process.env.DATABASE_URL ?? '';
if (!base.startsWith('postgres')) {
  throw new Error('Server tests need PostgreSQL: set TEST_DATABASE_URL (a user with CREATEDB) or DATABASE_URL in server/.env.');
}
// Remember the original server URL before DATABASE_URL is replaced with the test database below.
process.env.SKANS_TEST_BASE_URL ??= base;
process.env.SKANS_TEST_DB ??= `skans_test_${process.pid}_${Date.now()}`;
export const TEST_DB_NAME = process.env.SKANS_TEST_DB;

const withDb = (db: string) => {
  const url = new URL(base);
  url.pathname = `/${db}`;
  return url.toString();
};
/** The server's maintenance database, used only to create and drop the test database. */
export const TEST_ADMIN_URL = withDb('postgres');

export const TEST_ENV = {
  NODE_ENV: 'test',
  DATABASE_URL: withDb(TEST_DB_NAME),
  SESSION_SECRET: 'test-only-session-secret-not-used-anywhere-else-0123456789',
  MAX_FAILED_LOGINS: '5',
  LOCKOUT_MINUTES: '15',
};
