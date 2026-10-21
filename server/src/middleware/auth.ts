import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { ROLES, type Role, type SessionUser } from '@skans/shared';
import { prisma } from '../db';
import { forbidden, HttpError } from '../lib/http';

declare module 'express-session' {
  interface SessionData {
    userId?: number;
    csrfToken?: string;
  }
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}

/** Roles that are no longer supported (e.g. the former HOA role) get the least privileged role. */
export function normaliseRole(role: string): Role {
  return (ROLES as readonly string[]).includes(role) ? (role as Role) : 'TEACHER';
}

/**
 * Loads the signed-in user from the database on every request, so that deactivation,
 * role changes and subject re-assignment take effect immediately.
 */
export async function loadUser(req: Request, _res: Response, next: NextFunction) {
  try {
    const userId = req.session?.userId;
    if (userId) {
      const u = await prisma.user.findUnique({
        where: { id: userId },
        include: { subjects: { select: { subjectId: true } } },
      });
      if (u && u.isActive) {
        req.user = {
          id: u.id,
          username: u.username,
          fullName: u.fullName,
          role: normaliseRole(u.role),
          mustChangePassword: u.mustChangePassword,
          subjectIds: u.subjects.map((s) => s.subjectId),
        };
      } else {
        delete req.session.userId;
      }
    }
    next();
  } catch (e) {
    next(e);
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(new HttpError(401, 'Please sign in.'));
  next();
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new HttpError(401, 'Please sign in.'));
    if (!roles.includes(req.user.role)) return next(forbidden());
    next();
  };
}

/** Subject scope: ADMIN sees all subjects, others only their assigned ones. */
export function canAccessSubject(user: SessionUser, subjectId: number): boolean {
  return user.role === 'ADMIN' || user.subjectIds.includes(subjectId);
}

export function assertSubject(user: SessionUser, subjectId: number) {
  if (!canAccessSubject(user, subjectId)) throw forbidden('This subject is not assigned to you.');
}

// ---------- CSRF (synchronizer token stored in the session) ----------

export function ensureCsrfToken(req: Request): string {
  if (!req.session.csrfToken) req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  return req.session.csrfToken;
}

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

export function csrfProtection(req: Request, _res: Response, next: NextFunction) {
  if (SAFE.has(req.method)) return next();
  const sent = req.get('x-csrf-token') ?? '';
  const expected = req.session?.csrfToken ?? '';
  const ok =
    sent.length > 0 &&
    sent.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(sent), Buffer.from(expected));
  if (!ok) return next(new HttpError(403, 'Security token missing or expired. Please reload the page.'));
  next();
}
