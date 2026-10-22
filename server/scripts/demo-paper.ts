/**
 * Builds the CAF 8 AAE demo mock paper (original content, see scripts/demo/aae-mock.ts) inside the
 * app, then writes its final question paper and answer key PDFs:
 *
 *   npm run db:backup                 (always back up first)
 *   npm run demo:paper                -> output/demo/*.pdf
 *   npm run demo:paper -- --replace   (rebuild after editing the content)
 *
 * Every question goes through the same validation and HTML sanitising as the app, is saved as
 * APPROVED (reviewed by the first active administrator) and tagged with DEMO_SOURCE, so it can
 * be found or removed. The paper is saved as FINAL with a version snapshot, like Finalise.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  checkPaperMarks,
  effectiveItemMarks,
  paperInputSchema,
  questionInputSchema,
  type QuestionInput,
  type QuestionType,
} from '@skans/shared';
import { prisma } from '../src/db';
import { audit } from '../src/lib/audit';
import { buildSnapshot, downloadFileName, paperInclude, parseTemplateConfig, snapshotToRenderInput } from '../src/lib/papers';
import { sanitizeQuestionInput } from '../src/lib/questions';
import { closeBrowser, htmlToPdf } from '../src/render/pdf';
import { renderPaper } from '../src/render/paperHtml';
import { DEMO_QUESTIONS, DEMO_SOURCE, DEMO_TITLE, type DemoMcq } from './demo/aae-mock';

const SUBJECT_CODE = 'AAE';
const outputDir = path.resolve(process.cwd(), '..', 'output', 'demo');
const replace = process.argv.includes('--replace');

const options = (m: DemoMcq) => m.options.map((html, i) => ({ key: String.fromCharCode(97 + i), html: `<p>${html}</p>`, correct: i === m.correct }));

async function main() {
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN', isActive: true }, orderBy: { id: 'asc' } });
  if (!admin) throw new Error('No active administrator found. Run the seed first.');
  const subject = await prisma.subject.findUnique({ where: { code: SUBJECT_CODE }, include: { template: true } });
  if (!subject?.template) throw new Error(`Subject ${SUBJECT_CODE} (with a paper format) not found. Run the seed first.`);

  const existing = await prisma.paper.findFirst({ where: { title: DEMO_TITLE, deletedAt: null } });
  if (existing && !replace) {
    console.log(`The demo paper already exists (paper #${existing.id}). Use --replace to rebuild it.`);
    return;
  }
  if (replace) {
    const old = await prisma.paper.findMany({ where: { title: DEMO_TITLE }, select: { id: true } });
    await prisma.paper.deleteMany({ where: { id: { in: old.map((p) => p.id) } } });
    const removed = await prisma.question.deleteMany({ where: { source: DEMO_SOURCE, paperItems: { none: {} } } });
    console.log(`Removed ${old.length} old demo paper(s) and ${removed.count} old demo question(s).`);
  }

  // ---- questions (validated and sanitised exactly like POST /api/questions)
  const inputs: { input: QuestionInput; section: string; newPage: boolean }[] = [];
  const base = { subjectId: subject.id, difficulty: 'MEDIUM' as const, source: DEMO_SOURCE, comments: '' };
  for (const q of DEMO_QUESTIONS) {
    if (q.kind === 'mcqs') {
      for (const m of q.items) {
        inputs.push({
          section: q.section, newPage: false,
          input: questionInputSchema.parse({ ...base, type: 'MCQ', topic: m.topic, marks: 1, body: m.stem, answer: '', advice: '', content: { options: options(m), layout: m.layout ?? 'auto' } }),
        });
      }
    } else if (q.kind === 'set') {
      inputs.push({
        section: q.section, newPage: false,
        input: questionInputSchema.parse({
          ...base, type: 'MCQ_GROUP', topic: q.topic, marks: q.items.length, body: q.intro, answer: '', advice: '',
          content: { items: q.items.map((m, i) => ({ id: `i${i + 1}`, stem: m.stem, options: options(m), layout: m.layout ?? 'auto', marks: 1 })) },
        }),
      });
    } else if (q.kind === 'short') {
      inputs.push({
        section: q.section, newPage: !!q.newPage,
        input: questionInputSchema.parse({ ...base, type: 'SHORT', topic: q.topic, marks: q.marks, body: q.body, answer: q.answer, advice: q.advice, content: {} }),
      });
    } else {
      inputs.push({
        section: q.section, newPage: !!q.newPage,
        input: questionInputSchema.parse({
          ...base, type: q.kind === 'case' ? 'CASE_STUDY' : 'LONG', topic: q.topic, marks: q.parts.reduce((s, x) => s + x.marks, 0), body: q.body, answer: '', advice: q.advice,
          content: {
            partLabelStyle: null,
            parts: q.parts.map((x, i) => ({ id: `p${i + 1}`, html: x.html, marks: x.marks, answer: x.answer, parts: (x.parts ?? []).map((s, j) => ({ id: `p${i + 1}s${j + 1}`, html: s.html, marks: s.marks, answer: s.answer })) })),
          },
        }),
      });
    }
  }

  const now = new Date();
  const created: { id: number; type: string; content: string; marks: number; section: string; newPage: boolean }[] = [];
  for (const { input, section, newPage } of inputs) {
    const data = sanitizeQuestionInput(input);
    const q = await prisma.question.create({
      data: { ...data, status: 'APPROVED', createdById: admin.id, updatedById: admin.id, reviewedById: admin.id, reviewedAt: now, reviewComment: 'Demo content' },
    });
    created.push({ id: q.id, type: q.type, content: q.content, marks: q.marks, section, newPage });
  }
  const mcqCount = created.reduce((n, q) => n + (q.type === 'MCQ' ? 1 : q.type === 'MCQ_GROUP' ? JSON.parse(q.content).items.length : 0), 0);
  console.log(`Created ${created.length} approved questions (${mcqCount} MCQs in total).`);

  // ---- paper (validated like POST /api/papers, saved as FINAL with a version snapshot)
  const input = paperInputSchema.parse({
    title: DEMO_TITLE,
    subjectId: subject.id,
    templateId: subject.template.id,
    status: 'FINAL',
    header: {
      session: 'Autumn 2026', examDate: '2026-12-07', durationMinutes: 240, readingMinutes: 15, maxMarks: 160,
      batchNo: 'Demo', testNo: 'Mock 1', teacherName: 'Farooq', researchOfficers: '', adminName: admin.fullName,
      titleOverride: subject.name,
    },
    items: created.map((q) => ({ questionId: q.id, section: q.section, newPage: q.newPage })),
    versionNote: 'Demo mock paper',
  });
  const check = checkPaperMarks(created.map((q) => effectiveItemMarks({ type: q.type as QuestionType, content: JSON.parse(q.content), marks: q.marks }, null)), input.header.maxMarks);
  if (check.status !== 'match') throw new Error(`Marks do not add up: ${check.message}`);

  const paper = await prisma.$transaction(async (tx) => {
    const p = await tx.paper.create({
      data: {
        title: input.title, subjectId: input.subjectId, templateId: input.templateId, status: 'FINAL', header: JSON.stringify(input.header),
        createdById: admin.id, updatedById: admin.id,
        items: { create: input.items.map((it, i) => ({ questionId: it.questionId, section: it.section, position: i, marksOverride: null, newPage: it.newPage })) },
      },
    });
    const full = await tx.paper.findUniqueOrThrow({ where: { id: p.id }, include: paperInclude });
    const snapshot = buildSnapshot(full, parseTemplateConfig(full.template.config));
    await tx.paperVersion.create({ data: { paperId: p.id, version: 1, note: input.versionNote, snapshot: JSON.stringify(snapshot), createdById: admin.id } });
    await tx.paper.update({ where: { id: p.id }, data: { currentVersion: 1 } });
    return { id: p.id, snapshot };
  });
  await audit(null, 'PAPER_CREATE', 'Paper', paper.id, { title: DEMO_TITLE, status: 'FINAL', demo: true, questions: created.length }, { id: admin.id, username: admin.username });
  console.log(`Saved paper #${paper.id} "${DEMO_TITLE}" as FINAL (${check.message}).`);

  // ---- PDFs, printed from the frozen snapshot exactly like the download buttons
  await mkdir(outputDir, { recursive: true });
  for (const mode of ['paper', 'key'] as const) {
    const { html, runningHeader } = renderPaper(snapshotToRenderInput(paper.snapshot, mode, null));
    const fileName = downloadFileName(paper.snapshot.templateConfig, mode === 'paper' ? 'paper' : 'answerKey', paper.snapshot);
    const { pdf, pageCount } = await htmlToPdf(html, fileName.replace(/\.pdf$/, ''), runningHeader);
    await writeFile(path.join(outputDir, fileName), pdf);
    console.log(`  ${path.join(outputDir, fileName)} (${pageCount} pages)`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeBrowser();
    await prisma.$disconnect();
  });
