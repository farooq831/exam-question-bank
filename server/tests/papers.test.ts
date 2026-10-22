import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/db';
import { closeBrowser } from '../src/render/pdf';
import { binaryParser, login, pdfText, shortQuestion, subjectId, unique, type Session } from './helpers';

let teacher: Session;
let admin: Session;
let FAR = 0;
let TAX = 0;
let templateId = 0;

const PRIVATE = { comments: 'PRIVATE-INTERNAL-COMMENT', source: 'PRIVATE-SOURCE-NOTE' };

beforeAll(async () => {
  [teacher, admin] = await Promise.all(['teacher_far', 'admin'].map((u) => login(u)));
  [FAR, TAX] = await Promise.all(['FAR', 'TPC'].map(subjectId));
  templateId = (await prisma.paperTemplate.findUniqueOrThrow({ where: { code: 'SKANS_CAF' } })).id;
});

/** Teacher writes and submits a question; the administrator approves it. */
async function approvedQuestion(overrides: Record<string, unknown> = {}) {
  const q = (await teacher.post('/api/questions?submit=1', shortQuestion(FAR, { ...PRIVATE, ...overrides })).expect(201)).body;
  await admin.post(`/api/questions/${q.id}/review`, { decision: 'APPROVE', comment: 'Fine.' }).expect(200);
  return q as { id: number; marks: number };
}

function paperBody(items: { questionId: number; marksOverride?: number | null }[], maxMarks: number, extra: Record<string, unknown> = {}) {
  return {
    title: unique('Test paper '),
    subjectId: FAR,
    templateId,
    status: 'DRAFT',
    header: { session: 'Autumn 2026', examDate: '2026-11-02', durationMinutes: 60, readingMinutes: 5, maxMarks, batchNo: '7', teacherName: 'Ms Test', testNo: '3', researchOfficers: 'RO-PERSON-ONE', adminName: 'ADMIN-PERSON', titleOverride: '', instructionsOverride: null },
    items: items.map((i) => ({ section: '', marksOverride: null, newPage: false, ...i })),
    ...extra,
  };
}

describe('question review workflow', () => {
  it('requires a comment to reject, then supports resubmission and approval', async () => {
    const q = (await teacher.post('/api/questions?submit=1', shortQuestion(FAR)).expect(201)).body;
    const missing = await admin.post(`/api/questions/${q.id}/review`, { decision: 'REJECT', comment: '   ' }).expect(400);
    expect(JSON.stringify(missing.body)).toMatch(/comment is required/i);

    const rejected = (await admin.post(`/api/questions/${q.id}/review`, { decision: 'REJECT', comment: 'Add the standard reference.' }).expect(200)).body;
    expect(rejected.status).toBe('REJECTED');
    expect(rejected.reviewComment).toBe('Add the standard reference.');
    // A rejected question goes back to its author, not straight to approval.
    await admin.post(`/api/questions/${q.id}/review`, { decision: 'APPROVE', comment: '' }).expect(403);

    await teacher.put(`/api/questions/${q.id}?submit=1`, shortQuestion(FAR, { body: '<p>Explain the matching principle (IAS 1).</p>' })).expect(200);
    const approved = (await admin.post(`/api/questions/${q.id}/review`, { decision: 'APPROVE', comment: '' }).expect(200)).body;
    expect(approved.status).toBe('APPROVED');
    expect(approved.reviewedBy).toBe('SKANS IT Administrator');

    const actions = (await prisma.auditLog.findMany({ where: { entityType: 'Question', entityId: String(q.id) } })).map((a) => a.action);
    expect(actions).toEqual(expect.arrayContaining(['QUESTION_CREATE', 'QUESTION_REJECT', 'QUESTION_UPDATE', 'QUESTION_APPROVE']));
  });

  it('lets ADMIN review submitted questions from any subject', async () => {
    const q = (await login('teacher_tax').then((t) => t.post('/api/questions?submit=1', shortQuestion(TAX)).expect(201))).body;
    await admin.post(`/api/questions/${q.id}/review`, { decision: 'APPROVE', comment: 'Approved by ADMIN.' }).expect(200);
  });
});

describe('permanent deletion from the recycle bin', () => {
  it('requires the recycle bin first and is limited to ADMIN', async () => {
    const q = (await teacher.post('/api/questions?submit=1', shortQuestion(FAR)).expect(201)).body;
    const live = await admin.del(`/api/questions/${q.id}/permanent`).expect(400);
    expect(live.body.error).toMatch(/recycle bin/);
    await teacher.del(`/api/questions/${q.id}`).expect(200);
    await teacher.del(`/api/questions/${q.id}/permanent`).expect(403);
    const listed = (await admin.get(`/api/questions/${q.id}`).expect(200)).body;
    expect(listed.permissions.purge).toBe(true);
    await admin.del(`/api/questions/${q.id}/permanent`).expect(200);
    expect(await prisma.question.findUnique({ where: { id: q.id } })).toBeNull();
    expect(await prisma.auditLog.count({ where: { action: 'QUESTION_PURGE', entityId: String(q.id), username: 'admin' } })).toBe(1);
  });

  it('refuses questions that are used in a paper', async () => {
    const q = await approvedQuestion();
    await admin.post('/api/papers', paperBody([{ questionId: q.id }], 5)).expect(201);
    await admin.del(`/api/questions/${q.id}`).expect(200);
    const res = await admin.del(`/api/questions/${q.id}/permanent`).expect(409);
    expect(res.body.error).toMatch(/used in 1 paper/);
    expect(await prisma.question.findUnique({ where: { id: q.id } })).not.toBeNull();
  });
});

describe('paper building rules', () => {
  it('accepts only approved, non-deleted questions of the paper subject', async () => {
    const draft = (await teacher.post('/api/questions', shortQuestion(FAR)).expect(201)).body;
    const submitted = (await teacher.post('/api/questions?submit=1', shortQuestion(FAR)).expect(201)).body;
    const taxApproved = await prisma.question.findFirstOrThrow({ where: { subjectId: TAX, status: 'APPROVED' } });

    for (const id of [draft.id, submitted.id]) {
      const res = await admin.post('/api/papers', paperBody([{ questionId: id }], 5)).expect(400);
      expect(res.body.error).toMatch(/not approved|not available/);
    }
    const other = await admin.post('/api/papers', paperBody([{ questionId: taxApproved.id }], 5)).expect(400);
    expect(other.body.error).toMatch(/another subject/);

    const ok = await approvedQuestion();
    await teacher.del(`/api/questions/${ok.id}`).expect(403);
    await admin.del(`/api/questions/${ok.id}`).expect(200);
    await admin.post('/api/papers', paperBody([{ questionId: ok.id }], 5)).expect(400);

    const dup = await approvedQuestion();
    const twice = await admin.post('/api/papers', paperBody([{ questionId: dup.id }, { questionId: dup.id }], 10)).expect(400);
    expect(twice.body.error).toMatch(/only appear once/);
  });

  it('validates the marks total before finalising', async () => {
    const a = await approvedQuestion();
    const b = await approvedQuestion();
    // Drafts may be saved with a mismatch...
    const draft = (await admin.post('/api/papers', paperBody([{ questionId: a.id }, { questionId: b.id }], 20)).expect(201)).body;
    expect(draft.totalMarks).toBe(10);
    // ...but cannot be finalised until the total equals maximum marks.
    const refused = await admin.put(`/api/papers/${draft.id}`, paperBody([{ questionId: a.id }, { questionId: b.id }], 20, { status: 'FINAL' })).expect(400);
    expect(refused.body.error).toMatch(/Cannot finalise: Total is 10: 10 mark\(s\) short/);
    const over = await admin.post('/api/papers', paperBody([{ questionId: a.id, marksOverride: 15 }, { questionId: b.id }], 10, { status: 'FINAL' })).expect(400);
    expect(over.body.error).toMatch(/more than the maximum/);

    const final = (await admin.put(`/api/papers/${draft.id}`, paperBody([{ questionId: a.id, marksOverride: 15 }, { questionId: b.id }], 20, { status: 'FINAL' })).expect(200)).body;
    expect(final.status).toBe('FINAL');
    expect(final.totalMarks).toBe(20);
    expect(await prisma.auditLog.count({ where: { action: 'PAPER_FINALIZE', entityId: String(draft.id) } })).toBe(1);
  });
});

describe('preview and PDF output', () => {
  let paperId = 0;
  let paperTitle = '';
  let marker = '';

  beforeAll(async () => {
    marker = unique('Bodymarker');
    const q = await approvedQuestion({
      body: `<p>${marker} Prepare the statement below.</p><table><tbody><tr><th><p>Item</p></th><th><p>Rs.</p></th></tr><tr><td><p>Sales</p></td><td><p>1,000</p></td></tr><tr><td><p>Costs</p></td><td><p>600</p></td></tr></tbody></table>`,
      answer: '<p>MODEL-ANSWER-TEXT</p>',
      advice: '<p>EXAMINER-ADVICE-TEXT</p>',
      marks: 5,
    });
    const p = (await admin.post('/api/papers', paperBody([{ questionId: q.id }], 5, { status: 'FINAL' })).expect(201)).body;
    paperId = p.id;
    paperTitle = p.title;
  });

  it('renders a live HTML preview that hides answers and private notes', async () => {
    const paper = (await admin.get(`/api/papers/${paperId}`).expect(200)).body;
    const body = { title: paper.title, subjectId: FAR, templateId, header: paper.header, items: paper.items.map((i: { questionId: number }) => ({ questionId: i.questionId })) };
    const html = (await admin.post('/api/papers/preview?format=html', { ...body, mode: 'paper' }).expect(200)).text;
    expect(html).toContain(marker);
    expect(html).toContain('<thead>');
    for (const secret of ['MODEL-ANSWER-TEXT', 'EXAMINER-ADVICE-TEXT', ...Object.values(PRIVATE), 'Fine.']) expect(html).not.toContain(secret);
    const key = (await admin.post('/api/papers/preview?format=html', { ...body, mode: 'key' }).expect(200)).text;
    expect(key).toContain('MODEL-ANSWER-TEXT');
    expect(key).toContain('EXAMINER-ADVICE-TEXT');
    for (const secret of [...Object.values(PRIVATE), 'Fine.']) expect(key).not.toContain(secret);
  });

  it('downloads a clean question-paper PDF and records the download', async () => {
    const res = await admin.get(`/api/papers/${paperId}/pdf?watermark=1`).buffer(true).parse(binaryParser).expect(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="FAR_Autumn2026_Paper\.pdf"/);
    const pdf = res.body as Buffer;
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    const pages = await pdfText(pdf);
    expect(pages.length).toBe(Number(res.headers['x-page-count']));
    const text = pages.join('\n');
    expect(text).toContain(marker);
    expect(text).toContain(paperTitle);
    expect(text).toMatch(/2 November 2026/);
    expect(text).toContain('admin ·'); // watermark: username and timestamp
    for (const banned of [/https?:\/\//, /about:blank/, /file:\/\//, /localhost/, /\d{1,2}\/\d{1,2}\/\d{2},\s*\d{1,2}:\d{2}/]) expect(text).not.toMatch(banned);
    for (const secret of ['MODEL-ANSWER-TEXT', 'EXAMINER-ADVICE-TEXT', 'RO-PERSON-ONE', 'ADMIN-PERSON', ...Object.values(PRIVATE)]) expect(text).not.toContain(secret);
    expect(text).not.toContain('DRAFT'); // final papers print clean
    expect(await prisma.auditLog.count({ where: { action: 'PAPER_PDF_DOWNLOAD', entityId: String(paperId) } })).toBe(1);
  });

  it('downloads a separate answer-key PDF', async () => {
    const res = await admin.get(`/api/papers/${paperId}/answer-key.pdf`).buffer(true).parse(binaryParser).expect(200);
    expect(res.headers['content-disposition']).toMatch(/AnswerKey\.pdf/);
    const text = (await pdfText(res.body as Buffer)).join('\n');
    expect(text).toContain('ANSWER KEY');
    expect(text).toContain('MODEL-ANSWER-TEXT');
    expect(text).toContain('EXAMINER-ADVICE-TEXT');
    // People responsible for the paper are named on the answer key only.
    for (const name of ['Ms Test', 'RO-PERSON-ONE', 'ADMIN-PERSON']) expect(text).toContain(name);
    for (const secret of Object.values(PRIVATE)) expect(text).not.toContain(secret);
    expect(await prisma.auditLog.count({ where: { action: 'ANSWER_KEY_PDF_DOWNLOAD', entityId: String(paperId) } })).toBe(1);
  });

  it('prints "Page X of Y" on every page of a multi-page paper', async () => {
    const seeded = await prisma.paper.findFirstOrThrow({ where: { title: 'FAR Spring 2026 Examination' } });
    const items = (await admin.get(`/api/papers/${seeded.id}`).expect(200)).body.items.map((i: { questionId: number; section: string }) => ({ questionId: i.questionId, section: i.section, newPage: true }));
    const created = (await admin.post('/api/papers', { ...paperBody([], 30), items }).expect(201)).body;
    const res = await admin.get(`/api/papers/${created.id}/pdf`).buffer(true).parse(binaryParser).expect(200);
    const pages = await pdfText(res.body as Buffer);
    expect(pages.length).toBeGreaterThan(2);
    // The CAF template omits the running header on page 1, like the reference paper.
    pages.slice(1).forEach((text, i) => expect(text).toMatch(new RegExp(String.raw`Page\s+${i + 2}\s+of\s+${pages.length}`)));
    expect(pages[0]).not.toMatch(/Page\s+1\s+of/);
    // Drafts are for review: watermarked and named _DRAFT.
    expect(res.headers['content-disposition']).toMatch(/_DRAFT\.pdf"/);
    expect(pages.join(' ')).toContain('DRAFT');
  });
});

describe('template rendering', () => {
  it('repeats table header rows when a long table continues on the next page', async () => {
    const rows = Array.from({ length: 70 }, (_, i) => `<tr><td><p>Ledger line ${i + 1}</p></td><td><p>${(i + 1) * 1000}</p></td></tr>`).join('');
    const q = await approvedQuestion({ body: `<p>Long ledger.</p><table><tbody><tr><th><p>HDRCOLA</p></th><th><p>HDRCOLB</p></th></tr>${rows}</tbody></table>`, marks: 5 });
    const p = (await admin.post('/api/papers', paperBody([{ questionId: q.id }], 5)).expect(201)).body;
    const res = await admin.get(`/api/papers/${p.id}/pdf`).buffer(true).parse(binaryParser).expect(200);
    const pages = await pdfText(res.body as Buffer);
    expect(pages.length).toBeGreaterThan(1);
    const withTable = pages.filter((t) => t.includes('Ledger line'));
    expect(withTable.length).toBeGreaterThan(1);
    for (const t of withTable) expect(t).toContain('HDRCOLA');
  });

  it('uses one SKANS format with the SKANS logo at the top right', async () => {
    const formats = (await admin.get('/api/templates').expect(200)).body as { code: string }[];
    expect(formats.map((f) => f.code)).toEqual(['SKANS_CAF']);
    const q = await approvedQuestion();
    const caf = (await admin.post('/api/papers/preview?format=html', { ...paperBody([{ questionId: q.id }], 5), mode: 'paper' }).expect(200)).text;
    // SKANS logo at the top right of the CAF header; no examining-body branding anywhere.
    expect(caf).toMatch(/<div class="caf-logo"><img src="data:image\/png;base64,[^"]+" alt="SKANS"><\/div>/);
    // Ignore embedded font/logo data (base64 can contain any letters by chance).
    expect(caf.replace(/data:[^"')]+/g, '')).not.toMatch(/ICAP/);
  });
});

afterAll(async () => {
  await closeBrowser();
  await prisma.$disconnect();
});
