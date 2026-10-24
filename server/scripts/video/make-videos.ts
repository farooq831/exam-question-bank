/**
 * Records the tutorial videos (Teacher guide, Admin guide) from the real app, with subtitles and chapters:
 *
 *   npm run docs:videos              both videos
 *   npm run docs:videos -- teacher   only the teacher video (or: admin)
 *   npm run docs:videos -- shots     only the README screenshots (docs/media/screenshots)
 *
 * Output in output/video/: <name>.mp4 (H.264, chapter markers, subtitle track), <name>.srt and
 * <name>-chapters.txt (timeline to paste into a message or a YouTube description).
 * Works on its own temporary PostgreSQL database and server (port 4800); nothing else is touched.
 * Needs FFmpeg (winget install Gyan.FFmpeg) and the built client in client/dist-test.
 */
import { execSync, spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type Page } from 'playwright';
import { createPrismaClient } from '../../src/db';
import { Lesson, durationMs, overlayScript, toMp4 } from './video-kit';

const here = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.resolve(here, '..', '..');
const root = path.resolve(serverDir, '..');
const outDir = path.join(root, 'output', 'video');
const PORT = Number(process.env.VIDEO_PORT ?? 4800);
const BASE = `http://localhost:${PORT}`;
const DB = `skans_video_${Date.now()}`;
const ADMIN_FIRST = 'VideoTemp2026x';
const ADMIN_PW = 'VideoAdmin2026x';
const TEMP_PW = 'Welcome2026xx';
const TEACHER_PW = 'AyeshaOwn2026';
const which = process.argv[2] ?? 'all';

const findExe = (name: string) => {
  try { return execSync(`where ${name}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split(/\r?\n/)[0].trim(); } catch { /* not on PATH */ }
  const pkgs = path.join(process.env.LOCALAPPDATA ?? '', 'Microsoft', 'WinGet', 'Packages');
  const hit = execSync(`dir /s /b "${pkgs}\\${name}.exe"`, { encoding: 'utf8', shell: 'cmd.exe' }).split(/\r?\n/)[0].trim();
  if (!hit) throw new Error(`${name} not found. Install FFmpeg: winget install Gyan.FFmpeg`);
  return hit;
};

const baseUrl = process.env.DATABASE_URL ?? '';
const urlFor = (db: string) => { const u = new URL(baseUrl); u.pathname = `/${db}`; return u.toString(); };
const env = { ...process.env, NODE_ENV: 'development', PORT: String(PORT), DATABASE_URL: urlFor(DB), CLIENT_DIST: '../client/dist-test', SESSION_SECRET: 'video-only-session-secret-not-used-anywhere-else-0123456789', CLIENT_ORIGIN: BASE, SKANS_ADMIN_PASSWORD: ADMIN_FIRST };

const toast = (p: Page, text: string | RegExp) => p.locator('[data-sonner-toast]').filter({ hasText: text }).first().waitFor({ state: 'attached', timeout: 30_000 });

// ------------------------------------------------------------------ off-camera helper (admin in a hidden browser)
async function api(p: Page, method: string, url: string, body?: unknown) {
  return p.evaluate(async ([m, u, b]) => {
    const me = await (await fetch('/api/auth/me')).json();
    const r = await fetch('/api' + u, { method: m as string, headers: { 'content-type': 'application/json', 'x-csrf-token': me.csrfToken }, body: b === undefined ? undefined : JSON.stringify(b) });
    return { status: r.status, data: await r.json().catch(() => null) };
  }, [method, url, body] as const);
}
async function hiddenSignIn(browser: Browser, user: string, first: string, own?: string) {
  const p = await (await browser.newContext()).newPage();
  await p.goto(`${BASE}/login`);
  await p.getByLabel('Username').fill(user);
  await p.getByLabel('Password', { exact: true }).fill(first);
  await p.getByRole('button', { name: 'Sign in' }).click();
  if (own) {
    await p.getByLabel('Current password').fill(first);
    await p.getByLabel('New password', { exact: true }).fill(own);
    await p.getByLabel('Confirm new password').fill(own);
    await p.getByRole('button', { name: 'Save password' }).click();
  }
  await p.getByText(/Good (morning|afternoon|evening)/).waitFor();
  return p;
}

async function record(browser: Browser, logo: string, name: string, file: string, script: (L: Lesson) => Promise<void>) {
  const tmp = path.join(outDir, 'tmp');
  mkdirSync(tmp, { recursive: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: tmp, size: { width: 1280, height: 720 } }, acceptDownloads: true });
  await ctx.addInitScript(overlayScript(logo));
  const page = await ctx.newPage();
  const L = new Lesson(page, name);
  L.start();
  try {
    await script(L);
  } catch (e) {
    await page.screenshot({ path: path.join(outDir, `${file}-FAILED.png`) }).catch(() => {});
    throw e;
  } finally {
    L.finish();
    await ctx.close();
  }
  const webm = await page.video()!.path();
  const ffmpeg = findExe('ffmpeg'), ffprobe = findExe('ffprobe');
  const dur = durationMs(ffprobe, webm);
  const srt = path.join(outDir, `${file}.srt`);
  const meta = path.join(tmp, `${file}.ffmeta`);
  writeFileSync(meta, L.writeFiles(srt, path.join(outDir, `${file}-chapters.txt`), dur), 'utf8');
  const mp4 = path.join(outDir, `${file}.mp4`);
  toMp4(ffmpeg, webm, meta, srt, mp4);
  console.log(`  ${mp4} (${Math.round(dur / 60000)} min ${Math.round((dur % 60000) / 1000)} s, ${L.chapters.length} chapters)`);
}

// ================================================================== TEACHER
async function teacherLesson(L: Lesson, adminHidden: Page) {
  const p = L.page;
  const dlg = () => p.getByRole('dialog');
  const newQ = async (type: RegExp) => { await p.goto(`${BASE}/questions?new=1`); await L.click(dlg().getByRole('radio', { name: type }).first()); };
  await p.goto(`${BASE}/login`);
  await L.card('SKANS Question Bank', 'Teacher Guide', 'Writing exam questions, step by step · for teachers and Research Officers', 6500);
  await L.say('Welcome! In this video you will learn everything a teacher does in the SKANS Question Bank.');
  await L.say('We will sign in, write every type of question, add tables and answers, and send questions for review.');
  await L.say('Research Officers use exactly the same screens, so this video is for you too. Let us begin.');

  // 1 ------------------------------------------------------------
  await L.chapter('Signing in for the first time', 'Your username, the temporary password and your own password');
  await L.say('Open the link you received. Type the username the administrator gave you.');
  await L.type(p.getByLabel('Username'), 'ayesha');
  await L.say('Now type the temporary password from the administrator.');
  await L.type(p.getByLabel('Password', { exact: true }), TEMP_PW);
  await L.say('Not sure what you typed? Click the eye icon to show the password.');
  await L.click(p.getByRole('button', { name: 'Show password' }).first());
  await L.say('Click the eye again to hide it. Then click Sign in.');
  await L.click(p.getByRole('button', { name: 'Hide password' }).first());
  await L.click(p.getByRole('button', { name: 'Sign in' }));
  await p.getByLabel('Current password').waitFor();
  await L.say('The first time, the system asks you to choose your own password. Type the temporary password here.');
  await L.type(p.getByLabel('Current password'), TEMP_PW);
  await L.say('Now choose a new password: at least 10 characters, with letters and a number. Type it twice.');
  await L.type(p.getByLabel('New password', { exact: true }), TEACHER_PW);
  await L.type(p.getByLabel('Confirm new password'), TEACHER_PW);
  await L.say('Click Save password.');
  await L.click(p.getByRole('button', { name: 'Save password' }));
  await p.getByText(/Good (morning|afternoon|evening)/).waitFor();
  await L.say('Done! From now on you sign in with your own password. Never share it with anyone.');

  // 2 ------------------------------------------------------------
  await L.chapter('Your dashboard', 'The home page and the menu');
  await L.say('This is your dashboard, your home page. The menu on the left has two pages: Dashboard and Questions.');
  await L.point(p.getByRole('link', { name: 'Questions', exact: true }));
  await L.say('The big blue card is the quickest way to write a new question.');
  await L.point(p.getByText('Write a new question'));
  await L.say('These four tiles count your drafts, questions waiting for review, questions returned to you, and approved questions.');
  for (const t of ['My drafts', 'In review', 'Returned to me']) await L.point(p.getByText(t, { exact: true }), 500);
  await L.say('Click any tile to open that list. Below, Recent activity shows what happened last.');

  // 3 ------------------------------------------------------------
  await L.chapter('Starting a new question', 'Question types, subject, difficulty, marks and title');
  await L.click(p.getByText('Write a new question'));
  await L.say('The question editor opens. At the top you choose the type of question. There are six types.');
  const tiles: [RegExp, string][] = [
    [/^MCQ/, 'MCQ: one multiple-choice question with options (a) to (d).'],
    [/MCQ set/, 'MCQ set: several MCQs that belong together, numbered (i), (ii), (iii).'],
    [/True \/ False/, 'True / False: one or more statements, each true or false.'],
    [/^Short/, 'Short: a question with one written answer.'],
    [/^Long/, 'Long: a question with sub-questions (a), (b), (c) and parts inside them.'],
    [/^Case study/, 'Case study: a scenario followed by sub-questions.'],
  ];
  for (const [re, text] of tiles) { await L.point(dlg().getByRole('radio', { name: re }).first(), 200); await L.say(text); }
  await L.say('Below the tiles: choose the subject, the difficulty, and the marks the question is worth.');
  await L.point(dlg().getByLabel('Subject'));
  await L.point(dlg().getByLabel('Difficulty'));
  await L.point(dlg().getByLabel('Marks', { exact: true }));
  await L.say('The Title is a short name for the question. The reviewer sees it in lists, so make it clear.');
  await L.point(dlg().getByLabel('Title'));

  // 4 ------------------------------------------------------------
  await L.chapter('Writing an MCQ', 'One question with options (a) to (d)');
  await L.say('Click the MCQ tile, give the question a title and set the marks.');
  await L.click(dlg().getByRole('radio', { name: /^MCQ/ }).first());
  await L.fill(dlg().getByLabel('Title'), 'Revenue recognition - first step');
  await L.fill(dlg().getByLabel('Marks', { exact: true }), '1');
  await L.say('Type the question in the Question box.');
  await L.type(p.locator('[aria-label="Question text"]'), 'Under IFRS 15, which of the following is the FIRST step in recognising revenue?');
  await L.say('Now type the four options, (a) to (d).');
  const opts = ['Identify the contract with the customer', 'Determine the transaction price', 'Identify the performance obligations', 'Recognise revenue when obligations are satisfied'];
  for (const [i, t] of opts.entries()) await L.type(p.locator(`[aria-label="Option ${String.fromCharCode(97 + i)}"]`), t, 18);
  await L.say('Mark the correct answer: click the round button next to it. The correct option turns green.');
  await L.click(dlg().locator('input[type="radio"]').nth(0));
  await L.say('Need a fifth option? Click Option. Up to six options are allowed. The bin icon removes an option.');
  await L.click(dlg().getByRole('button', { name: 'Option', exact: true }));
  await L.click(dlg().getByRole('button', { name: 'Remove option' }).last());
  await L.say('Print layout decides how the options are printed: one per line, in two columns or in four. Auto chooses for you.');
  await L.point(dlg().getByLabel('Print layout'));
  await L.say('Further down is the Answer key. Explain why the answer is correct. This prints only in the answer key, never on the question paper.');
  await L.type(p.locator('[aria-label="Model answer"]'), 'Step 1 of the five-step model is to identify the contract with the customer.', 18);
  await L.say('The question is ready. Click Submit to send it to the administrator for review.');
  await L.click(dlg().getByRole('button', { name: 'Submit' }));
  await toast(p, 'Submitted for review');
  await L.say('A green message confirms it. While a question is in review, it cannot be changed.');

  // 5 ------------------------------------------------------------
  await L.chapter('Writing an MCQ set', 'Several MCQs that belong together');
  await L.say('Use an MCQ set when several MCQs share one scenario. Click the MCQ set tile.');
  await newQ(/MCQ set/);
  await L.fill(dlg().getByLabel('Title'), 'Hilltop Traders - audit planning MCQs');
  await L.say('In the Question box, write the shared introduction for all the MCQs in the set.');
  await L.type(p.locator('[aria-label="Question text"]'), 'Questions (i) and (ii) relate to Hilltop Traders Limited, a new audit client.');
  await L.say('Item (i): type its question and options, and mark the correct one.');
  await L.type(p.locator('[aria-label="MCQ 1 text"]'), 'Before accepting the engagement, the auditor should first:');
  const so = dlg().locator('[aria-label^="Option "]');
  const first = ['Contact the previous auditor', 'Issue the audit report', 'Count the inventory', 'Sign the financial statements'];
  for (let i = 0; i < 4; i++) await L.type(so.nth(i), first[i], 15);
  await L.click(dlg().locator('input[type="radio"]').nth(0));
  await L.say('Click MCQ to add item (ii). You can add up to forty items in one set.');
  await L.click(dlg().getByRole('button', { name: 'MCQ', exact: true }));
  await L.type(p.locator('[aria-label="MCQ 2 text"]'), 'Materiality is best described as:');
  const second = ['A fixed amount set by law', 'The amount that could influence users’ decisions', 'The total of all errors', 'The audit fee'];
  for (let i = 0; i < 4; i++) await L.type(so.nth(4 + i), second[i], 15);
  await L.click(dlg().locator('input[type="radio"]').nth(5));
  await L.say('Each item has its own marks box. The total marks are added up for you automatically. Look at the bottom left.');
  await L.point(p.getByText(/marks$/).last());
  await L.click(dlg().getByRole('button', { name: 'Submit' }));
  await toast(p, 'Submitted for review');

  // 6 ------------------------------------------------------------
  await L.chapter('True / False statements', 'One statement, or several at once');
  await newQ(/True \/ False/);
  await L.say('For True or False, type the statement and choose True or False as the correct answer.');
  await L.fill(dlg().getByLabel('Marks', { exact: true }), '1');
  await L.type(p.locator('[aria-label="Question text"]'), 'Inventory is measured at the lower of cost and net realisable value.');
  await L.click(dlg().getByRole('radiogroup').getByRole('radio', { name: 'True' }).first());
  await L.say('Have more statements? Click Add another statement. Each one gets its own True or False.');
  await L.click(dlg().getByRole('button', { name: 'Add another statement' }));
  await L.type(p.locator('[aria-label="Statement 2 text"]'), 'Depreciation increases the carrying amount of an asset.');
  await L.click(dlg().getByRole('radiogroup', { name: 'Statement 2 answer' }).getByRole('radio', { name: 'False' }));
  await L.say('Each statement is saved as its own question, so it can be reviewed and used in papers separately.');
  await L.click(dlg().getByRole('button', { name: 'Submit' }));
  await toast(p, /True \/ False questions submitted/);

  // 7 ------------------------------------------------------------
  await L.chapter('Text tools', 'Bold, italic, underline, lists and numbering');
  await newQ(/^Short/);
  await L.fill(dlg().getByLabel('Title'), 'Salary income - taxable amount');
  await L.fill(dlg().getByLabel('Marks', { exact: true }), '6');
  await L.say('Above every text box is a toolbar, like in Word. Click Bold, type, then click Bold again to stop.');
  const qbox = p.locator('[aria-label="Question text"]');
  await L.click(qbox);
  await p.keyboard.type('Mr. Ali is employed by ', { delay: 25 });
  await L.click(dlg().getByRole('button', { name: 'Bold' }).first());
  await p.keyboard.type('United Enterprises Limited', { delay: 25 });
  await L.click(dlg().getByRole('button', { name: 'Bold' }).first());
  await p.keyboard.type('. ', { delay: 25 });
  await L.say('Italic and Underline work the same way.');
  await L.click(dlg().getByRole('button', { name: 'Italic' }).first());
  await p.keyboard.type('Tax year 2026', { delay: 25 });
  await L.click(dlg().getByRole('button', { name: 'Italic' }).first());
  await p.keyboard.press('Enter');
  await L.say('Numbered list: click it, then choose the style. (I), (II) is used for statements like "Consider the following".');
  await p.keyboard.type('Consider the following statements:', { delay: 22 });
  await p.keyboard.press('Enter');
  await L.click(dlg().locator('button[aria-label^="Numbered list"]').first());
  await L.say('The style buttons appear next to it: small roman (i), capital roman (I), letters (a), (A), or numbers (1).');
  await L.click(dlg().locator('button[aria-label="Number the list (I)"]'));
  await p.keyboard.type('Medical allowance is exempt up to 10% of basic salary.', { delay: 18 });
  await p.keyboard.press('Enter');
  await p.keyboard.type('Dearness allowance is fully taxable.', { delay: 18 });
  await p.keyboard.press('Enter');
  await p.keyboard.press('Enter');
  await L.say('Press Enter twice to end the list. The alignment buttons place text left, centre or right.');
  await L.point(dlg().getByRole('button', { name: 'Centre' }).first());

  // 8 ------------------------------------------------------------
  await L.chapter('Tables and amounts tables', 'Figures laid out like the ICAP papers');
  await L.say('Amounts table inserts the usual layout: labels on the left, figures on the right under Rupees.');
  await p.keyboard.type('He received the following monthly emoluments:', { delay: 18 });
  await L.click(dlg().locator('button[aria-label^="Insert an amounts table"]').first());
  const cells = qbox.locator('td');
  const rows: [string, string][] = [['Basic salary', '495,000'], ['Medical allowance', '60,000'], ['Dearness allowance', '50,000']];
  await L.say('Click a cell and type. The figures line up on the right automatically.');
  for (const [i, [a, b]] of rows.entries()) { await L.type(cells.nth(i * 2), a, 18); await L.type(cells.nth(i * 2 + 1), b, 25); }
  await L.say('When you are inside a table, more buttons appear: add or delete rows and columns, merge cells, header row, No border.');
  await L.click(dlg().getByRole('button', { name: 'Add row below' }));
  await L.type(cells.nth(6), 'Conveyance allowance', 18);
  await L.type(cells.nth(7), '25,000', 25);
  await L.say('The empty corner at the top left has no border, like the ICAP papers. No border can remove the lines of any cell.');
  await L.point(dlg().locator('button[aria-label^="Remove the borders"]'));
  await L.say('To merge cells, drag across them and click Merge. Text below starts a new line under the table.');
  await L.point(dlg().getByRole('button', { name: /Merge/ }));
  await L.click(dlg().locator('button[aria-label="Start a new line of text below this table"]'));
  await p.keyboard.type('Required: Compute the taxable salary of Mr. Ali for tax year 2026.', { delay: 18 });
  await L.say('The normal Table button inserts a plain 3 by 3 table. The question mark button explains all table tools.');
  await L.point(dlg().getByRole('button', { name: 'How tables work' }).first());
  await L.say('This question is not finished yet, so click Save draft. Drafts are only visible to you.');
  await L.click(dlg().getByRole('button', { name: 'Save draft' }));
  await toast(p, /saved/i);

  // 9 ------------------------------------------------------------
  await L.chapter('Long questions with sub-questions', 'Sub-questions (a), (b) and parts (i), (ii)');
  await newQ(/^Long/);
  await L.fill(dlg().getByLabel('Title'), 'Leases - lessee accounting');
  await L.say('Type the scenario in the Question box. Then write each sub-question below it.');
  await L.type(qbox, 'Bright Foods Limited leased a delivery vehicle on 1 July 2025 for five years.', 18);
  await L.type(p.locator('[aria-label="(a) text"]'), 'Explain how the lease should be recognised at the start.', 18);
  await L.say('Each sub-question has its own marks box. Here, (a) is worth 4 marks.');
  await L.fill(dlg().getByLabel('Marks', { exact: true }).nth(1), '4');
  await L.say('Click Sub-question to add (b).');
  await L.click(dlg().getByRole('button', { name: 'Sub-question', exact: true }));
  await L.type(p.locator('[aria-label="(b) text"]'), 'Prepare extracts for the year ended 30 June 2026:', 18);
  await L.say('Inside a sub-question you can add parts: click Part (b)(i).');
  await L.click(dlg().getByRole('button', { name: /Part \(b\)\(i\)/ }));
  await L.type(p.locator('[aria-label="(b)(i) text"]'), 'Statement of financial position', 18);
  await L.click(dlg().getByRole('button', { name: /Part \(b\)\(ii\)/ }));
  await L.type(p.locator('[aria-label="(b)(ii) text"]'), 'Statement of profit or loss', 18);
  await L.say('The total marks are added up from the parts automatically. Numbering lets you choose (a), (i) or (1) for sub-questions.');
  await L.point(dlg().getByLabel('Numbering'));
  await L.say('Under each part, click Answer to write its model answer. It prints only in the answer key.');
  await L.click(dlg().getByText('Answer', { exact: true }).first());
  await L.type(p.locator('[aria-label="(a) answer"]'), 'Recognise a right-of-use asset and a lease liability at the present value of lease payments.', 15);
  await L.click(dlg().getByRole('button', { name: 'Submit' }));
  await toast(p, 'Submitted for review');

  // 10 -----------------------------------------------------------
  await L.chapter('Case studies', 'A scenario with sub-questions');
  await newQ(/^Case study/);
  await L.fill(dlg().getByLabel('Title'), 'Metro Logistics - planning risks');
  await L.say('A case study works like a long question: a scenario first, then sub-questions with marks.');
  await L.type(qbox, 'Metro Logistics Limited provides transport services. Revenue grew by 27% and a new bonus scheme rewards managers for revenue growth.', 12);
  await L.type(p.locator('[aria-label="(a) text"]'), 'Identify and explain two risks of material misstatement.', 15);
  await L.fill(dlg().getByLabel('Marks', { exact: true }).nth(1), '6');
  await L.click(dlg().getByRole('button', { name: 'Submit' }));
  await toast(p, 'Submitted for review');

  // 11 -----------------------------------------------------------
  await L.chapter('Answer key and private notes', 'What prints in the answer key, and what never prints');
  await p.goto(`${BASE}/questions?status=DRAFT`);
  await L.say('Let us finish the draft from before. In Questions, choose Drafts and click Edit.');
  await L.click(p.locator('.list-row', { hasText: 'Salary income' }).getByRole('button', { name: 'Edit' }));
  await L.say('Scroll to the Answer key. Model answer and Examiner’s advice print only in the answer key.');
  await L.type(p.locator('[aria-label="Model answer"]'), 'Taxable salary = 495,000 + 50,000 + 25,000 = Rs. 570,000 per month.', 15);
  await L.type(p.locator('[aria-label="Examiner\'s advice"]'), 'Award one mark for each allowance treated correctly.', 15);
  await L.say('Private notes are for you and the reviewer only. They never print. Use them for the source and comments.');
  await L.click(dlg().getByText('Private notes'));
  await L.type(dlg().getByLabel('Source'), 'Spring 2026 mock, Q3', 20);
  await L.say('Click Submit when the question is complete.');
  await L.click(dlg().getByRole('button', { name: 'Submit' }));
  await toast(p, 'Submitted for review');

  // 12 -----------------------------------------------------------
  await L.chapter('The editor window', 'Minimise, maximise and close');
  await p.goto(`${BASE}/questions?new=1`);
  await L.click(dlg().getByRole('radio', { name: /^Short/ }));
  await L.type(qbox, 'A question I will finish later...', 25);
  await L.say('The buttons at the top right work like Windows. Maximise makes the editor full screen.');
  await L.click(p.getByRole('button', { name: 'Maximise' }));
  await L.say('Restore down makes it normal size again.');
  await L.click(p.getByRole('button', { name: 'Restore down' }));
  await L.say('Minimise hides the editor in a bar at the bottom, so you can look at something else. Your text is kept.');
  await L.click(p.getByRole('button', { name: 'Minimise' }));
  await L.say('Click the bar to bring the editor back.');
  await L.click(p.getByRole('region', { name: 'Minimised window' }).getByRole('button', { name: 'Restore' }).last());
  await L.say('Cancel or the cross closes the editor without saving.');
  await L.click(dlg().getByRole('button', { name: 'Cancel' }));

  // 13 -----------------------------------------------------------
  await L.chapter('Your questions list', 'Statuses, search and filters');
  await p.goto(`${BASE}/questions`);
  await L.say('The Questions page lists your questions. Each one shows its status on the right.');
  await L.say('Draft: not sent yet. In review: waiting for the administrator. Returned: changes requested. Approved: ready for papers.');
  for (const c of ['Drafts', 'In review', 'Approved', 'Returned', 'All']) await L.click(p.getByRole('button', { name: c, exact: true }), 450);
  await L.say('Type in the search box to find questions by words in the title or text.');
  await L.type(p.getByPlaceholder('Search questions'), 'revenue', 60);
  await L.wait(900);
  await L.fill(p.getByPlaceholder('Search questions'), '');
  await L.say('You can also filter by subject and by question type.');
  await L.point(p.getByLabel('Subject'));
  await L.point(p.getByLabel('Type'));
  await L.say('Click a title to preview the question exactly as written.');
  await L.click(p.locator('.list-row').first().locator('button').first());
  await L.wait(1500);
  await L.click(p.getByRole('dialog').getByRole('button', { name: 'Close' }));

  // 14 -----------------------------------------------------------
  await L.chapter('Duplicate and the recycle bin', 'Copying, deleting and restoring questions');
  await L.say('Duplicate makes a copy as a new draft. It is handy for writing a similar question.');
  await L.click(p.locator('.list-row', { hasText: 'Revenue recognition' }).getByRole('button', { name: 'Duplicate' }));
  await toast(p, 'Copied as a new draft');
  await L.say('The bin icon moves a question to the Recycle bin. Approved questions cannot be deleted by teachers.');
  await L.click(p.locator('.list-row').first().getByRole('button', { name: 'Move to recycle bin' }));
  await L.click(p.getByRole('button', { name: 'Move to bin' }));
  await toast(p, 'Moved to recycle bin');
  await L.say('Open the Recycle bin to see deleted questions.');
  await L.click(p.getByRole('button', { name: 'Recycle bin' }));
  await L.say('Restore brings a question back. Delete permanently removes it for ever. It cannot be undone.');
  await L.point(p.getByRole('button', { name: 'Restore' }).first());
  await L.click(p.getByRole('button', { name: 'Delete permanently' }).first());
  await L.say('You are always asked to confirm.');
  await L.click(p.getByRole('dialog').getByRole('button', { name: 'Delete' }));
  await toast(p, 'Deleted permanently');
  await L.click(p.getByRole('button', { name: 'Back to questions' }));

  // 15 -----------------------------------------------------------
  // Off camera: the administrator returns the MCQ set with a comment.
  const set = (await api(adminHidden, 'GET', '/questions?status=SUBMITTED&pageSize=50')).data.items.find((q: { topic: string }) => q.topic.startsWith('Hilltop'));
  await api(adminHidden, 'POST', `/questions/${set.id}/review`, { decision: 'REJECT', comment: 'Please add a third MCQ about audit risk.' });
  await L.chapter('When a question is returned', 'Reading the comment, fixing and submitting again');
  await p.goto(`${BASE}/`);
  await L.say('Sometimes the reviewer asks for changes. The tile Returned to me shows how many.');
  await L.click(p.getByText('Returned to me', { exact: true }));
  await L.say('The reviewer’s comment is shown under the question in red. Read it, then click Edit.');
  await L.point(p.getByText('Please add a third MCQ').first(), 1200);
  await L.click(p.locator('.list-row', { hasText: 'Hilltop' }).getByRole('button', { name: 'Edit' }));
  await L.say('The comment is also shown at the top of the editor. Make the change...');
  await L.click(dlg().getByRole('button', { name: 'MCQ', exact: true }));
  await L.type(p.locator('[aria-label="MCQ 3 text"]'), 'Audit risk is the risk that the auditor:', 18);
  const third = ['Gives an inappropriate opinion', 'Loses the client', 'Charges a low fee', 'Misses a deadline'];
  for (let i = 0; i < 4; i++) await L.type(so.nth(8 + i), third[i], 12);
  await L.click(dlg().locator('input[type="radio"]').nth(8));
  await L.say('...and click Submit again. The question goes back to the reviewer.');
  await L.click(dlg().getByRole('button', { name: 'Submit' }));
  await toast(p, 'Submitted for review');

  // 16 -----------------------------------------------------------
  await L.chapter('Your account', 'Changing your password and signing out');
  await p.goto(`${BASE}/`);
  await L.say('At the bottom left you see your name. The key icon changes your password at any time.');
  await L.click(p.getByRole('link', { name: 'Change password', exact: true }));
  await L.say('Type your current password and the new one twice, then Save password. Forgot your password? Ask the administrator.');
  await L.point(p.getByLabel('Current password'), 1500);
  await L.click(p.getByRole('link', { name: 'Dashboard', exact: true }));
  await L.say('When you finish, click the sign-out icon, especially on a shared computer.');
  await L.click(p.getByRole('button', { name: 'Sign out' }));
  await p.getByLabel('Username').waitFor();
  await L.card('That is everything!', 'You are ready to write questions', 'Questions? Ask your administrator. Thank you for helping build the SKANS Question Bank.', 7000);
}

// ================================================================== ADMIN
async function adminLesson(L: Lesson, browser: Browser) {
  const p = L.page;
  const dlg = () => p.getByRole('dialog');
  // Off camera: a locked account for the Unlock demonstration.
  const anon = await (await browser.newContext()).newPage();
  await anon.goto(`${BASE}/login`);
  await anon.evaluate(async () => {
    const csrf = (await (await fetch('/api/auth/csrf')).json()).csrfToken;
    for (let i = 0; i < 5; i++) await fetch('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json', 'x-csrf-token': csrf }, body: JSON.stringify({ username: 'tariq', password: 'wrong-password-1' }) });
  });

  await p.goto(`${BASE}/login`);
  await L.card('SKANS Question Bank', 'Administrator Guide', 'Users, reviewing questions, building papers, PDFs, paper format and the audit log', 6500);
  await L.say('Welcome! This video shows everything an administrator does in the SKANS Question Bank.');
  await L.say('Teachers write questions; you manage users, review questions, build exam papers and download the PDFs.');

  // 1 ------------------------------------------------------------
  await L.chapter('Signing in and the admin dashboard', 'Your overview');
  await L.say('Sign in with your username and password. The first time, you choose your own password, exactly like teachers.');
  await L.type(p.getByLabel('Username'), 'admin');
  await L.type(p.getByLabel('Password', { exact: true }), ADMIN_PW, 35);
  await L.click(p.getByRole('button', { name: 'Sign in' }));
  await p.getByText(/Good (morning|afternoon|evening)/).waitFor();
  await L.say('As an administrator you see more in the menu: Review, Papers, Users, Subjects, Paper format and Audit log.');
  for (const n of ['Review', 'Papers', 'Users', 'Subjects', 'Paper format', 'Audit log']) await L.point(p.getByRole('link', { name: n, exact: true }), 300);
  await L.say('The tiles show questions waiting for review, approved questions, drafts and papers. New question and New paper are at the top.');
  await L.point(p.getByText('Waiting for review'));
  await L.say('Recent papers, recent activity and a table of questions per subject complete the overview.');

  // 2 ------------------------------------------------------------
  await L.chapter('Managing users', 'Adding teachers, Research Officers and administrators');
  await L.click(p.getByRole('link', { name: 'Users', exact: true }));
  await L.say('Users lists everyone. Use the buttons to show only admins, teachers, Research Officers or inactive accounts.');
  for (const c of ['Teachers', 'Research officers', 'All']) await L.click(p.getByRole('button', { name: c, exact: true }), 450);
  await L.say('To add someone, click Add user.');
  await L.click(p.getByRole('button', { name: 'Add user' }));
  await L.say('Type the full name and a username: small letters and numbers, for example sara.ahmed.');
  await L.type(dlg().getByLabel('Full name'), 'Sara Ahmed');
  await L.type(dlg().getByLabel('Username'), 'sara.ahmed');
  await L.say('Choose the role: Teacher, Research Officer or Administrator.');
  await L.point(dlg().getByLabel('Role'));
  await dlg().getByLabel('Role').selectOption({ label: 'Teacher' });
  await L.say('Tick the subjects this person may write for. Teachers only see their own subjects.');
  await L.click(dlg().getByRole('button', { name: 'FAR', exact: true }));
  await L.click(dlg().getByRole('button', { name: 'CR', exact: true }));
  await L.say('Give a temporary password. Send it to the person; they must choose their own at the first sign-in.');
  await L.type(dlg().getByLabel('Temporary password'), 'Welcome2026sa');
  await L.click(dlg().getByRole('button', { name: 'Save' }));
  await toast(p, 'User created');
  await L.say('Each row has buttons. The pencil edits name, role, subjects or Active.');
  const row = (name: string) => p.locator('.list-row', { hasText: name }).first();
  await L.point(row('Sara Ahmed').getByRole('button', { name: 'Edit' }));
  await L.say('The key resets a forgotten password: a new temporary password appears. Copy it and send it to the person.');
  await L.click(row('Sara Ahmed').getByRole('button', { name: 'Reset password' }));
  await L.wait(1500);
  await L.click(dlg().getByRole('button', { name: 'Cancel' }));
  await L.say('After five wrong passwords an account locks for 15 minutes. The open-lock button unlocks it at once.');
  await L.click(row('TARIQ').getByRole('button', { name: 'Unlock' }));
  await L.say('The power button deactivates someone who left. They cannot sign in, but their work is kept.');
  await L.point(row('Sara Ahmed').getByRole('button', { name: 'Deactivate' }), 1200);
  await L.say('Tip: keep two administrator accounts, so you can never be locked out of the system.');

  // 3 ------------------------------------------------------------
  await L.chapter('Subjects', 'The 8 CAF papers');
  await L.click(p.getByRole('link', { name: 'Subjects', exact: true }));
  await L.say('Subjects shows the eight CAF papers in Group A and Group B. They are set up already.');
  await L.say('The pencil changes a subject’s name or CAF number. Add subject creates a new one if ever needed.');
  await L.click(p.locator('.list-row', { hasText: 'Financial Accounting' }).getByRole('button', { name: 'Edit' }));
  await L.wait(1200);
  await L.click(dlg().getByRole('button', { name: 'Cancel' }));

  // 4 ------------------------------------------------------------
  await L.chapter('Reviewing questions', 'Approving, or returning with a comment');
  await L.click(p.getByRole('link', { name: 'Review', exact: true }));
  await L.say('Review lists every question teachers have submitted. Click a title to read the full question.');
  await L.click(p.locator('.list-row').first().locator('button').first());
  await L.wait(2500);
  await L.say('If the question is good, click the tick to approve it. You can add a note for the author.');
  await L.click(p.locator('.list-row').first().getByRole('button', { name: 'Approve' }));
  await L.type(dlg().locator('textarea'), 'Well written, thank you.', 25);
  await L.click(dlg().locator('button').filter({ hasText: /^Approve$/ }).last());
  await toast(p, /approved/i);
  await L.say('If something must change, click the cross to return it. A comment is required, so the teacher knows what to fix.');
  await L.click(p.locator('.list-row').first().getByRole('button', { name: 'Return to author' }));
  await L.type(dlg().locator('textarea'), 'Please add the tax year to the question.', 25);
  await L.click(dlg().getByRole('button', { name: 'Return to author' }));
  await toast(p, /returned/i);
  await L.say('Only approved questions can be used in papers. Let us approve the rest quickly.');
  for (let i = 0; i < 6; i++) {
    const b = p.locator('.list-row').first().getByRole('button', { name: 'Approve' });
    if (!(await b.count())) break;
    await L.click(b, 300);
    await L.click(dlg().locator('button').filter({ hasText: /^Approve$/ }).last(), 500);
    await dlg().waitFor({ state: 'detached' });
    await p.waitForTimeout(800);
  }

  // 5 ------------------------------------------------------------
  await L.chapter('Questions as administrator', 'Everyone’s questions');
  await L.click(p.getByRole('link', { name: 'Questions', exact: true }));
  await L.say('As administrator you see all questions of all teachers, including their drafts, and you can edit any question.');
  await L.say('The same filters, search, preview and recycle bin work here. You can also write questions yourself with New question.');
  await L.point(p.getByRole('button', { name: 'New question' }));

  // 6 ------------------------------------------------------------
  await L.chapter('Building a paper: details', 'Title, subject, session, marks, time and names');
  await L.click(p.getByRole('link', { name: 'Papers', exact: true }));
  await L.say('Papers lists all exam papers. The demo paper is here already. Click New paper.');
  await L.click(p.getByRole('button', { name: 'New paper' }).first());
  await L.say('Details: give the paper a title and choose the subject.');
  await L.fill(p.getByLabel('Title'), 'AAE Mock Test 2');
  const subj = p.getByLabel('Subject');
  await L.point(subj);
  await subj.selectOption((await subj.locator('option', { hasText: 'AAE' }).first().getAttribute('value'))!);
  await L.say('Session, exam date, maximum marks, duration and reading time print in the paper’s heading.');
  await L.fill(p.getByLabel('Session'), 'Autumn 2026');
  await L.point(p.getByLabel('Maximum marks'));
  await L.point(p.getByLabel('Duration (min)'));
  await L.say('Prepared by: the teacher, Research Officers and admin. These names print only in the answer key.');
  await L.type(p.getByLabel('Teacher'), 'Ayesha Khan', 25);
  await L.click(p.getByRole('button', { name: 'Bilal Ahmed' }));
  await L.say('Instructions come from the paper format. Custom for this paper lets you change them for this paper only.');
  await L.point(p.getByRole('button', { name: 'Custom for this paper' }), 1200);

  // 7 ------------------------------------------------------------
  await L.chapter('Building a paper: questions', 'Adding, ordering, sections and marks');
  await L.click(p.getByRole('button', { name: /^Questions/ }));
  await L.say('On the left are the approved questions of this subject. Search to find a topic.');
  await L.type(p.getByPlaceholder('Search approved questions'), 'materiality', 60);
  await L.say('Click a title to read the question first. Add to paper puts it in the paper.');
  await L.click(p.locator('.list-row').first().locator('button').first());
  await L.click(dlg().getByRole('button', { name: 'Add to paper' }));
  await L.fill(p.getByPlaceholder('Search approved questions'), '');
  await L.say('Or simply click the plus button next to a question.');
  for (let i = 0; i < 5; i++) await L.click(p.getByRole('button', { name: 'Add to paper' }).first(), 350);
  await L.say('On the right is the paper in order. The arrows move a question up or down; the cross removes it.');
  await L.click(p.getByRole('button', { name: 'Move down' }).first());
  await L.say('Choose the section for each question, change its marks for this paper, or start it on a New page.');
  await L.point(p.getByLabel('Section').first());
  await L.point(p.getByRole('button', { name: 'New page' }).first());
  await L.say('At the top right you always see the total marks against the maximum.');
  await L.point(p.getByText(/\/\s*100 marks/).first(), 1500);

  // 8 ------------------------------------------------------------
  await L.chapter('Preview and saving a draft', 'See the paper exactly as it prints');
  await L.say('Preview shows the question paper exactly as it will print.');
  await L.click(p.getByRole('button', { name: 'Preview', exact: true }));
  await p.locator('iframe[title="Paper preview"]').waitFor();
  await L.wait(3500);
  await L.say('Scroll to check it. Use maximise for a bigger view. Close it when done.');
  await L.click(dlg().getByRole('button', { name: 'Close' }));
  await L.say('Click Save. The paper is saved as a draft and can be changed any time.');
  await L.click(p.getByRole('button', { name: 'Save', exact: true }));
  await toast(p, /saved/i);

  // 9 ------------------------------------------------------------
  await L.chapter('Downloading drafts for review', 'DRAFT watermark and your own watermark');
  await L.click(p.getByRole('button', { name: 'Download', exact: true }));
  await L.say('Download has the question paper and the answer key as PDF files.');
  await L.say('While a paper is a draft, every page says DRAFT - FOR REVIEW. Share drafts for checking before finalising.');
  const [d1] = await Promise.all([p.waitForEvent('download'), L.click(p.getByRole('link', { name: /Question paper/ }))]);
  await d1.path();
  await L.say('Tick this box to print your name and the time on every page, so a leaked copy can be traced.');
  await L.click(p.getByLabel('Add my name and time as a watermark'));
  await L.click(p.getByLabel('Add my name and time as a watermark'));
  await L.say('Preview key shows the answer key with model answers, examiner’s advice and the names.');
  await L.click(p.getByRole('button', { name: 'Preview key' }));
  await p.locator('iframe').first().waitFor();
  await L.wait(3000);
  await L.click(dlg().getByRole('button', { name: 'Close' }));

  // 10 -----------------------------------------------------------
  await L.chapter('Finalising the paper', 'Clean PDFs when the marks match');
  await L.say('Finalise is only possible when the total marks equal the maximum marks. Let us set the maximum to the total.');
  const total = await p.evaluate(() => document.body.innerText.match(/(\d+(?:\.\d+)?)\s*\/\s*100 marks/)?.[1]);
  await L.click(p.getByRole('button', { name: 'Details' }));
  await L.fill(p.getByLabel('Maximum marks'), String(total ?? '6'));
  await L.say('Now the total matches, and Finalise is enabled. Click it.');
  await L.click(p.getByRole('button', { name: 'Finalise' }));
  await toast(p, 'Paper finalised');
  await L.say('A final paper is frozen: later changes to its questions do not change it. Downloads are now clean, without DRAFT.');
  await L.click(p.getByRole('button', { name: 'Download', exact: true }));
  const [d2] = await Promise.all([p.waitForEvent('download'), L.click(p.getByRole('link', { name: /Question paper/ }))]);
  await d2.path();
  const [d3] = await Promise.all([p.waitForEvent('download'), L.click(p.getByRole('link', { name: /Answer key/ }))]);
  await d3.path();
  await L.say('Both PDFs are downloaded: the question paper and the answer key.');

  // 11 -----------------------------------------------------------
  await L.chapter('Versions and reopening', 'Every save is kept');
  await L.say('History lists every saved version. Restore brings an older version back as a new draft; nothing is deleted.');
  await L.click(p.getByRole('button', { name: /History/ }).first());
  await L.wait(2500);
  await L.click(dlg().getByRole('button', { name: 'Close' }));
  await L.say('Need to change a final paper? Reopen turns it back into a draft. The final version stays in the history.');
  await L.click(p.getByRole('button', { name: 'Reopen' }));
  await L.wait(1500);
  await L.click(dlg().getByRole('button', { name: 'Cancel' }));

  // 12 -----------------------------------------------------------
  await L.chapter('The paper library', 'Search, duplicate and delete papers');
  await L.click(p.getByRole('link', { name: 'Papers', exact: true }));
  await L.say('The library shows every paper with its status. Search finds a paper by its title.');
  await L.type(p.getByPlaceholder('Search papers'), 'AAE', 80);
  await L.say('Duplicate copies a paper as a new draft, for example to make the next mock test.');
  await L.click(p.getByRole('button', { name: 'Duplicate' }).first());
  await toast(p, /copied|duplicated/i);
  await L.click(p.getByRole('link', { name: 'Papers', exact: true }));
  await L.say('Delete removes a paper. You are asked to confirm first.');
  await L.click(p.getByRole('button', { name: 'Delete' }).first());
  await L.wait(1200);
  await L.click(dlg().getByRole('button', { name: 'Cancel' }));

  // 13 -----------------------------------------------------------
  await L.chapter('Paper format', 'Fonts, sizes, spacing and margins');
  await L.click(p.getByRole('link', { name: 'Paper format', exact: true }));
  await L.click(p.getByRole('button', { name: 'Edit' }).first());
  await L.say('Paper format controls how every paper looks: fonts, sizes, spacing, margins, headings and instructions.');
  await L.say('Change a value and it is highlighted. The small arrow puts that one value back to the SKANS standard.');
  await L.fill(p.locator('input[aria-label="Body text"]'), '12');
  await L.click(p.locator('button[title^="Back to the standard value"]').first());
  await L.say('Click a section title to open more settings.');
  await L.click(dlg().getByText('Spacing (pt) & page margins (mm)'));
  await L.wait(1500);
  await L.say('Reset to standard puts every setting back at once. Nothing changes until you click Save.');
  await L.point(dlg().getByRole('button', { name: 'Reset to standard' }), 1200);
  await L.click(dlg().getByRole('button', { name: 'Cancel' }));

  // 14 -----------------------------------------------------------
  await L.chapter('The audit log', 'Who did what, and when');
  await L.click(p.getByRole('link', { name: 'Audit log', exact: true }));
  await L.say('The audit log records every sign-in, change, review, PDF download and deletion, with the user and the time.');
  await L.say('Filter by user, action, record type or dates to find something quickly.');
  await L.type(p.getByPlaceholder('User'), 'ayesha', 80);
  await L.wait(1200);
  await L.point(p.getByLabel('Action'));
  await L.fill(p.getByPlaceholder('User'), '');

  // 15 -----------------------------------------------------------
  await L.chapter('Signing out and good habits', 'Keeping the system safe');
  await p.goto(`${BASE}/`);
  await L.say('Change your password with the key icon at the bottom left. Sign out when you leave a shared computer.');
  await L.say('Good habits: one account per person, deactivate people who leave, and keep a second administrator account.');
  await L.click(p.getByRole('button', { name: 'Sign out' }));
  await p.getByLabel('Username').waitFor();
  await L.card('That is everything!', 'You are ready to run the SKANS Question Bank', 'Backups run every night. For server questions, see the Server Setup Guide.', 7000);
}

// ================================================================== README screenshots
async function screenshots(browser: Browser) {
  const dir = path.join(root, 'docs', 'media', 'screenshots');
  mkdirSync(dir, { recursive: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await ctx.addInitScript("document.addEventListener('DOMContentLoaded',()=>{const s=document.createElement('style');s.textContent='[data-sonner-toaster]{display:none!important}';document.head.appendChild(s)})");
  const p = await ctx.newPage();
  const shot = async (name: string, go: () => Promise<unknown>) => {
    try { await go(); await p.waitForTimeout(900); await p.screenshot({ path: path.join(dir, `${name}.png`) }); console.log('  ' + name); }
    catch (e) { console.log(`  FAILED ${name}: ${(e as Error).message.split(/\r?\n/)[0]}`); await p.keyboard.press('Escape').catch(() => {}); }
  };
  const dlg = () => p.getByRole('dialog');
  const editQ = async (search: string) => {
    await p.goto(`${BASE}/questions`);
    await p.getByPlaceholder('Search questions').fill(search);
    await p.waitForTimeout(1200);
    await p.locator('.list-row').first().getByRole('button', { name: 'Edit' }).click();
    await dlg().waitFor();
  };
  await shot('01-login', async () => { await p.goto(`${BASE}/login`); await p.getByLabel('Username').waitFor(); });
  await p.getByLabel('Username').fill('admin');
  await p.getByLabel('Password', { exact: true }).fill(ADMIN_PW);
  await p.getByRole('button', { name: 'Sign in' }).click();
  await p.getByText(/Good (morning|afternoon|evening)/).waitFor();
  await shot('02-admin-dashboard', async () => p.waitForTimeout(800));
  await shot('03-question-bank', async () => { await p.goto(`${BASE}/questions`); await p.locator('.list-row').first().waitFor(); });
  await shot('04-question-types', async () => { await p.goto(`${BASE}/questions?new=1`); await dlg().waitFor(); });
  await shot('05-mcq-editor', async () => editQ('Materiality calculation'));
  await shot('06-amounts-table', async () => { await editQ('Margalla'); await p.locator('[aria-label="Question text"] table').first().scrollIntoViewIfNeeded(); });
  await shot('07-long-question', async () => { await editQ('Going concern'); await p.locator('[aria-label="(a) text"]').first().scrollIntoViewIfNeeded(); });
  await shot('08-review-queue', async () => { await p.goto(`${BASE}/review`); await p.locator('.list-row').first().waitFor(); await p.locator('.list-row').first().locator('button').first().click(); });
  await p.goto(`${BASE}/papers`);
  const openPaper = async () => { await p.goto(`${BASE}/papers`); await p.getByText(/Demo Mock Paper/).first().click(); await p.getByRole('button', { name: /^Questions/ }).waitFor(); };
  await shot('09-paper-library', async () => p.getByText(/Demo Mock Paper/).first().waitFor());
  await shot('10-paper-details', openPaper);
  await shot('11-paper-builder', async () => { await p.getByRole('button', { name: /^Questions/ }).click(); });
  await shot('12-paper-preview', async () => { await p.getByRole('button', { name: 'Preview', exact: true }).click(); await p.locator('iframe').first().waitFor(); await p.waitForTimeout(2500); });
  await shot('13-answer-key-preview', async () => { await dlg().getByRole('button', { name: 'Show answer key' }).click(); await p.waitForTimeout(2500); });
  await p.keyboard.press('Escape');
  await shot('14-users', async () => { await p.goto(`${BASE}/admin/users`); await p.locator('.list-row').first().waitFor(); });
  await shot('15-paper-format', async () => { await p.goto(`${BASE}/admin/templates`); await p.getByRole('button', { name: 'Edit' }).first().click(); await dlg().waitFor(); });
  await shot('16-audit-log', async () => { await p.goto(`${BASE}/admin/audit`); await p.waitForTimeout(800); });
  await shot('17-subjects', async () => { await p.goto(`${BASE}/admin/subjects`); await p.waitForTimeout(800); });
  await ctx.close();
  // Teacher view and phone view
  const t = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await t.goto(`${BASE}/login`);
  await t.getByLabel('Username').fill('ayesha');
  await t.getByLabel('Password', { exact: true }).fill(TEACHER_PW);
  await t.getByRole('button', { name: 'Sign in' }).click();
  await t.getByText(/Good (morning|afternoon|evening)/).waitFor();
  await t.waitForTimeout(900);
  await t.screenshot({ path: path.join(dir, '18-teacher-dashboard.png') });
  console.log('  18-teacher-dashboard');
  const m = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  await m.goto(`${BASE}/login`);
  await m.getByLabel('Username').fill('ayesha');
  await m.getByLabel('Password', { exact: true }).fill(TEACHER_PW);
  await m.getByRole('button', { name: 'Sign in' }).click();
  await m.getByText(/Good (morning|afternoon|evening)/).waitFor();
  await m.waitForTimeout(900);
  await m.screenshot({ path: path.join(dir, '19-phone.png') });
  console.log('  19-phone');
}

// ================================================================== main
async function main() {
  if (!baseUrl.startsWith('postgres')) throw new Error('DATABASE_URL must point to PostgreSQL (server/.env).');
  if (!existsSync(path.join(root, 'client', 'dist-test', 'index.html'))) {
    console.log('Building the web app into client/dist-test...');
    execSync('npm run build -w client -- --outDir dist-test --emptyOutDir', { cwd: root, stdio: 'ignore' });
  }
  mkdirSync(outDir, { recursive: true });
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
    for (let i = 0; i < 60; i++) { try { if ((await fetch(`${BASE}/api/health`)).ok) break; } catch { /* starting */ } await new Promise((r) => setTimeout(r, 1000)); }
    browser = await chromium.launch();
    const logo = `data:image/png;base64,${readFileSync(path.join(root, 'client', 'public', 'branding', 'skans-logo.png')).toString('base64')}`;

    const admin = await hiddenSignIn(browser, 'admin', ADMIN_FIRST, ADMIN_PW);
    const subjects = (await api(admin, 'GET', '/subjects')).data as { id: number; code: string }[];
    const sid = (c: string) => subjects.find((s) => s.code === c)!.id;
    for (const [username, fullName, role, codes] of [['ayesha', 'Ayesha Khan', 'TEACHER', ['FAR']], ['bilal', 'Bilal Ahmed', 'RESEARCH_OFFICER', ['FAR', 'AAE']], ['tariq', 'Tariq Mehmood', 'TEACHER', ['TPC']]] as const) {
      await api(admin, 'POST', '/users', { username, fullName, role, password: TEMP_PW, subjectIds: codes.map(sid) });
    }

    if (which === 'shots') {
      const t = await hiddenSignIn(browser, 'ayesha', TEMP_PW, TEACHER_PW);
      for (const topic of ['Revenue recognition - first step', 'Leases - lessee accounting', 'Salary income - taxable amount']) {
        await api(t, 'POST', '/questions?submit=1', { subjectId: sid('FAR'), type: 'SHORT', topic, marks: 5, body: `<p>${topic}: explain with an example.</p>`, content: {} });
      }
      console.log('Taking screenshots...');
      await screenshots(browser);
      return;
    }
    if (which === 'all' || which === 'teacher') {
      console.log('Recording the teacher video...');
      await record(browser, logo, 'SKANS Question Bank - Teacher Guide', 'SKANS-QB-Teacher-Guide', (L) => teacherLesson(L, admin));
    } else {
      // The admin video needs the teacher's work: create it off camera.
      const t = await hiddenSignIn(browser, 'ayesha', TEMP_PW, TEACHER_PW);
      for (const topic of ['Revenue recognition - first step', 'Leases - lessee accounting', 'Metro Logistics - planning risks', 'Salary income - taxable amount']) {
        await api(t, 'POST', '/questions?submit=1', { subjectId: sid('FAR'), type: 'SHORT', topic, marks: 5, body: `<p>${topic}: explain.</p>`, content: {} });
      }
    }
    if (which === 'all' || which === 'admin') {
      console.log('Recording the admin video...');
      await record(browser, logo, 'SKANS Question Bank - Administrator Guide', 'SKANS-QB-Admin-Guide', (L) => adminLesson(L, browser!));
    }
  } finally {
    await browser?.close();
    if (server?.pid) { try { execSync(`taskkill /PID ${server.pid} /T /F`, { stdio: 'ignore' }); } catch { /* stopped */ } }
    await maint.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${DB}" WITH (FORCE)`);
    await maint.$disconnect();
    const tmp = path.join(outDir, 'tmp');
    if (existsSync(tmp)) rmSync(tmp, { recursive: true, force: true });
  }
}

void renameSync;
main().catch((e) => {
  console.error('[videos]', e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
