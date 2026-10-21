import { Router } from 'express';
import bcrypt from 'bcryptjs';
import type { Prisma } from '@prisma/client';
import { resetPasswordSchema, userCreateSchema, userUpdateSchema, type Role, type UserDTO } from '@skans/shared';
import { prisma } from '../db';
import { audit } from '../lib/audit';
import { ah, badRequest, conflict, idParam, notFound, parse } from '../lib/http';
import { PrismaSessionStore } from '../lib/sessionStore';
import { normaliseRole, requireRole } from '../middleware/auth';
import { BCRYPT_ROUNDS } from './auth';

const router = Router();
router.use(requireRole('ADMIN'));

type UserRow = Prisma.UserGetPayload<{ include: { subjects: true } }>;

function toDTO(u: UserRow): UserDTO {
  return {
    id: u.id,
    username: u.username,
    fullName: u.fullName,
    email: u.email,
    role: normaliseRole(u.role),
    isActive: u.isActive,
    lockedUntil: u.lockedUntil && u.lockedUntil > new Date() ? u.lockedUntil.toISOString() : null,
    failedLogins: u.failedLogins,
    lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
    subjectIds: u.subjects.map((s) => s.subjectId),
  };
}

async function assertSubjectsExist(ids: number[]) {
  if (!ids.length) return;
  const n = await prisma.subject.count({ where: { id: { in: ids } } });
  if (n !== new Set(ids).size) throw badRequest('One or more subjects do not exist.');
}

router.get(
  '/',
  ah(async (_req, res) => {
    const users = await prisma.user.findMany({ include: { subjects: true }, orderBy: [{ role: 'asc' }, { username: 'asc' }] });
    res.json(users.map(toDTO));
  }),
);

router.post(
  '/',
  ah(async (req, res) => {
    const input = parse(userCreateSchema, req.body);
    await assertSubjectsExist(input.subjectIds);
    const exists = await prisma.user.findUnique({ where: { username: input.username } });
    if (exists) throw conflict('That username is already taken.');
    const user = await prisma.user.create({
      data: {
        username: input.username,
        fullName: input.fullName,
        email: input.email || null,
        role: input.role,
        isActive: input.isActive,
        mustChangePassword: true,
        passwordHash: await bcrypt.hash(input.password, BCRYPT_ROUNDS),
        subjects: { create: [...new Set(input.subjectIds)].map((subjectId) => ({ subjectId })) },
      },
      include: { subjects: true },
    });
    await audit(req, 'USER_CREATE', 'User', user.id, { username: user.username, role: user.role });
    res.status(201).json(toDTO(user));
  }),
);

router.put(
  '/:id',
  ah(async (req, res) => {
    const id = idParam(req);
    const input = parse(userUpdateSchema, req.body);
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw notFound('User');
    await assertSubjectsExist(input.subjectIds);

    // Lock-out protection: the system must always keep at least one active administrator,
    // and an administrator cannot remove their own access.
    const losingAdmin = user.role === 'ADMIN' && (input.role !== 'ADMIN' || !input.isActive);
    if (losingAdmin) {
      if (id === req.user!.id) throw badRequest('You cannot remove your own administrator access.');
      const otherAdmins = await prisma.user.count({ where: { role: 'ADMIN', isActive: true, id: { not: id } } });
      if (otherAdmins === 0) throw badRequest('At least one active administrator is required.');
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        fullName: input.fullName,
        email: input.email || null,
        role: input.role,
        isActive: input.isActive,
        subjects: {
          deleteMany: {},
          create: [...new Set(input.subjectIds)].map((subjectId) => ({ subjectId })),
        },
      },
      include: { subjects: true },
    });
    if (!input.isActive) await PrismaSessionStore.destroyForUser(id);
    await audit(req, 'USER_UPDATE', 'User', id, {
      role: input.role,
      isActive: input.isActive,
      subjectIds: input.subjectIds,
    });
    res.json(toDTO(updated));
  }),
);

router.post(
  '/:id/reset-password',
  ah(async (req, res) => {
    const id = idParam(req);
    const { newPassword } = parse(resetPasswordSchema, req.body);
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw notFound('User');
    await prisma.user.update({
      where: { id },
      data: {
        passwordHash: await bcrypt.hash(newPassword, BCRYPT_ROUNDS),
        mustChangePassword: id !== req.user!.id,
        failedLogins: 0,
        lockedUntil: null,
      },
    });
    if (id !== req.user!.id) await PrismaSessionStore.destroyForUser(id);
    await audit(req, 'PASSWORD_RESET', 'User', id, { username: user.username });
    res.json({ ok: true });
  }),
);

router.post(
  '/:id/unlock',
  ah(async (req, res) => {
    const id = idParam(req);
    await prisma.user.update({ where: { id }, data: { failedLogins: 0, lockedUntil: null } });
    await audit(req, 'USER_UNLOCK', 'User', id);
    res.json({ ok: true });
  }),
);

export default router;
