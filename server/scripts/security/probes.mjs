// Security and behaviour probes (part 1): sign-in, permissions, input validation, paper rules, robustness.
// Run through scripts/security/run.ts (npm run test:security), which starts an isolated server in test mode.
const B = process.argv[2] ?? 'http://localhost:4700';
const ADMIN_PW = process.argv[3];
const results = [];
const log = (kind, id, msg) => { results.push([kind, id, msg]); console.log(`${kind.padEnd(4)} ${id.padEnd(4)} ${msg}`); };
const check = (id, ok, msg) => log(ok ? 'PASS' : 'FAIL', id, msg);
const info = (id, msg) => log('INFO', id, msg);

class Session {
  constructor() { this.cookie = ''; this.csrf = ''; }
  async req(method, path, body, raw = false, extraHeaders = {}) {
    const headers = { ...(this.cookie ? { cookie: this.cookie } : {}), ...(this.csrf ? { 'x-csrf-token': this.csrf } : {}), ...extraHeaders };
    let payload;
    if (body !== undefined) { headers['content-type'] ??= 'application/json'; payload = raw ? body : JSON.stringify(body); }
    const t0 = performance.now();
    const r = await fetch(B + '/api' + path, { method, headers, body: payload, redirect: 'manual' });
    const ms = performance.now() - t0;
    const sc = r.headers.get('set-cookie'); if (sc) this.cookie = sc.split(';')[0];
    const ct = r.headers.get('content-type') ?? '';
    const data = ct.includes('json') ? await r.json().catch(() => null) : await r.arrayBuffer();
    return { status: r.status, data, ms, headers: r.headers };
  }
  async login(username, password) {
    this.csrf = (await this.req('GET', '/auth/csrf')).data.csrfToken;
    const r = await this.req('POST', '/auth/login', { username, password });
    if (r.data?.csrfToken) this.csrf = r.data.csrfToken;
    return r;
  }
  async changePw(cur, next) { return this.req('POST', '/auth/change-password', { currentPassword: cur, newPassword: next, confirmPassword: next }); }
}
const anon = async () => { const s = new Session(); s.csrf = (await s.req('GET', '/auth/csrf')).data.csrfToken; return s; };

// ------------------------------------------------------------------ set-up
const admin = new Session();
await admin.login('admin', ADMIN_PW);
await admin.changePw(ADMIN_PW, 'AdminExplore2026');
await admin.login('admin', 'AdminExplore2026');
const subjects = (await admin.req('GET', '/subjects')).data;
const FAR = subjects.find((s) => s.code === 'FAR').id, TPC = subjects.find((s) => s.code === 'TPC').id;
const mk = async (username, role, subjectIds) => (await admin.req('POST', '/users', { username, fullName: username.toUpperCase(), role, password: 'Welcome2026xx', subjectIds })).data;
const tA = await mk('teacher_a', 'TEACHER', [FAR]); const tB = await mk('teacher_b', 'TEACHER', [FAR]);
await mk('officer', 'RESEARCH_OFFICER', [FAR]); await mk('tax_t', 'TEACHER', [TPC]);
const sign = async (u) => { const s = new Session(); await s.login(u, 'Welcome2026xx'); await s.changePw('Welcome2026xx', 'Own' + u + '2026x'); await s.login(u, 'Own' + u + '2026x'); return s; };
const A = await sign('teacher_a'), Bt = await sign('teacher_b'), RO = await sign('officer'), TX = await sign('tax_t');
const short = (subjectId, extra = {}) => ({ subjectId, type: 'SHORT', topic: 'Explore', marks: 5, body: '<p>Explain accruals.</p>', answer: '<p>Answer</p>', content: {}, ...extra });
const mcq = (subjectId, options) => ({ subjectId, type: 'MCQ', topic: 'MCQ', marks: 1, body: '<p>Pick one</p>', content: { layout: 'auto', options } });
const opt = (n, correct) => Array.from({ length: n }, (_, i) => ({ key: String.fromCharCode(97 + i), html: `<p>o${i}</p>`, correct: correct.includes(i) }));

// ------------------------------------------------------------------ authentication
console.log('\n== Authentication and sessions');
let r = await (await anon()).req('POST', '/auth/login', { username: "' OR 1=1 --", password: 'x' });
check('A1', r.status === 401, `SQL-injection username refused (${r.status})`);
r = await (await anon()).req('POST', '/auth/login', { username: 'a'.repeat(20000), password: 'x'.repeat(5000) });
check('A2', r.status === 400 || r.status === 401, `very long username/password handled without crash (${r.status})`);
r = await (await anon()).req('POST', '/auth/login', { username: 'ADMIN', password: 'AdminExplore2026' });
info('A3', `username "ADMIN" (capitals) → ${r.status} (${r.status === 200 ? 'case-insensitive' : 'case-sensitive'})`);
{ const s = new Session(); await s.login('teacher_b', 'Ownteacher_b2026x'); const cookie = s.cookie; await s.req('POST', '/auth/logout');
  const old = new Session(); old.cookie = cookie; r = await old.req('GET', '/questions');
  check('A4', r.status === 401, `old session cookie after logout is rejected (${r.status})`); }
{ const s1 = await anon(); const s2 = await anon(); const stolen = s1.csrf; s2.csrf = stolen;
  r = await s2.req('POST', '/auth/login', { username: 'admin', password: 'AdminExplore2026' });
  check('A5', r.status === 403, `CSRF token from another session is refused (${r.status})`); }
r = await A.changePw('Ownteacher_a2026x', 'Ownteacher_a2026x');
info('A6', `changing password to the same password → ${r.status}${r.data?.error ? ' ' + (r.data.fields?.[0]?.message ?? r.data.error) : ''}`);
r = await A.req('POST', '/auth/change-password', { currentPassword: 'wrong-current-1', newPassword: 'NewerPass2026x', confirmPassword: 'NewerPass2026x' });
check('A7', r.status === 400 || r.status === 401 || r.status === 403, `wrong current password refused (${r.status})`);

// ------------------------------------------------------------------ permissions
console.log('\n== Permissions (who can see / change what)');
const qa = (await A.req('POST', '/questions', short(FAR))).data;
r = await Bt.req('GET', `/questions/${qa.id}`);
check('P1', r.status === 404 || r.status === 403, `teacher B cannot open teacher A's draft by id (${r.status})`);
r = await Bt.req('PUT', `/questions/${qa.id}`, short(FAR, { body: '<p>hijack</p>' }));
check('P2', r.status === 404 || r.status === 403, `teacher B cannot edit teacher A's draft (${r.status})`);
r = await Bt.req('DELETE', `/questions/${qa.id}`);
check('P3', r.status === 404 || r.status === 403, `teacher B cannot delete teacher A's draft (${r.status})`);
await A.req('POST', `/questions/${qa.id}/submit`);
r = await A.req('POST', `/questions/${qa.id}/review`, { decision: 'APPROVE', comment: '' });
check('P4', r.status === 403, `teacher cannot approve their own question (${r.status})`);
r = await TX.req('POST', '/questions', short(FAR));
check('P5', r.status === 403, `teacher cannot write in a subject not assigned (${r.status})`);
r = await A.req('PUT', `/users/${tA.id}`, { fullName: 'X', role: 'ADMIN', subjectIds: [FAR], isActive: true });
check('P6', r.status === 403, `teacher cannot make themselves admin (${r.status})`);
r = await RO.req('GET', '/papers');
check('P7', r.status === 403, `Research Officer cannot open papers (${r.status})`);
const adminMe = (await admin.req('GET', '/auth/me')).data.user;
r = await admin.req('PUT', `/users/${adminMe.id}`, { fullName: 'Admin', role: 'TEACHER', subjectIds: [], isActive: true });
check('P8', r.status === 400, `admin cannot remove their own admin access (${r.status})`);
r = await admin.req('PUT', `/users/${adminMe.id}`, { fullName: 'Admin', role: 'ADMIN', subjectIds: [], isActive: false });
check('P9', r.status === 400, `admin cannot deactivate themselves / the last admin (${r.status})`);
{ const s = await sign('officer').catch(() => null); void s; }
r = await admin.req('PUT', `/users/${tB.id}`, { fullName: 'TEACHER_B', role: 'TEACHER', subjectIds: [FAR], isActive: false });
const bAfter = await Bt.req('GET', '/questions');
check('P10', bAfter.status === 401, `deactivated user's open session stops working at once (${bAfter.status})`);
await admin.req('PUT', `/users/${tB.id}`, { fullName: 'TEACHER_B', role: 'TEACHER', subjectIds: [FAR], isActive: true });
r = await A.req('GET', '/questions/999999');
check('P11', r.status === 404, `unknown question id → 404 (${r.status})`);
r = await A.req('GET', '/questions/abc');
check('P12', r.status === 400 || r.status === 404, `non-numeric id handled (${r.status})`);

// ------------------------------------------------------------------ input validation
console.log('\n== Input validation');
for (const [id, marks] of [['V1a', -5], ['V1b', 0], ['V1c', 1e9], ['V1d', 'abc'], ['V1e', 2.25]]) {
  r = await A.req('POST', '/questions', short(FAR, { marks }));
  if (id === 'V1e') info(id, `marks ${marks} → ${r.status}${r.status === 201 ? ' saved as ' + r.data.marks : ''}`);
  else check(id, r.status === 400, `marks ${JSON.stringify(marks)} refused (${r.status})`);
}
for (const [id, body] of [['V2a', ''], ['V2b', '   '], ['V2c', '<p></p>'], ['V2d', '<p>&nbsp;</p>']]) {
  r = await A.req('POST', '/questions', short(FAR, { body }));
  check(id, r.status === 400, `empty question text ${JSON.stringify(body)} refused (${r.status})`);
}
for (const [id, n, correct, want] of [['V3a', 4, [], 400], ['V3b', 4, [0, 1], 400], ['V3c', 1, [0], 400], ['V3d', 7, [0], 400], ['V3e', 4, [2], 201]]) {
  r = await A.req('POST', '/questions', mcq(FAR, opt(n, correct)));
  check(id, r.status === want, `MCQ with ${n} options and ${correct.length} correct → ${r.status} (expected ${want})`);
}
r = await A.req('POST', '/questions', '{"broken json', true);
check('V4', r.status === 400, `malformed JSON → ${r.status} (not 500)`);
r = await A.req('POST', '/questions', short(FAR, { body: '<p>' + 'x'.repeat(3_200_000) + '</p>' }));
check('V5', r.status === 413 || r.status === 400, `request over the 3 MB limit refused (${r.status})`);
const urdu = 'مندرجہ ذیل میں سے کون سا درست ہے؟ آمدنی کی شناخت';
r = await A.req('POST', '/questions', short(FAR, { topic: 'اردو سوال', body: `<p>${urdu} 😀 ✓ Rs. 1,000</p>` }));
check('V6', r.status === 201 && r.data.body.includes(urdu), `Urdu text and emoji saved unchanged (${r.status})`);
const urduQ = r.data;
r = await A.req('POST', '/questions', short(FAR, { topic: '<img src=x onerror=alert(1)>', body: '<p onclick="x()">t<a href="javascript:alert(1)">l</a><iframe src="//evil"></iframe></p>' }));
check('V7', r.status === 201 && !/onclick|javascript:|<iframe/i.test(r.data.body), `dangerous HTML attributes, links and iframes removed from question text`);
info('V7b', `title with HTML is stored as plain text "${r.data.topic.slice(0, 40)}" (shown escaped by React)`);
r = await A.req('GET', '/questions?pageSize=100000');
check('V8', r.status === 400 || (r.status === 200 && r.data.items.length <= 200), `huge pageSize refused or capped (${r.status}, ${r.data?.items?.length ?? '-'} rows)`);
for (const [id, q] of [['V9a', '%'], ['V9b', '_'], ['V9c', "'; DROP TABLE \"Question\"; --"], ['V9d', '(.*)+$'], ['V9e', '\\']]) {
  r = await A.req('GET', '/questions?q=' + encodeURIComponent(q));
  check(id, r.status === 200, `search for ${JSON.stringify(q)} works safely (${r.status}, ${r.data?.total} found)`);
}
r = await A.req('GET', '/questions?q=ACCRUALS');
check('V10', r.status === 200 && r.data.total > 0, `search ignores capital letters (${r.data?.total} found)`);
{ const ids = Array.from({ length: 300_000 }, (_, i) => i + 1); const t0 = performance.now();
  r = await admin.req('POST', '/questions/lookup', { ids });
  check('V11', r.status === 400, `oversized list (300,000 ids, ~2 MB) refused (${r.status}) in ${Math.round(performance.now() - t0)} ms (zod advisory probe)`); }
r = await admin.req('POST', '/subjects', { code: 'FAR', name: 'Duplicate', level: '', templateId: null });
check('V12', r.status === 409 || r.status === 400, `duplicate subject code refused (${r.status})`);
r = await admin.req('POST', '/subjects', { code: 'bad code!', name: 'X', level: '', templateId: null });
check('V13', r.status === 400, `invalid subject code refused (${r.status})`);
r = await admin.req('POST', '/users', { username: 'weak', fullName: 'Weak', role: 'TEACHER', password: 'password', subjectIds: [] });
check('V14', r.status === 400, `weak password refused for a new user (${r.status})`);
r = await admin.req('POST', '/users', { username: 'ROOT<script>', fullName: 'X', role: 'TEACHER', password: 'Welcome2026xx', subjectIds: [] });
check('V15', r.status === 400, `invalid username characters refused (${r.status})`);
const tpl = (await admin.req('GET', '/templates')).data[0];
r = await admin.req('PUT', `/templates/${tpl.id}`, { code: tpl.code, name: tpl.name, description: tpl.description, isActive: true, config: { ...tpl.config, page: { ...tpl.config.page, marginTopMm: -50 } } });
check('V16', r.status === 400, `negative page margin in paper format refused (${r.status})`);
r = await admin.req('PUT', `/templates/${tpl.id}`, { code: tpl.code, name: tpl.name, description: tpl.description, isActive: true, config: { ...tpl.config, fonts: { ...tpl.config.fonts, sizePt: 500 } } });
check('V17', r.status === 400, `absurd font size (500 pt) refused (${r.status})`);

// ------------------------------------------------------------------ business rules
console.log('\n== Business rules');
const approve = async (q) => { await A.req('POST', `/questions/${q.id}/submit`); return admin.req('POST', `/questions/${q.id}/review`, { decision: 'APPROVE', comment: '' }); };
const q1 = (await A.req('POST', '/questions', short(FAR, { topic: 'Paper Q1', marks: 10, body: '<p>ORIGINAL-WORDING</p>' }))).data; await approve(q1);
const q2 = (await A.req('POST', '/questions', short(FAR, { topic: 'Paper Q2', marks: 10 }))).data; await approve(q2);
const draftQ = (await A.req('POST', '/questions', short(FAR, { topic: 'Still draft' }))).data;
const taxQ = (await TX.req('POST', '/questions', short(TPC))).data; await TX.req('POST', `/questions/${taxQ.id}/submit`); await admin.req('POST', `/questions/${taxQ.id}/review`, { decision: 'APPROVE', comment: '' });
const header = { session: 'Explore 2026', examDate: '2026-11-01', durationMinutes: 180, readingMinutes: 15, maxMarks: 20 };
const paper = (items, status = 'DRAFT', extra = {}) => ({ title: 'Explore paper', subjectId: FAR, templateId: tpl.id, status, header, items: items.map((q) => ({ questionId: q.id })), ...extra });
r = await admin.req('POST', '/papers', paper([q1, draftQ]));
check('B1', r.status === 400, `a draft (unapproved) question cannot go on a paper (${r.status})`);
r = await admin.req('POST', '/papers', paper([q1, taxQ]));
check('B2', r.status === 400, `a question from another subject cannot go on a paper (${r.status})`);
r = await admin.req('POST', '/papers', paper([q1], 'FINAL'));
check('B3', r.status === 400, `finalising with marks 10 / max 20 is refused (${r.status})`);
const fin = (await admin.req('POST', '/papers', paper([q1, q2], 'FINAL'))).data;
check('B4', !!fin?.id, `finalising with matching marks (20 / 20) works`);
const before = await admin.req('GET', `/papers/${fin.id}/pdf`);
r = await admin.req('PUT', `/questions/${q1.id}`, short(FAR, { topic: 'Paper Q1', marks: 10, body: '<p>CHANGED-AFTER-FINAL</p>' }));
info('B5', `admin edits an approved question that is in a final paper → ${r.status}`);
const after = await admin.req('GET', `/papers/${fin.id}/pdf`);
const pdfText = async (buf) => { const { createRequire } = await import('node:module'); const { pathToFileURL } = await import('node:url'); const req = createRequire(process.cwd() + '/package.json'); const { getDocument } = await import(pathToFileURL(req.resolve('pdfjs-dist/legacy/build/pdf.mjs')).href); const d = await getDocument({ data: new Uint8Array(buf) }).promise; let t = ''; for (let i = 1; i <= d.numPages; i++) t += (await (await d.getPage(i)).getTextContent()).items.map((x) => x.str).join(' '); return t; };
const tBefore = await pdfText(before.data), tAfter = await pdfText(after.data);
check('B6', tBefore.includes('ORIGINAL-WORDING') && tAfter.includes('ORIGINAL-WORDING') && !tAfter.includes('CHANGED-AFTER-FINAL'), `a FINAL paper keeps its frozen wording when a question is edited later`);
r = await admin.req('DELETE', `/questions/${q2.id}`); const purge = await admin.req('DELETE', `/questions/${q2.id}/permanent`);
check('B7', purge.status === 409, `question used in a paper cannot be deleted permanently (${purge.status})`);
await admin.req('POST', `/questions/${q2.id}/restore`);
const urduPaper = (await admin.req('POST', '/questions/lookup', { ids: [urduQ.id] })).data;
await A.req('POST', `/questions/${urduQ.id}/submit`); await admin.req('POST', `/questions/${urduQ.id}/review`, { decision: 'APPROVE', comment: '' });
r = await admin.req('POST', '/papers/preview', { title: 'Urdu check', subjectId: FAR, templateId: tpl.id, header: { ...header, maxMarks: 5 }, items: [{ questionId: urduQ.id }], mode: 'paper' });
const urduText = r.status === 200 ? await pdfText(r.data) : '';
check('B8', urduText.replace(/\s/g, '').includes('آمدنی'.replace(/\s/g, '')) || /[؀-ۿ]/.test(urduText), `Urdu text appears in the PDF (${r.status}; Arabic-script characters found: ${/[؀-ۿ]/.test(urduText)})`);
void urduPaper;
const q9 = (await A.req('POST', '/questions?submit=1', short(FAR, { topic: 'Waiting for review' }))).data;
r = await admin.req('POST', `/questions/${q9.id}/review`, { decision: 'REJECT', comment: '' });
check('B9', r.status === 400, `returning without a comment is refused (${r.status})`);
r = await A.req('PUT', `/questions/${q1.id}`, short(FAR, { body: '<p>teacher edits approved</p>' }));
check('B10', r.status === 403, `teacher cannot edit an approved question (${r.status})`);
r = await admin.req('DELETE', `/subjects/${FAR}`);
info('B11', `deleting a subject that has questions → ${r.status} ${r.data?.error ?? ''}`);
// two admins saving the same paper at once
const p2 = (await admin.req('POST', '/papers', paper([q1]))).data;
const admin2 = new Session(); await admin2.login('admin', 'AdminExplore2026');
const [s1, s2] = await Promise.all([admin.req('PUT', `/papers/${p2.id}`, { ...paper([q1]), title: 'Saved by window 1' }), admin2.req('PUT', `/papers/${p2.id}`, { ...paper([q1, q2]), title: 'Saved by window 2' })]);
const final2 = (await admin.req('GET', `/papers/${p2.id}`)).data;
info('B12', `two people saving the same paper at once → both ${s1.status}/${s2.status}; result "${final2.title}" with ${final2.items.length} question(s): last save wins, no warning`);

// ------------------------------------------------------------------ robustness and speed
console.log('\n== Robustness and speed');
r = await A.req('GET', '/does-not-exist');
check('R1', r.status === 404 && r.data?.error, `unknown API route → JSON 404`);
{ const all = await Promise.all(Array.from({ length: 50 }, () => A.req('GET', '/questions?pageSize=20')));
  const bad = all.filter((x) => x.status !== 200).length; const avg = all.reduce((s, x) => s + x.ms, 0) / all.length;
  check('R2', bad === 0, `50 requests at the same time: ${bad} errors, average ${Math.round(avg)} ms`); }
{ const n = 600; const t0 = performance.now(); const batch = [];
  for (let i = 0; i < n; i++) batch.push({ ...short(FAR, { topic: `Bulk ${i}`, body: `<p>Bulk question number ${i} about depreciation and revenue.</p>` }) });
  for (let i = 0; i < n; i += 50) await Promise.all(batch.slice(i, i + 50).map((b) => A.req('POST', '/questions', b)));
  info('R3', `created ${n} questions in ${Math.round(performance.now() - t0)} ms`);
  const list = await A.req('GET', '/questions?pageSize=50'); const search = await A.req('GET', '/questions?q=depreciation');
  check('R4', list.ms < 1000 && search.ms < 1000, `with ${list.data.total} questions: list ${Math.round(list.ms)} ms, search ${Math.round(search.ms)} ms (${search.data.total} hits)`); }
{ const big = []; for (let i = 0; i < 40; i++) { const q = (await A.req('POST', '/questions', short(FAR, { topic: `Big ${i}`, marks: 2.5, body: `<p>${'A long question paragraph for page filling. '.repeat(12)}</p>` }))).data; await approve(q); big.push(q); }
  const t0 = performance.now(); r = await admin.req('POST', '/papers/preview', { title: 'Big paper', subjectId: FAR, templateId: tpl.id, header: { ...header, maxMarks: 100 }, items: big.map((q) => ({ questionId: q.id })), mode: 'paper' });
  const pages = r.headers.get('x-page-count');
  check('R5', r.status === 200, `40-question PDF made in ${Math.round(performance.now() - t0)} ms (${pages ?? '?'} pages)`);
  const t1 = performance.now(); const par = await Promise.all(Array.from({ length: 4 }, () => admin.req('POST', '/papers/preview', { title: 'Big paper', subjectId: FAR, templateId: tpl.id, header: { ...header, maxMarks: 100 }, items: big.map((q) => ({ questionId: q.id })), mode: 'paper' })));
  check('R6', par.every((x) => x.status === 200), `4 PDFs of that paper at the same time: ${par.map((x) => x.status).join(',')} in ${Math.round(performance.now() - t1)} ms`); }
// The rate limit is checked in limits.mjs (needs the normal limits, not test mode).

const fails = results.filter((x) => x[0] === 'FAIL');
console.log(`\nSUMMARY: ${results.filter((x) => x[0] === 'PASS').length} pass, ${fails.length} fail, ${results.filter((x) => x[0] === 'INFO').length} info`);
for (const f of fails) console.log('  FAIL', f[1], f[2]);
process.exitCode = fails.length ? 1 : 0;
