/**
 * Security tests: npm run test:security -w server
 *
 * Starts an isolated server on a temporary PostgreSQL database (ports 4830-4832) three times:
 *   1. test mode: sign-in, permissions, validation, paper rules, robustness (probes.mjs)
 *   2. normal mode: headers, cookies, information leaks, file access, lockout, rate limits (limits.mjs)
 *   3. production mode behind HTTPS: Secure cookie and Strict-Transport-Security (limits.mjs production)
 * Prints PASS / FAIL for every check; exits with an error when any check fails. Nothing else is touched.
 */
import { execSync, spawn, spawnSync, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPrismaClient } from '../../src/db';

const here = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.resolve(here, '..', '..');
const DB = `skans_security_${Date.now()}`;
const FIRST_PW = 'SecurityFirst2026';
const baseUrl = process.env.DATABASE_URL ?? '';
const urlFor = (db: string) => { const u = new URL(baseUrl); u.pathname = `/${db}`; return u.toString(); };
const env = { ...process.env, DATABASE_URL: urlFor(DB), SESSION_SECRET: 'security-test-only-session-secret-0123456789abcdef', SKANS_ADMIN_PASSWORD: FIRST_PW, CLIENT_DIST: '../client/dist-test' };

async function withServer(mode: string, port: number, extra: Record<string, string>, fn: (base: string) => number) {
  const server: ChildProcess = spawn('npx tsx src/index.ts', { cwd: serverDir, env: { ...env, NODE_ENV: mode, PORT: String(port), ...extra }, stdio: 'ignore', shell: true });
  const base = `http://localhost:${port}`;
  try {
    for (let i = 0; i < 60; i++) { try { if ((await fetch(`${base}/api/health`)).ok) break; } catch { /* starting */ } await new Promise((r) => setTimeout(r, 1000)); }
    return fn(base);
  } finally {
    if (server.pid) { try { execSync(`taskkill /PID ${server.pid} /T /F`, { stdio: 'ignore' }); } catch { /* stopped */ } }
  }
}
const node = (script: string, ...args: string[]) => spawnSync(process.execPath, [path.join(here, script), ...args], { stdio: 'inherit' }).status ?? 1;

async function main() {
  if (!baseUrl.startsWith('postgres')) throw new Error('DATABASE_URL must point to PostgreSQL (server/.env).');
  const maint = createPrismaClient(urlFor('postgres'));
  await maint.$executeRawUnsafe(`CREATE DATABASE "${DB}"`);
  let failed = 0;
  try {
    execSync('npx prisma migrate deploy', { cwd: serverDir, env, stdio: 'pipe' });
    execSync('npx tsx prisma/seed.ts', { cwd: serverDir, env, stdio: 'pipe' });
    console.log('Part 1: sign-in, permissions, validation, paper rules, robustness');
    failed += await withServer('test', 4830, {}, (b) => node('probes.mjs', b, FIRST_PW));
    console.log('\nPart 2: headers, cookies, leaks, file access, lockout, rate limits');
    failed += await withServer('development', 4831, {}, (b) => node('limits.mjs', b, 'AdminExplore2026'));
    console.log('\nPart 3: production mode behind HTTPS');
    failed += await withServer('production', 4832, { TRUST_PROXY: '1' }, (b) => node('limits.mjs', b, 'AdminExplore2026', 'production'));
  } finally {
    await maint.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${DB}" WITH (FORCE)`);
    await maint.$disconnect();
  }
  console.log(failed ? '\nSecurity tests: SOME CHECKS FAILED' : '\nSecurity tests: all checks passed');
  process.exitCode = failed ? 1 : 0;
}

main().catch((e) => {
  console.error('[security]', e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
