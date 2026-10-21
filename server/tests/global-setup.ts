import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TEST_DB_FILE, TEST_ENV } from './test-env';

/**
 * Creates the schema in a fresh, empty test database and seeds the demo dataset once per run.
 * Both steps are non-destructive (the file is new), and the file is removed afterwards.
 */
export default function setup() {
  const cwd = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  if (existsSync(TEST_DB_FILE)) throw new Error(`Test database ${TEST_DB_FILE} already exists; refusing to reuse it.`);
  mkdirSync(path.dirname(TEST_DB_FILE), { recursive: true });
  const env = { ...process.env, ...TEST_ENV };
  const run = (cmd: string) => execSync(cmd, { cwd, env, stdio: 'pipe' });
  run('npx prisma db push --skip-generate');
  run('npx tsx prisma/seed.ts');
  return () => {
    for (const suffix of ['', '-journal']) rmSync(TEST_DB_FILE + suffix, { force: true });
  };
}
