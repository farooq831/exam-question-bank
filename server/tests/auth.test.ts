import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/db';
import { anonymous, app, login, unique } from './helpers';

const TEMP_PASSWORD = 'Temporary2026x';

/** Creates a fresh teacher through the admin API (accounts start with mustChangePassword). */
async function createTeacher() {
  const admin = await login('admin');
  const username = unique('t_').toLowerCase();
  const res = await admin.post('/api/users', { username, fullName: 'Test Teacher', role: 'TEACHER', password: TEMP_PASSWORD, subjectIds: [] });
  expect(res.status).toBe(201);
  return { admin, username, id: res.body.id as number };
}

describe('authentication', () => {
  it('rejects unauthenticated API access', async () => {
    for (const url of ['/api/dashboard', '/api/questions', '/api/papers', '/api/users', '/api/audit']) {
      await request(app).get(url).expect(401);
    }
  });

  it('uses one generic message for unknown users and wrong passwords', async () => {
    const s = await anonymous();
    const unknown = await s.post('/api/auth/login', { username: 'nobody_here', password: 'whatever123' }).expect(401);
    const wrong = await s.post('/api/auth/login', { username: 'teacher_audit', password: 'wrong-password-1' }).expect(401);
    expect(unknown.body.error).toBe(wrong.body.error);
  });

  it('sets an HttpOnly, SameSite=Strict session cookie and never returns password hashes', async () => {
    const s = await anonymous();
    const res = await s.post('/api/auth/login', { username: 'teacher_far', password: 'SkansDemo2026' }).expect(200);
    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toMatch(/skans\.sid=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|\$2[aby]\$/);
    const me = await s.get('/api/auth/me').expect(200);
    expect(JSON.stringify(me.body)).not.toMatch(/passwordHash|\$2[aby]\$/);
    const admin = await login('admin');
    const users = await admin.get('/api/users').expect(200);
    expect(JSON.stringify(users.body)).not.toMatch(/passwordHash|\$2[aby]\$/);
  });

  it('logs out and invalidates the session', async () => {
    const s = await login('teacher_far');
    await s.get('/api/dashboard').expect(200);
    await s.post('/api/auth/logout').expect(200);
    await s.get('/api/dashboard').expect(401);
    const me = await s.get('/api/auth/me').expect(200);
    expect(me.body.user).toBeNull();
    expect(await prisma.auditLog.count({ where: { action: 'LOGOUT', username: 'teacher_far' } })).toBeGreaterThan(0);
  });
});

describe('CSRF protection', () => {
  it('rejects unsafe requests without a valid token', async () => {
    const agent = request.agent(app);
    await agent.get('/api/auth/csrf').expect(200);
    await agent.post('/api/auth/login').send({ username: 'admin', password: 'SkansDemo2026' }).expect(403);

    const s = await login('teacher_tax');
    await s.agent.post('/api/questions').send({}).expect(403);
    await s.agent.post('/api/questions').set('x-csrf-token', 'x'.repeat(64)).send({}).expect(403);
    await s.agent.post('/api/auth/logout').expect(403);
    // Safe methods do not need the token.
    await s.agent.get('/api/questions').expect(200);
  });

  it('rotates the token on sign-in', async () => {
    const s = await anonymous();
    const res = await s.post('/api/auth/login', { username: 'teacher_tax', password: 'SkansDemo2026' }).expect(200);
    expect(res.body.csrfToken).not.toBe(s.csrf);
    await s.agent.post('/api/questions/lookup').set('x-csrf-token', s.csrf).send({ ids: [] }).expect(403);
    await s.agent.post('/api/questions/lookup').set('x-csrf-token', res.body.csrfToken).send({ ids: [] }).expect(200);
  });
});

describe('password change and admin reset', () => {
  it('forces a new account to change its password before using the API', async () => {
    const { username } = await createTeacher();
    const s = await login(username, TEMP_PASSWORD);
    const blocked = await s.get('/api/questions').expect(403);
    expect(blocked.body.error).toMatch(/change your password/i);

    await s.post('/api/auth/change-password', { currentPassword: 'wrong-current-1', newPassword: 'BrandNew2026x', confirmPassword: 'BrandNew2026x' }).expect(400);
    await s.post('/api/auth/change-password', { currentPassword: TEMP_PASSWORD, newPassword: 'short1', confirmPassword: 'short1' }).expect(400);
    await s.post('/api/auth/change-password', { currentPassword: TEMP_PASSWORD, newPassword: 'BrandNew2026x', confirmPassword: 'Different2026x' }).expect(400);
    const ok = await s.post('/api/auth/change-password', { currentPassword: TEMP_PASSWORD, newPassword: 'BrandNew2026x', confirmPassword: 'BrandNew2026x' }).expect(200);
    await s.agent.get('/api/questions').expect(200);
    expect(ok.body.csrfToken).toBeTruthy();

    const old = await anonymous();
    await old.post('/api/auth/login', { username, password: TEMP_PASSWORD }).expect(401);
    await login(username, 'BrandNew2026x');
    expect(await prisma.auditLog.count({ where: { action: 'PASSWORD_CHANGE', username } })).toBe(1);
  });

  it('admin reset signs the user out and requires a new password', async () => {
    const { admin, username, id } = await createTeacher();
    const s = await login(username, TEMP_PASSWORD);
    await s.post('/api/auth/change-password', { currentPassword: TEMP_PASSWORD, newPassword: 'BrandNew2026x', confirmPassword: 'BrandNew2026x' }).expect(200);
    await admin.post(`/api/users/${id}/reset-password`, { newPassword: 'ResetByAdmin2026' }).expect(200);
    await s.agent.get('/api/auth/me').expect(200).then((r) => expect(r.body.user).toBeNull());
    const again = await login(username, 'ResetByAdmin2026');
    expect((await again.get('/api/auth/me')).body.user.mustChangePassword).toBe(true);
  });
});

describe('login lockout', () => {
  it('locks after repeated failures, even for the correct password, until an admin unlocks', async () => {
    const { admin, username, id } = await createTeacher();
    const s = await anonymous();
    for (let i = 0; i < 5; i++) await s.post('/api/auth/login', { username, password: `wrong-pass-${i}` }).expect(401);
    const locked = await s.post('/api/auth/login', { username, password: TEMP_PASSWORD }).expect(423);
    expect(locked.body.error).toMatch(/locked/i);
    expect(await prisma.auditLog.count({ where: { action: 'LOGIN_LOCKED', username } })).toBe(1);

    const listed = (await admin.get('/api/users').expect(200)).body.find((u: { id: number }) => u.id === id);
    expect(listed.lockedUntil).toBeTruthy();
    await admin.post(`/api/users/${id}/unlock`).expect(200);
    await s.post('/api/auth/login', { username, password: TEMP_PASSWORD }).expect(200);
  });

  it('blocks deactivated users and ends their sessions', async () => {
    const { admin, username, id } = await createTeacher();
    const s = await login(username, TEMP_PASSWORD);
    await admin.put(`/api/users/${id}`, { fullName: 'Test Teacher', email: '', role: 'TEACHER', subjectIds: [], isActive: false }).expect(200);
    expect((await s.get('/api/auth/me')).body.user).toBeNull();
    const again = await anonymous();
    await again.post('/api/auth/login', { username, password: TEMP_PASSWORD }).expect(403);
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
