// Security probes (part 2): headers, cookies, information leaks, file access, lockout and rate limits.
// Needs the normal limits (NODE_ENV=development or production). Usage: node limits.mjs <base url> <admin password> [production]
const B = process.argv[2];
const ADMIN_PW = process.argv[3];
const PROD = process.argv[4] === 'production';
const results = [];
const check = (id, ok, msg) => { results.push([ok ? 'PASS' : 'FAIL', id, msg]); console.log(`${ok ? 'PASS' : 'FAIL'} ${id.padEnd(4)} ${msg}`); };

class Session {
  cookie = ''; csrf = ''; setCookie = '';
  async req(method, path, body, headers = {}) {
    // In production mode the server sits behind Nginx/Cloudflare (TRUST_PROXY=1), which tells it the visitor used HTTPS.
    const h = { ...(PROD ? { 'x-forwarded-proto': 'https' } : {}), ...(this.cookie ? { cookie: this.cookie } : {}), ...(this.csrf ? { 'x-csrf-token': this.csrf } : {}), ...headers };
    let payload = body;
    if (body !== undefined && !(body instanceof FormData) && typeof body !== 'string') { h['content-type'] = 'application/json'; payload = JSON.stringify(body); }
    if (typeof body === 'string') h['content-type'] = 'application/json';
    const r = await fetch(B + path, { method, headers: h, body: payload, redirect: 'manual' });
    const sc = r.headers.get('set-cookie'); if (sc) { this.setCookie = sc; this.cookie = sc.split(';')[0]; }
    const text = await r.text();
    let data = text; try { data = JSON.parse(text); } catch { /* not JSON */ }
    return { status: r.status, data, text, headers: r.headers };
  }
  async login(username, password) {
    this.csrf = (await this.req('GET', '/api/auth/csrf')).data.csrfToken;
    const r = await this.req('POST', '/api/auth/login', { username, password });
    if (r.data?.csrfToken) this.csrf = r.data.csrfToken;
    return r;
  }
}

console.log(`\n== Security headers and cookies (${PROD ? 'production' : 'development'} mode)`);
const page = await new Session().req('GET', '/');
const api = await new Session().req('GET', '/api/health');
for (const [name, res] of [['web page', page], ['API', api]]) {
  check('H1', !res.headers.get('x-powered-by'), `${name}: the server does not announce its software (no X-Powered-By)`);
  check('H2', /nosniff/.test(res.headers.get('x-content-type-options') ?? ''), `${name}: X-Content-Type-Options nosniff`);
}
const csp = page.headers.get('content-security-policy') ?? '';
check('H3', /default-src 'self'/.test(csp) && !/script-src[^;]*'unsafe-inline'/.test(csp), `web page has a strict Content-Security-Policy (no inline scripts)`);
check('H4', /frame-ancestors 'none'|frame-ancestors 'self'/.test(csp) || /DENY|SAMEORIGIN/.test(page.headers.get('x-frame-options') ?? ''), 'the site cannot be framed by other sites (clickjacking)');
check('H5', !!page.headers.get('referrer-policy'), `Referrer-Policy set (${page.headers.get('referrer-policy')})`);
if (PROD) check('H6', /max-age=\d+/.test(page.headers.get('strict-transport-security') ?? ''), 'production: HTTPS is enforced in browsers (Strict-Transport-Security)');

const admin = new Session();
let r = await admin.login('admin', ADMIN_PW);
const cookie = admin.setCookie.toLowerCase();
check('C1', r.status === 200 && cookie.includes('httponly'), 'session cookie is HttpOnly (scripts cannot read it)');
check('C2', /samesite=strict/.test(cookie), 'session cookie is SameSite=Strict (not sent from other sites)');
if (PROD) check('C3', cookie.includes('secure'), 'production: session cookie is Secure (only sent over HTTPS)');
if (PROD) {
  console.log(`\nSUMMARY: ${results.filter((x) => x[0] === 'PASS').length} pass, ${results.filter((x) => x[0] === 'FAIL').length} fail`);
  process.exitCode = results.some((x) => x[0] === 'FAIL') ? 1 : 0;
  // Over plain HTTP a production server does not send the Secure cookie back, so the rest runs in development mode.
} else {
  console.log('\n== Information leaks and file access');
  const me = await admin.req('GET', '/api/auth/me');
  const users = await admin.req('GET', '/api/users');
  check('D1', !/passwordHash|\$2[aby]\$/.test(me.text + users.text), 'password hashes are never sent to the browser (me, user list)');
  r = await admin.req('POST', '/api/questions', '{"broken json');
  check('D2', r.status === 400 && !/\bat\s.+\.(ts|js):\d+/.test(r.text) && !/node_modules/.test(r.text), `errors do not reveal code or file paths (${r.status})`);
  r = await admin.req('GET', '/api/questions/1%27%20OR%201=1');
  check('D3', r.status === 400 || r.status === 404, `SQL text in an id is refused (${r.status})`);
  for (const p of ['/.env', '/../server/.env', '/%2e%2e/server/.env', '/server/.env', '/package.json', '/prisma/schema.prisma']) {
    r = await new Session().req('GET', p);
    check('F1', !/SESSION_SECRET|DATABASE_URL|postgres(ql)?:\/\/|"dependencies"|datasource/.test(r.text), `${p} does not expose server files (${r.status})`);
  }
  r = await new Session().req('GET', '/api/questions');
  check('F2', r.status === 401, `API refuses visitors who are not signed in (${r.status})`);
  r = await new Session().req('POST', '/api/auth/login', { username: 'admin', password: ADMIN_PW });
  check('F3', r.status === 403, `sign-in without the CSRF security token is refused (${r.status})`);

  // HTML in paper names must print as text (from the earlier exploratory tests).
  const subjects = (await admin.req('GET', '/api/subjects')).data;
  const FAR = subjects.find((s) => s.code === 'FAR').id;
  const tpl = (await admin.req('GET', '/api/templates')).data[0];
  const approved = (await admin.req('GET', `/api/questions?status=APPROVED&subjectId=${FAR}&pageSize=1`)).data.items[0];
  const evil = '<script>alert(1)</script><img src=x onerror=alert(2)>';
  r = await admin.req('POST', '/api/papers/preview?format=html', { title: evil, subjectId: FAR, templateId: tpl.id, header: { session: evil, examDate: '', maxMarks: 10, teacherName: evil, researchOfficers: evil, adminName: evil, titleOverride: evil }, items: [{ questionId: approved.id }], mode: 'key' });
  check('X1', r.status === 200 && !r.text.includes('<script>alert(1)') && !r.text.includes('<img src=x onerror'), `HTML typed into paper title and names prints as text, not code (${r.status})`);
  const form = new FormData();
  form.append('file', new Blob(['MZ fake program'], { type: 'application/x-msdownload' }), 'virus.exe');
  r = await admin.req('POST', '/api/import/questions?dryRun=1', form);
  check('X2', r.status === 400, `uploading a program instead of a CSV file is refused (${r.status})`);

  console.log('\n== Lockout and rate limits');
  await admin.req('POST', '/api/users', { username: 'victim', fullName: 'Victim User', role: 'TEACHER', password: 'Welcome2026xx', subjectIds: [FAR] });
  for (let i = 0; i < 5; i++) await new Session().login('victim', 'wrong-password-' + i);
  r = await new Session().login('victim', 'Welcome2026xx');
  check('L1', r.status !== 200, `after 5 wrong passwords the account is locked, even for the right password (${r.status}: ${r.data?.error ?? ''})`);
  const victim = (await admin.req('GET', '/api/users')).data.find((u) => u.username === 'victim');
  await admin.req('POST', `/api/users/${victim.id}/unlock`);
  r = await new Session().login('victim', 'Welcome2026xx');
  check('L2', r.status === 200, `the administrator can unlock it (${r.status})`);

  let blocked = 0;
  for (let i = 1; i <= 30; i++) { const s = new Session(); const x = await s.login('nobody', 'wrong'); if (x.status === 429) { blocked = i; break; } }
  check('L3', blocked > 0 && blocked <= 25, `password guessing from one computer is blocked after ${blocked || 'none of 30'} attempts (429)`);

  let blockedAt = 0;
  const s = new Session();
  for (let i = 1; i <= 700; i++) { if ((await s.req('GET', '/api/health')).status === 429) { blockedAt = i; break; } }
  check('L4', blockedAt > 500 && blockedAt <= 610, `flooding: request number ${blockedAt || 'none of 700'} in one minute is refused (limit 600)`);

  const fails = results.filter((x) => x[0] === 'FAIL');
  console.log(`\nSUMMARY: ${results.filter((x) => x[0] === 'PASS').length} pass, ${fails.length} fail`);
  for (const f of fails) console.log('  FAIL', f[1], f[2]);
  process.exitCode = fails.length ? 1 : 0;
}
