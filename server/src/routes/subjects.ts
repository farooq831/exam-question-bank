import { Router } from 'express';
import { z } from 'zod';
import { subjectInputSchema, type SubjectDTO } from '@skans/shared';
import { prisma } from '../db';
import { audit } from '../lib/audit';
import { ah, badRequest, idParam, notFound, parse } from '../lib/http';
import { assertSubject, requireRole } from '../middleware/auth';

const router = Router();

router.get(
  '/',
  ah(async (req, res) => {
    const u = req.user!;
    const subjects = await prisma.subject.findMany({
      where: u.role === 'ADMIN' ? {} : { id: { in: u.subjectIds } },
      include: { template: { select: { name: true } } },
      orderBy: { code: 'asc' },
    });
    res.json(
      subjects.map(
        (s): SubjectDTO => ({
          id: s.id,
          code: s.code,
          name: s.name,
          level: s.level,
          isActive: s.isActive,
          templateId: s.templateId,
          templateName: s.template?.name ?? null,
        }),
      ),
    );
  }),
);

async function assertTemplate(templateId: number | null) {
  if (templateId === null) return;
  if (!(await prisma.paperTemplate.findUnique({ where: { id: templateId } }))) throw badRequest('Template does not exist.');
}

router.post(
  '/',
  requireRole('ADMIN'),
  ah(async (req, res) => {
    const input = parse(subjectInputSchema, req.body);
    await assertTemplate(input.templateId);
    const s = await prisma.subject.create({ data: input });
    await audit(req, 'SUBJECT_CREATE', 'Subject', s.id, { code: s.code });
    res.status(201).json(s);
  }),
);

router.put(
  '/:id',
  requireRole('ADMIN'),
  ah(async (req, res) => {
    const id = idParam(req);
    const input = parse(subjectInputSchema, req.body);
    await assertTemplate(input.templateId);
    if (!(await prisma.subject.findUnique({ where: { id } }))) throw notFound('Subject');
    const s = await prisma.subject.update({ where: { id }, data: input });
    await audit(req, 'SUBJECT_UPDATE', 'Subject', id, input);
    res.json(s);
  }),
);

/** Switches the default template of a subject. */
router.patch(
  '/:id/template',
  requireRole('ADMIN'),
  ah(async (req, res) => {
    const id = idParam(req);
    assertSubject(req.user!, id);
    const { templateId } = parse(z.object({ templateId: z.number().int().positive() }), req.body);
    await assertTemplate(templateId);
    const s = await prisma.subject.update({ where: { id }, data: { templateId } });
    await audit(req, 'SUBJECT_UPDATE', 'Subject', id, { templateId });
    res.json(s);
  }),
);

export default router;
