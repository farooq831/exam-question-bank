import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

// Prisma 7 reads the schema location, migrations, seed command and the database URL used by the
// Prisma CLI (migrate, generate) from this file. The application connects in src/db.ts.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
