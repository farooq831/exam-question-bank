/**
 * Builds the illustrated User Guide (PDF) with real screenshots of the current version:
 *
 *   npm run docs:guide   -> output/guide/SKANS-Question-Bank-User-Guide.pdf (+ the screenshots)
 *
 * Works on its own temporary PostgreSQL database and server (port 4500): it bootstraps the system,
 * adds the AAE demo paper, signs in as an admin and a teacher, performs the steps the guide
 * describes, takes screenshots, renders the guide with Chromium, then stops the server and drops
 * the database. Nothing touches the development or beta data.
 */
import { spawn, execSync, type ChildProcess } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type Locator, type Page } from 'playwright';
import { createPrismaClient } from '../../src/db';
import { renderGuideHtml, type Shots } from './guide-content';

const here = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.resolve(here, '..', '..');
const outDir = path.resolve(serverDir, '..', 'output', 'guide');
const imgDir = path.join(outDir, 'img');
const PORT = 4500;
const BASE = `http://localhost:${PORT}`;
const DB = `skans_guide_${Date.now()}`;
const ADMIN_FIRST = 'GuideTemp2026x';
const ADMIN_PW = 'GuideAdmin2026x';
const TEACHER_FIRST = 'Welcome2026xx';
const TEACHER_PW = 'GuideTeacher2026';

const baseUrl = process.env.DATABASE_URL ?? '';
if (!baseUrl.startsWith('postgres')) throw new Error('DATABASE_URL must point to PostgreSQL (server/.env).');
const urlFor = (db: string) => {
  const u = new URL(baseUrl);
  u.pathname = `/${db}`;
  return u.toString();
};
const env = {
  ...process.env,
  NODE_ENV: 'development',
  PORT: String(PORT),
  DATABASE_URL: urlFor(DB),
  SESSION_SECRET: 'guide-only-session-secret-not-used-anywhere-else-0123456789',
  CLIENT_ORIGIN: BASE,
  SKANS_ADMIN_PASSWORD: ADMIN_FIRST,
};

const shots: Shots = {};
async function shot(name: string, target: Page | Locator, note = '') {
  const page = ('waitForTimeout' in target ? target : target.page()) as Page;
  // Pop-up messages (toasts) are not part of the screens being explained.
  await page.addStyleTag({ content: '[data-sonner-toaster]{display:none!important}' });
  await page.waitForTimeout(350);
  const buf = await target.screenshot({ type: 'png' });
  writeFileSync(path.join(imgDir, `${name}.png`), buf);
  shots[name] = `data:image/png;base64,${buf.toString('base64')}`;
  console.log(`  screenshot ${name}${note ? ` (${note})` : ''}`);
}

const typeIn = async (page: Page, label: string, text: string) => {
  await page.locator(`[aria-label="${label}"]`).first().click();
  await page.keyboard.type(text);
};
const toast = (page: Page, text: string | RegExp) => page.locator('[data-sonner-toast]').filter({ hasText: text }).first().waitFor({ state: 'attached', timeout: 20_000 });

async function signIn(page: Page, user: string, first: string, own: string, capture = false) {
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState('networkidle');
  if (capture) await shot('login', page);
  await page.getByLabel('Username').fill(user);
  await page.getByLabel('Password', { exact: true }).fill(first);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByLabel('Current password').fill(first);
  await page.getByLabel('New password', { exact: true }).fill(own);
  await page.getByLabel('Confirm new password').fill(own);
  if (capture) await shot('change-password', page);
  await page.getByRole('button', { name: 'Save password' }).click();
  await page.getByText(/Good (morning|afternoon|evening)/).waitFor();
}

async function walkthrough(browser: Browser) {
  const ctx = (w = 1280, h = 820) => browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1.5 });
  const admin = await (await ctx()).newPage();
  const teacher = await (await ctx()).newPage();

  // ---------------- admin creates the teacher
  await signIn(admin, 'admin', ADMIN_FIRST, ADMIN_PW);
  await admin.goto(`${BASE}/admin/users`);
  await admin.getByRole('button', { name: 'Add user' }).click();
  const dlg = admin.getByRole('dialog');
  await dlg.getByLabel('Full name').fill('Ayesha Khan');
  await dlg.getByLabel('Username').fill('ayesha');
  await dlg.getByLabel('Role').selectOption({ label: 'Teacher' });
  await dlg.getByRole('button', { name: 'FAR', exact: true }).click();
  await dlg.getByLabel('Temporary password').fill(TEACHER_FIRST);
  await shot('admin-add-user', dlg);
  await admin.getByRole('button', { name: 'Save' }).click();
  await toast(admin, 'User created');
  await shot('admin-users', admin);

  // ---------------- teacher: sign in, dashboard
  await signIn(teacher, 'ayesha', TEACHER_FIRST, TEACHER_PW, true);
  await shot('teacher-dashboard', teacher);

  // MCQ
  await teacher.goto(`${BASE}/questions?new=1`);
  await teacher.getByRole('radio', { name: /^MCQ/ }).first().click();
  await teacher.getByLabel('Title').fill('Revenue recognition – five-step model');
  await shot('editor-top', teacher.getByRole('dialog'));
  await typeIn(teacher, 'Question text', 'Under IFRS 15, which of the following is the FIRST step in recognising revenue?');
  const opts = ['Identify the contract with the customer', 'Determine the transaction price', 'Identify the performance obligations', 'Recognise revenue when obligations are satisfied'];
  for (const [i, t] of opts.entries()) await typeIn(teacher, `Option ${String.fromCharCode(97 + i)}`, t);
  await teacher.getByRole('dialog').locator('input[type="radio"]').first().check();
  await teacher.locator('[aria-label="Option a"]').scrollIntoViewIfNeeded();
  await shot('editor-mcq-options', teacher.getByRole('dialog'));
  await teacher.getByRole('dialog').getByRole('button', { name: 'Submit' }).click();
  await toast(teacher, 'Submitted for review');

  // Short with amounts table and (I) list
  await teacher.goto(`${BASE}/questions?new=1`);
  await teacher.getByRole('radio', { name: /^Short/ }).click();
  await teacher.getByLabel('Title').fill('Salary income – taxable amount');
  await teacher.getByLabel('Marks', { exact: true }).fill('6');
  await typeIn(teacher, 'Question text', 'Mr. Ali received the following monthly emoluments during the year:');
  await teacher.locator('button[aria-label^="Insert an amounts table"]').first().click();
  const cells = teacher.locator('[aria-label="Question text"] td');
  const rows: [string, string][] = [['Basic salary', '495,000'], ['Medical allowance', '60,000'], ['Dearness allowance', '50,000']];
  for (const [i, [label, amount]] of rows.entries()) {
    await cells.nth(i * 2).click(); await teacher.keyboard.type(label);
    await cells.nth(i * 2 + 1).click(); await teacher.keyboard.type(amount);
  }
  await teacher.locator('[aria-label="Question text"] > p').last().click();
  await teacher.keyboard.type('Consider the following statements:');
  await teacher.keyboard.press('Enter');
  await teacher.locator('button[aria-label^="Numbered list"]').first().click();
  await teacher.locator('button[aria-label="Number the list (I)"]').click();
  await teacher.keyboard.type('Medical allowance is exempt up to 10% of basic salary.');
  await teacher.keyboard.press('Enter');
  await teacher.keyboard.type('Dearness allowance is fully taxable.');
  await teacher.locator('[aria-label="Question text"]').scrollIntoViewIfNeeded();
  await shot('editor-table-list', teacher.locator('.rich-editor').first().locator('..'));
  await typeIn(teacher, 'Model answer', 'Taxable salary = 495,000 + 50,000 = Rs. 545,000 per month (medical allowance exempt).');
  await teacher.locator('[aria-label="Model answer"]').scrollIntoViewIfNeeded();
  await shot('editor-answer-key', teacher.getByRole('dialog'));
  await shot('editor-footer', teacher.getByRole('dialog').locator('button', { hasText: 'Submit' }).locator('xpath=..'));
  await teacher.getByRole('dialog').getByRole('button', { name: 'Submit' }).click();
  await toast(teacher, 'Submitted for review');

  // Long with sub-questions
  await teacher.goto(`${BASE}/questions?new=1`);
  await teacher.getByRole('radio', { name: /^Long/ }).click();
  await teacher.getByLabel('Title').fill('Leases – lessee accounting');
  await typeIn(teacher, 'Question text', 'Bright Foods Limited leased a delivery vehicle on 1 July 2025 for five years.');
  await typeIn(teacher, '(a) text', 'Explain how the lease should be initially recognised.');
  await teacher.getByRole('button', { name: 'Sub-question', exact: true }).click();
  await typeIn(teacher, '(b) text', 'Prepare the extracts for the year ended 30 June 2026:');
  await teacher.getByRole('button', { name: /Part \(b\)\(i\)/ }).click();
  await typeIn(teacher, '(b)(i) text', 'Statement of financial position');
  await teacher.locator('[aria-label="(a) text"]').scrollIntoViewIfNeeded();
  await shot('editor-long', teacher.getByRole('dialog'));
  await teacher.getByRole('dialog').getByRole('button', { name: 'Submit' }).click();
  await toast(teacher, 'Submitted for review');

  // True / False, several statements
  await teacher.goto(`${BASE}/questions?new=1`);
  await teacher.getByRole('radio', { name: /True \/ False/ }).click();
  await teacher.getByLabel('Marks', { exact: true }).fill('1');
  await typeIn(teacher, 'Question text', 'Inventory is measured at the lower of cost and net realisable value.');
  await teacher.getByRole('button', { name: 'Add another statement' }).click();
  await typeIn(teacher, 'Statement 2 text', 'Depreciation increases the carrying amount of an asset.');
  await teacher.getByRole('radiogroup', { name: 'Statement 2 answer' }).getByRole('radio', { name: 'False' }).click();
  await teacher.locator('[aria-label="Statement 2 text"]').scrollIntoViewIfNeeded();
  await shot('editor-true-false', teacher.getByRole('dialog'));
  await teacher.getByRole('button', { name: 'Save draft' }).click();
  await toast(teacher, /saved/i);

  // Window buttons
  await teacher.goto(`${BASE}/questions?new=1`);
  await teacher.getByRole('radio', { name: /^Case study/ }).click();
  await shot('editor-window-buttons', teacher.getByRole('dialog').locator('h2').locator('xpath=../..'));
  await teacher.getByRole('button', { name: 'Cancel' }).click();

  // ---------------- admin reviews
  await admin.goto(`${BASE}/review`);
  await admin.getByText('Revenue recognition', { exact: false }).first().waitFor();
  await admin.waitForTimeout(500);
  await shot('admin-review-queue', admin);
  await admin.locator('.list-row', { hasText: 'Salary income' }).first().getByRole('button', { name: 'Return to author' }).click();
  await admin.getByRole('dialog').locator('textarea').fill('Please state the tax year and the applicable tax rates.');
  await shot('admin-review-return', admin.getByRole('dialog'));
  await admin.getByRole('dialog').getByRole('button', { name: 'Return to author' }).click();
  await admin.getByRole('dialog').waitFor({ state: 'detached' });
  await admin.locator('.list-row', { hasText: 'Revenue recognition' }).first().getByRole('button', { name: 'Approve' }).click();
  await shot('admin-review-approve', admin.getByRole('dialog'));
  await admin.getByRole('dialog').locator('button').filter({ hasText: /^Approve$/ }).last().click();
  await admin.getByRole('dialog').waitFor({ state: 'detached' });

  // ---------------- teacher: list with statuses, returned question, recycle bin
  await teacher.goto(`${BASE}/questions`);
  await teacher.locator('.list-row').first().waitFor();
  await shot('teacher-questions', teacher);
  await teacher.goto(`${BASE}/questions?status=REJECTED`);
  await teacher.getByText('Please state the tax year').first().waitFor();
  await shot('teacher-returned', teacher.locator('.card').first());
  await teacher.goto(`${BASE}/questions?status=DRAFT`);
  await teacher.locator('.list-row').first().getByRole('button', { name: 'Move to recycle bin' }).click();
  await teacher.getByRole('button', { name: 'Move to bin' }).click();
  await toast(teacher, 'Moved to recycle bin');
  await teacher.goto(`${BASE}/questions?deleted=1`);
  await teacher.getByRole('button', { name: 'Restore' }).first().waitFor();
  await shot('teacher-bin', teacher);

  // ---------------- admin builds a paper
  await admin.goto(`${BASE}/papers`);
  await admin.getByText('CAF 8 AAE').first().waitFor();
  await shot('admin-papers', admin);
  await admin.goto(`${BASE}/papers?paper=new`);
  await admin.getByLabel('Title').fill('AAE Mock Test 2');
  const subject = admin.getByLabel('Subject');
  const aae = await subject.locator('option', { hasText: 'AAE' }).first().getAttribute('value');
  await subject.selectOption(aae!);
  await admin.getByLabel('Session').fill('Autumn 2026');
  await admin.getByLabel('Teacher').fill('Ayesha Khan');
  await shot('builder-details', admin);
  await admin.getByRole('button', { name: /^Questions/ }).click();
  for (let i = 0; i < 6; i++) await admin.getByRole('button', { name: 'Add to paper' }).first().click();
  await shot('builder-questions', admin);
  await admin.getByRole('button', { name: 'Preview', exact: true }).click();
  await admin.locator('iframe[title="Paper preview"]').waitFor();
  await admin.waitForTimeout(2500);
  await shot('builder-preview', admin);
  await admin.getByRole('button', { name: 'Close' }).last().click();
  await admin.getByRole('button', { name: 'Save', exact: true }).click();
  await toast(admin, /saved/i);
  await admin.getByRole('button', { name: 'Download', exact: true }).click();
  await shot('builder-download', admin);

  // ---------------- admin: paper format
  await admin.goto(`${BASE}/admin/templates`);
  await admin.getByRole('button', { name: 'Edit' }).first().click();
  await shot('admin-format', admin.getByRole('dialog'));
}

async function main() {
  mkdirSync(imgDir, { recursive: true });
  const maint = createPrismaClient(urlFor('postgres'));
  await maint.$executeRawUnsafe(`CREATE DATABASE "${DB}"`);
  let server: ChildProcess | null = null;
  let browser: Browser | null = null;
  try {
    console.log(`Preparing a temporary system (${DB})...`);
    execSync('npx prisma migrate deploy', { cwd: serverDir, env, stdio: 'pipe' });
    execSync('npx tsx prisma/seed.ts', { cwd: serverDir, env, stdio: 'pipe' });
    execSync('npx tsx scripts/demo-paper.ts', { cwd: serverDir, env, stdio: 'pipe' });
    server = spawn('npx tsx src/index.ts', { cwd: serverDir, env, stdio: 'ignore', shell: true });
    for (let i = 0; i < 60; i++) {
      try { if ((await fetch(`${BASE}/api/health`)).ok) break; } catch { /* starting */ }
      await new Promise((r) => setTimeout(r, 1000));
    }
    browser = await chromium.launch();
    console.log('Taking screenshots...');
    await walkthrough(browser);

    console.log('Rendering the guide...');
    const logo = `data:image/png;base64,${readFileSync(path.resolve(serverDir, '..', 'client', 'public', 'branding', 'skans-logo.png')).toString('base64')}`;
    const html = renderGuideHtml(shots, logo);
    writeFileSync(path.join(outDir, 'guide.html'), html);
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    const file = path.join(outDir, 'SKANS-Question-Bank-User-Guide.pdf');
    await page.pdf({
      path: file,
      format: 'A4',
      printBackground: true,
      margin: { top: '16mm', bottom: '16mm', left: '15mm', right: '15mm' },
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: '<div style="font-family:Segoe UI,Arial,sans-serif;font-size:8px;color:#64748b;width:100%;padding:0 15mm;display:flex;justify-content:space-between"><span>SKANS Question Bank · User Guide (Beta)</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>',
    });
    console.log(`Guide written: ${file}`);
  } finally {
    await browser?.close();
    if (server?.pid) {
      try { execSync(process.platform === 'win32' ? `taskkill /PID ${server.pid} /T /F` : `kill ${server.pid}`, { stdio: 'ignore' }); } catch { /* already stopped */ }
    }
    await maint.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${DB}" WITH (FORCE)`);
    await maint.$disconnect();
  }
}

main().catch((e) => {
  console.error('[guide]', e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
