/** Text and layout of the User Guide (simple English). Screenshots come from make-guide.ts. */
export type Shots = Record<string, string>;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function renderGuideHtml(shots: Shots, logo: string): string {
  const img = (name: string, caption: string, width = 100) =>
    shots[name] ? `<figure style="width:${width}%"><img src="${shots[name]}" alt="${esc(caption)}"><figcaption>${caption}</figcaption></figure>` : '';
  const steps = (items: string[]) => `<ol class="steps">${items.map((s) => `<li>${s}</li>`).join('')}</ol>`;
  const tip = (text: string) => `<div class="tip"><b>Tip</b> ${text}</div>`;
  const note = (text: string) => `<div class="note"><b>Important</b> ${text}</div>`;
  const b = (s: string) => `<b>${s}</b>`;

  const sections: { id: string; part?: string; title: string; body: string }[] = [
    // ------------------------------------------------------------------ Part A
    {
      id: 'signin', part: 'Part A · Getting started (everyone)', title: '1. Sign in',
      body: `<p>Open the link you received in Chrome, Edge or Firefox (computer, tablet or phone).</p>
        ${steps([`Type your ${b('username')} and ${b('password')}. Click the eye icon to see what you typed.`, `Click ${b('Sign in')}. A welcome message shows your name.`])}
        ${img('login', 'The sign-in page', 92)}
        ${tip('Forgot your password? Ask the administrator to reset it. After 5 wrong passwords the account is locked for 15 minutes.')}`,
    },
    {
      id: 'password', title: '2. First sign-in: choose your own password',
      body: `<p>The first time you sign in, you must replace the temporary password with your own.</p>
        ${steps([`Type the temporary password in ${b('Current password')}.`, `Type your new password twice. It needs ${b('at least 10 characters')}, with ${b('a letter and a number')}.`, `Click ${b('Save password')}.`])}
        ${img('change-password', 'Choosing your own password', 80)}`,
    },
    {
      id: 'dashboard', title: '3. The dashboard',
      body: `<p>After signing in you see the dashboard. The menu on the left takes you to each page.</p>
        ${steps([`${b('Write a new question')}: the big blue card opens the question editor.`, `The four tiles show ${b('My drafts')}, ${b('In review')}, ${b('Returned to me')} and ${b('Approved')}. Click a tile to see those questions.`, `${b('Recent activity')} shows what happened last.`])}
        ${img('teacher-dashboard', 'The dashboard of a teacher')}
        <table><tr><th>Role</th><th>What you can do</th></tr>
          <tr><td>${b('Teacher')} / ${b('Research Officer')}</td><td>Write questions for your subjects, submit them for review, fix returned questions, use the recycle bin.</td></tr>
          <tr><td>${b('Administrator')}</td><td>Everything above, plus review questions, build papers, download PDFs, manage users, subjects and the paper format.</td></tr></table>`,
    },
    // ------------------------------------------------------------------ Part B
    {
      id: 'new', part: 'Part B · Writing questions (teachers and Research Officers)', title: '4. Write a new question',
      body: `${steps([`Click ${b('Write a new question')} on the dashboard (or ${b('New question')} on the Questions page).`, `Choose the ${b('question type')} by clicking a tile.`, `Fill in ${b('Subject')}, ${b('Difficulty')}, ${b('Marks')} and a short ${b('Title')}. The title is what the reviewer sees in the list.`])}
        ${img('editor-top', 'Choose the type, then fill in subject, marks and title')}
        <table><tr><th>Type</th><th>Use it for</th></tr>
          <tr><td>${b('MCQ')}</td><td>One multiple-choice question with options (a) to (d).</td></tr>
          <tr><td>${b('MCQ set')}</td><td>Several MCQs that belong together, numbered (i), (ii), (iii)... for example all based on one scenario.</td></tr>
          <tr><td>${b('True / False')}</td><td>One or more true/false statements.</td></tr>
          <tr><td>${b('Short')}</td><td>A question with one written answer.</td></tr>
          <tr><td>${b('Long')}</td><td>A question with sub-questions (a), (b), (c)... and parts inside them.</td></tr>
          <tr><td>${b('Case study')}</td><td>A scenario followed by sub-questions.</td></tr></table>
        ${tip('Use <b>MCQ</b> for questions that can be reused in any paper. Use <b>MCQ set</b> only when the questions must always stay together.')}`,
    },
    {
      id: 'mcq', title: '5. MCQ: options and the correct answer',
      body: `${steps([`Type the question in the ${b('Question')} box.`, `Type each option (a), (b), (c), (d). Use ${b('+ Option')} to add more (up to 6).`, `Click the round button next to the ${b('correct option')}. It turns green.`, `Choose the print layout if needed (1 per line, 2 or 4 columns). ${b('Auto')} is usually fine.`])}
        ${img('editor-mcq-options', 'Options with the correct answer marked in green')}`,
    },
    {
      id: 'tools', title: '6. Text tools, tables and numbered lists',
      body: `<p>The toolbar above each text box works like Word: ${b('Bold')}, ${b('Italic')}, ${b('Underline')}, superscript, subscript, bullet list, numbered list and alignment.</p>
        ${steps([`${b('Amounts table')}: click it to insert the usual layout with labels on the left and figures on the right under ${b('Rupees')}. Type in the cells.`, `${b('Table')}: inserts a normal 3 × 3 table. Inside a table you get buttons to add or delete rows and columns, merge cells, make a header row, or remove borders (${b('No border')}).`, `Use ${b('Align right')} for amounts so the figures line up.`, `${b('Numbered list')}: after clicking it, choose the style: (i), (I), (a), (A) or (1). Use (I), (II) for statements such as "Consider the following statements".`, `${b('↵ Text below')}: starts a new line under a table. You can also just click below the table.`])}
        ${img('editor-table-list', 'An amounts table and an (I), (II) list, exactly as they print')}
        ${tip('You can paste tables from Word or Excel. Check the result, and set the header row if needed. Drag a column edge to change its width.')}`,
    },
    {
      id: 'long', title: '7. Long questions and case studies',
      body: `${steps([`Type the scenario in the ${b('Question')} box.`, `Type sub-question (a). Click ${b('+ Sub-question')} to add (b), (c) and so on.`, `Inside a sub-question, click ${b('+ Part')} to add parts such as (b)(i), (b)(ii).`, `Give each part its marks. The total is added up for you.`, `Click ${b('Answer')} under a part to add its model answer.`])}
        ${img('editor-long', 'Sub-questions (a), (b) and a part (b)(i)')}
        ${tip('A <b>Short</b> question can be turned into a long one with <b>Add sub-questions</b>.')}`,
    },
    {
      id: 'tf', title: '8. Several True / False statements at once',
      body: `${steps([`Choose ${b('True / False')}, type the first statement and choose ${b('True')} or ${b('False')}.`, `Click ${b('Add another statement')} for each extra statement, each with its own True / False.`, `Click ${b('Save draft')} or ${b('Submit')}. Each statement is saved as its own question.`])}
        ${img('editor-true-false', 'Two statements, each with its own answer')}`,
    },
    {
      id: 'answer', title: '9. Answer key and private notes',
      body: `${steps([`${b('Model answer')}: the answer printed in the answer key.`, `${b("Examiner's advice")}: marking guidance, also printed in the answer key only.`, `${b('Private notes')}: the source and comments. These are never printed.`])}
        ${img('editor-answer-key', 'The answer key section of the editor')}`,
    },
    {
      id: 'save', title: '10. Save or submit',
      body: `${steps([`${b('Save draft')}: keeps your work so you can finish it later. Only you can see drafts.`, `${b('Submit')}: sends the question to the administrator for review. While it is in review you cannot change it.`, `${b('Cancel')}: closes without saving.`])}
        ${img('editor-footer', 'The buttons at the bottom of the editor', 70)}
        <p>The window buttons at the top right let you ${b('minimise')} the editor (your text is kept; click the bar at the bottom of the screen to bring it back), ${b('maximise')} it to full screen, or ${b('close')} it.</p>
        ${img('editor-window-buttons', 'Minimise, maximise and close', 90)}`,
    },
    {
      id: 'list', title: '11. Your questions and what each status means',
      body: `${img('teacher-questions', 'The Questions page')}
        <table><tr><th>Status</th><th>Meaning</th><th>What you can do</th></tr>
          <tr><td>${b('Draft')}</td><td>Not sent yet</td><td>Edit, submit, duplicate or delete</td></tr>
          <tr><td>${b('In review')}</td><td>Waiting for the administrator</td><td>Wait; it cannot be changed now</td></tr>
          <tr><td>${b('Returned')}</td><td>The reviewer asked for changes</td><td>Read the comment, edit, submit again</td></tr>
          <tr><td>${b('Approved')}</td><td>Accepted; can be used in papers</td><td>Duplicate it to make a variation</td></tr></table>
        ${tip('Use the search box, the subject and type filters, and the <b>Mine</b> button to find questions quickly.')}`,
    },
    {
      id: 'returned', title: '12. When a question is returned',
      body: `${steps([`Open ${b('Returned')} (or the "Returned to me" tile on the dashboard).`, `Read the reviewer's comment under the question.`, `Click ${b('Edit')}, make the changes, then click ${b('Submit')} again.`])}
        ${img('teacher-returned', 'A returned question with the reviewer’s comment')}`,
    },
    {
      id: 'bin', title: '13. Recycle bin',
      body: `${steps([`The bin icon on a question moves it to the ${b('Recycle bin')} (approved questions cannot be deleted by teachers).`, `Open ${b('Recycle bin')} on the Questions page to see deleted questions.`, `${b('Restore')} brings a question back. ${b('Delete permanently')} removes it for ever.`])}
        ${img('teacher-bin', 'The recycle bin')}
        ${note('A question that is used in a paper cannot be deleted permanently.')}`,
    },
    // ------------------------------------------------------------------ Part C
    {
      id: 'review', part: 'Part C · Administrators', title: '14. Review questions',
      body: `${steps([`Open ${b('Review')}. Click a question's title to read it in full.`, `Click the ${b('tick')} to approve, or the ${b('cross')} to return it to the author.`, `When returning, write what should be changed. A comment is required.`])}
        ${img('admin-review-queue', 'Questions waiting for review')}
        ${img('admin-review-return', 'Returning a question with a comment', 85)}`,
    },
    {
      id: 'paper', title: '15. Build a paper',
      body: `${steps([`Open ${b('Papers')} and click ${b('New paper')}.`, `${b('Details')}: title, subject, session, exam date, maximum marks, duration and reading time. Under ${b('Prepared by')}, enter the teacher, Research Officer(s) and admin (printed on the answer key only).`, `${b('Questions')}: click ${b('+')} next to approved questions to add them. Use the arrows to change the order, choose the section, and ${b('New page')} to start a question on a new page.`, `${b('Preview')} shows the paper exactly as it will print.`, `Click ${b('Save')}. ${b('Finalise')} becomes available when the total marks match the maximum marks.`])}
        ${img('builder-details', 'Paper details')}
        ${img('builder-questions', 'Adding approved questions to the paper')}
        ${img('builder-preview', 'Preview of the paper')}`,
    },
    {
      id: 'download', title: '16. Download the paper and answer key',
      body: `${steps([`Open the ${b('Download')} tab.`, `Click ${b('Question paper')} or ${b('Answer key')} to download the PDF.`, `A draft paper prints with ${b('DRAFT – FOR REVIEW')} across each page. Share drafts for checking, then ${b('Finalise')} to print clean copies.`, `${b('History')} lists every saved version.`])}
        ${img('builder-download', 'The Download tab')}`,
    },
    {
      id: 'users', title: '17. Users',
      body: `${steps([`Open ${b('Users')} and click ${b('Add user')}.`, `Enter the full name and a username, choose the ${b('role')}, and tick the ${b('subjects')} for teachers and Research Officers.`, `Enter a temporary password and send it to the person. They choose their own at first sign-in.`, `The row buttons can edit a user, reset a password, unlock an account or deactivate it.`])}
        ${img('admin-add-user', 'Adding a teacher', 80)}`,
    },
    {
      id: 'format', title: '18. Paper format',
      body: `<p>${b('Paper format')} controls fonts, sizes, spacing and margins of every paper. Changed values are highlighted with a small ${b('↺')} button that puts the standard value back. ${b('Reset to standard')} restores everything. Nothing is saved until you click ${b('Save')}.</p>
        ${img('admin-format', 'The paper format editor')}`,
    },
    // ------------------------------------------------------------------ Part D
    {
      id: 'faq', part: 'Part D · Help', title: '19. Questions and problems',
      body: `<table><tr><th>Problem</th><th>What to do</th></tr>
          <tr><td>I forgot my password</td><td>Ask the administrator to reset it.</td></tr>
          <tr><td>"Account locked"</td><td>Wait 15 minutes, or ask the administrator to unlock it.</td></tr>
          <tr><td>I cannot edit my question</td><td>It is in review or approved. Wait for the review, or duplicate it.</td></tr>
          <tr><td>I do not see a subject</td><td>Ask the administrator to add the subject to your account.</td></tr>
          <tr><td>The page does not open</td><td>Check your internet connection and try again. During the beta, ask for the current link.</td></tr></table>
        ${note('This is a <b>beta (test) version</b>. Please do not enter real or upcoming exam questions yet; test data may be deleted.')}
        <h3>Reporting a problem</h3>
        <p>Send the administrator: what you were doing, what you expected, what happened, and a ${b('screenshot')}.</p>`,
    },
  ];

  const toc = sections.map((s) => `${s.part ? `<li class="part">${esc(s.part)}</li>` : ''}<li><a href="#${s.id}">${esc(s.title)}</a></li>`).join('');
  const body = sections
    .map((s) => `${s.part ? `<h1 class="part">${esc(s.part)}</h1>` : ''}<section id="${s.id}"><h2>${esc(s.title)}</h2>${s.body}</section>`)
    .join('');

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>SKANS Question Bank – User Guide</title>
<style>
  *{box-sizing:border-box}
  body{font-family:'Segoe UI',Arial,sans-serif;color:#1f2937;font-size:10.5pt;line-height:1.5;margin:0}
  .cover{height:250mm;display:flex;flex-direction:column;justify-content:center;align-items:flex-start;padding:0 8mm;break-after:page}
  .cover img{width:70mm;margin-bottom:18mm}
  .cover h1{font-size:30pt;color:#1b2a4b;margin:0;line-height:1.1}
  .cover .sub{font-size:15pt;color:#c08a2e;margin:4mm 0 10mm;font-weight:600}
  .cover p{color:#475569;margin:1mm 0}
  .bar{width:22mm;height:2mm;background:#c08a2e;border-radius:1mm;margin-bottom:8mm}
  .toc{break-after:page}
  .toc h2{border:0}
  .toc ol{list-style:none;padding:0;columns:1}
  .toc li{padding:1.2mm 0;border-bottom:.3mm dotted #cbd5e1}
  .toc li.part{border:0;padding-top:5mm;color:#c08a2e;font-weight:700;text-transform:uppercase;font-size:9pt;letter-spacing:.05em}
  .toc a{color:#1b2a4b;text-decoration:none}
  h1.part{break-before:page;font-size:18pt;color:#fff;background:#1b2a4b;padding:5mm 6mm;border-radius:3mm;margin:0 0 6mm}
  h2{font-size:14pt;color:#1b2a4b;border-bottom:.5mm solid #e2e8f0;padding-bottom:1.5mm;margin:7mm 0 3mm}
  h3{font-size:11pt;color:#1b2a4b;margin:5mm 0 2mm}
  section{break-inside:auto}
  p{margin:0 0 3mm}
  ol.steps{margin:0 0 4mm;padding-left:6mm}
  ol.steps li{margin:0 0 1.5mm;padding-left:1mm}
  ol.steps li::marker{color:#c08a2e;font-weight:700}
  figure{margin:2mm auto 5mm;break-inside:avoid}
  figure img{width:100%;border:.3mm solid #cbd5e1;border-radius:2.5mm;display:block}
  figcaption{font-size:8.5pt;color:#64748b;text-align:center;margin-top:1.5mm}
  table{width:100%;border-collapse:collapse;margin:2mm 0 5mm;font-size:9.5pt;break-inside:avoid}
  th{background:#1b2a4b;color:#fff;text-align:left;padding:1.8mm 2.5mm}
  td{border-bottom:.3mm solid #e2e8f0;padding:1.8mm 2.5mm;vertical-align:top}
  .tip,.note{border-radius:2.5mm;padding:2.5mm 3.5mm;margin:2mm 0 5mm;font-size:9.5pt;break-inside:avoid}
  .tip{background:#ecfdf5;border-left:1.2mm solid #059669}
  .note{background:#fffbeb;border-left:1.2mm solid #d97706}
  .tip b:first-child,.note b:first-child{display:block;margin-bottom:.5mm}
</style></head><body>
<div class="cover">
  <img src="${logo}" alt="SKANS School of Accountancy">
  <div class="bar"></div>
  <h1>SKANS Question Bank</h1>
  <div class="sub">User Guide · Beta version</div>
  <p>For teachers, Research Officers and administrators</p>
  <p>October 2026</p>
</div>
<div class="toc"><h2>Contents</h2><ol>${toc}</ol></div>
${body}
</body></html>`;
}
