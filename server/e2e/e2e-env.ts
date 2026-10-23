import 'dotenv/config';

/**
 * Browser tests run the real server against their own brand-new PostgreSQL database
 * (skans_e2e_<pid>_<time>) on the server named by TEST_DATABASE_URL or DATABASE_URL, so they never
 * touch the development data. The name is fixed once through an environment variable, so the
 * Playwright config, the global setup and the web server all agree on it.
 */
const base = process.env.SKANS_E2E_BASE_URL ?? process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? '';
if (!base.startsWith('postgres')) throw new Error('Browser tests need PostgreSQL: set TEST_DATABASE_URL (a user with CREATEDB) or DATABASE_URL in server/.env.');
process.env.SKANS_E2E_BASE_URL ??= base;
process.env.SKANS_E2E_DB ??= `skans_e2e_${process.pid}_${Date.now()}`;

const withDb = (db: string) => {
  const url = new URL(base);
  url.pathname = `/${db}`;
  return url.toString();
};

export const E2E_DB_NAME = process.env.SKANS_E2E_DB;
export const E2E_ADMIN_URL = withDb('postgres');
export const E2E_PORT = Number(process.env.E2E_PORT ?? 4173);
export const E2E_BASE_URL = `http://localhost:${E2E_PORT}`;
/** First administrator password used by the seed in the test database only. */
export const E2E_ADMIN_PASSWORD = 'E2eAdminTemp2026';

export const E2E_SERVER_ENV: Record<string, string> = {
  NODE_ENV: 'development',
  PORT: String(E2E_PORT),
  DATABASE_URL: withDb(E2E_DB_NAME),
  SESSION_SECRET: 'e2e-only-session-secret-not-used-anywhere-else-0123456789',
  CLIENT_ORIGIN: E2E_BASE_URL,
  MAX_FAILED_LOGINS: '5',
  LOCKOUT_MINUTES: '15',
  SKANS_ADMIN_PASSWORD: E2E_ADMIN_PASSWORD,
};
