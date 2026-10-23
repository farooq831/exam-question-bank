/**
 * End-to-end walkthrough of the SKANS Question Bank in a real browser: sign-in and accounts,
 * every question type, review, paper building and PDFs, permissions and security basics.
 * Steps run in order and share state (users created by the admin sign in later, and so on).
 */
import { expect, test, type Browser, type Page } from '@playwright/test';
import { E2E_ADMIN_PASSWORD } from './e2e-env';

test.describe.configure({ mode: 'serial' });

const ADMIN_PASSWORD = 'AdminOwn2026x';
const TEMP_PASSWORD = 'Welcome2026xx';
let admin: Page;
let teacher: Page;
let officer: Page;
let taxTeacher: Page;

async function newPage(browser: Browser, viewport = { width: 1280, height: 860 }) {
  const context = await browser.newContext({ viewport, acceptDownloads: true, baseURL: test.info().project.use.baseURL });
  const page = await context.newPage();
  page.on('pageerror', (e) => {
    throw new Error(`Browser error on ${page.url()}: ${e.message}`);
  });
  return page;
}

const toast = (page: Page, text: string | RegExp) => expect(page.locator('[data-sonner-toast]').filter({ hasText: text }).first()).toBeVisible();
const typeIn = async (page: Page, label: string, text: string) => {
  await page.locator(`[aria-label="${label}"]`).first().click();
  await page.keyboard.type(text);
};
const me = (page: Page) => page.evaluate(async () => (await (await fetch('/api/auth/me')).json()) as { user: { username: string } | null; csrfToken: string });

async function signIn(page: Page, username: string, password: string, newPassword?: string) {
  await page.goto('/login');
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  if (newPassword) {
    await page.getByLabel('Current password').fill(password);
    await page.getByLabel('New password', { exact: true }).fill(newPassword);
    await page.getByLabel('Confirm new password').fill(newPassword);
    await page.getByRole('button', { name: 'Save password' }).click();
  }
  await expect(page.getByText(/Good (morning|afternoon|evening)/)).toBeVisible();
}

async function addUser(fullName: string, username: string, role: string, subjects: string[]) {
  await admin.goto('/admin/users');
  await admin.getByRole('button', { name: 'Add user' }).click();
  const dialog = admin.getByRole('dialog');
  await dialog.getByLabel('Full name').fill(fullName);
  await dialog.getByLabel('Username').fill(username);
  await dialog.getByLabel('Role').selectOption({ label: role });
  for (const code of subjects) await dialog.getByRole('button', { name: code, exact: true }).click();
  await dialog.getByLabel('Temporary password').fill(TEMP_PASSWORD);
  await admin.getByRole('button', { name: 'Save' }).click();
  await toast(admin, 'User created');
}

async function newQuestion(type: RegExp, title?: string) {
  await teacher.goto('/questions?new=1');
  await teacher.getByRole('radio', { name: type }).first().click();
  if (title) await teacher.getByLabel('Title').fill(title);
}

test.beforeAll(async ({ browser }) => {
  admin = await newPage(browser);
  teacher = await newPage(browser);
  officer = await newPage(browser);
  taxTeacher = await newPage(browser);
});

// ---------------------------------------------------------------- sign-in and accounts

test('wrong password is refused', async () => {
  await admin.goto('/login');
  await admin.getByLabel('Username').fill('admin');
  await admin.getByLabel('Password', { exact: true }).fill('wrong-password-1');
  await admin.getByRole('button', { name: 'Sign in' }).click();
  await toast(admin, 'Incorrect username or password');
});

test('first sign-in forces a password change and explains a weak password', async () => {
  await admin.getByLabel('Password', { exact: true }).fill(E2E_ADMIN_PASSWORD);
  await admin.getByRole('button', { name: 'Sign in' }).click();
  await admin.getByLabel('Current password').fill(E2E_ADMIN_PASSWORD);
  await admin.getByLabel('New password', { exact: true }).fill('short');
  await admin.getByLabel('Confirm new password').fill('short');
  await admin.getByRole('button', { name: 'Save password' }).click();
  await toast(admin, 'New password: At least 10 characters');
  await admin.getByLabel('New password', { exact: true }).fill(ADMIN_PASSWORD);
  await admin.getByLabel('Confirm new password').fill(ADMIN_PASSWORD);
  await admin.getByRole('button', { name: 'Save password' }).click();
  await expect(admin.getByText(/Good (morning|afternoon|evening)/)).toBeVisible();
});

test('admin sees every menu item and the 8 CAF subjects', async () => {
  const nav = (await admin.locator('aside nav a').allInnerTexts()).join('|');
  for (const item of ['Dashboard', 'Review', 'Questions', 'Papers', 'Users', 'Subjects', 'Paper format', 'Audit log']) expect(nav).toContain(item);
  await admin.goto('/admin/subjects');
  for (const code of ['FAR', 'TPC', 'DSR', 'BLD', 'MA', 'CR', 'BIA', 'AAE']) await expect(admin.getByText(code, { exact: true }).first()).toBeVisible();
});

test('admin creates a teacher, a Research Officer and a teacher of another subject', async () => {
  await addUser('Ayesha Khan', 'ayesha', 'Teacher', ['FAR']);
  await addUser('Bilal Ahmed', 'bilal', 'Research Officer', ['FAR']);
  await addUser('Tariq Mehmood', 'tariq', 'Teacher', ['TPC']);
});

test('a duplicate username is refused', async () => {
  await admin.getByRole('button', { name: 'Add user' }).click();
  const dialog = admin.getByRole('dialog');
  await dialog.getByLabel('Full name').fill('Someone Else');
  await dialog.getByLabel('Username').fill('ayesha');
  await dialog.getByLabel('Temporary password').fill(TEMP_PASSWORD);
  await admin.getByRole('button', { name: 'Save' }).click();
  await toast(admin, /exists|taken|already/i);
  await admin.getByRole('button', { name: 'Cancel' }).click();
});

// ---------------------------------------------------------------- teacher: every question type

test('teacher signs in and only sees teacher pages', async () => {
  await signIn(teacher, 'ayesha', TEMP_PASSWORD, 'AyeshaOwn2026');
  const nav = (await teacher.locator('aside nav a').allInnerTexts()).join('|');
  for (const hidden of ['Users', 'Papers', 'Review']) expect(nav).not.toContain(hidden);
  await teacher.goto('/admin/users');
  await expect(teacher.getByRole('button', { name: 'Add user' })).toHaveCount(0);
});

test('an empty question is blocked with a clear message', async () => {
  await newQuestion(/^Short/);
  await teacher.getByRole('button', { name: 'Save draft' }).click();
  await expect(teacher.getByText('Enter the question text.')).toBeVisible();
  await teacher.getByRole('button', { name: 'Cancel' }).click();
});

test('MCQ', async () => {
  await newQuestion(/^MCQ/, 'E2E MCQ');
  await typeIn(teacher, 'Question text', 'Which statement about materiality is correct?');
  for (const [i, text] of ['Alpha', 'Beta', 'Gamma', 'Delta'].entries()) await typeIn(teacher, `Option ${String.fromCharCode(97 + i)}`, text);
  await teacher.getByRole('dialog').getByRole('button', { name: 'Submit' }).click();
  await toast(teacher, 'Submitted for review');
});

test('MCQ set with two items', async () => {
  await newQuestion(/MCQ set/, 'E2E MCQ set');
  await typeIn(teacher, 'Question text', 'Questions (i) and (ii) relate to E2E Ltd.');
  await typeIn(teacher, 'MCQ 1 text', 'First item?');
  const options = teacher.locator('[aria-label^="Option "]');
  for (let i = 0; i < 4; i++) { await options.nth(i).click(); await teacher.keyboard.type(`One ${i}`); }
  await teacher.getByRole('button', { name: 'MCQ', exact: true }).click();
  await typeIn(teacher, 'MCQ 2 text', 'Second item?');
  for (let i = 4; i < 8; i++) { await options.nth(i).click(); await teacher.keyboard.type(`Two ${i}`); }
  await teacher.getByRole('dialog').getByRole('button', { name: 'Submit' }).click();
  await toast(teacher, 'Submitted for review');
});

test('three True / False statements at once', async () => {
  await newQuestion(/True \/ False/);
  await teacher.getByLabel('Marks', { exact: true }).fill('1');
  await typeIn(teacher, 'Question text', 'Statement one.');
  await teacher.getByRole('button', { name: 'Add another statement' }).click();
  await typeIn(teacher, 'Statement 2 text', 'Statement two.');
  await teacher.getByRole('button', { name: 'Add another statement' }).click();
  await typeIn(teacher, 'Statement 3 text', 'Statement three.');
  await teacher.getByRole('dialog').getByRole('button', { name: 'Submit' }).click();
  await toast(teacher, '3 True / False questions submitted for review');
});

test('short question with an amounts table, an (I) list and text below the table', async () => {
  await newQuestion(/^Short/, 'E2E Short');
  await typeIn(teacher, 'Question text', 'Emoluments:');
  await teacher.locator('button[aria-label^="Insert an amounts table"]').first().click();
  const cells = teacher.locator('[aria-label="Question text"] td');
  await cells.nth(0).click(); await teacher.keyboard.type('Basic salary');
  await cells.nth(1).click(); await teacher.keyboard.type('495,000');
  await teacher.locator('[aria-label="Question text"] > p').last().click();
  await teacher.keyboard.type('Consider:');
  await teacher.keyboard.press('Enter');
  await teacher.locator('button[aria-label^="Numbered list"]').first().click();
  await teacher.locator('button[aria-label="Number the list (I)"]').click();
  await teacher.keyboard.type('First statement');
  await teacher.getByRole('dialog').getByRole('button', { name: 'Submit' }).click();
  await toast(teacher, 'Submitted for review');
  const saved = await teacher.evaluate(async () => (await (await fetch('/api/questions?q=emoluments')).json()).items[0].body as string);
  expect(saved).toContain('<th class="nb">');
  expect(saved).toMatch(/text-align:\s*right/);
  expect(saved).toContain('data-list-style="upper-roman"');
});

test('long question with sub-questions and a part inside', async () => {
  await newQuestion(/^Long/, 'E2E Long');
  await typeIn(teacher, 'Question text', 'Long scenario.');
  await typeIn(teacher, '(a) text', 'Part a.');
  await teacher.getByRole('button', { name: 'Sub-question', exact: true }).click();
  await typeIn(teacher, '(b) text', 'Part b.');
  await teacher.getByRole('button', { name: /Part \(b\)\(i\)/ }).click();
  await typeIn(teacher, '(b)(i) text', 'Part b i.');
  await teacher.getByRole('dialog').getByRole('button', { name: 'Submit' }).click();
  await toast(teacher, 'Submitted for review');
});

test('case study saved as a draft', async () => {
  await newQuestion(/Case study/, 'E2E Case');
  await typeIn(teacher, 'Question text', 'Case scenario.');
  await typeIn(teacher, '(a) text', 'Case part a.');
  await teacher.getByRole('button', { name: 'Save draft' }).click();
  await toast(teacher, 'Saved');
});

test('editor window can be maximised, minimised and restored without losing text', async () => {
  await newQuestion(/^Short/);
  await typeIn(teacher, 'Question text', 'Kept while minimised.');
  await teacher.getByRole('button', { name: 'Maximise' }).click();
  await teacher.getByRole('button', { name: 'Minimise' }).click();
  await teacher.getByRole('region', { name: 'Minimised window' }).getByRole('button', { name: 'Restore' }).last().click();
  await expect(teacher.locator('[aria-label="Question text"]')).toContainText('Kept while minimised.');
  await teacher.getByRole('button', { name: 'Cancel' }).click();
});

test('duplicate, recycle bin, restore and delete permanently', async () => {
  await teacher.goto('/questions');
  await teacher.locator('.list-row', { hasText: 'E2E Case' }).first().getByRole('button', { name: 'Duplicate' }).click();
  await toast(teacher, 'Copied as a new draft');
  await teacher.locator('.list-row', { hasText: 'E2E Case' }).first().getByRole('button', { name: 'Move to recycle bin' }).click();
  await teacher.getByRole('button', { name: 'Move to bin' }).click();
  await toast(teacher, 'Moved to recycle bin');
  await teacher.goto('/questions?deleted=1');
  await teacher.getByRole('button', { name: 'Restore' }).first().click();
  await toast(teacher, 'Restored');
  await teacher.goto('/questions');
  await teacher.locator('.list-row', { hasText: 'E2E Case' }).first().getByRole('button', { name: 'Move to recycle bin' }).click();
  await teacher.getByRole('button', { name: 'Move to bin' }).click();
  await teacher.goto('/questions?deleted=1');
  await teacher.getByRole('button', { name: 'Delete permanently' }).first().click();
  await teacher.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
  await toast(teacher, 'Deleted permanently');
});

test('search ignores capital letters', async () => {
  await teacher.goto('/questions');
  await teacher.getByPlaceholder('Search questions').fill('MATERIALITY');
  await expect(teacher.locator('.list-row', { hasText: 'E2E MCQ' }).first()).toBeVisible();
});

// ---------------------------------------------------------------- security and visibility

test('question HTML is cleaned of scripts', async () => {
  const body = await teacher.evaluate(async () => {
    const session = await (await fetch('/api/auth/me')).json();
    const subjects = await (await fetch('/api/subjects')).json();
    const r = await fetch('/api/questions', { method: 'POST', headers: { 'content-type': 'application/json', 'x-csrf-token': session.csrfToken }, body: JSON.stringify({ subjectId: subjects[0].id, type: 'SHORT', topic: 'XSS', marks: 2, body: '<p>Hi<script>alert(1)</script><img src=x onerror=alert(2)></p>', content: {} }) });
    return (await r.json()).body as string;
  });
  expect(body).not.toMatch(/script|onerror|<img/i);
});

test('a request without the CSRF token is refused', async () => {
  const status = await teacher.evaluate(async () => (await fetch('/api/questions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).status);
  expect(status).toBe(403);
});

test('teachers are refused by admin endpoints', async () => {
  const statuses = await teacher.evaluate(async () => Promise.all(['/api/users', '/api/audit', '/api/templates'].map(async (u) => (await fetch(u)).status)));
  expect(statuses).toEqual([403, 403, 403]);
});

test('a Research Officer has teacher rights', async () => {
  await signIn(officer, 'bilal', TEMP_PASSWORD, 'BilalOwn2026x');
  await officer.goto('/questions?new=1');
  await officer.getByRole('radio', { name: /^Short/ }).click();
  await officer.getByLabel('Title').fill('RO question');
  await typeIn(officer, 'Question text', 'Written by the research officer.');
  await officer.getByRole('dialog').getByRole('button', { name: 'Submit' }).click();
  await toast(officer, 'Submitted for review');
});

test('teachers see neither other subjects nor colleagues’ unapproved questions', async () => {
  await signIn(taxTeacher, 'tariq', TEMP_PASSWORD, 'TariqOwn2026x');
  expect(await taxTeacher.evaluate(async () => (await (await fetch('/api/questions')).json()).total)).toBe(0);
  const topics = await teacher.evaluate(async () => (await (await fetch('/api/questions?pageSize=100')).json()).items.map((q: { topic: string }) => q.topic));
  expect(topics).not.toContain('RO question');
});

// ---------------------------------------------------------------- review

test('review queue shows titles; returning needs a comment', async () => {
  await admin.goto('/review');
  await expect(admin.getByText('E2E MCQ', { exact: true })).toBeVisible();
  await expect(admin.getByText('Untitled question')).toHaveCount(0);
  await admin.locator('.list-row', { hasText: 'E2E Short' }).first().getByRole('button', { name: 'Return to author' }).click();
  const dialog = admin.getByRole('dialog');
  const send = dialog.getByRole('button', { name: 'Return to author' });
  await expect(send).toBeDisabled();
  await dialog.locator('textarea').fill('Please add the year end.');
  await send.click();
  await expect(dialog).toBeHidden();
});

test('admin approves through the dialog (and the rest through the API)', async () => {
  await admin.locator('.list-row').first().getByRole('button', { name: 'Approve' }).click();
  const dialog = admin.getByRole('dialog');
  await dialog.locator('button').filter({ hasText: /^Approve$/ }).last().click();
  await expect(dialog).toBeHidden();
  await admin.evaluate(async () => {
    const session = await (await fetch('/api/auth/me')).json();
    const list = await (await fetch('/api/questions?status=SUBMITTED&pageSize=100')).json();
    for (const q of list.items) await fetch(`/api/questions/${q.id}/review`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-csrf-token': session.csrfToken }, body: JSON.stringify({ decision: 'APPROVE', comment: '' }) });
  });
  await admin.reload();
  await expect(admin.getByText(/nothing to review/i)).toBeVisible();
});

test('the teacher fixes the returned question and the admin approves it', async () => {
  await teacher.goto('/questions?status=REJECTED');
  await expect(teacher.getByText('Please add the year end.').first()).toBeVisible();
  await teacher.locator('.list-row', { hasText: 'E2E Short' }).getByRole('button', { name: 'Edit' }).click();
  await teacher.locator('[aria-label="Question text"]').click();
  await teacher.keyboard.press('Control+Home');
  await teacher.keyboard.type('Year ended 30 June 2026. ');
  await teacher.getByRole('dialog').getByRole('button', { name: 'Submit' }).click();
  await toast(teacher, 'Submitted for review');
  await admin.goto('/review');
  await admin.locator('.list-row').first().getByRole('button', { name: 'Approve' }).click();
  await admin.getByRole('dialog').locator('button').filter({ hasText: /^Approve$/ }).last().click();
  await expect(admin.getByText(/nothing to review/i)).toBeVisible();
  await teacher.goto('/questions?status=APPROVED');
  await expect(teacher.locator('.list-row', { hasText: 'E2E MCQ' }).first().getByRole('button', { name: 'Edit' })).toHaveCount(0);
});

// ---------------------------------------------------------------- papers and PDFs

test('build a paper; Finalise waits until the marks match', async () => {
  await admin.goto('/papers?paper=new');
  await admin.getByLabel('Title').fill('E2E FAR Test 1');
  await admin.getByLabel('Session').fill('Autumn 2026');
  await admin.getByRole('button', { name: 'Bilal Ahmed' }).click();
  await admin.getByLabel('Teacher').fill('Ayesha Khan');
  await admin.getByRole('button', { name: /^Questions/ }).click();
  while (await admin.getByRole('button', { name: 'Add to paper' }).count()) await admin.getByRole('button', { name: 'Add to paper' }).first().click();
  await expect(admin.getByText('All added')).toBeVisible();
  await admin.getByRole('button', { name: 'Preview', exact: true }).click();
  await expect(admin.locator('iframe[title="Paper preview"]')).toBeVisible();
  await admin.getByRole('button', { name: 'Close' }).last().click();
  const finalise = admin.getByRole('button', { name: 'Finalise' });
  await expect(finalise).toBeDisabled();
  const total = await admin.evaluate(() => document.body.innerText.match(/(\d+(?:\.\d+)?)\s*\/\s*100/)?.[1]);
  expect(total).toBeTruthy();
  await admin.getByRole('button', { name: 'Details' }).click();
  await admin.getByLabel('Maximum marks').fill(String(total));
  await expect(finalise).toBeEnabled();
});

test('drafts download as _DRAFT; finalised papers and answer keys download clean', async () => {
  await admin.getByRole('button', { name: 'Save', exact: true }).click();
  await toast(admin, /saved/i);
  await admin.getByRole('button', { name: 'Download', exact: true }).click();
  const download = async (name: RegExp) => {
    const [file] = await Promise.all([admin.waitForEvent('download', { timeout: 90_000 }), admin.getByRole('link', { name }).click()]);
    return file.suggestedFilename();
  };
  expect(await download(/Question paper/)).toMatch(/_DRAFT\.pdf$/);
  await admin.getByRole('button', { name: 'Finalise' }).click();
  await toast(admin, /finalised|saved/i);
  expect(await download(/Question paper/)).not.toMatch(/_DRAFT/);
  expect(await download(/Answer key/)).toMatch(/AnswerKey/i);
});

test('version history, protected questions and duplicating a paper', async () => {
  await admin.getByRole('button', { name: /History/ }).first().click();
  await expect(admin.getByRole('dialog').getByText(/Finalised/).first()).toBeVisible();
  await admin.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
  const status = await admin.evaluate(async () => {
    const session = await (await fetch('/api/auth/me')).json();
    const [q] = (await (await fetch('/api/questions?status=APPROVED&pageSize=1')).json()).items;
    const headers = { 'x-csrf-token': session.csrfToken };
    await fetch(`/api/questions/${q.id}`, { method: 'DELETE', headers });
    const res = await fetch(`/api/questions/${q.id}/permanent`, { method: 'DELETE', headers });
    await fetch(`/api/questions/${q.id}/restore`, { method: 'POST', headers });
    return res.status;
  });
  expect(status).toBe(409);
  await admin.goto('/papers');
  await expect(admin.getByText('E2E FAR Test 1').first()).toBeVisible();
  await admin.getByRole('button', { name: 'Duplicate' }).first().click();
  await toast(admin, /copied|duplicated/i);
});

// ---------------------------------------------------------------- admin pages

test('paper format: change a value, reset to standard, save', async () => {
  await admin.goto('/admin/templates');
  await admin.getByRole('button', { name: 'Edit' }).first().click();
  await admin.locator('input[aria-label="Body text"]').fill('14');
  await admin.getByRole('button', { name: 'Reset to standard' }).click();
  await admin.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(admin.locator('input[aria-label="Body text"]')).toHaveValue('11');
  await admin.getByRole('button', { name: 'Save' }).click();
  await toast(admin, 'Format saved');
});

test('reset password and deactivate sign the user out', async () => {
  await admin.goto('/admin/users');
  const row = () => admin.locator('.list-row', { hasText: 'Tariq Mehmood' }).first();
  await row().getByRole('button', { name: 'Reset password' }).click();
  await admin.getByRole('dialog').getByRole('button', { name: /Reset|Save/ }).last().click();
  await toast(admin, /reset|password/i);
  await row().getByRole('button', { name: 'Deactivate' }).click();
  await admin.getByRole('button', { name: 'Deactivate' }).last().click();
  await expect(row().getByRole('button', { name: 'Activate' })).toBeVisible();
  await row().getByRole('button', { name: 'Activate' }).click();
  await admin.getByRole('button', { name: 'Activate' }).last().click();
  expect((await me(taxTeacher)).user).toBeNull();
});

test('audit log records the activity', async () => {
  await admin.goto('/admin/audit');
  await expect(admin.locator('.list-row', { hasText: 'Paper create' }).first()).toBeVisible();
  await expect(admin.locator('.list-row', { hasText: 'Question approve' }).first()).toBeVisible();
});

test('five wrong passwords lock the account', async () => {
  const message = await officer.evaluate(async () => {
    await fetch('/api/auth/logout', { method: 'POST', headers: { 'x-csrf-token': (await (await fetch('/api/auth/me')).json()).csrfToken } });
    const csrf = (await (await fetch('/api/auth/csrf')).json()).csrfToken;
    const headers = { 'content-type': 'application/json', 'x-csrf-token': csrf };
    for (let i = 0; i < 5; i++) await fetch('/api/auth/login', { method: 'POST', headers, body: JSON.stringify({ username: 'bilal', password: 'nope-nope-1' }) });
    const r = await fetch('/api/auth/login', { method: 'POST', headers, body: JSON.stringify({ username: 'bilal', password: 'BilalOwn2026x' }) });
    return (await r.json()).error as string;
  });
  expect(message).toMatch(/locked|try again/i);
});

test('security headers and cookie settings', async ({ request }) => {
  const res = await request.get('/login');
  expect(res.headers()['content-security-policy']).toBeTruthy();
  expect(res.headers()['x-powered-by']).toBeUndefined();
  const cookie = (await admin.context().cookies()).find((c) => c.name === 'skans.sid');
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.sameSite).toBe('Strict');
});

test('phone width: no sideways scrolling', async ({ browser }) => {
  const phone = await newPage(browser, { width: 390, height: 844 });
  await signIn(phone, 'ayesha', 'AyeshaOwn2026');
  for (const url of ['/', '/questions', '/questions?new=1']) {
    await phone.goto(url);
    await phone.waitForLoadState('networkidle');
    expect(await phone.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(2);
  }
});

test('sign out ends the session', async () => {
  await teacher.goto('/');
  await teacher.getByRole('button', { name: /Sign out|Log out/i }).click();
  await expect(teacher.getByLabel('Username')).toBeVisible();
  expect((await me(teacher)).user).toBeNull();
});
