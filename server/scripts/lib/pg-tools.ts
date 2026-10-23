/** Helpers for running PostgreSQL's own tools (pg_dump, pg_restore) against DATABASE_URL. */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

/** Finds pg_dump / pg_restore: PG_BIN, then PATH, then the usual Windows install folders. */
export function pgTool(name: 'pg_dump' | 'pg_restore'): string {
  const exe = process.platform === 'win32' ? `${name}.exe` : name;
  if (process.env.PG_BIN) {
    const p = path.join(process.env.PG_BIN, exe);
    if (existsSync(p)) return p;
  }
  const onPath = spawnSync(exe, ['--version'], { stdio: 'ignore' });
  if (onPath.status === 0) return exe;
  if (process.platform === 'win32') {
    const base = 'C:\\Program Files\\PostgreSQL';
    if (existsSync(base)) {
      const versions = readdirSync(base).filter((v) => /^\d+$/.test(v)).sort((a, b) => Number(b) - Number(a));
      for (const v of versions) {
        const p = path.join(base, v, 'bin', exe);
        if (existsSync(p)) return p;
      }
    }
  }
  throw new Error(`${name} was not found. Install the PostgreSQL client tools or set PG_BIN to their folder.`);
}

/**
 * Connection details for libpq tools. The password goes through PGPASSWORD (never on the command
 * line, where other users of the machine could see it), and Prisma-only options such as
 * ?schema=public are dropped.
 */
export function pgConnection(databaseUrl: string): { args: string[]; env: NodeJS.ProcessEnv; database: string } {
  const url = new URL(databaseUrl);
  if (!/^postgres(ql)?:$/.test(url.protocol)) throw new Error('DATABASE_URL is not a PostgreSQL URL.');
  const database = decodeURIComponent(url.pathname.replace(/^\//, ''));
  return {
    database,
    args: ['--host', url.hostname || 'localhost', '--port', url.port || '5432', '--username', decodeURIComponent(url.username), '--dbname', database],
    env: { ...process.env, PGPASSWORD: decodeURIComponent(url.password), PGSSLMODE: url.searchParams.get('sslmode') ?? process.env.PGSSLMODE ?? 'prefer' },
  };
}
