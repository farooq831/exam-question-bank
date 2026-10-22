import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/db';
import { login, shortQuestion, subjectId, unique, type Session } from './helpers';

let teacher: Session;
let teacherTax: Session;
let admin: Session;
let FAR = 0;
let TAX = 0;

beforeAll(async () => {
  [teacher, teacherTax, admin] = await Promise.all(['teacher_far', 'teacher_tax', 'admin'].map((u) => login(u)));
  [FAR, TAX] = await Promise.all(['FAR', 'TPC'].map(subjectId));
});

describe('TEACHER restrictions', () => {
  it('cannot use paper, user, subject, template or audit administration', async () => {
    const paper = await prisma.paper.findFirstOrThrow({ where: { subjectId: FAR } });
    await teacher.get('/api/papers').expect(403);
    await teacher.get(`/api/papers/${paper.id}`).expect(403);
    await teacher.post('/api/papers', {}).expect(403);
    await teacher.post('/api/papers/preview?format=html', {}).expect(403);
    await teacher.get(`/api/papers/${paper.id}/pdf`).expect(403);
    await teacher.get(`/api/papers/${paper.id}/answer-key.pdf`).expect(403);
    await teacher.get('/api/users').expect(403);
    await teacher.get('/api/audit').expect(403);
    await teacher.get('/api/templates').expect(403);
    await teacher.post('/api/subjects', { code: 'ZZ', name: 'Nope', level: 'CAF', templateId: null }).expect(403);
    await teacher.agent.patch(`/api/subjects/${FAR}/template`).set('x-csrf-token', teacher.csrf).send({ templateId: 1 }).expect(403);
  });

  it('only sees assigned subjects', async () => {
    const subjects = (await teacher.get('/api/subjects').expect(200)).body as { code: string }[];
    expect(subjects.map((s) => s.code).sort()).toEqual(['CR', 'FAR']);
    await teacher.get(`/api/questions?subjectId=${TAX}`).expect(403);
    const all = (await teacher.get('/api/questions?pageSize=100').expect(200)).body.items as { subjectCode: string }[];
    expect(all.length).toBeGreaterThan(0);
    expect(all.every((q) => ['FAR', 'CR'].includes(q.subjectCode))).toBe(true);

    const taxQuestion = await prisma.question.findFirstOrThrow({ where: { subjectId: TAX, status: 'APPROVED' } });
    await teacher.get(`/api/questions/${taxQuestion.id}`).expect(404);
    await teacher.post(`/api/questions/${taxQuestion.id}/duplicate`).expect(404);
    await teacher.post('/api/questions', shortQuestion(TAX)).expect(403);
  });

  it("cannot see other teachers' drafts", async () => {
    // Give both teachers a shared subject: drafts stay private even inside the same subject.
    const tax = await prisma.user.findUniqueOrThrow({ where: { username: 'teacher_tax' } });
    await prisma.userSubject.upsert({ where: { userId_subjectId: { userId: tax.id, subjectId: FAR } }, update: {}, create: { userId: tax.id, subjectId: FAR } });
    const own = (await teacherTax.post('/api/questions', shortQuestion(FAR)).expect(201)).body;
    await teacher.get(`/api/questions/${own.id}`).expect(404);
    await admin.get(`/api/questions/${own.id}`).expect(200);
    await prisma.userSubject.delete({ where: { userId_subjectId: { userId: tax.id, subjectId: FAR } } });
  });

  it('cannot approve or reject questions', async () => {
    const created = (await teacher.post('/api/questions?submit=1', shortQuestion(FAR)).expect(201)).body;
    expect(created.status).toBe('SUBMITTED');
    await teacher.post(`/api/questions/${created.id}/review`, { decision: 'APPROVE', comment: '' }).expect(403);
    await teacher.post(`/api/questions/${created.id}/review`, { decision: 'REJECT', comment: 'no' }).expect(403);
    expect((await prisma.question.findUniqueOrThrow({ where: { id: created.id } })).status).toBe('SUBMITTED');
  });

  it('edits only own draft or rejected questions', async () => {
    const draft = (await teacher.post('/api/questions', shortQuestion(FAR)).expect(201)).body;
    await teacher.put(`/api/questions/${draft.id}`, shortQuestion(FAR, { topic: 'Edited draft' })).expect(200);
    await teacher.post(`/api/questions/${draft.id}/submit`).expect(200);
    const blocked = await teacher.put(`/api/questions/${draft.id}`, shortQuestion(FAR)).expect(403);
    expect(blocked.body.error).toMatch(/waiting for review/);

    const approved = await prisma.question.findFirstOrThrow({ where: { subjectId: FAR, status: 'APPROVED' } });
    await teacher.put(`/api/questions/${approved.id}`, shortQuestion(FAR)).expect(403);
    await teacher.del(`/api/questions/${approved.id}`).expect(403);
  });
});

describe('CSV import hardening', () => {
  it('rejects CSV headers that could replace the record prototype', async () => {
    const res = await teacher.agent
      .post('/api/import/questions?dryRun=1')
      .set('x-csrf-token', teacher.csrf)
      .attach('file', Buffer.from('__proto__,body\nx,y\n'), 'questions.csv')
      .expect(400);
    expect(res.body.error).toMatch(/Invalid column name/);
  });
});

describe('two-role model', () => {
  it('no longer accepts the HOA role', async () => {
    const res = await admin.post('/api/users', { username: unique('h_').toLowerCase(), fullName: 'Former HOA', role: 'HOA', password: 'Welcome2026xx', subjectIds: [] }).expect(400);
    expect(JSON.stringify(res.body)).toMatch(/role/);
  });

  it('treats a leftover HOA account as a teacher (least privilege)', async () => {
    const username = unique('legacy_').toLowerCase();
    await admin.post('/api/users', { username, fullName: 'Legacy HOA', role: 'TEACHER', password: 'Welcome2026xx', subjectIds: [FAR] }).expect(201);
    await prisma.user.update({ where: { username }, data: { role: 'HOA', mustChangePassword: false } });
    const legacy = await login(username, 'Welcome2026xx');
    expect((await legacy.get('/api/auth/me')).body.user.role).toBe('TEACHER');
    await legacy.get('/api/papers').expect(403);
    await legacy.get('/api/templates').expect(403);
  });

  it("ADMIN cannot approve someone else's draft before it is submitted", async () => {
    const draft = (await teacher.post('/api/questions', shortQuestion(FAR)).expect(201)).body;
    await admin.get(`/api/questions/${draft.id}`).expect(200);
    await admin.post(`/api/questions/${draft.id}/review`, { decision: 'APPROVE', comment: '' }).expect(403);
  });

  it('ADMIN can edit any question and see every subject', async () => {
    const approved = await prisma.question.findFirstOrThrow({ where: { subjectId: TAX, status: 'APPROVED' } });
    const full = (await admin.get(`/api/questions/${approved.id}`).expect(200)).body;
    expect(full.permissions.edit).toBe(true);
    expect((await admin.get('/api/subjects').expect(200)).body.map((s: { code: string }) => s.code).sort()).toEqual(['AAE', 'BIA', 'BLD', 'CR', 'DSR', 'FAR', 'MA', 'TPC']);
  });
});

describe('ADMIN administration', () => {
  it('creates and updates users, subjects and templates with audit records', async () => {
    const username = unique('u_').toLowerCase();
    const user = (await admin.post('/api/users', { username, fullName: 'New Teacher', role: 'TEACHER', password: 'Welcome2026xx', subjectIds: [FAR] }).expect(201)).body;
    expect(user.subjectIds).toEqual([FAR]);
    await admin.post('/api/users', { username, fullName: 'Dup', role: 'TEACHER', password: 'Welcome2026xx', subjectIds: [] }).expect(409);
    await admin.post('/api/users', { username: 'Bad Name!', fullName: 'x', role: 'TEACHER', password: 'short', subjectIds: [] }).expect(400);
    const updated = (await admin.put(`/api/users/${user.id}`, { fullName: 'Promoted Admin', email: '', role: 'ADMIN', subjectIds: [FAR, TAX], isActive: true }).expect(200)).body;
    expect(updated.role).toBe('ADMIN');

    const me = (await admin.get('/api/auth/me')).body.user;
    await admin.put(`/api/users/${me.id}`, { fullName: me.fullName, email: '', role: 'TEACHER', subjectIds: [], isActive: true }).expect(400);

    const code = unique('S').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
    const subject = (await admin.post('/api/subjects', { code, name: 'Test Subject', level: 'CAF', templateId: null }).expect(201)).body;
    await admin.put(`/api/subjects/${subject.id}`, { code, name: 'Renamed Subject', level: 'CAF', templateId: null, isActive: false }).expect(200);

    const template = (await admin.get('/api/templates').expect(200)).body[0];
    await admin.put(`/api/templates/${template.id}`, { ...template, description: 'Updated by test' }).expect(200);
    await admin.put(`/api/templates/${template.id}`, { ...template, config: { ...template.config, fonts: { ...template.config.fonts, sizePt: 99 } } }).expect(400);

    for (const action of ['USER_CREATE', 'USER_UPDATE', 'SUBJECT_CREATE', 'SUBJECT_UPDATE', 'TEMPLATE_UPDATE']) {
      expect(await prisma.auditLog.count({ where: { action, username: 'admin' } })).toBeGreaterThan(0);
    }
  });

  it('filters the audit log', async () => {
    const res = await admin.get('/api/audit?action=USER_CREATE&username=admin').expect(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body.items.every((a: { action: string }) => a.action === 'USER_CREATE')).toBe(true);
  });

  it('sees school-wide dashboard counts', async () => {
    const dash = (await admin.get('/api/dashboard').expect(200)).body;
    expect(dash.pendingReview).toBe(await prisma.question.count({ where: { status: 'SUBMITTED', deletedAt: null } }));
    expect(dash.stats.papers).toBeGreaterThan(0);
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
