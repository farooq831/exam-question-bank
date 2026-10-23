/**
 * One-time copy of an old SQLite database (before the move to PostgreSQL) into the PostgreSQL
 * database named by DATABASE_URL:
 *
 *   npm run db:copy-from-sqlite -w server -- prisma/dev.db
 *
 * Safe by design: the SQLite file is opened read-only, and the copy refuses to run unless the
 * PostgreSQL tables are empty (apply migrations first with `npx prisma migrate deploy`).
 * Everything is copied in one transaction with the original ids (users, password hashes,
 * subjects, formats, questions, papers, versions, audit log); sessions are skipped, so everyone
 * simply signs in again. Afterwards the row counts are compared table by table.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Prisma } from '@prisma/client';
import { prisma } from '../src/db';

/** Parents before children, so foreign keys are always satisfied. */
const ORDER = ['PaperTemplate', 'Subject', 'User', 'UserSubject', 'Question', 'Paper', 'PaperItem', 'PaperVersion', 'AuditLog'] as const;

const delegate = (model: string) => (prisma as unknown as Record<string, { createMany(a: { data: unknown[] }): Promise<{ count: number }>; count(): Promise<number> }>)[model.charAt(0).toLowerCase() + model.slice(1)];

async function main() {
  const file = path.resolve(process.argv[2] ?? 'prisma/dev.db');
  if (!existsSync(file)) throw new Error(`SQLite file not found: ${file}`);
  if (!process.env.DATABASE_URL?.startsWith('postgres')) throw new Error('DATABASE_URL must point to PostgreSQL.');
  const sqlite = new DatabaseSync(file, { readOnly: true });

  for (const model of ORDER) {
    if ((await delegate(model).count()) > 0) throw new Error(`PostgreSQL table "${model}" is not empty. The copy only runs into an empty database.`);
  }

  const models = new Map(Prisma.dmmf.datamodel.models.map((m) => [m.name, m]));
  const rowsByModel = new Map<string, Record<string, unknown>[]>();
  for (const model of ORDER) {
    const fields = models.get(model)!.fields.filter((f) => f.kind === 'scalar');
    const rows = sqlite.prepare(`SELECT * FROM "${model}"`).all() as Record<string, unknown>[];
    rowsByModel.set(
      model,
      rows.map((row) => {
        const out: Record<string, unknown> = {};
        for (const f of fields) {
          const v = row[f.name];
          if (v === undefined) continue;
          if (v === null) out[f.name] = null;
          else if (f.type === 'DateTime') out[f.name] = new Date(typeof v === 'number' || typeof v === 'bigint' ? Number(v) : String(v));
          else if (f.type === 'Boolean') out[f.name] = v === 1 || v === true || v === '1' || v === 'true';
          else if (f.type === 'Int') out[f.name] = Number(v);
          else if (f.type === 'Float') out[f.name] = Number(v);
          else out[f.name] = v;
        }
        return out;
      }),
    );
  }

  await prisma.$transaction(
    async (tx) => {
      for (const model of ORDER) {
        const data = rowsByModel.get(model)!;
        const d = (tx as unknown as Record<string, { createMany(a: { data: unknown[] }): Promise<{ count: number }> }>)[model.charAt(0).toLowerCase() + model.slice(1)];
        for (let i = 0; i < data.length; i += 500) await d.createMany({ data: data.slice(i, i + 500) });
        // Ids were copied as they were, so move each id counter past the highest id.
        if (models.get(model)!.fields.some((f) => f.name === 'id' && f.type === 'Int')) {
          await tx.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"${model}"', 'id'), COALESCE((SELECT MAX(id) FROM "${model}"), 0) + 1, false)`);
        }
      }
    },
    { timeout: 120_000 },
  );

  let ok = true;
  for (const model of ORDER) {
    const before = (sqlite.prepare(`SELECT COUNT(*) AS c FROM "${model}"`).get() as { c: number }).c;
    const after = await delegate(model).count();
    if (Number(before) !== after) ok = false;
    console.log(`${model.padEnd(14)} SQLite ${String(before).padStart(5)}   PostgreSQL ${String(after).padStart(5)}   ${Number(before) === after ? 'OK' : 'MISMATCH'}`);
  }
  sqlite.close();
  if (!ok) throw new Error('Row counts differ. Nothing should be used until this is checked.');
  console.log('Copy complete. Everyone signs in again (sessions are not copied).');
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
