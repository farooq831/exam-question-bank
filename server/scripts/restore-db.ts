/**
 * Restores a backup made by `npm run db:backup`.
 *
 *   npm run db:verify-backup                     restore the newest backup into a temporary database,
 *                                                compare every table with the live data, drop it again
 *   npm run db:verify-backup -- <backup folder>  the same for a chosen backup
 *   npm run db:restore -- <backup folder> --yes  REPLACE the live database with the backup
 *
 * Verifying never touches the live database. A real restore first checks the backup's checksum,
 * then takes a fresh safety backup of the current data, then replaces it in one transaction.
 * Stop the application before a real restore; everyone signs in again afterwards.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { env, paths } from '../src/config';
import { pgConnection, pgTool } from './lib/pg-tools';

const TABLES = ['User', 'Subject', 'UserSubject', 'PaperTemplate', 'Question', 'Paper', 'PaperItem', 'PaperVersion', 'AuditLog'];

function pickBackup(arg: string | undefined): string {
  if (arg) return path.resolve(arg);
  const root = path.resolve(process.env.BACKUP_DIR ?? path.join(paths.serverRoot, 'backups'));
  const newest = readdirSync(root).filter((n) => /^skans-\d{8}-\d{6}$/.test(n) && existsSync(path.join(root, n, 'database.dump'))).sort().pop();
  if (!newest) throw new Error(`No PostgreSQL backup found in ${root}.`);
  return path.join(root, newest);
}

/** Reads the dump and checks it against the checksum written when the backup was made. */
function readDump(folder: string): Buffer {
  const dumpFile = path.join(folder, 'database.dump');
  if (!existsSync(dumpFile)) throw new Error(`${dumpFile} not found.`);
  const dump = readFileSync(dumpFile);
  const infoFile = path.join(folder, 'backup.json');
  if (existsSync(infoFile)) {
    const info = JSON.parse(readFileSync(infoFile, 'utf8')) as { sha256?: string };
    const actual = createHash('sha256').update(dump).digest('hex');
    if (info.sha256 && info.sha256 !== actual) throw new Error('The backup file is damaged (checksum does not match). Use another backup.');
  }
  return dump;
}

/** pg_restore reads the dump from stdin (Windows builds cannot open paths with emoji). */
function pgRestore(dump: Buffer, databaseUrl: string, extra: string[]) {
  const conn = pgConnection(databaseUrl);
  const r = spawnSync(pgTool('pg_restore'), [...conn.args, '--no-owner', '--no-privileges', '--exit-on-error', ...extra], { env: conn.env, input: dump, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`pg_restore failed: ${(r.stderr || r.error?.message || 'unknown error').trim()}`);
}

const urlFor = (base: string, db: string) => {
  const u = new URL(base);
  u.pathname = `/${db}`;
  return u.toString();
};

async function counts(url: string): Promise<Record<string, number>> {
  const client = new PrismaClient({ datasourceUrl: url });
  try {
    const out: Record<string, number> = {};
    for (const t of TABLES) out[t] = Number(((await client.$queryRawUnsafe(`SELECT COUNT(*)::int AS c FROM "${t}"`)) as { c: number }[])[0].c);
    return out;
  } finally {
    await client.$disconnect();
  }
}

async function verify(folder: string) {
  const dump = readDump(folder);
  const scratch = `skans_verify_${Date.now()}`;
  const admin = new PrismaClient({ datasourceUrl: urlFor(env.DATABASE_URL, 'postgres') });
  await admin.$executeRawUnsafe(`CREATE DATABASE "${scratch}"`);
  try {
    pgRestore(dump, urlFor(env.DATABASE_URL, scratch), []);
    const [restored, live] = await Promise.all([counts(urlFor(env.DATABASE_URL, scratch)), counts(env.DATABASE_URL)]);
    console.log(`Backup ${path.basename(folder)} restores correctly. Rows (backup / live now):`);
    for (const t of TABLES) console.log(`  ${t.padEnd(14)} ${String(restored[t]).padStart(6)} / ${String(live[t]).padStart(6)}`);
    console.log('Differences are expected for anything added or changed after the backup was made.');
  } finally {
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${scratch}" WITH (FORCE)`);
    await admin.$disconnect();
  }
}

async function restore(folder: string) {
  const dump = readDump(folder);
  console.log('Taking a safety backup of the current data first...');
  const safety = spawnSync(process.execPath, [...process.execArgv, path.join(paths.serverRoot, 'scripts', 'backup-db.ts')], { stdio: 'inherit', env: process.env });
  if (safety.status !== 0) throw new Error('The safety backup failed, so nothing was restored.');
  pgRestore(dump, env.DATABASE_URL, ['--clean', '--if-exists', '--single-transaction']);
  const after = await counts(env.DATABASE_URL);
  console.log(`Restored ${path.basename(folder)}. Rows now: ${TABLES.map((t) => `${t} ${after[t]}`).join(', ')}.`);
}

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const mode = process.argv.includes('--verify') ? 'verify' : 'restore';
  const folder = pickBackup(args[0]);
  if (mode === 'verify') return verify(folder);
  if (!args[0]) throw new Error('Name the backup folder to restore, e.g. npm run db:restore -- backups/skans-20261023-230000 --yes');
  if (!process.argv.includes('--yes')) throw new Error('This replaces ALL current data with the backup. Add --yes to confirm (a safety backup is taken first).');
  return restore(folder);
}

main().catch((e) => {
  console.error('[restore]', e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
