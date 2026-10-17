import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import { changePasswordSchema, loginSchema } from '@skans/shared';
import { env } from '../config';
import { prisma } from '../db';
import { audit } from '../lib/audit';
import { ah, HttpError, parse } from '../lib/http';
import { PrismaSessionStore } from '../lib/sessionStore';
import { ensureCsrfToken, requireAuth } from '../middleware/auth';

export const BCRYPT_ROUNDS = 12;
// Used to keep response time similar when the username does not exist.
const DUMMY_HASH = bcrypt.hashSync('timing-equaliser-not-a-password', BCRYPT_ROUNDS);

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.NODE_ENV === 'test' ? 1000 : 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many sign-in attempts from this computer. Please wait 15 minutes.' },
});

router.get('/csrf', (req, res) => {
  res.json({ csrfToken: ensureCsrfToken(req) });
});

router.get('/me', (req, res) => {
  const csrfToken = ensureCsrfToken(req);
  res.json({ user: req.user ?? null, csrfToken });
});

router.post(
  '/login',
  loginLimiter,
  ah(async (req, res) => {
    const { username, password } = parse(loginSchema, req.body);
    const user = await prisma.user.findUnique({ where: { username: username.toLowerCase() } });
    const generic = new HttpError(401, 'Incorrect username or password.');

    if (!user) {
      await bcrypt.compare(password, DUMMY_HASH);
      await audit(req, 'LOGIN_FAILED', 'User', '', { username }, { id: null, username });
      throw generic;
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const mins = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      throw new HttpError(423, `Account temporarily locked after repeated failed sign-ins. Try again in ${mins} minute(s) or ask the administrator to unlock it.`);
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      const failed = user.failedLogins + 1;
      const lock = failed >= env.MAX_FAILED_LOGINS;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLogins: lock ? 0 : failed,
          lockedUntil: lock ? new Date(Date.now() + env.LOCKOUT_MINUTES * 60_000) : null,
        },
      });
      await audit(req, lock ? 'LOGIN_LOCKED' : 'LOGIN_FAILED', 'User', user.id, { attempts: failed }, {
        id: user.id,
        username: user.username,
      });
      throw generic;
    }
    if (!user.isActive) throw new HttpError(403, 'This account has been deactivated. Contact the administrator.');

    await prisma.user.update({
      where: { id: user.id },
      data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    // Prevent session fixation: issue a brand new session id on sign-in.
    await new Promise<void>((resolve, reject) => req.session.regenerate((e) => (e ? reject(e) : resolve())));
    req.session.userId = user.id;
    const csrfToken = ensureCsrfToken(req);
    await new Promise<void>((resolve, reject) => req.session.save((e) => (e ? reject(e) : resolve())));
    await audit(req, 'LOGIN', 'User', user.id, '', { id: user.id, username: user.username });

    const subjects = await prisma.userSubject.findMany({ where: { userId: user.id } });
    res.json({
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
        subjectIds: subjects.map((s) => s.subjectId),
      },
      csrfToken,
    });
  }),
);

router.post(
  '/logout',
  ah(async (req, res) => {
    if (req.user) await audit(req, 'LOGOUT', 'User', req.user.id);
    await new Promise<void>((resolve) => req.session.destroy(() => resolve()));
    res.clearCookie('skans.sid');
    res.json({ ok: true });
  }),
);

router.post(
  '/change-password',
  requireAuth,
  ah(async (req, res) => {
    const input = parse(changePasswordSchema, req.body);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
    if (!(await bcrypt.compare(input.currentPassword, user.passwordHash))) {
      throw new HttpError(400, 'Current password is incorrect.', { fields: [{ path: 'currentPassword' }] });
    }
    if (await bcrypt.compare(input.newPassword, user.passwordHash)) {
      throw new HttpError(400, 'New password must be different from the current password.');
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(input.newPassword, BCRYPT_ROUNDS), mustChangePassword: false },
    });
    // Sign out every other session of this user and continue on a fresh session id.
    await PrismaSessionStore.destroyForUser(user.id);
    await new Promise<void>((resolve, reject) => req.session.regenerate((e) => (e ? reject(e) : resolve())));
    req.session.userId = user.id;
    const csrfToken = ensureCsrfToken(req);
    await audit(req, 'PASSWORD_CHANGE', 'User', user.id);
    res.json({ ok: true, csrfToken });
  }),
);

export default router;
