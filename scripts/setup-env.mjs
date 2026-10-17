// Creates server/.env from server/.env.example on first setup, with a fresh random session secret.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(root, 'server', '.env');
const examplePath = path.join(root, 'server', '.env.example');

if (existsSync(envPath)) {
  console.log('[setup] server/.env already exists - leaving it unchanged.');
} else {
  const secret = randomBytes(48).toString('hex');
  const content = readFileSync(examplePath, 'utf8').replace(
    /^SESSION_SECRET=.*$/m,
    `SESSION_SECRET=${secret}`,
  );
  writeFileSync(envPath, content, { mode: 0o600 });
  console.log('[setup] Created server/.env with a random SESSION_SECRET.');
}
