import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPrismaClient } from '../src/db';
import { E2E_ADMIN_URL, E2E_DB_NAME, E2E_SERVER_ENV } from './e2e-env';

/**
 * Creates the empty test database, applies the migrations and runs the production bootstrap seed
 * (admin with a known temporary password, the 8 CAF subjects and the paper format). Only databases
 * named skans_e2e_<pid>_<time> are ever created or dropped. The returned function drops it again.
 */
export default async function globalSetup() {
  if (!/^skans_e2e_\d+_\d+$/.test(E2E_DB_NAME)) throw new Error(`Refusing to use database name "${E2E_DB_NAME}".`);
  const admin = createPrismaClient(E2E_ADMIN_URL);
  await admin.$executeRawUnsafe(`CREATE DATABASE "${E2E_DB_NAME}"`);
  await admin.$disconnect();

  const cwd = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const env = { ...process.env, ...E2E_SERVER_ENV };
  execSync('npx prisma migrate deploy', { cwd, env, stdio: 'pipe' });
  execSync('npx tsx prisma/seed.ts', { cwd, env, stdio: 'pipe' });

  return async () => {
    const client = createPrismaClient(E2E_ADMIN_URL);
    await client.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${E2E_DB_NAME}" WITH (FORCE)`);
    await client.$disconnect();
  };
}
