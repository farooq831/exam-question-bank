import type { Prisma } from '@prisma/client';
import type { SessionUser } from '@skans/shared';

/**
 * Row-level visibility of questions (enforced in every query):
 *  - HOA: questions of assigned subjects, except other users' private drafts.
 *  - TEACHER: own questions of assigned subjects + APPROVED questions of assigned subjects.
 *  - ADMIN: all question content for school-wide administration and review.
 */
export function questionVisibility(user: SessionUser): Prisma.QuestionWhereInput {
  if (user.role === 'ADMIN') return {};
  if (user.role === 'HOA') {
    return {
      subjectId: { in: user.subjectIds },
      OR: [{ status: { not: 'DRAFT' } }, { createdById: user.id }],
    };
  }
  if (user.role === 'TEACHER') {
    return {
      subjectId: { in: user.subjectIds },
      OR: [{ createdById: user.id }, { status: 'APPROVED' }],
    };
  }
  return { id: -1 };
}

type Q = { subjectId: number; createdById: number; status: string; deletedAt: Date | null };

/**
 * Teachers may only change their own questions while they are drafts or have been sent back
 * (rejected); a submitted question is frozen while it waits for review. HOA may maintain any
 * question of an assigned subject.
 */
export function canEditQuestion(user: SessionUser, q: Q): boolean {
  if (!user.subjectIds.includes(q.subjectId)) return false;
  if (user.role === 'HOA') return true;
  if (user.role === 'TEACHER') return q.createdById === user.id && (q.status === 'DRAFT' || q.status === 'REJECTED');
  return false;
}

/**
 * Reviewers decide on SUBMITTED questions. Someone else's draft or rejected question must be
 * (re)submitted by its author first; reviewers may approve their own drafts directly.
 */
export function canReviewQuestion(user: SessionUser, q: Q): boolean {
  if (q.deletedAt) return false;
  if (user.role === 'HOA' && !user.subjectIds.includes(q.subjectId)) return false;
  if (user.role !== 'ADMIN' && user.role !== 'HOA') return false;
  if (q.status === 'SUBMITTED') return true;
  return (q.status === 'DRAFT' || q.status === 'REJECTED') && q.createdById === user.id;
}

export function canDeleteQuestion(user: SessionUser, q: Q): boolean {
  if (user.role === 'ADMIN') return true;
  if (!user.subjectIds.includes(q.subjectId)) return false;
  if (user.role === 'HOA') return true;
  return user.role === 'TEACHER' && q.createdById === user.id && q.status !== 'APPROVED';
}
