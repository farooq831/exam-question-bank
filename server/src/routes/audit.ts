import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { auditQuerySchema, type Paged, type AuditLogDTO } from '@skans/shared';
import { prisma } from '../db';
import { ah, parse } from '../lib/http';
import { requireRole } from '../middleware/auth';
import { toAuditDTO } from './dashboard';

const router = Router();
router.use(requireRole('ADMIN'));

router.get(
  '/',
  ah(async (req, res) => {
    const f = parse(auditQuerySchema, req.query);
    const where: Prisma.AuditLogWhereInput = {
      ...(f.action ? { action: f.action } : {}),
      ...(f.username ? { username: { contains: f.username, mode: 'insensitive' } } : {}),
      ...(f.entityType ? { entityType: f.entityType } : {}),
      ...(f.from || f.to
        ? {
            createdAt: {
              ...(f.from ? { gte: new Date(`${f.from}T00:00:00`) } : {}),
              ...(f.to ? { lte: new Date(`${f.to}T23:59:59.999`) } : {}),
            },
          }
        : {}),
    };
    const [total, rows] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (f.page - 1) * f.pageSize,
        take: f.pageSize,
      }),
    ]);
    const body: Paged<AuditLogDTO> = { items: rows.map(toAuditDTO), total, page: f.page, pageSize: f.pageSize };
    res.json(body);
  }),
);

export default router;
