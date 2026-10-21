/**
 * Online backup of the SQLite database and the branding folder (safe while the server is running):
 *   npm run db:backup                 -> server/backups/skans-YYYYMMDD-HHMMSS/
 *   npm run db:backup -- D:\Backups   -> D:\Backups\skans-YYYYMMDD-HHMMSS/
 * For PostgreSQL use pg_dump instead (see README "Backups").
 */
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { env, paths } from '../src/config';
import { prisma } from '../src/db';

const now = new Date();
const pad = (n: number) => String(n).padStart(2, '0');
// Local server time, so the folder name matches the clock school staff see.
const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
const root = path.resolve(process.argv[2] ?? path.join(paths.serverRoot, 'backups'));
const target = path.join(root, `skans-${stamp}`);

async function main() {
  if (!env.DATABASE_URL.startsWith('file:')) {
    console.error('DATABASE_URL is not SQLite. Back up PostgreSQL with pg_dump (see README).');
    process.exitCode = 1;
    return;
  }
  mkdirSync(target, { recursive: true });
  const dbFile = path.join(target, 'database.db');
  // VACUUM INTO writes a consistent, compacted copy without stopping the application.
  await prisma.$executeRawUnsafe(`VACUUM INTO '${dbFile.replace(/'/g, "''")}'`);
  if (existsSync(paths.branding)) cpSync(paths.branding, path.join(target, 'branding'), { recursive: true });
  console.log(`[backup] Database and branding saved to ${target}`);
}

main()
  .catch((error) => {
    console.error('[backup] failed:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
