// Creates the release package to copy to the SKANS server:
//   npm run release   ->  output/release/skans-question-bank-<date>-<commit>.zip
//
// Only files tracked in git are included (git archive), so the package can never contain
// passwords (.env, .env.beta), databases, backups, logs, node_modules, build output or the
// ICAP reference papers in samples/. Commit your changes first: uncommitted edits are NOT included.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();

const dirty = git('status', '--porcelain', '--untracked-files=no');
if (dirty) {
  console.warn('[release] WARNING: these changes are not committed and will NOT be in the package:\n' + dirty);
}
const commit = git('rev-parse', '--short', 'HEAD');
const date = git('log', '-1', '--format=%cd', '--date=format:%Y%m%d');
const name = `skans-question-bank-${date}-${commit}`;
const outDir = path.join(root, 'output', 'release');
mkdirSync(outDir, { recursive: true });
const zip = path.join(outDir, `${name}.zip`);

git('archive', '--format=zip', `--prefix=${name}/`, '-o', zip, 'HEAD');

const files = git('ls-tree', '-r', '--name-only', 'HEAD').split('\n');
for (const forbidden of [/(^|\/)\.env$/, /\.env\.beta$/, /\.db$/, /(^|\/)backups/, /^samples\//, /node_modules\//]) {
  const hit = files.find((f) => forbidden.test(f));
  if (hit) throw new Error(`[release] refusing: ${hit} must not be in the package`);
}
const bytes = readFileSync(zip);
const sha256 = createHash('sha256').update(bytes).digest('hex');
writeFileSync(`${zip}.sha256`, `${sha256}  ${path.basename(zip)}\n`);
console.log(`[release] ${zip}`);
console.log(`[release] ${files.length} files, ${(statSync(zip).size / 1024 / 1024).toFixed(1)} MB, commit ${commit}`);
console.log(`[release] SHA-256 ${sha256}`);
