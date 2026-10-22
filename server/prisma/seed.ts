/**
 * Production bootstrap. Contains NO demo data.
 *
 *   npm run db:seed    Non-destructive and idempotent. Creates the SKANS paper formats, the CAF
 *                      subjects and, when no administrator exists, one `admin` account with a
 *                      one-time password that must be changed at first sign-in. Existing rows are
 *                      never overwritten. It also migrates data from older versions (former HOA
 *                      accounts become teachers; ICAP-named formats are renamed to SKANS).
 *   npm run db:reset   DESTRUCTIVE. Deletes all data, then bootstraps an empty system.
 *                      Refused when NODE_ENV=production unless --force is also given.
 *
 * The initial admin password can be fixed with SKANS_ADMIN_PASSWORD; otherwise a random one is
 * generated and printed once.
 */
import { randomInt } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { Prisma } from '@prisma/client';
import { CA_PAPERS, CAF_TEMPLATE_CONFIG, LEGACY_SUBJECT_CODES, passwordPolicy, SKANS_TEMPLATE_CONFIG, templateConfigSchema } from '@skans/shared';
import { prisma } from '../src/db';

const RESET = process.argv.includes('--reset');
const FORCE = process.argv.includes('--force');

export const CAF_TEMPLATE = {
  code: 'SKANS_CAF',
  name: 'SKANS CAF Examination',
  description:
    'SKANS CAF examination paper. Standard format: the CAF-8 Audit and Assurance Essentials paper and the formatting sheet from the administration (Calisto MT, A4, approved sizes, margins and spacing), with the SKANS logo at the top right.',
};
export const SKANS_TEMPLATE = {
  code: 'SKANS_INTERNAL',
  name: 'SKANS Internal Test',
  description: 'SKANS internal (class) test layout with batch, teacher and test number. Values are provisional until the administration confirms the guidelines.',
};

type Tx = Prisma.TransactionClient;

async function wipe(tx: Tx) {
  await tx.paperVersion.deleteMany();
  await tx.paperItem.deleteMany();
  await tx.paper.deleteMany();
  await tx.question.deleteMany();
  await tx.auditLog.deleteMany();
  await tx.userSubject.deleteMany();
  await tx.subject.deleteMany();
  await tx.paperTemplate.deleteMany();
  await tx.user.deleteMany();
  await tx.session.deleteMany();
}

/** Upgrades data written by earlier versions. Safe to run repeatedly. */
async function migrateLegacy(tx: Tx) {
  const hoa = await tx.user.updateMany({ where: { role: 'HOA' }, data: { role: 'TEACHER' } });
  if (hoa.count) console.log(`[seed] ${hoa.count} former Head-of-Academics account(s) converted to TEACHER. Promote to ADMIN manually if needed.`);

  const legacy = await tx.paperTemplate.findUnique({ where: { code: 'ICAP_EXAM' } });
  if (legacy && !(await tx.paperTemplate.findUnique({ where: { code: CAF_TEMPLATE.code } }))) {
    const parsed = templateConfigSchema.safeParse(JSON.parse(legacy.config));
    const config = parsed.success ? parsed.data : CAF_TEMPLATE_CONFIG;
    if (/Stage Examination$/.test(config.header.instituteLine)) config.header.instituteLine = CAF_TEMPLATE_CONFIG.header.instituteLine;
    config.header.logo = 'skans';
    const renamed = ['ICAP Exam Style', 'CAF Examination Paper'].includes(legacy.name);
    await tx.paperTemplate.update({
      where: { id: legacy.id },
      data: {
        code: CAF_TEMPLATE.code,
        config: JSON.stringify(config),
        ...(renamed ? { name: CAF_TEMPLATE.name, description: CAF_TEMPLATE.description } : {}),
      },
    });
    console.log('[seed] Renamed the former ICAP_EXAM format to SKANS_CAF and switched it to the SKANS logo.');
  }

  // Apply the approved Audit-paper specification to the CAF format if it still has the earlier defaults.
  const caf = await tx.paperTemplate.findUnique({ where: { code: CAF_TEMPLATE.code } });
  if (caf) {
    const current = templateConfigSchema.safeParse(JSON.parse(caf.config));
    if (current.success && current.data.fonts.body === 'Times' && current.data.page.marginLeftMm === 19) {
      await tx.paperTemplate.update({ where: { id: caf.id }, data: { config: JSON.stringify(CAF_TEMPLATE_CONFIG), name: CAF_TEMPLATE.name, description: CAF_TEMPLATE.description } });
      console.log('[seed] SKANS CAF Examination format updated to the approved specification (Calisto MT, sheet margins and spacing).');
    }
  }

  // The 8 CAF papers: official names and CAF numbers for rows created by earlier versions.
  for (const paper of CA_PAPERS) {
    const row = await tx.subject.findUnique({ where: { code: paper.code } });
    if (row && (row.level === 'CAF' || row.level === '')) {
      await tx.subject.update({ where: { id: row.id }, data: { name: paper.name, level: paper.level, isActive: true } });
    }
  }
  // Subjects from earlier versions that are not CAF papers any more are switched off (never deleted).
  const oldSubjects = await tx.subject.updateMany({ where: { code: { in: LEGACY_SUBJECT_CODES }, isActive: true }, data: { isActive: false } });
  if (oldSubjects.count) console.log(`[seed] ${oldSubjects.count} old subject(s) deactivated (not part of the 8 CAF papers). Reactivate them in Subjects if needed.`);
}

function initialPassword() {
  const fromEnv = process.env.SKANS_ADMIN_PASSWORD;
  if (fromEnv) {
    passwordPolicy.parse(fromEnv);
    return { password: fromEnv, generated: false };
  }
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  const body = Array.from({ length: 10 }, () => chars[randomInt(chars.length)]).join('');
  return { password: `${body}${digits[randomInt(digits.length)]}${digits[randomInt(digits.length)]}`, generated: true };
}

async function bootstrap(tx: Tx) {
  const ensureTemplate = (t: typeof CAF_TEMPLATE, config: unknown) =>
    tx.paperTemplate.upsert({ where: { code: t.code }, update: {}, create: { ...t, config: JSON.stringify(config) } });
  const caf = await ensureTemplate(CAF_TEMPLATE, CAF_TEMPLATE_CONFIG);
  const skans = await ensureTemplate(SKANS_TEMPLATE, SKANS_TEMPLATE_CONFIG);

  for (const subject of CA_PAPERS) {
    await tx.subject.upsert({
      where: { code: subject.code },
      update: {},
      create: { code: subject.code, name: subject.name, level: subject.level, templateId: subject.layout === 'CAF' ? caf.id : skans.id },
    });
  }

  let admin: { username: string; password: string; generated: boolean } | null = null;
  if ((await tx.user.count({ where: { role: 'ADMIN', isActive: true } })) === 0) {
    if (await tx.user.findUnique({ where: { username: 'admin' } })) {
      console.warn('[seed] No active administrator, and the username "admin" is taken. Run: npm run reset-admin -- admin <new-password>');
    } else {
      const { password, generated } = initialPassword();
      await tx.user.create({
        data: { username: 'admin', fullName: 'System Administrator', role: 'ADMIN', mustChangePassword: true, passwordHash: await bcrypt.hash(password, 12) },
      });
      admin = { username: 'admin', password, generated };
    }
  }
  return admin;
}

async function main() {
  if (RESET && process.env.NODE_ENV === 'production' && !FORCE) {
    throw new Error('Refusing to reset a production database. Re-run with --reset --force if you really mean it.');
  }
  const admin = await prisma.$transaction(
    async (tx) => {
      if (RESET) await wipe(tx);
      await migrateLegacy(tx);
      return bootstrap(tx);
    },
    { timeout: 60_000 },
  );
  console.log(`[seed] ${CA_PAPERS.length} CAF papers (CAF 1-8) and 2 SKANS paper formats present.${RESET ? ' All previous data was deleted.' : ''}`);
  if (admin) {
    console.log('[seed] Administrator account created:');
    console.log(`         username: ${admin.username}`);
    console.log(`         password: ${admin.generated ? admin.password : '(value of SKANS_ADMIN_PASSWORD)'}`);
    console.log('         The password must be changed at first sign-in. This is the only time it is shown.');
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
