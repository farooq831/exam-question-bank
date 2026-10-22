import request from 'supertest';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { createApp } from '../src/app';
import { prisma } from '../src/db';
import { buildSnapshot, paperInclude, parseTemplateConfig, snapshotToRenderInput } from '../src/lib/papers';
import { renderPaper } from '../src/render/paperHtml';
import { closeBrowser, htmlToPdf } from '../src/render/pdf';
import { checkPaperMarks } from '@skans/shared';

const app = createApp();

async function loggedIn(username: string) {
  const agent = request.agent(app);
  const csrf = await agent.get('/api/auth/csrf');
  await agent.post('/api/auth/login').set('x-csrf-token', csrf.body.csrfToken).send({ username, password: 'SkansDemo2026' }).expect(200);
  return agent;
}

describe('auth and RBAC workflow', () => {
  it('requires authentication and prevents teachers from generating papers', async () => {
    await request(app).get('/api/papers').expect(401);
    const teacher = await loggedIn('teacher_far');
    await teacher.get('/api/papers').expect(403);
  });

  it('limits a teacher to assigned subjects', async () => {
    const teacher = await loggedIn('teacher_far');
    const tax = await prisma.subject.findUniqueOrThrow({ where: { code: 'TPC' } });
    await teacher.get(`/api/questions?subjectId=${tax.id}`).expect(403);
    const far = await prisma.subject.findUniqueOrThrow({ where: { code: 'FAR' } });
    const response = await teacher.get(`/api/questions?subjectId=${far.id}`).expect(200);
    expect(response.body.items.length).toBeGreaterThan(0);
  });

  it('allows administrators to review questions and access paper generation', async () => {
    const admin = await loggedIn('admin');
    const csrf = (await admin.get('/api/auth/csrf')).body.csrfToken;
    const submitted = await admin.get('/api/questions?status=SUBMITTED&pageSize=1').expect(200);
    expect(submitted.body.items.length).toBeGreaterThan(0);
    await admin
      .post(`/api/questions/${submitted.body.items[0].id}/review`)
      .set('x-csrf-token', csrf)
      .send({ decision: 'APPROVE', comment: 'Approved for the administrator demo.' })
      .expect(200);
    await admin.get('/api/papers').expect(200);
  });
});

describe('marks, template rendering, and PDF generation', () => {
  let paperId = 0;
  beforeAll(async () => {
    const paper = await prisma.paper.findFirstOrThrow({ where: { title: 'FAR Spring 2026 Examination' } });
    paperId = paper.id;
  });

  it('reports mismatched and matching paper totals', () => {
    expect(checkPaperMarks([4, 5], 20).status).toBe('under');
    expect(checkPaperMarks([4, 5], 9).status).toBe('match');
  });

  it('renders a seeded table paper and produces a clean PDF', async () => {
    const paper = await prisma.paper.findUniqueOrThrow({ where: { id: paperId }, include: paperInclude });
    const snapshot = buildSnapshot(paper, parseTemplateConfig(paper.template.config));
    const { html, runningHeader } = renderPaper(snapshotToRenderInput(snapshot, 'paper', null));
    expect(html).toContain('table');
    expect(html).not.toContain('http://');
    // Running header with bold page numbers, printed from page 2 (Chromium header template).
    expect(runningHeader?.skipFirstPage).toBe(true);
    expect(runningHeader?.template).toContain('<b class="pageNumber"></b>');
    expect(runningHeader?.template).toContain('<b class="totalPages"></b>');
    const result = await htmlToPdf(html, 'workflow-test', runningHeader);
    expect(result.pdf.length).toBeGreaterThan(10_000);
    expect(result.pageCount).toBeGreaterThan(0);
  });

  afterAll(async () => {
    await closeBrowser();
    await prisma.$disconnect();
  });
});
