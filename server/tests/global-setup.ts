import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPrismaClient } from '../src/db';
import { TEST_ADMIN_URL, TEST_DB_NAME, TEST_ENV } from './test-env';

/**
 * Creates a fresh, empty PostgreSQL database for this run, applies the migrations, runs the
 * production bootstrap seed and loads the test-only demo fixtures. Only databases whose name
 * starts with "skans_test_" are ever created or dropped here.
 */
export default async function setup() {
  if (!/^skans_test_\d+_\d+$/.test(TEST_DB_NAME)) throw new Error(`Refusing to use test database name "${TEST_DB_NAME}".`);
  const cwd = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const admin = createPrismaClient(TEST_ADMIN_URL);
  await admin.$executeRawUnsafe(`CREATE DATABASE "${TEST_DB_NAME}"`);
  await admin.$disconnect();

  const env = { ...process.env, ...TEST_ENV };
  const run = (cmd: string) => execSync(cmd, { cwd, env, stdio: 'pipe' });
  run('npx prisma migrate deploy');
  run('npx tsx prisma/seed.ts');
  run('npx tsx tests/fixtures/demo-data.ts');

  return async () => {
    const client = createPrismaClient(TEST_ADMIN_URL);
    await client.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${TEST_DB_NAME}" WITH (FORCE)`);
    await client.$disconnect();
  };
}
