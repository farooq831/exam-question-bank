/**
 * Emergency recovery for the school IT administrator (run on the server console):
 *   npm run reset-admin -- <username> <new-password>
 * Unlocks the account, re-activates it, ensures the ADMIN role and sets the new password.
 * This guarantees the administrator can never be permanently locked out of the system.
 */
import bcrypt from 'bcryptjs';
import { passwordPolicy } from '@skans/shared';
import { prisma } from '../src/db';

const [username = 'admin', password] = process.argv.slice(2);
if (!password) {
  console.error('Usage: npm run reset-admin -- <username> <new-password>');
  process.exit(1);
}
const check = passwordPolicy.safeParse(password);
if (!check.success) {
  console.error('Password rejected: ' + check.error.issues.map((i) => i.message).join(', '));
  process.exit(1);
}
const hash = await bcrypt.hash(password, 12);
const user = await prisma.user.upsert({
  where: { username },
  update: { passwordHash: hash, role: 'ADMIN', isActive: true, failedLogins: 0, lockedUntil: null, mustChangePassword: false },
  create: { username, fullName: 'System Administrator', role: 'ADMIN', passwordHash: hash },
});
await prisma.auditLog.create({
  data: { userId: user.id, username: 'console', action: 'PASSWORD_RESET', entityType: 'User', entityId: String(user.id), details: 'reset-admin script' },
});
console.log(`Administrator "${username}" is active and unlocked with the new password.`);
await prisma.$disconnect();
