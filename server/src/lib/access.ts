import type { Prisma } from '@prisma/client';
import { isAuthorRole, type SessionUser } from '@skans/shared';

/**
 * Roles:
 *  - ADMIN: runs the system. Sees every question (including drafts), reviews submissions, builds
 *    and downloads papers, manages users, subjects and templates.
 *  - TEACHER and RESEARCH_OFFICER (same rights): work only in assigned subjects. Writes questions, edits own drafts/rejected
 *    questions, submits them for review and can see approved questions of those subjects.
 *
 * Row-level visibility is applied in every question query.
 */
export function questionVisibility(user: SessionUser): Prisma.QuestionWhereInput {
  if (user.role === 'ADMIN') return {};
  if (isAuthorRole(user.role)) {
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
 * (rejected); a submitted question is frozen while it waits for review. ADMIN may edit any question.
 */
export function canEditQuestion(user: SessionUser, q: Q): boolean {
  if (user.role === 'ADMIN') return true;
  if (!user.subjectIds.includes(q.subjectId)) return false;
  return isAuthorRole(user.role) && q.createdById === user.id && (q.status === 'DRAFT' || q.status === 'REJECTED');
}

/**
 * ADMIN decides on SUBMITTED questions. Someone else's draft or rejected question must be
 * (re)submitted by its author first; the administrator may approve their own drafts directly.
 */
export function canReviewQuestion(user: SessionUser, q: Q): boolean {
  if (q.deletedAt || user.role !== 'ADMIN') return false;
  if (q.status === 'SUBMITTED') return true;
  return (q.status === 'DRAFT' || q.status === 'REJECTED') && q.createdById === user.id;
}

/** Permanent deletion (from the recycle bin) is limited to ADMIN. */
export function canPurgeQuestion(user: SessionUser, q: Q): boolean {
  return !!q.deletedAt && user.role === 'ADMIN';
}

export function canDeleteQuestion(user: SessionUser, q: Q): boolean {
  if (user.role === 'ADMIN') return true;
  if (!user.subjectIds.includes(q.subjectId)) return false;
  return isAuthorRole(user.role) && q.createdById === user.id && q.status !== 'APPROVED';
}
