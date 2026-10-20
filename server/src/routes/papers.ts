import { Router, type Request, type Response } from 'express';
import type { Prisma } from '@prisma/client';
import {
  autoGenerateSchema,
  checkPaperMarks,
  downloadQuerySchema,
  effectiveItemMarks,
  paperInputSchema,
  paperPreviewSchema,
  type PaperInput,
  type PaperVersionDTO,
  type QuestionType,
} from '@skans/shared';
import { z } from 'zod';
import { prisma } from '../db';
import { questionVisibility } from '../lib/access';
import { audit } from '../lib/audit';
import { ah, badRequest, idParam, notFound, parse } from '../lib/http';
import {
  buildSnapshot,
  downloadFileName,
  paperInclude,
  parseTemplateConfig,
  snapshotToRenderInput,
  toPaperDTO,
  toPaperSummary,
  type PaperRow,
  type PaperSnapshot,
} from '../lib/papers';
import { parseJson, questionInclude, toQuestionDTO } from '../lib/questions';
import { assertSubject, requireRole } from '../middleware/auth';
import { renderPaperHtml } from '../render/paperHtml';
import { htmlToPdf } from '../render/pdf';

const router = Router();
// Heads of Academics and administrators build, generate and download papers.
router.use(requireRole('ADMIN', 'HOA'));

async function loadPaper(req: Request, id: number): Promise<PaperRow> {
  const p = await prisma.paper.findFirst({ where: { id, deletedAt: null }, include: paperInclude });
  if (!p) throw notFound('Paper');
  assertSubject(req.user!, p.subjectId);
  return p;
}

/** Validates subject scope, template and that every question is approved and belongs to the subject. */
async function validatePaperInput(req: Request, input: Pick<PaperInput, 'subjectId' | 'templateId' | 'items'>) {
  assertSubject(req.user!, input.subjectId);
  const template = await prisma.paperTemplate.findUnique({ where: { id: input.templateId } });
  if (!template) throw badRequest('Template does not exist.');
  const ids = input.items.map((i) => i.questionId);
  if (new Set(ids).size !== ids.length) throw badRequest('A question can only appear once in a paper.');
  const questions = await prisma.question.findMany({
    where: { AND: [{ id: { in: ids } }, questionVisibility(req.user!)] },
    include: questionInclude,
  });
  const byId = new Map(questions.map((q) => [q.id, q]));
  for (const id of ids) {
    const q = byId.get(id);
    if (!q) throw badRequest(`Question #${id} is not available.`);
    if (q.subjectId !== input.subjectId) throw badRequest(`Question #${id} belongs to another subject.`);
    if (q.deletedAt) throw badRequest(`Question #${id} has been deleted.`);
    if (q.status !== 'APPROVED') throw badRequest(`Question #${id} is not approved yet.`);
  }
  return { template, byId };
}

function marksCheckFor(input: PaperInput, byId: Map<number, { type: string; content: string; marks: number }>) {
  const marks = input.items.map((it) => {
    const q = byId.get(it.questionId)!;
    return effectiveItemMarks({ type: q.type as QuestionType, content: parseJson(q.content, {}), marks: q.marks }, it.marksOverride);
  });
  return checkPaperMarks(marks, input.header.maxMarks);
}

async function saveVersion(tx: Prisma.TransactionClient, paperId: number, userId: number, note: string) {
  const p = await tx.paper.findUniqueOrThrow({ where: { id: paperId }, include: paperInclude });
  const version = p.currentVersion + 1;
  const snapshot = buildSnapshot(p, parseTemplateConfig(p.template.config));
  await tx.paperVersion.create({
    data: { paperId, version, note, snapshot: JSON.stringify(snapshot), createdById: userId },
  });
  return tx.paper.update({ where: { id: paperId }, data: { currentVersion: version }, include: paperInclude });
}

router.get(
  '/',
  ah(async (req, res) => {
    const q = parse(
      z.object({
        subjectId: z.coerce.number().int().positive().optional(),
        status: z.enum(['DRAFT', 'FINAL']).optional(),
        q: z.string().trim().max(100).optional(),
      }),
      req.query,
    );
    const where: Prisma.PaperWhereInput = {
      deletedAt: null,
      subjectId: q.subjectId ? q.subjectId : req.user!.role === 'ADMIN' ? undefined : { in: req.user!.subjectIds },
      ...(q.status ? { status: q.status } : {}),
      ...(q.q ? { title: { contains: q.q } } : {}),
    };
    if (q.subjectId) assertSubject(req.user!, q.subjectId);
    const rows = await prisma.paper.findMany({ where, include: paperInclude, orderBy: { updatedAt: 'desc' }, take: 200 });
    res.json(rows.map(toPaperSummary));
  }),
);

router.get(
  '/:id',
  ah(async (req, res) => {
    res.json(toPaperDTO(await loadPaper(req, idParam(req))));
  }),
);

router.post(
  '/',
  ah(async (req, res) => {
    const input = parse(paperInputSchema, req.body);
    const { byId } = await validatePaperInput(req, input);
    const check = marksCheckFor(input, byId);
    if (input.status === 'FINAL' && check.status !== 'match' && !input.acknowledgeMarksMismatch) {
      throw badRequest(`Cannot finalise: ${check.message}`, { marksCheck: check });
    }
    const paper = await prisma.$transaction(async (tx) => {
      const p = await tx.paper.create({
        data: {
          title: input.title,
          subjectId: input.subjectId,
          templateId: input.templateId,
          status: input.status,
          header: JSON.stringify(input.header),
          createdById: req.user!.id,
          updatedById: req.user!.id,
          items: {
            create: input.items.map((it, i) => ({
              questionId: it.questionId,
              section: it.section,
              position: i,
              marksOverride: it.marksOverride,
              newPage: it.newPage,
            })),
          },
        },
      });
      return saveVersion(tx, p.id, req.user!.id, input.versionNote || 'Created');
    });
    await audit(req, 'PAPER_CREATE', 'Paper', paper.id, { title: paper.title, status: paper.status });
    res.status(201).json(toPaperDTO(paper));
  }),
);

router.put(
  '/:id',
  ah(async (req, res) => {
    const existing = await loadPaper(req, idParam(req));
    const input = parse(paperInputSchema, req.body);
    const { byId } = await validatePaperInput(req, input);
    const check = marksCheckFor(input, byId);
    if (input.status === 'FINAL' && check.status !== 'match' && !input.acknowledgeMarksMismatch) {
      throw badRequest(`Cannot finalise: ${check.message}`, { marksCheck: check });
    }
    const paper = await prisma.$transaction(async (tx) => {
      await tx.paperItem.deleteMany({ where: { paperId: existing.id } });
      await tx.paper.update({
        where: { id: existing.id },
        data: {
          title: input.title,
          subjectId: input.subjectId,
          templateId: input.templateId,
          status: input.status,
          header: JSON.stringify(input.header),
          updatedById: req.user!.id,
          items: {
            create: input.items.map((it, i) => ({
              questionId: it.questionId,
              section: it.section,
              position: i,
              marksOverride: it.marksOverride,
              newPage: it.newPage,
            })),
          },
        },
      });
      const note = input.versionNote || (input.status === 'FINAL' && existing.status !== 'FINAL' ? 'Marked as final' : 'Saved');
      return saveVersion(tx, existing.id, req.user!.id, note);
    });
    await audit(req, input.status === 'FINAL' && existing.status !== 'FINAL' ? 'PAPER_FINALIZE' : 'PAPER_UPDATE', 'Paper', paper.id, {
      version: paper.currentVersion,
      status: paper.status,
      totalMarks: check.total,
    });
    res.json(toPaperDTO(paper));
  }),
);

router.post(
  '/:id/duplicate',
  ah(async (req, res) => {
    const src = await loadPaper(req, idParam(req));
    const copy = await prisma.$transaction(async (tx) => {
      const p = await tx.paper.create({
        data: {
          title: `Copy of ${src.title}`.slice(0, 200),
          subjectId: src.subjectId,
          templateId: src.templateId,
          status: 'DRAFT',
          header: src.header,
          createdById: req.user!.id,
          updatedById: req.user!.id,
          items: {
            create: src.items.map((it) => ({
              questionId: it.questionId,
              section: it.section,
              position: it.position,
              marksOverride: it.marksOverride,
              newPage: it.newPage,
            })),
          },
        },
      });
      return saveVersion(tx, p.id, req.user!.id, `Duplicated from paper #${src.id}`);
    });
    await audit(req, 'PAPER_DUPLICATE', 'Paper', copy.id, { from: src.id });
    res.status(201).json(toPaperDTO(copy));
  }),
);

router.delete(
  '/:id',
  ah(async (req, res) => {
    const p = await loadPaper(req, idParam(req));
    await prisma.paper.update({ where: { id: p.id }, data: { deletedAt: new Date(), updatedById: req.user!.id } });
    await audit(req, 'PAPER_DELETE', 'Paper', p.id, { title: p.title });
    res.json({ ok: true });
  }),
);

router.get(
  '/:id/versions',
  ah(async (req, res) => {
    const p = await loadPaper(req, idParam(req));
    const versions = await prisma.paperVersion.findMany({
      where: { paperId: p.id },
      include: { createdBy: { select: { fullName: true } } },
      orderBy: { version: 'desc' },
    });
    res.json(
      versions.map((v): PaperVersionDTO => {
        const s = parseJson<PaperSnapshot | null>(v.snapshot, null);
        const total = s ? s.items.reduce((sum, it) => sum + effectiveItemMarks(it.question, it.marksOverride), 0) : 0;
        return {
          id: v.id,
          version: v.version,
          note: v.note,
          createdBy: v.createdBy.fullName,
          createdAt: v.createdAt.toISOString(),
          status: s?.status ?? 'DRAFT',
          totalMarks: Math.round(total * 100) / 100,
          questionCount: s?.items.length ?? 0,
        };
      }),
    );
  }),
);

router.post(
  '/:id/versions/:version/restore',
  ah(async (req, res) => {
    const p = await loadPaper(req, idParam(req));
    const version = idParam(req, 'version');
    const v = await prisma.paperVersion.findUnique({ where: { paperId_version: { paperId: p.id, version } } });
    if (!v) throw notFound('Version');
    const s = parseJson<PaperSnapshot | null>(v.snapshot, null);
    if (!s) throw badRequest('This version cannot be restored.');
    // Keep only questions that still exist, are approved and not deleted.
    const still = await prisma.question.findMany({
      where: { id: { in: s.items.map((i) => i.questionId) }, deletedAt: null, status: 'APPROVED', subjectId: s.subjectId },
      select: { id: true },
    });
    const ok = new Set(still.map((q) => q.id));
    const items = s.items.filter((i) => ok.has(i.questionId));
    const paper = await prisma.$transaction(async (tx) => {
      await tx.paperItem.deleteMany({ where: { paperId: p.id } });
      await tx.paper.update({
        where: { id: p.id },
        data: {
          title: s.title,
          header: JSON.stringify(s.header),
          templateId: (await tx.paperTemplate.findUnique({ where: { id: s.templateId } })) ? s.templateId : p.templateId,
          status: 'DRAFT',
          updatedById: req.user!.id,
          items: {
            create: items.map((it, i) => ({
              questionId: it.questionId,
              section: it.section,
              position: i,
              marksOverride: it.marksOverride,
              newPage: it.newPage,
            })),
          },
        },
      });
      return saveVersion(tx, p.id, req.user!.id, `Restored from version ${version}`);
    });
    await audit(req, 'PAPER_RESTORE_VERSION', 'Paper', p.id, { version, skipped: s.items.length - items.length });
    res.json({ paper: toPaperDTO(paper), skipped: s.items.length - items.length });
  }),
);

// ---------------------------------------------------------------- PDF

function watermarkText(req: Request) {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const ts = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return `CONFIDENTIAL · ${req.user!.username} · ${ts}`;
}

/** Final papers are printed from their frozen snapshot, drafts from live data. */
async function snapshotFor(p: PaperRow): Promise<PaperSnapshot> {
  if (p.status === 'FINAL' && p.currentVersion > 0) {
    const v = await prisma.paperVersion.findUnique({ where: { paperId_version: { paperId: p.id, version: p.currentVersion } } });
    const s = parseJson<PaperSnapshot | null>(v?.snapshot, null);
    if (s) return s;
  }
  return buildSnapshot(p, parseTemplateConfig(p.template.config));
}

async function sendPdf(req: Request, res: Response, mode: 'paper' | 'key') {
  const p = await loadPaper(req, idParam(req));
  const { watermark } = parse(downloadQuerySchema, req.query);
  const snap = await snapshotFor(p);
  const html = renderPaperHtml(snapshotToRenderInput(snap, mode, watermark === '1' ? watermarkText(req) : null));
  const fileName = downloadFileName(snap.templateConfig, mode === 'paper' ? 'paper' : 'answerKey', snap);
  const { pdf, pageCount } = await htmlToPdf(html, fileName.replace(/\.pdf$/, ''));
  await audit(req, mode === 'paper' ? 'PAPER_PDF_DOWNLOAD' : 'ANSWER_KEY_PDF_DOWNLOAD', 'Paper', p.id, {
    file: fileName,
    pages: pageCount,
    watermark: watermark === '1',
    version: p.currentVersion,
  });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.setHeader('X-Page-Count', String(pageCount));
  res.setHeader('Cache-Control', 'no-store');
  res.send(pdf);
}

router.get('/:id/pdf', ah((req, res) => sendPdf(req, res, 'paper')));
router.get('/:id/answer-key.pdf', ah((req, res) => sendPdf(req, res, 'key')));

/** Live preview of an unsaved paper: the exact same renderer and PDF engine as the download. */
router.post(
  '/preview',
  ah(async (req, res) => {
    const input = parse(paperPreviewSchema, req.body);
    const { template, byId } = await validatePaperInput(req, input);
    const subject = await prisma.subject.findUniqueOrThrow({ where: { id: input.subjectId } });
    const html = renderPaperHtml({
      mode: input.mode,
      config: parseTemplateConfig(template.config),
      subject: { code: subject.code, name: subject.name },
      header: input.header,
      title: input.title,
      watermark: null,
      items: input.items.map((it) => {
        const q = byId.get(it.questionId)!;
        const dto = toQuestionDTO(q);
        return {
          question: { id: q.id, type: dto.type, marks: q.marks, body: q.body, content: dto.content, answer: q.answer, advice: q.advice },
          section: it.section,
          newPage: it.newPage,
          marks: effectiveItemMarks(dto, it.marksOverride),
        };
      }),
    });
    if (req.query.format === 'html') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:");
      return res.send(html);
    }
    const { pdf, pageCount } = await htmlToPdf(html, input.title);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('X-Page-Count', String(pageCount));
    res.setHeader('Cache-Control', 'no-store');
    res.send(pdf);
  }),
);

// ---------------------------------------------------------------- auto-generate

router.post(
  '/auto-generate',
  ah(async (req, res) => {
    const input = parse(autoGenerateSchema, req.body);
    assertSubject(req.user!, input.subjectId);

    // Questions used in the subject's most recent N papers are avoided.
    let recentlyUsed = new Set<number>();
    if (input.avoidLastNPapers > 0) {
      const recent = await prisma.paper.findMany({
        where: { subjectId: input.subjectId, deletedAt: null },
        orderBy: { updatedAt: 'desc' },
        take: input.avoidLastNPapers,
        include: { items: { select: { questionId: true } } },
      });
      recentlyUsed = new Set(recent.flatMap((p) => p.items.map((i) => i.questionId)));
    }
    const picked = new Set<number>(input.excludeQuestionIds);
    const result: { questionId: number; section: string }[] = [];
    const shortfalls: string[] = [];

    for (const rule of input.rules) {
      const candidates = await prisma.question.findMany({
        where: {
          AND: [
            questionVisibility(req.user!),
            { subjectId: input.subjectId, status: 'APPROVED', deletedAt: null },
            rule.type ? { type: rule.type } : {},
            rule.marks !== undefined ? { marks: rule.marks } : {},
            rule.difficulty ? { difficulty: rule.difficulty } : {},
            input.topics.length ? { topic: { in: input.topics } } : {},
          ],
        },
        select: { id: true },
      });
      const pool = candidates.map((c) => c.id).filter((id) => !picked.has(id) && !recentlyUsed.has(id));
      // Fisher-Yates shuffle for a fair random pick.
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      const take = pool.slice(0, rule.count);
      take.forEach((id) => {
        picked.add(id);
        result.push({ questionId: id, section: rule.section });
      });
      if (take.length < rule.count) {
        shortfalls.push(
          `Rule "${rule.count} × ${rule.type ?? 'any type'}${rule.marks !== undefined ? ` @ ${rule.marks} marks` : ''}": only ${take.length} matching question(s) available.`,
        );
      }
    }
    const rows = await prisma.question.findMany({ where: { id: { in: result.map((r) => r.questionId) } }, include: questionInclude });
    const byId = new Map(rows.map((r) => [r.id, toQuestionDTO(r)]));
    res.json({
      items: result.map((r) => ({ ...r, question: byId.get(r.questionId) })),
      shortfalls,
      avoided: recentlyUsed.size,
    });
  }),
);

export default router;
