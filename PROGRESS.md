# SKANS Question Bank — Production Hardening Progress

The earlier prototype log (milestones 1–7 of the demo build) is kept in
[docs/PROTOTYPE-HISTORY.md](docs/PROTOTYPE-HISTORY.md).

## Milestone 0 — Audit (21 October 2026)

No application code was changed during the audit.

### Architecture

| Layer | Implementation |
|---|---|
| Workspaces | npm workspaces: `shared` (zod schemas, types, marks, template config), `server`, `client` |
| Server | Express 4 + TypeScript (tsx runtime, `tsc --noEmit` typecheck), routes in `server/src/routes` |
| Database | Prisma 6 on SQLite; enums and JSON stored as `String` for PostgreSQL portability; no migrations folder (`prisma db push`) |
| Auth | express-session with a Prisma-backed session store, HttpOnly `SameSite=Strict` cookie (`secure` in production), synchroniser CSRF token, bcrypt (12 rounds), per-account lockout, login and API rate limits, Helmet CSP |
| RBAC | `requireRole` route guards, `assertSubject` subject scope, row-level `questionVisibility` in every question query |
| Rendering | `server/src/render/paperHtml.ts` builds one self-contained HTML document (embedded fonts and logos) used for both the live preview iframe and the Playwright PDF |
| Client | React 18 + Vite + Tailwind + React Router; TipTap editor; four large screen files (`QuestionBank`, `PaperBuilder`, `Admin`, `App`) |
| Tests | Vitest: 10 shared unit tests; 5 server tests (Supertest + real PDF) |

### Baseline results

| Command | Result |
|---|---|
| `npm run typecheck` | Pass (shared, server, client) |
| `npm test` | Pass: shared 10/10, server 5/5 |
| `npm run build` | Client build is reached only after server `prisma generate`. Server build failed with `EPERM` renaming the Prisma query-engine DLL, because the user's own `npm run dev` (ports 4000/5173) holds the DLL open. This is a Windows file lock, not a code defect. |
| `npm run pdf:samples -w server` | Pass: FAR paper is 2 pages, FAR key, TAX paper and TAX key are 1 page each |
| Running app | Dev server already running on 4000/5173 |

### Existing working features

- Login/logout, change password, session cookies, CSRF with client retry, account lockout, admin unlock/reset.
- Question CRUD with six types, status workflow (draft → submitted → approved/rejected), soft delete/restore, duplicate, search and filters.
- Review endpoint with mandatory rejection comment (shared `reviewSchema`).
- Paper CRUD with ordered items, sections, marks overrides, server-side marks validation on finalise, version snapshots, duplicate, version restore, auto-generate endpoint.
- HTML preview and PDF downloads (paper and answer key) through the same renderer, optional watermark, audit entries for every mutation and download.
- Admin screens for users, subjects, templates (raw JSON) and the audit log.

### Defects and gaps found

**Data and seed**

1. **Destructive seed (high).** `prisma/seed.ts` deletes every table, including users and audit logs, and `npm run setup` / `db:setup` always runs it. Rerunning setup on a school server would wipe live data.
2. The seeded **FINAL** FAR paper contains a **DRAFT** question (`far-short`), which breaks the approved-only rule.
3. Seed question marks bypass `computeQuestionMarks`: the FAR impairment question stores 12 marks but its parts total 4, so the paper header total and the printed marks disagree.
4. Seeded FINAL papers have no version snapshot (`currentVersion = 0`), so they print from live data.
5. PRC-level subjects (CR, AAE) are seeded although the system is CAF-only.
6. **Server tests run against the development database** and change its data (they approve a submitted question).

**Security and RBAC**

7. Teachers can edit their own **SUBMITTED** questions while those questions wait for review. The specification allows editing only drafts and rejected questions.
8. HOA and ADMIN can approve **other people's drafts and rejected questions** without the author resubmitting them, which skips the submission step.
9. Users flagged `mustChangePassword` get 403 on every API call, but the client never redirects them to the change-password screen, so the app appears broken.
10. Test coverage is thin. There are no tests for CSRF, lockout, password change, HOA scope, teacher review/PDF denial, rejection comments, approved-only papers, admin CRUD or audit records.

**Question lifecycle (client)**

11. **Data loss on edit (high).** The editor does not load saved MCQ options, true/false answers or long-question parts. Opening an existing MCQ and saving it replaces its options with "Option A–D".
12. MCQ option text and examiner advice are plain-text inputs that strip formatting. Part answers and sub-parts cannot be edited. An MCQ group supports only one item.
13. There is no "Save and submit" action in the editor and no dedicated review queue. The review modal shows no question preview and reads its comment from the DOM.
14. The preview shows only MCQ options and omits parts, answers and advice.

**Paper management**

15. The client marks total ignores structured marks: overrides on MCQ groups and long questions are ignored by the server but counted by the client, so the two can disagree.
16. Saved papers cannot be deleted, duplicated or reopened from version history in the UI. FINAL papers open as editable without warning.

**PDF and templates**

17. **Running header missing on the CAF template (bug).** The header font (Carlito) is used only in `@page` margin boxes, so Chromium never loads the embedded font and `font-display:block` leaves "Page X of Y" invisible. The SKANS template works because its header font matches the body font.
18. **Branding risk.** `client/public/branding/exam-body-logo.svg` is a home-made crest labelled "ICAP" and is printed on every CAF paper. The template is named "ICAP Exam Style", and the SKANS logo is also an unofficial placeholder. The brief allows only authorised logos.
19. Template editing is raw JSON only and is available to ADMIN only. HOA has the API but no UI.
20. Answer-key MCQ tables and examiner advice work. Internal comments, review comments and source notes are not rendered; this was confirmed in `paperHtml.ts`.

**Admin and tablet UX**

21. The admin screen uses CSS classes (`primary`, `secondary`, `label`) that are not defined, so its buttons render unstyled.
22. The ADMIN dashboard shows a pending-review count of 0 (computed for HOA only), no paper count, no recent activity and no quick actions.
23. The sidebar is a fixed 288 px from 768 px upwards and cannot be collapsed, which wastes a third of an iPad portrait screen. List rows use wide flex rows, and the paper-builder rows overflow on tablets.
24. Password reset uses `window.prompt`, and the users list has no deactivate shortcut.

**Dependencies**

25. `npm audit` reported 48 advisories at the prototype audit. They were not changed blindly and are recorded for review.

### Recommended implementation order (adopted)

1. **M1 Foundation:** make the seed non-destructive and idempotent (`--reset` explicit), fix the seed data (marks, approved-only, CAF-only, version snapshots), isolate the test database, and document the environment.
2. **M2 Authorization:** tighten edit and review state rules, enforce the forced password change in the client, and add a broad permission test suite.
3. **M3 Question lifecycle:** rebuild the editor so it loads every content type and has rich options and parts, add save-and-submit, a review queue page with preview and required rejection comment, and a full preview.
4. **M4 Paper management:** fix structured-marks totals, add a saved-papers list with open/duplicate/delete/versions, and add a reopen guard for FINAL papers.
5. **M5 PDF output:** fix the running-header font, remove unauthorised branding (print a logo only when an authorised file is present), rename the template to "CAF Examination Paper", and add automated PDF text, page-count and URL checks.
6. **M6 Admin and tablet UX:** admin dashboard, styled admin forms, collapsible sidebar, card layouts on tablets, and a template form for common fields.
7. **M7 Handover:** README, production env example, backups, PostgreSQL notes, final validation.

No schema change is planned, so Prisma client regeneration (blocked by the running dev server's file lock) is not needed.

## Milestone 1 — Stabilise foundation

- [x] **Done.** The seed is non-destructive and idempotent. `npm run db:seed` and `npm run setup` create only missing templates, CAF subjects and demo accounts, and never modify existing rows (passwords and admin edits survive). Demo questions and papers are added only when the question bank is empty. Verified by seeding a fresh database twice: the second run created 0 rows.
- [x] **Done.** Destructive reset is explicit: `npm run db:reset` (`seed.ts --reset`). It is refused when `NODE_ENV=production` unless `--force` is added.
- [x] **Done.** Seed data corrected:
  - Marks are computed with `computeQuestionMarks`.
  - The FINAL FAR paper contains only APPROVED questions and totals 30/30.
  - Both sample papers have a frozen version-1 snapshot.
  - PRC subjects (CR, AAE) were removed (CAF only).
  - MFA demo questions are assigned to MFA instead of FAR.
- [x] **Done.** Server tests use a brand-new SQLite file in the OS temp directory per run (`server/vitest.config.ts`, `tests/global-setup.ts`) and delete it afterwards. They no longer modify `dev.db`. Prisma's AI-safety guard refused `db push --force-reset`. The design therefore needs no destructive command; the guard was not bypassed.
- [x] **Done.** `BRANDING_DIR` is documented in `server/.env.example`.
- Validation: server typecheck passes; server tests 5/5 pass.

## Milestone 2 — Production authorization

Rules tightened on the server (`server/src/lib/access.ts`):

- [x] **Done.** Teachers can edit only their own **DRAFT** or **REJECTED** questions. A **SUBMITTED** question is frozen until it is reviewed (clear 403 message).
- [x] **Done.** Reviewers (HOA within assigned subjects, ADMIN everywhere) decide on **SUBMITTED** questions. Another person's draft or rejected question must be (re)submitted by its author first. Reviewers may still approve their own drafts.
- [x] **Done.** Client: accounts flagged `mustChangePassword` now see a dedicated change-password screen instead of a broken workspace.
- [x] **Done.** The dashboard shows the ADMIN pending-review count and recent papers school-wide (previously HOA only).
- [x] **Done.** A startup warning appears when `NODE_ENV=production` runs without `TRUST_PROXY=1`, because Secure cookies would not stick behind Nginx.
- [x] **Done (found while adding PDF tests; planned for M5).** The CAF running header ("Page X of Y") was invisible. The renderer now forces the header font to load.

Reviewed and kept: bcrypt (12 rounds) with a timing-equalised unknown-user path, session regeneration on login and password change, sessions destroyed on deactivation, reset and password change, HttpOnly `SameSite=Strict` cookie (Secure in production), synchroniser CSRF token, account lockout, login and API rate limits, Helmet CSP, zod validation, sanitize-html on save and render. No security control was weakened.

New regression tests (server: 35 tests in 4 files, all passing):

- `tests/auth.test.ts`:
  - 401 when unauthenticated
  - generic login error
  - cookie flags
  - no password hashes in any response
  - logout
  - CSRF missing, wrong or stale token
  - token rotation
  - forced password change and its validation
  - admin reset signs the user out
  - lockout and unlock
  - deactivation
- `tests/rbac.test.ts`:
  - teacher denied papers, PDFs, preview, users, audit, templates and subjects
  - teacher subject isolation
  - teacher cannot see other teachers' drafts
  - teacher cannot review
  - teacher cannot edit submitted or approved questions
  - HOA subject scope for questions and papers
  - HOA template edit scope
  - nobody approves an unsubmitted draft
  - ADMIN user, subject and template CRUD with validation and audit
  - audit filter
  - admin dashboard counts
- `tests/papers.test.ts`:
  - rejection requires a comment
  - reject → resubmit → approve with audit trail
  - ADMIN review
  - approved-only, same-subject and non-deleted paper items
  - duplicate items rejected
  - marks under or over blocks finalising
  - HTML preview hides answers, advice, internal comments, source and review comments
  - question-paper PDF: headers, filename, page count, title, date, watermark, no URL/browser date, no answers or private notes
  - answer-key PDF contains answers and advice but no private notes
  - download audit records
  - "Page X of Y" on every page after page 1

## Milestone 3 — Question lifecycle

- [x] **Done.** New question editor (`client/src/questions/`):
  - Fixed the edit data-loss bug: every content type now loads from the saved question (MCQ options and correct answer, MCQ-group items, true/false, parts, sub-parts and part answers).
  - Rich-text MCQ options with stable editors.
  - MCQ groups with any number of items.
  - Long and case-study questions support parts, sub-parts, per-part model answers and a label-style choice.
  - Marks of structured questions are derived exactly as on the server.
  - Client-side validation; the server still validates everything.
  - "Save draft" and "Save & submit for review" actions.
  - The reviewer's rejection comment is shown to the author.
  - Clearly separated "Answer key only" (answer, advice) and "Private — never printed" (source, internal comments) sections.
- [x] **Done.** TipTap toolbar:
  - Bold, italic, underline, superscript, subscript, bulleted and numbered lists, and left/centre/right alignment (for figures).
  - Insert table, add/delete row and column, merge, split, header row, delete table.
  - 36 px touch targets.
  - A built-in help panel explains that merge needs adjacent selected cells, that the header row is the table's first row, and that header rows repeat on printed pages. Word/Excel paste is cleaned by the server sanitiser.
- [x] **Done.** New **Review queue** page (`/review`, ADMIN and HOA):
  - Shows submitted questions oldest first with subject, topic, type, marks, author and submission time.
  - Inline preview, Approve, and Reject with a mandatory comment.
- [x] **Done.** Question bank:
  - Responsive cards and URL-based filters.
  - Debounced search; "Mine" and "Recycle bin" (restore) filters.
  - Actions mirror the server rules: no edit button while a question awaits review.
  - Confirmation dialog before deletion.
  - Full preview of every type.
- [x] **Done.** Seed fix: the AUD/CMA/BL/MFA demo questions are now filed under their own subjects (the AUD ones were under FAR).
- Browser verification (Playwright against an isolated server on :4100 with its own temporary database; the user's running dev server and `dev.db` were not touched):
  1. teacher_far creates an MCQ with a table and four options and saves it.
  2. On reopening, the options, correct answer and table are intact.
  3. Save & submit hides the edit button.
  4. hoa_far previews the question in the queue; Reject stays disabled until a comment is entered, then rejects.
  5. The teacher sees the comment, edits and resubmits.
  6. HOA approves.
  7. No horizontal overflow at 768 px.
- Tests: shared 10/10, server 35/35, client typecheck and build pass.

## Milestone 4 — Paper management

- [x] **Done.** **Saved papers library** (`/papers`):
  - Search and status filter.
  - Cards with subject, format, status, a total/max marks indicator, version, author and date.
  - Open, paper PDF, answer-key PDF, version history (restore as a new draft), duplicate, and delete (with confirmation).
- [x] **Done.** **Four-step builder** that works on tablets: 1 subject & paper format, 2 paper details, 3 questions, 4 review & output. The open paper and step are kept in the URL, so Back/refresh works.
- [x] **Done.** Paper details:
  - Title and optional heading override, session, date, duration, reading time, maximum marks, batch, teacher, and test number.
  - Template instructions are shown, or the paper can opt into custom instructions (bold and `{count}` tokens explained).
- [x] **Done.** Marks:
  - The client total now uses the shared `effectiveItemMarks`/`checkPaperMarks`, so it always agrees with the server.
  - Overrides are locked for MCQ groups and long questions (their marks come from parts), with a reset-to-original link.
  - Finalise is disabled unless the total equals the maximum; the server enforces this too.
- [x] **Done.** Only approved questions of the chosen subject are offered. Changing subject asks before clearing the paper. Questions can be previewed (without private notes), reordered with arrow buttons (touch) or by drag (desktop), assigned to sections, and set to start on a new page.
- [x] **Done.** FINAL papers:
  - A banner explains that downloads print the frozen version.
  - Saving changes requires confirming "Reopen as draft"; the final version stays in the history.
- [x] **Done.** Downloads use plain links, so they work on iPad Safari without pop-up blocking, with an optional CONFIDENTIAL watermark. The live preview modal can switch between paper and answer key.
- [x] **Done.** Race fixed: a title typed before the lists finished loading was being overwritten.
- Browser verification on the isolated :4100 instance (hoa_far):
  1. The library lists the seeded papers.
  2. New paper: steps 1–4. Two approved questions give a 9/20 warning; MCQ-group marks are locked; a single-MCQ override brings the total to 20/20; reorder works.
  3. The live preview shows the typed title.
  4. Finalise shows version 1 and the final banner.
  5. `FAR_Autumn2026_Paper.pdf` and `FAR_Autumn2026_AnswerKey.pdf` download.
  6. Version history opens.
  7. No horizontal overflow at 768 px.
- Not added (no fake controls): rule-based auto-generation UI. The `/papers/auto-generate` endpoint remains available for a later iteration.

## Milestone 5 — Professional PDF output

- [x] **Done.** Branding:
  - Removed both placeholder logos: a home-made crest labelled "ICAP", and an unofficial SKANS mark.
  - Papers now print a logo only when an authorised file is present (`client/public/branding/README.md` explains names, format and the written-authorisation rule). Without one, the SKANS header prints the institute name as text and the CAF header prints no logo.
- [x] **Done.** The template display name is "CAF Examination Paper", with a description stating that fonts, margins, logo and wording are provisional. The seed renames only the untouched prototype default ("ICAP Exam Style"). Internal keys (`ICAP_EXAM`, `layout: 'ICAP'`) are unchanged so stored configurations keep working. The login page no longer advertises "ICAP-style" papers.
- [x] **Done.** "Page X of Y" running header fixed on the CAF format (done in M2, now covered by tests).
- [x] **Done.** Marks after a table or option grid no longer float into the next part. This fixed "(03 marks) (08 marks)" printing on one line and "(10 marks)" printing beside "THE END".
- [x] **Done.** Short single questions (short, MCQ, true/false) are kept on one page. Long questions may flow across pages. Short tables and individual MCQ items never split.
- [x] **Done.** When the MCQs of one printed question do not all carry one mark, each item shows its marks, so a 5-mark MCQ is no longer printed without marks.
- [x] **Done.** Automated PDF validation (`server/tests/papers.test.ts`):
  - page count matches `X-Page-Count`
  - title, date and watermark text present
  - no URL, `about:blank`, `file://`, `localhost` or browser date stamp
  - answers and private notes absent from the paper
  - answers and advice present in the key, private notes absent
  - "Page X of Y" on every page after page 1
  - long-table header row repeated on every page the table spans
  - SKANS header fields printed
  - no logo without an authorised file

Comparison with the reference documents in `samples/` (visual comparison of rendered pages; no pixel-diff tool is installed):

| Aspect | SKANS Internal Test vs `TAX BATCH 1.pdf` | CAF Examination Paper vs `FAR-Spring-2026.pdf` |
|---|---|---|
| Header layout | Same structure: logo/name, two-column Batch/Teacher/Test and Time/Max/Reading/Date block, ruled title band, underlined "Instruction:" with (i)–(iv) | Same structure: level line, subject title, date / marks / duration lines, boxed instructions, section bars, "QUESTION n" headings, "(THE END)" |
| Running header | The reference has none; its browser URL/date header is exactly what we suppress. The current template prints a footer, which is configurable | Matches "Session ┃ Subject … Page X of Y", skipped on page 1 |
| Fonts | Arial-metric (Arimo) body with Times-metric (Tinos) headings, embedded | Times-metric (Tinos) body, Calibri-metric (Carlito) running header, embedded |
| Logo | Text fallback until an authorised file is supplied | None until an authorised file is supplied |

**Not claimed:** an exact match. Exact fonts, sizes, margins and spacing must be set from the approved school specification when it is supplied. These values are data in the template configuration, not code. Template text, such as the CAF MCQ intro "Each MCQ carries ONE mark", should also be confirmed by the school.

Validation: shared 10/10, server 37/37, full typecheck passes. Sample PDFs were regenerated from a freshly seeded temporary database (`output/`, git-ignored).

## Milestone 6 — Admin and tablet UX

- [x] **Done.** App shell (`client/src/App.tsx`):
  - Navigation follows the recommended structure: Dashboard, Review queue, Question bank, Paper builder, Users, Subjects, Templates, Audit log, filtered by role.
  - Below 1024 px (iPad portrait and landscape) the sidebar is a drawer with an overlay and closes after navigation. On desktop it can collapse to an icon rail, remembered per browser with a storage fallback.
  - Sticky top bar; 44 px touch targets; an in-app 404 page.
- [x] **Done.** Dashboard (`client/src/Dashboard.tsx`), all tiles linking to filtered lists:
  - ADMIN: pending review, approved, rejected, drafts, papers, active users, subjects, templates.
  - HOA: pending review, approved, rejected, drafts.
  - Teacher: drafts, awaiting review, approved, sent back.
  - Quick actions, recent papers, recent activity, and per-subject counts (scrollable table).
- [x] **Done.** Users:
  - Search and role/status filters; responsive cards with role, status, locked badge, last sign-in and subject chips.
  - Add/edit form with subject checklist and a generated policy-compliant temporary password (works without HTTPS).
  - Reset-password dialog (replaces `window.prompt`).
  - Unlock, and deactivate/activate with confirmation (you cannot deactivate yourself; the server also protects the last administrator).
- [x] **Done.** Subjects: cards with inline default-format selection, and an add/edit form (code, name, level, format, active).
- [x] **Done.** Templates (ADMIN, and HOA where permitted):
  - "Common settings" form covering fonts, size, line height, margins, institute line, logo choice, date format, batch/teacher/test fields, instructions (title, numbering, box, lines), heading pattern and style, gap, marks format and position, sections, running header/footer text, position and first page, and end text.
  - "Advanced (JSON)" tab for everything else, validated by the server.
  - Duplicate a template to start a new format.
  - HOA gets a view-only editor for templates shared with subjects outside their scope.
- [x] **Done.** Audit log: filters by action, username, record type and date range; paging; expandable details with IP.
- [x] **Done.** Fixed: the admin screens used undefined CSS classes (`primary`, `secondary`, `label`), so their buttons were unstyled. These are now shared utility classes.
- Browser verification (isolated :4100 instance):
  1. Admin dashboard.
  2. Create a teacher with a generated password.
  3. Change template font size via the form and see "11 pt".
  4. Filter the audit log to USER_CREATE.
  5. Sidebar collapse and expand.
  6. At 768×1024: no horizontal overflow on Dashboard, Users, Subjects, Templates, Audit, Review queue, Papers and Question bank; drawer navigation works.
  7. The new teacher is forced to change the temporary password, then reaches the teacher workspace.
  8. hoa_audit sees templates as view-only.
