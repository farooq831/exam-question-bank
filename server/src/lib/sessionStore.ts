import session from 'express-session';
import { prisma } from '../db';

/** express-session store backed by the Session table (works on SQLite and PostgreSQL). */
export class PrismaSessionStore extends session.Store {
  private cleanupTimer: NodeJS.Timeout;

  constructor(private ttlMs: number) {
    super();
    this.cleanupTimer = setInterval(() => {
      prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } }).catch(() => undefined);
    }, 15 * 60 * 1000);
    this.cleanupTimer.unref();
  }

  private expiry(sess: session.SessionData) {
    const exp = sess.cookie?.expires ? new Date(sess.cookie.expires) : new Date(Date.now() + this.ttlMs);
    return exp;
  }

  get(sid: string, cb: (err: unknown, session?: session.SessionData | null) => void) {
    prisma.session
      .findUnique({ where: { sid } })
      .then((row) => {
        if (!row || row.expiresAt < new Date()) return cb(null, null);
        cb(null, JSON.parse(row.data));
      })
      .catch((e) => cb(e));
  }

  set(sid: string, sess: session.SessionData, cb?: (err?: unknown) => void) {
    const data = JSON.stringify(sess);
    const expiresAt = this.expiry(sess);
    prisma.session
      .upsert({ where: { sid }, create: { sid, data, expiresAt }, update: { data, expiresAt } })
      .then(() => cb?.())
      .catch((e) => cb?.(e));
  }

  destroy(sid: string, cb?: (err?: unknown) => void) {
    prisma.session
      .deleteMany({ where: { sid } })
      .then(() => cb?.())
      .catch((e) => cb?.(e));
  }

  touch(sid: string, sess: session.SessionData, cb?: () => void) {
    prisma.session
      .updateMany({ where: { sid }, data: { expiresAt: this.expiry(sess) } })
      .then(() => cb?.())
      .catch(() => cb?.());
  }

  /** Signs a user out everywhere (used after password reset or deactivation). */
  static async destroyForUser(userId: number) {
    const rows = await prisma.session.findMany({ select: { sid: true, data: true } });
    const sids = rows.filter((r) => {
      try {
        return JSON.parse(r.data).userId === userId;
      } catch {
        return false;
      }
    });
    if (sids.length) await prisma.session.deleteMany({ where: { sid: { in: sids.map((s) => s.sid) } } });
  }
}
