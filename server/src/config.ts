import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().default(4000),
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters (run npm run setup)'),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  TRUST_PROXY: z.enum(['0', '1']).default('0'),
  MAX_FAILED_LOGINS: z.coerce.number().int().min(3).max(20).default(5),
  LOCKOUT_MINUTES: z.coerce.number().int().min(1).max(1440).default(15),
  SESSION_TTL_MINUTES: z.coerce.number().int().min(5).max(7 * 24 * 60).default(480),
  BRANDING_DIR: z.string().optional(),
  /** Folder with the built website; the browser tests use their own (client/dist-test). */
  CLIENT_DIST: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid server environment configuration:');
  for (const issue of parsed.error.issues) console.error(`  ${issue.path.join('.')}: ${issue.message}`);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
export const paths = {
  serverRoot,
  branding: env.BRANDING_DIR
    ? path.resolve(serverRoot, env.BRANDING_DIR)
    : path.resolve(serverRoot, '..', 'client', 'public', 'branding'),
  clientDist: env.CLIENT_DIST ? path.resolve(serverRoot, env.CLIENT_DIST) : path.resolve(serverRoot, '..', 'client', 'dist'),
};
