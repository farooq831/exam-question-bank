/**
 * Removes demo and test content before going live. Shows what it would remove unless --yes is
 * given; with --yes it first takes a backup (npm run db:backup), then deletes in one transaction.
 *
 *   npm run data:cleanup -- --demo            the demo mock paper and its questions (npm run demo:paper)
 *   npm run data:cleanup -- --all-content     EVERY paper and question (a clean start for go-live)
 *   ... --yes                                 actually delete
 *
 * Users, subjects, the paper format and the audit log are never touched. Deactivate test accounts
 * in Users instead (their history stays in the audit log).
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import type { Prisma } from '@prisma/client';
import { prisma } from '../src/db';
import { audit } from '../src/lib/audit';
import { paths } from '../src/config';
import { DEMO_SOURCE, DEMO_TITLE } from './demo/aae-mock';

async function main() {
  const demo = process.argv.includes('--demo');
  const all = process.argv.includes('--all-content');
  const yes = process.argv.includes('--yes');
  if (demo === all) throw new Error('Choose exactly one: --demo or --all-content (add --yes to delete).');

  const paperWhere: Prisma.PaperWhereInput = demo ? { title: DEMO_TITLE } : {};
  const questionWhere: Prisma.QuestionWhereInput = demo ? { source: DEMO_SOURCE } : {};
  const papers = await prisma.paper.findMany({ where: paperWhere, select: { id: true, title: true, status: true }, orderBy: { id: 'asc' } });
  const questions = await prisma.question.count({ where: questionWhere });
  // Questions still used by papers that stay cannot be removed.
  const blocked = demo
    ? await prisma.question.count({ where: { ...questionWhere, paperItems: { some: { paperId: { notIn: papers.map((p) => p.id) } } } } })
    : 0;

  console.log(`${demo ? 'Demo' : 'All'} content in the database:`);
  for (const p of papers) console.log(`  paper #${p.id} (${p.status}) ${p.title}`);
  console.log(`  ${questions} question(s)${blocked ? `, of which ${blocked} are also used in other papers and will be kept` : ''}`);
  if (!papers.length && !questions) return console.log('Nothing to remove.');
  if (!yes) return console.log('\nNothing was deleted. Run again with --yes to delete (a backup is taken first).');

  const backup = spawnSync(process.execPath, [...process.execArgv, path.join(paths.serverRoot, 'scripts', 'backup-db.ts')], { stdio: 'inherit', env: process.env });
  if (backup.status !== 0) throw new Error('The backup failed, so nothing was deleted.');

  const result = await prisma.$transaction(async (tx) => {
    const p = await tx.paper.deleteMany({ where: { id: { in: papers.map((x) => x.id) } } }); // items and versions go with them
    const q = await tx.question.deleteMany({ where: { ...questionWhere, paperItems: { none: {} } } });
    return { papers: p.count, questions: q.count };
  });
  await audit(null, 'QUESTION_PURGE', 'Cleanup', demo ? 'demo' : 'all-content', result, { id: null, username: 'cleanup-script' });
  console.log(`Deleted ${result.papers} paper(s) and ${result.questions} question(s).`);
}

main()
  .catch((e) => {
    console.error('[cleanup]', e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
