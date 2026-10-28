/**
 * Load test: npm run test:load -w server
 *
 * Starts its own server (port 4820) on a temporary PostgreSQL database with the 160-mark demo paper,
 * then measures response times and errors under many simultaneous users:
 *   1. sign-in burst, 2. browsing (lists, questions, papers) at rising user counts,
 *   3. many teachers saving questions at once, 4. simultaneous PDF downloads.
 * Runs with NODE_ENV=test so the per-computer rate limit does not cut the test short
 * (the rate limit itself is checked by the security tests). Nothing else is touched.
 */
import { execSync, spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPrismaClient } from '../src/db';

const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 4820;
const BASE = `http://localhost:${PORT}/api`;
const DB = `skans_load_${Date.now()}`;
const PW = 'LoadTestAdmin2026';
const baseUrl = process.env.DATABASE_URL ?? '';
const urlFor = (db: string) => { const u = new URL(baseUrl); u.pathname = `/${db}`; return u.toString(); };
const env = { ...process.env, NODE_ENV: 'test', PORT: String(PORT), DATABASE_URL: urlFor(DB), SESSION_SECRET: 'load-test-only-session-secret-0123456789abcdef0123456789', SKANS_ADMIN_PASSWORD: PW };

class Client {
  cookie = '';
  csrf = '';
  async req(method: string, p: string, body?: unknown) {
    const headers: Record<string, string> = {};
    if (this.cookie) headers.cookie = this.cookie;
    if (this.csrf && method !== 'GET') headers['x-csrf-token'] = this.csrf;
    if (body !== undefined) headers['content-type'] = 'application/json';
    const t = performance.now();
    const r = await fetch(BASE + p, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const sc = r.headers.get('set-cookie');
    if (sc) this.cookie = sc.split(';')[0];
    const buf = await r.arrayBuffer();
    return { status: r.status, ms: performance.now() - t, bytes: buf.byteLength, json: () => JSON.parse(Buffer.from(buf).toString('utf8')) };
  }
  async login() {
    this.csrf = (await this.req('GET', '/auth/csrf')).json().csrfToken;
    const r = await this.req('POST', '/auth/login', { username: 'admin', password: PW });
    if (r.status !== 200) throw new Error(`login ${r.status}`);
    this.csrf = r.json().csrfToken;
    return r;
  }
}

interface Stats { name: string; users: number; seconds: number; times: number[]; errors: number; statuses: Record<number, number> }
const pct = (xs: number[], p: number) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))] : 0; };
const rows: string[][] = [];
function report(s: Stats) {
  const ok = s.times.length - s.errors;
  const row = [s.name, String(s.users), String(s.times.length), (s.times.length / s.seconds).toFixed(1), pct(s.times, 50).toFixed(0), pct(s.times, 95).toFixed(0), pct(s.times, 99).toFixed(0), Math.max(...s.times).toFixed(0), `${s.errors} (${((s.errors / Math.max(1, s.times.length)) * 100).toFixed(1)}%)`];
  rows.push(row);
  console.log(`  ${s.name.padEnd(34)} users ${String(s.users).padStart(3)}  req ${String(s.times.length).padStart(5)}  ${row[3].padStart(6)} req/s  p50 ${row[4].padStart(5)} ms  p95 ${row[5].padStart(5)} ms  p99 ${row[6].padStart(5)} ms  errors ${row[8]}${ok ? '' : ' ' + JSON.stringify(s.statuses)}`);
}

/** Runs `users` virtual users for `seconds`, each repeating `step` as fast as the server answers. */
async function run(name: string, users: number, seconds: number, clients: Client[], step: (c: Client, i: number) => Promise<{ status: number; ms: number }>, okStatus = (s: number) => s < 400) {
  const s: Stats = { name, users, seconds, times: [], errors: 0, statuses: {} };
  const end = Date.now() + seconds * 1000;
  await Promise.all(Array.from({ length: users }, async (_, u) => {
    let i = 0;
    while (Date.now() < end) {
      try {
        const r = await step(clients[u % clients.length], i++);
        s.times.push(r.ms);
        s.statuses[r.status] = (s.statuses[r.status] ?? 0) + 1;
        if (!okStatus(r.status)) s.errors++;
      } catch { s.times.push(0); s.errors++; }
    }
  }));
  report(s);
  return s;
}

async function main() {
  if (!baseUrl.startsWith('postgres')) throw new Error('DATABASE_URL must point to PostgreSQL (server/.env).');
  const maint = createPrismaClient(urlFor('postgres'));
  await maint.$executeRawUnsafe(`CREATE DATABASE "${DB}"`);
  let server: ChildProcess | null = null;
  try {
    console.log(`Preparing a temporary system (${DB}) with the 160-mark demo paper...`);
    execSync('npx prisma migrate deploy', { cwd: serverDir, env, stdio: 'pipe' });
    execSync('npx tsx prisma/seed.ts', { cwd: serverDir, env, stdio: 'pipe' });
    execSync('npx tsx scripts/demo-paper.ts', { cwd: serverDir, env, stdio: 'pipe' });
    server = spawn('npx tsx src/index.ts', { cwd: serverDir, env, stdio: 'ignore', shell: true });
    for (let i = 0; i < 60; i++) { try { if ((await fetch(`${BASE}/health`)).ok) break; } catch { /* starting */ } await new Promise((r) => setTimeout(r, 1000)); }

    // First sign-in: the seeded admin must choose a password; then keep the same one.
    const first = new Client();
    await first.login();
    await first.req('POST', '/auth/change-password', { currentPassword: PW, newPassword: PW + 'x', confirmPassword: PW + 'x' });
    env.SKANS_ADMIN_PASSWORD = PW;
    const pw2 = PW + 'x';
    const loginAs = async () => {
      const c = new Client();
      c.csrf = (await c.req('GET', '/auth/csrf')).json().csrfToken;
      const r = await c.req('POST', '/auth/login', { username: 'admin', password: pw2 });
      if (r.status === 200) c.csrf = r.json().csrfToken;
      return { c, r };
    };

    console.log('\n1. Sign-in burst (passwords are checked with bcrypt, deliberately slow)');
    for (const n of [10, 25]) {
      const t = performance.now();
      const res = await Promise.all(Array.from({ length: n }, loginAs));
      const times = res.map((x) => x.r.ms);
      report({ name: `${n} people sign in at the same moment`, users: n, seconds: (performance.now() - t) / 1000, times, errors: res.filter((x) => x.r.status !== 200).length, statuses: {} });
    }

    const clients = (await Promise.all(Array.from({ length: 50 }, loginAs))).map((x) => x.c);
    const qs = (await clients[0].req('GET', '/questions?pageSize=100')).json().items as { id: number }[];
    const paperId = ((await clients[0].req('GET', '/papers')).json() as { id: number }[] | { items: { id: number }[] });
    const pid = Array.isArray(paperId) ? paperId[0].id : paperId.items[0].id;
    const subjects = (await clients[0].req('GET', '/subjects')).json() as { id: number; code: string }[];
    const far = subjects.find((s) => s.code === 'FAR')!.id;

    console.log('\n2a. Each page on its own (one person, 20 times; median)');
    const pages: [string, string][] = [['Dashboard', '/dashboard'], ['Question list (25)', '/questions?pageSize=25'], ['Question search', '/questions?q=audit&pageSize=25'],
      ['One question', `/questions/${qs[0].id}`], ['Paper list', '/papers'], ['One paper (69 questions)', `/papers/${pid}`], ['Subjects', '/subjects'], ['Audit log', '/audit']];
    for (const [label, p] of pages) {
      const t: number[] = [];
      for (let i = 0; i < 20; i++) t.push((await clients[0].req('GET', p)).ms);
      console.log(`  ${label.padEnd(28)} ${pct(t, 50).toFixed(0).padStart(5)} ms`);
    }

    console.log('\n2. Browsing: dashboard, question lists, single questions, papers (mixed)');
    const browse = (c: Client, i: number) => {
      const pick = [
        () => c.req('GET', '/dashboard'),
        () => c.req('GET', `/questions?page=${(i % 3) + 1}&pageSize=25`),
        () => c.req('GET', `/questions/${qs[i % qs.length].id}`),
        () => c.req('GET', '/questions?q=audit&pageSize=25'),
        () => c.req('GET', '/papers'),
        () => c.req('GET', `/papers/${pid}`),
      ];
      return pick[i % pick.length]();
    };
    for (const users of [10, 25, 50]) await run(`Browsing, ${users} people at once`, users, 20, clients, browse);

    console.log('\n3. Writing: teachers saving new questions at the same time');
    await run('Saving questions, 20 people at once', 20, 15, clients, (c, i) =>
      c.req('POST', '/questions', { subjectId: far, type: 'SHORT', topic: `Load ${i}`, marks: 5, difficulty: 'MEDIUM', source: '', body: `<p>Load test question ${i} with some <strong>bold</strong> text.</p>`, answer: '<p>Answer</p>', advice: '', comments: '', content: {} }));

    console.log('\n4. PDF: the full 160-mark paper (about 20 pages) downloaded at the same time');
    for (const users of [1, 5, 10]) {
      await run(`PDF downloads, ${users} at once`, users, users === 1 ? 15 : 25, clients, (c, i) => c.req('GET', i % 2 ? `/papers/${pid}/answer-key.pdf` : `/papers/${pid}/pdf`));
    }

    console.log('\nSummary (times in milliseconds)');
    console.log('| Test | Users | Requests | Req/s | p50 | p95 | p99 | Max | Errors |');
    console.log('|---|---:|---:|---:|---:|---:|---:|---:|---|');
    for (const r of rows) console.log(`| ${r.join(' | ')} |`);
  } finally {
    if (server?.pid) { try { execSync(`taskkill /PID ${server.pid} /T /F`, { stdio: 'ignore' }); } catch { /* stopped */ } }
    await maint.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${DB}" WITH (FORCE)`);
    await maint.$disconnect();
  }
}

main().catch((e) => {
  console.error('[load-test]', e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
