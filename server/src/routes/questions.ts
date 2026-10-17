import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { questionInputSchema, questionQuerySchema, reviewSchema, type Paged, type QuestionDTO } from '@skans/shared';
import { prisma } from '../db';
import { canDeleteQuestion, canEditQuestion, canReviewQuestion, questionVisibility } from '../lib/access';
import { audit } from '../lib/audit';
import { ah, badRequest, forbidden, idParam, notFound, parse } from '../lib/http';
import { questionInclude, sanitizeQuestionInput, toQuestionDTO } from '../lib/questions';
import { assertSubject, requireRole } from '../middleware/auth';

const router = Router();
router.use(requireRole('HOA', 'TEACHER'));

async function loadVisible(user: Express.Request['user'], id: number, includeDeleted = false) {
  const q = await prisma.question.findFirst({
    where: { AND: [{ id }, questionVisibility(user!), includeDeleted ? {} : { deletedAt: null }] },
    include: questionInclude,
  });
  if (!q) throw notFound('Question');
  return q;
}

router.get(
  '/',
  ah(async (req, res) => {
    const f = parse(questionQuerySchema, req.query);
    const user = req.user!;
    const and: Prisma.QuestionWhereInput[] = [questionVisibility(user)];
    and.push(f.deleted === '1' ? { deletedAt: { not: null } } : { deletedAt: null });
    if (f.subjectId) and.push({ subjectId: f.subjectId });
    if (f.type) and.push({ type: f.type });
    if (f.status) and.push({ status: f.status });
    if (f.difficulty) and.push({ difficulty: f.difficulty });
    if (f.marksMin !== undefined) and.push({ marks: { gte: f.marksMin } });
    if (f.marksMax !== undefined) and.push({ marks: { lte: f.marksMax } });
    if (f.source) and.push({ source: { contains: f.source } });
    if (f.topic) and.push({ topic: { contains: f.topic } });
    if (f.mine === '1') and.push({ createdById: user.id });
    if (f.q) {
      for (const term of f.q.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 8)) {
        and.push({ searchText: { contains: term } });
      }
    }
    const where: Prisma.QuestionWhereInput = { AND: and };
    const orderBy: Prisma.QuestionOrderByWithRelationInput[] =
      f.sort === 'created'
        ? [{ createdAt: 'desc' }]
        : f.sort === 'marks'
          ? [{ marks: 'desc' }, { id: 'desc' }]
          : f.sort === 'subject'
            ? [{ subject: { code: 'asc' } }, { id: 'asc' }]
            : [{ updatedAt: 'desc' }];
    const [total, rows] = await Promise.all([
      prisma.question.count({ where }),
      prisma.question.findMany({
        where,
        include: { ...questionInclude, _count: { select: { paperItems: true } } },
        orderBy,
        skip: (f.page - 1) * f.pageSize,
        take: f.pageSize,
      }),
    ]);
    const body: Paged<QuestionDTO> = {
      items: rows.map((r) => toQuestionDTO(r, { usedInPapers: r._count.paperItems })),
      total,
      page: f.page,
      pageSize: f.pageSize,
    };
    res.json(body);
  }),
);

/** Distinct topics and sources for filters / autocomplete. */
router.get(
  '/meta/facets',
  ah(async (req, res) => {
    const subjectId = req.query.subjectId ? Number(req.query.subjectId) : undefined;
    const where: Prisma.QuestionWhereInput = {
      AND: [questionVisibility(req.user!), { deletedAt: null }, subjectId ? { subjectId } : {}],
    };
    const [topics, sources] = await Promise.all([
      prisma.question.findMany({ where, distinct: ['topic'], select: { topic: true }, orderBy: { topic: 'asc' } }),
      prisma.question.findMany({ where, distinct: ['source'], select: { source: true }, orderBy: { source: 'asc' } }),
    ]);
    res.json({
      topics: topics.map((t) => t.topic).filter(Boolean),
      sources: sources.map((s) => s.source).filter(Boolean),
    });
  }),
);

router.get(
  '/:id',
  ah(async (req, res) => {
    const q = await loadVisible(req.user, idParam(req), true);
    const used = await prisma.paperItem.count({ where: { questionId: q.id } });
    res.json({
      ...toQuestionDTO(q, { usedInPapers: used }),
      permissions: {
        edit: !q.deletedAt && canEditQuestion(req.user!, q),
        review: canReviewQuestion(req.user!, q),
        delete: !q.deletedAt && canDeleteQuestion(req.user!, q),
        restore: !!q.deletedAt && canDeleteQuestion(req.user!, q),
        submit:
          !q.deletedAt && q.createdById === req.user!.id && (q.status === 'DRAFT' || q.status === 'REJECTED'),
      },
    });
  }),
);

router.post(
  '/',
  ah(async (req, res) => {
    const input = parse(questionInputSchema, req.body);
    assertSubject(req.user!, input.subjectId);
    const submit = req.query.submit === '1';
    const data = sanitizeQuestionInput(input);
    if (!data.body) throw badRequest('Question text is required.');
    const q = await prisma.question.create({
      data: { ...data, status: submit ? 'SUBMITTED' : 'DRAFT', createdById: req.user!.id, updatedById: req.user!.id },
      include: questionInclude,
    });
    await audit(req, 'QUESTION_CREATE', 'Question', q.id, { subject: q.subject.code, type: q.type, status: q.status });
    res.status(201).json(toQuestionDTO(q));
  }),
);

router.put(
  '/:id',
  ah(async (req, res) => {
    const existing = await loadVisible(req.user, idParam(req));
    if (!canEditQuestion(req.user!, existing)) {
      throw forbidden(
        existing.status === 'APPROVED'
          ? 'Approved questions can only be changed by the Head of Academics. Duplicate it to make a new version.'
          : 'You cannot edit this question.',
      );
    }
    const input = parse(questionInputSchema, req.body);
    assertSubject(req.user!, input.subjectId);
    const data = sanitizeQuestionInput(input);
    if (!data.body) throw badRequest('Question text is required.');
    const submit = req.query.submit === '1';
    const q = await prisma.question.update({
      where: { id: existing.id },
      data: {
        ...data,
        updatedById: req.user!.id,
        ...(submit && existing.status !== 'APPROVED' ? { status: 'SUBMITTED' } : {}),
      },
      include: questionInclude,
    });
    await audit(req, 'QUESTION_UPDATE', 'Question', q.id, { status: q.status });
    res.json(toQuestionDTO(q));
  }),
);

router.post(
  '/:id/submit',
  ah(async (req, res) => {
    const q = await loadVisible(req.user, idParam(req));
    if (q.createdById !== req.user!.id) throw forbidden('Only the author can submit a question for review.');
    if (q.status !== 'DRAFT' && q.status !== 'REJECTED') throw badRequest('Only draft or rejected questions can be submitted.');
    const updated = await prisma.question.update({
      where: { id: q.id },
      data: { status: 'SUBMITTED' },
      include: questionInclude,
    });
    await audit(req, 'QUESTION_SUBMIT', 'Question', q.id);
    res.json(toQuestionDTO(updated));
  }),
);

router.post(
  '/:id/review',
  requireRole('HOA'),
  ah(async (req, res) => {
    const q = await loadVisible(req.user, idParam(req));
    if (!canReviewQuestion(req.user!, q)) throw forbidden('This question is not awaiting your review.');
    const { decision, comment } = parse(reviewSchema, req.body);
    const updated = await prisma.question.update({
      where: { id: q.id },
      data: {
        status: decision === 'APPROVE' ? 'APPROVED' : 'REJECTED',
        reviewComment: comment,
        reviewedById: req.user!.id,
        reviewedAt: new Date(),
      },
      include: questionInclude,
    });
    await audit(req, decision === 'APPROVE' ? 'QUESTION_APPROVE' : 'QUESTION_REJECT', 'Question', q.id, { comment });
    res.json(toQuestionDTO(updated));
  }),
);

router.post(
  '/:id/duplicate',
  ah(async (req, res) => {
    const q = await loadVisible(req.user, idParam(req));
    assertSubject(req.user!, q.subjectId);
    const copy = await prisma.question.create({
      data: {
        subjectId: q.subjectId,
        topic: q.topic,
        type: q.type,
        marks: q.marks,
        difficulty: q.difficulty,
        source: q.source,
        body: q.body,
        content: q.content,
        answer: q.answer,
        advice: q.advice,
        comments: `Duplicated from question #${q.id}.${q.comments ? ' ' + q.comments : ''}`.slice(0, 5000),
        searchText: q.searchText,
        status: 'DRAFT',
        createdById: req.user!.id,
        updatedById: req.user!.id,
      },
      include: questionInclude,
    });
    await audit(req, 'QUESTION_DUPLICATE', 'Question', copy.id, { from: q.id });
    res.status(201).json(toQuestionDTO(copy));
  }),
);

router.delete(
  '/:id',
  ah(async (req, res) => {
    const q = await loadVisible(req.user, idParam(req));
    if (!canDeleteQuestion(req.user!, q)) throw forbidden('You cannot delete this question.');
    await prisma.question.update({ where: { id: q.id }, data: { deletedAt: new Date(), updatedById: req.user!.id } });
    await audit(req, 'QUESTION_DELETE', 'Question', q.id);
    res.json({ ok: true });
  }),
);

router.post(
  '/:id/restore',
  ah(async (req, res) => {
    const q = await loadVisible(req.user, idParam(req), true);
    if (!q.deletedAt) throw badRequest('Question is not deleted.');
    if (!canDeleteQuestion(req.user!, q)) throw forbidden('You cannot restore this question.');
    await prisma.question.update({ where: { id: q.id }, data: { deletedAt: null, updatedById: req.user!.id } });
    await audit(req, 'QUESTION_RESTORE', 'Question', q.id);
    res.json({ ok: true });
  }),
);

/** Bulk lookup used by the paper builder (only returns questions the user may see). */
router.post(
  '/lookup',
  ah(async (req, res) => {
    const { ids } = parse(z.object({ ids: z.array(z.number().int().positive()).max(300) }), req.body);
    const rows = await prisma.question.findMany({
      where: { AND: [{ id: { in: ids } }, questionVisibility(req.user!)] },
      include: questionInclude,
    });
    res.json(rows.map((r) => toQuestionDTO(r)));
  }),
);

export default router;
