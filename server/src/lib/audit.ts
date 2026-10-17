import type { Request } from 'express';
import type { AuditAction } from '@skans/shared';
import { prisma } from '../db';

/** Writes an audit record. Never throws: auditing must not break the user's action. */
export async function audit(
  req: Request | null,
  action: AuditAction,
  entityType = '',
  entityId: string | number = '',
  details: unknown = '',
  actor?: { id: number | null; username: string },
) {
  try {
    const user = actor ?? (req?.user ? { id: req.user.id, username: req.user.username } : { id: null, username: '' });
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        username: user.username,
        action,
        entityType,
        entityId: String(entityId),
        details: typeof details === 'string' ? details : JSON.stringify(details),
        ip: req?.ip ?? '',
      },
    });
  } catch (e) {
    console.error('[audit] failed to write log', e);
  }
}
