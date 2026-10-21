import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/db';
import { login, shortQuestion, subjectId, unique, type Session } from './helpers';

let teacher: Session;
let teacherTax: Session;
let hoa: Session;
let hoaAudit: Session;
let admin: Session;
let FAR = 0;
let TAX = 0;
let AUD = 0;

beforeAll(async () => {
  [teacher, teacherTax, hoa, hoaAudit, admin] = await Promise.all(
    ['teacher_far', 'teacher_tax', 'hoa_far', 'hoa_audit', 'admin'].map((u) => login(u)),
  );
  [FAR, TAX, AUD] = await Promise.all(['FAR', 'TAX', 'AUD'].map(subjectId));
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
    expect(subjects.map((s) => s.code).sort()).toEqual(['FAR', 'FAR1', 'FAR2']);
    await teacher.get(`/api/questions?subjectId=${TAX}`).expect(403);
    const all = (await teacher.get('/api/questions?pageSize=100').expect(200)).body.items as { subjectCode: string }[];
    expect(all.length).toBeGreaterThan(0);
    expect(all.every((q) => ['FAR', 'FAR1', 'FAR2'].includes(q.subjectCode))).toBe(true);

    const taxQuestion = await prisma.question.findFirstOrThrow({ where: { subjectId: TAX, status: 'APPROVED' } });
    await teacher.get(`/api/questions/${taxQuestion.id}`).expect(404);
    await teacher.post(`/api/questions/${taxQuestion.id}/duplicate`).expect(404);
    await teacher.post('/api/questions', shortQuestion(TAX)).expect(403);
  });

  it("cannot see other teachers' drafts", async () => {
    const own = (await teacherTax.post('/api/questions', shortQuestion(TAX)).expect(201)).body;
    await hoa.get(`/api/questions/${own.id}`).expect(404); // HOA does not see private drafts either
    await admin.get(`/api/questions/${own.id}`).expect(200);
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

describe('HOA restrictions', () => {
  it('cannot manage users, subjects or the audit log', async () => {
    await hoa.get('/api/users').expect(403);
    await hoa.get('/api/audit').expect(403);
    await hoa.post('/api/subjects', { code: 'ZZ', name: 'Nope', level: 'CAF', templateId: null }).expect(403);
    await hoa.post('/api/users', {}).expect(403);
  });

  it('is limited to assigned subjects for questions and papers', async () => {
    const audQuestion = await prisma.question.findFirstOrThrow({ where: { subjectId: AUD, status: 'SUBMITTED' } });
    await hoa.get(`/api/questions/${audQuestion.id}`).expect(404);
    await hoa.post(`/api/questions/${audQuestion.id}/review`, { decision: 'APPROVE', comment: '' }).expect(404);
    await hoa.get(`/api/questions?subjectId=${AUD}`).expect(403);

    const farPaper = await prisma.paper.findFirstOrThrow({ where: { subjectId: FAR } });
    await hoaAudit.get(`/api/papers/${farPaper.id}`).expect(403);
    await hoaAudit.get(`/api/papers/${farPaper.id}/pdf`).expect(403);
    await hoaAudit.get(`/api/papers/${farPaper.id}/answer-key.pdf`).expect(403);
    const listed = (await hoaAudit.get('/api/papers').expect(200)).body as { subjectCode: string }[];
    expect(listed.every((p) => p.subjectCode === 'AUD')).toBe(true);
  });

  it('may only edit templates whose subjects are all assigned to them', async () => {
    const templates = (await hoaAudit.get('/api/templates').expect(200)).body as { id: number; canEdit: boolean; code: string; name: string; description: string; isActive: boolean; config: unknown }[];
    const caf = templates.find((t) => t.code === 'ICAP_EXAM')!;
    expect(caf.canEdit).toBe(false);
    await hoaAudit.put(`/api/templates/${caf.id}`, caf).expect(403);
  });

  it('cannot approve someone else\'s draft before it is submitted', async () => {
    const draft = (await teacher.post('/api/questions', shortQuestion(FAR)).expect(201)).body;
    await admin.get(`/api/questions/${draft.id}`).expect(200);
    await admin.post(`/api/questions/${draft.id}/review`, { decision: 'APPROVE', comment: '' }).expect(403);
  });
});

describe('ADMIN administration', () => {
  it('creates and updates users, subjects and templates with audit records', async () => {
    const username = unique('u_').toLowerCase();
    const user = (await admin.post('/api/users', { username, fullName: 'New HOA', role: 'HOA', password: 'Welcome2026xx', subjectIds: [FAR] }).expect(201)).body;
    expect(user.subjectIds).toEqual([FAR]);
    await admin.post('/api/users', { username, fullName: 'Dup', role: 'HOA', password: 'Welcome2026xx', subjectIds: [] }).expect(409);
    await admin.post('/api/users', { username: 'Bad Name!', fullName: 'x', role: 'HOA', password: 'short', subjectIds: [] }).expect(400);
    const updated = (await admin.put(`/api/users/${user.id}`, { fullName: 'Renamed HOA', email: '', role: 'TEACHER', subjectIds: [FAR, TAX], isActive: true }).expect(200)).body;
    expect(updated.role).toBe('TEACHER');

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
