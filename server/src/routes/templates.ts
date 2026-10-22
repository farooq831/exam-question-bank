import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { templateConfigSchema, templateInputSchema, type TemplateDTO } from '@skans/shared';
import { prisma } from '../db';
import { audit } from '../lib/audit';
import { ah, conflict, idParam, notFound, parse } from '../lib/http';
import { parseJson } from '../lib/questions';
import { requireRole } from '../middleware/auth';
import { calistoStatus } from '../render/assets';

const router = Router();
// Paper formats are managed by administrators only.
router.use(requireRole('ADMIN'));

type Row = Prisma.PaperTemplateGetPayload<{ include: { subjects: { select: { id: true; code: true } } } }>;

export function toTemplateDTO(t: Row): TemplateDTO {
  const parsed = templateConfigSchema.safeParse(parseJson(t.config, {}));
  return {
    id: t.id,
    code: t.code,
    name: t.name,
    description: t.description,
    isActive: t.isActive,
    config: parsed.success ? parsed.data : (parseJson(t.config, {}) as TemplateDTO['config']),
    subjectCodes: t.subjects.map((s) => s.code),
    updatedAt: t.updatedAt.toISOString(),
  };
}

const include = { subjects: { select: { id: true, code: true } } } as const;

router.get(
  '/',
  ah(async (_req, res) => {
    const rows = await prisma.paperTemplate.findMany({ include, orderBy: { name: 'asc' } });
    res.json(rows.map(toTemplateDTO));
  }),
);

/** Whether the licensed Calisto MT font is available to the PDF renderer on this server. */
router.get(
  '/font-status',
  ah(async (_req, res) => {
    res.json({ calisto: calistoStatus() });
  }),
);

router.get(
  '/:id',
  ah(async (req, res) => {
    const t = await prisma.paperTemplate.findUnique({ where: { id: idParam(req) }, include });
    if (!t) throw notFound('Template');
    res.json(toTemplateDTO(t));
  }),
);

router.post(
  '/',
  ah(async (req, res) => {
    const input = parse(templateInputSchema, req.body);
    if (await prisma.paperTemplate.findUnique({ where: { code: input.code } })) throw conflict('Template code already exists.');
    const t = await prisma.paperTemplate.create({
      data: {
        code: input.code,
        name: input.name,
        description: input.description,
        isActive: input.isActive,
        config: JSON.stringify(input.config),
      },
      include,
    });
    await audit(req, 'TEMPLATE_CREATE', 'PaperTemplate', t.id, { code: t.code });
    res.status(201).json(toTemplateDTO(t));
  }),
);

router.put(
  '/:id',
  ah(async (req, res) => {
    const id = idParam(req);
    const existing = await prisma.paperTemplate.findUnique({ where: { id }, include });
    if (!existing) throw notFound('Template');
    const input = parse(templateInputSchema, req.body);
    if (input.code !== existing.code && (await prisma.paperTemplate.findUnique({ where: { code: input.code } }))) {
      throw conflict('Template code already exists.');
    }
    const t = await prisma.paperTemplate.update({
      where: { id },
      data: {
        code: input.code,
        name: input.name,
        description: input.description,
        isActive: input.isActive,
        config: JSON.stringify(input.config),
      },
      include,
    });
    await audit(req, 'TEMPLATE_UPDATE', 'PaperTemplate', id, { code: t.code });
    res.json(toTemplateDTO(t));
  }),
);

export default router;
