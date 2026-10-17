import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { QUESTION_STATUSES, type AuditLogDTO, type DashboardDTO, type QuestionStatus } from '@skans/shared';
import { prisma } from '../db';
import { questionVisibility } from '../lib/access';
import { ah } from '../lib/http';
import { paperInclude, toPaperSummary } from '../lib/papers';

const router = Router();

export function toAuditDTO(a: { id: number; username: string; action: string; entityType: string; entityId: string; details: string; ip: string; createdAt: Date }): AuditLogDTO {
  return { ...a, createdAt: a.createdAt.toISOString() };
}

router.get(
  '/',
  ah(async (req, res) => {
    const user = req.user!;
    const subjects = await prisma.subject.findMany({
      where: user.role === 'ADMIN' ? { isActive: true } : { id: { in: user.subjectIds } },
      orderBy: { code: 'asc' },
    });
    // Admin sees aggregate counts only (no question content).
    const where: Prisma.QuestionWhereInput =
      user.role === 'ADMIN' ? { deletedAt: null } : { AND: [questionVisibility(user), { deletedAt: null }] };
    const grouped = await prisma.question.groupBy({ by: ['subjectId', 'status'], where, _count: { _all: true } });

    const totals = Object.fromEntries(QUESTION_STATUSES.map((s) => [s, 0])) as Record<QuestionStatus, number>;
    const countsBySubject = subjects
      .map((s) => {
        const row = { subjectId: s.id, code: s.code, name: s.name, DRAFT: 0, SUBMITTED: 0, APPROVED: 0, REJECTED: 0 };
        for (const g of grouped.filter((x) => x.subjectId === s.id)) {
          const st = g.status as QuestionStatus;
          row[st] = g._count._all;
          totals[st] += g._count._all;
        }
        return row;
      })
      .filter((r) => user.role !== 'ADMIN' || r.DRAFT + r.SUBMITTED + r.APPROVED + r.REJECTED > 0);

    const pendingReview =
      user.role === 'HOA'
        ? await prisma.question.count({ where: { subjectId: { in: user.subjectIds }, status: 'SUBMITTED', deletedAt: null } })
        : 0;
    const myRejected =
      user.role === 'TEACHER'
        ? await prisma.question.count({ where: { createdById: user.id, status: 'REJECTED', deletedAt: null } })
        : 0;

    const recentPapers =
      user.role === 'HOA'
        ? (
            await prisma.paper.findMany({
              where: { subjectId: { in: user.subjectIds }, deletedAt: null },
              include: paperInclude,
              orderBy: { updatedAt: 'desc' },
              take: 5,
            })
          ).map(toPaperSummary)
        : [];

    const activity = await prisma.auditLog.findMany({
      where: user.role === 'ADMIN' ? {} : { userId: user.id, action: { notIn: ['LOGIN', 'LOGOUT'] } },
      orderBy: { createdAt: 'desc' },
      take: 8,
    });

    const stats: DashboardDTO['stats'] = {};
    if (user.role === 'ADMIN') {
      const [users, subjectsCount, templates, papers] = await Promise.all([
        prisma.user.count({ where: { isActive: true } }),
        prisma.subject.count(),
        prisma.paperTemplate.count(),
        prisma.paper.count({ where: { deletedAt: null } }),
      ]);
      Object.assign(stats, { users, subjects: subjectsCount, templates, papers });
    }

    const body: DashboardDTO = {
      role: user.role,
      countsBySubject,
      totals,
      pendingReview,
      myRejected,
      recentPapers,
      recentActivity: activity.map(toAuditDTO),
      stats,
    };
    res.json(body);
  }),
);

export default router;
