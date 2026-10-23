import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

/**
 * Prisma 7 talks to PostgreSQL through the node-postgres driver adapter. The `schema` parameter
 * in DATABASE_URL (a Prisma convention) is passed to the adapter instead of the driver.
 * Scripts and tests use this to open a second connection, e.g. to create a temporary database.
 */
export function createPrismaClient(connectionString = process.env.DATABASE_URL): PrismaClient {
  if (!connectionString) throw new Error('DATABASE_URL is not set.');
  const url = new URL(connectionString);
  const schema = url.searchParams.get('schema') ?? undefined;
  url.searchParams.delete('schema');
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString() }, schema ? { schema } : undefined) });
}

export const prisma = createPrismaClient();
