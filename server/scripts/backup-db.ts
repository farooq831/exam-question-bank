/**
 * Backup of the PostgreSQL database and the branding folder (safe while the system is in use):
 *
 *   npm run db:backup                 -> <BACKUP_DIR>/skans-YYYYMMDD-HHMMSS/
 *   npm run db:backup -- D:\Backups   -> D:\Backups\skans-YYYYMMDD-HHMMSS/
 *
 * Each backup folder holds:
 *   database.dump  pg_dump "custom" format (compressed, restores with `npm run db:restore`)
 *   branding/      the logo files
 *   backup.json    when, which database, sizes and a SHA-256 checksum of the dump
 *
 * Old backups are removed automatically: the newest BACKUP_KEEP_DAILY (default 14) are kept, plus
 * the newest backup of each of the last BACKUP_KEEP_MONTHLY (default 6) months. Only folders named
 * skans-YYYYMMDD-HHMMSS are ever deleted. With BACKUP_COPY_DIR set, every new backup is also copied
 * there (another disk, a USB drive or a synced OneDrive/Google Drive folder), with the same rules.
 * Scheduled nightly by scripts/schedule-backup.ps1 (Windows) or cron (Linux).
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { closeSync, cpSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { env, paths } from '../src/config';
import { pgConnection, pgTool } from './lib/pg-tools';

const NAME = /^skans-(\d{4})(\d{2})(\d{2})-(\d{6})$/;
const now = new Date();
const pad = (n: number) => String(n).padStart(2, '0');
// Local server time, so the folder name matches the clock school staff see.
const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
const keepDaily = Math.max(1, Number(process.env.BACKUP_KEEP_DAILY ?? 14));
const keepMonthly = Math.max(0, Number(process.env.BACKUP_KEEP_MONTHLY ?? 6));

/** Keeps the newest `keepDaily` backups and the newest one of each of the last `keepMonthly` months. */
function prune(root: string): string[] {
  // Only PostgreSQL backups made by this script (they have backup.json) are ever deleted; older
  // folders, such as the SQLite backups from before 23 October 2026, are left alone.
  const folders = readdirSync(root)
    .filter((n) => NAME.test(n) && statSync(path.join(root, n)).isDirectory() && existsSync(path.join(root, n, 'backup.json')))
    .sort()
    .reverse();
  const keep = new Set(folders.slice(0, keepDaily));
  const months = new Set<string>();
  for (const f of folders) {
    const month = f.slice(6, 12);
    if (months.size >= keepMonthly && !months.has(month)) break;
    if (!months.has(month)) {
      months.add(month);
      keep.add(f);
    }
  }
  const removed = folders.filter((f) => !keep.has(f));
  for (const f of removed) rmSync(path.join(root, f), { recursive: true, force: true });
  return removed;
}

function main() {
  const root = path.resolve(process.argv[2] ?? process.env.BACKUP_DIR ?? path.join(paths.serverRoot, 'backups'));
  const target = path.join(root, `skans-${stamp}`);
  mkdirSync(target, { recursive: true });

  const conn = pgConnection(env.DATABASE_URL);
  const dumpFile = path.join(target, 'database.dump');
  // pg_dump writes to stdout and Node writes the file: Windows builds of pg_dump cannot open paths
  // with characters outside the system code page (such as emoji in a folder name).
  const fd = openSync(dumpFile, 'w');
  const dump = spawnSync(pgTool('pg_dump'), [...conn.args, '--format=custom', '--compress=6', '--no-owner', '--no-privileges'], { env: conn.env, stdio: ['ignore', fd, 'pipe'], encoding: 'utf8' });
  closeSync(fd);
  if (dump.status !== 0 || !existsSync(dumpFile) || statSync(dumpFile).size === 0) {
    rmSync(target, { recursive: true, force: true });
    throw new Error(`pg_dump failed: ${(dump.stderr || dump.error?.message || 'unknown error').trim()}`);
  }
  if (existsSync(paths.branding)) cpSync(paths.branding, path.join(target, 'branding'), { recursive: true });

  const bytes = readFileSync(dumpFile);
  writeFileSync(
    path.join(target, 'backup.json'),
    JSON.stringify({ createdAt: now.toISOString(), database: conn.database, format: 'pg_dump custom', dumpBytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }, null, 2),
  );
  console.log(`[backup] ${target} (${(bytes.length / 1024).toFixed(0)} KB)`);

  const removed = prune(root);
  if (removed.length) console.log(`[backup] removed ${removed.length} old backup(s): ${removed.join(', ')}`);

  const copyRoot = process.env.BACKUP_COPY_DIR;
  if (copyRoot) {
    try {
      mkdirSync(copyRoot, { recursive: true });
      cpSync(target, path.join(copyRoot, path.basename(target)), { recursive: true });
      prune(copyRoot);
      console.log(`[backup] second copy saved in ${copyRoot}`);
    } catch (e) {
      // The main backup is safe; report the failed copy so the scheduled task shows an error.
      console.error(`[backup] could not copy to BACKUP_COPY_DIR (${copyRoot}): ${(e as Error).message}`);
      process.exitCode = 2;
    }
  }
}

try {
  main();
} catch (error) {
  console.error('[backup] failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
