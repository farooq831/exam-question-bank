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

## Milestone 7 — Deployment and handover

- [x] **Done.** `README.md` rewritten. It covers:
  - architecture and setup
  - environment variables and database commands (destructive ones marked)
  - demo accounts and the role-permission matrix
  - development, test and PDF commands
  - how to add or change a template and add authorised branding
  - SQLite → PostgreSQL migration (including case-sensitivity and sequence notes)
  - school-server deployment, Nginx/HTTPS, firewall, backups and restore
  - tablet and browser support, and current limitations
- [x] **Done.** `server/.env.production.example` with production values and guidance.
- [x] **Done.** `npm run db:backup`: an online, consistent SQLite backup (`VACUUM INTO`) plus a copy of the branding folder, timestamped in local time. Verified on a temporary database.
- [x] **Done.** Dependency review (`npm audit --omit=dev`): 38 moderate/high advisories, all transitive or requiring major upgrades (TipTap, React Router, Prisma tooling, csv-parse). Not force-upgraded. The one reachable issue — csv-parse prototype replacement through CSV headers in the HOA/teacher import endpoint — is mitigated in code and covered by a new test.

### Final validation (21 October 2026)

| Check | Result |
|---|---|
| `npm test` | shared 10/10, server 38/38 (fresh temporary database per run) |
| `npm run typecheck` | 0 errors (shared, server, client) |
| `npm run build -w client` | Pass |
| Server typecheck (`tsc --noEmit`) | Pass. `npm run build -w server` also runs `prisma generate`, which fails with `EPERM` only while another `npm run dev` holds the Prisma engine DLL (Windows file lock). Stop the dev server first. |
| Browser checks (Playwright, isolated instance) | Question lifecycle, paper builder, admin screens, forced password change, iPad-portrait layout of 8 screens (no horizontal overflow) |
| User's running dev server (4000/5173, `dev.db`) | Healthy after all changes; its data was not modified by any test or seed |

### What works

- **Teacher:** writes all six question types with tables and answers in assigned subjects only, then saves and submits.
- **Review:** ADMIN/HOA review from the queue; rejection requires a comment and the author resubmits.
- **Papers:**
  - only approved questions are offered
  - the 4-step builder validates marks
  - live preview uses the PDF renderer
  - finalise, version history, duplicate and delete
  - paper and answer-key PDFs with optional watermark
- **Admin:** dashboard, users, subjects, templates (form + JSON), audit log.
- **Permissions:** all enforced on the server, with 38 automated tests.

### What remains (needs school input or a later iteration)

1. Approved CAF and SKANS specifications and sample papers. Set the template values from them, then compare page by page; no exact match is claimed yet.
2. Authorised logo files and written permission for any examining-body mark.
3. Optional interfaces for CSV import and rule-based auto-generation (the server endpoints exist).
4. Planned major-version dependency upgrades (TipTap 3, React Router 7, Prisma 7) to clear the remaining advisories.
5. Before go-live: deactivate the demo accounts, set real passwords, and schedule `npm run db:backup`.

## Follow-up — permanent deletion from the recycle bin

- [x] **Done.** "Delete permanently" in the Question bank recycle bin, with a red confirmation dialog warning that the action cannot be undone. The endpoint is `DELETE /api/questions/:id/permanent`.
- Rules, all server-enforced:
  - Only ADMIN, or HOA within assigned subjects; teachers can still only recycle and restore.
  - The question must already be in the recycle bin.
  - Refused (409) if the question is used in any paper, so papers and their versions never lose content. The button is disabled with an explanation in that case.
  - Each deletion is recorded as `QUESTION_PURGE` in the audit log, with subject, topic, type and author.
- Tests: 2 new server tests cover recycle-bin-first, teacher denied, HOA allowed, removal from the database, the audit record, and refusal when used in a paper. Totals: shared 10/10, server 40/40, typecheck clean.

## Follow-up — SKANS internal system: two roles, no demo data, SKANS branding (21 October 2026)

- [x] **Two roles only (ADMIN, TEACHER).**
  - The HOA role is removed from schemas, server rules, routes, the client and tests.
  - ADMIN now reviews questions, builds and downloads papers, manages templates, and can create and edit any question.
  - Legacy `HOA` accounts are converted to TEACHER by the seed and are treated as TEACHER until then (least privilege). Creating an HOA user is rejected.
- [x] **Sub-questions.** Previously they appeared only after choosing the "Long question" type.
  - Short questions now offer **Add sub-questions** (a), (b)…
  - Sub-questions can be split further into parts, e.g. (ii)(a).
  - Labels read "Sub-question (i)" and "Part (ii)(a)"; type names read "Long question (with sub-questions)".
- [x] **Demo data removed from the product.**
  - The seed is now a production bootstrap: SKANS formats, CAF subjects, and one `admin` with a one-time random password (or `SKANS_ADMIN_PASSWORD`) that must be changed at first sign-in.
  - Demo users, questions and papers moved to `server/tests/fixtures/` and are loaded only into the temporary test database.
  - `db:reset` no longer uses Prisma's `--force-reset`; the seed deletes data itself.
  - `pdf:samples` renders a built-in example instead of reading demo papers.
  - `dev.db` was backed up to `server/backups/skans-20261021-153853/` and then reset to a clean system.
- [x] **ICAP removed; SKANS branding.**
  - The format is now **SKANS CAF Examination** (`SKANS_CAF`, layout `CAF`). Its formatting is taken from the reference CAF paper, with the SKANS logo (`client/public/branding/skans-logo.jpg`, supplied by the school) at the **top right**.
  - The SKANS Internal Test format prints the same logo top left.
  - The app sidebar and sign-in page use `skans-logo-dark.jpg`, and the theme colours match the logo (navy `#1B2A4B`, gold `#C08A2E`).
  - The exam-body logo option is removed. Old saved configs (`layout: 'ICAP'`, `logo: 'exam-body'`) are read as `CAF` / `skans`, and the seed renames `ICAP_EXAM` to `SKANS_CAF`.
- Pending from the administration: full CAF paper names, one finalised standard sample paper, and formatting guidelines (font family, size and weight, margins, line spacing, paragraph spacing). Current values are provisional and editable in **Templates**.
- Validation:
  - Tests: shared 11/11, server 40/40; typecheck clean.
  - Browser check on an isolated instance: bootstrap admin forced password change; navigation shows no HOA; empty bank; question with sub-questions (i), (ii) and part (ii)(a) saved.
  - Sample PDFs show the SKANS logo top right (CAF) and top left (internal test).
  - The user's dev server signs in as the new `admin`.

## Follow-up — college logo and sign-in access (21 October 2026)

- [x] Replaced the SKANS School System logo (uploaded by mistake) with the **SKANS School of Accountancy** college logo:
  - `skans-logo.png` (full colour) on papers, top right on the CAF format and top left on internal tests.
  - `skans-logo-dark.png` (white lettering) in the app's navy sidebar and sign-in panel.
  - CAF logo width set to 46 mm so the header title stays on one line.
- [x] Sign-in: the demo accounts (`teacher_far`, password `SkansDemo2026`) no longer exist since demo data was removed. In the local `dev.db`, the `admin` password was set with `npm run reset-admin`, and a `teacher` account (FAR, FAR1, FAR2, TAX) was created through the admin API. That account must change its password at first sign-in.
- Tests: shared 11/11, server 40/40.

## Follow-up — show/hide password (21 October 2026)

- [x] New `client/src/components/PasswordInput.tsx`: a password field with an eye button (Show/Hide, keyboard and screen-reader accessible, 44 px touch target).
- Used on the sign-in page, all three change-password fields (including the forced first sign-in change), and the administrator's **Add user** and **Reset password** dialogs. The two admin dialogs start visible so the generated temporary password can be read out, and the eye hides it.
- Browser check on the running app: the field type switches password → text → password; sign-in still works; the Add-user dialog has the toggle. Client typecheck passes.

## Follow-up: administration requirements for the CAF papers (22 October 2026)

Source: the administration's email, `samples/Req_by _admin/Formatting Sheet.xlsx`, and the eight attached Spring 2026 papers (CAF-8 Audit and Assurance Essentials is the standard). Agreed scope: build the format only; teachers enter the questions themselves.

- [x] **Standard paper format.** "SKANS CAF Examination" follows the Audit paper and the formatting sheet:
  - Calisto MT throughout (title 15 pt bold, paper name 18 pt bold, date/marks/time 12 pt, everything else 11 pt), single line spacing, justified body.
  - Sheet spacing: 12 pt between paragraphs and sub-parts, 8 pt from stem to options, 0 pt between options, 13 pt after QUESTION headings, 19 pt after SECTION bars.
  - Margins: left 2.14 cm, text to 560 pt.
  - Boxed instructions, thick SECTION bars, dotted tables, "(01 mark)" right-aligned and bold, per-MCQ marks, "(THE END)".
  - Running header "Spring 2026 ▌ Paper … Page **X** of **Y**" in Calibri, about 1.3 cm from the top, from page 2. It is rendered with Chromium's header template, because CSS margin boxes cannot bold only the numbers; page 1 is taken from a header-less render.
  - SKANS logo at the top right, sized so the title stays on one line.
  - All sizes and spacing values are editable in **Paper formats** (new typography settings; older saved formats get these defaults).
- [x] **Calisto MT** is embedded from the server's installed fonts (or `branding/fonts/`); it is never committed (licensed font). It falls back to Tinos with a logged warning.
- [x] **8 CAF subjects** under their official names with CAF numbers and groups: FAR, TPC, DSR, BLD (Group A); MA, CR, BIA, AAE (Group B). They are ordered CAF 1–8 everywhere and grouped in the paper and subject screens. Old subjects are deactivated by the seed, never deleted.
- [x] **Names:** Teacher, Research Officer(s) and Admin fields on every paper (Details → Prepared by), printed on the **answer key only**.
- [x] **Draft for review:** draft PDFs always carry a "DRAFT – FOR REVIEW" watermark and a `_DRAFT` file name; finalised papers print clean.
- [x] **UI clean-up across every screen** (in progress before this request, now complete):
  - Shared page header, chips, icon buttons with tooltips, pills and empty states; light cards.
  - Sign-in is a single card; the sidebar groups navigation, and the redundant top bar is removed on desktop.
  - Dashboard: greeting, 4 numbers, 2 lists.
  - Questions and Review are single clean lists.
  - The editor has short labels with folding Answer key and Private notes sections.
  - Papers: library plus three tabs, with actions always visible.
  - Users, Subjects (by CAF group), Paper formats (form with all sheet values) and Audit log are compact lists.
- [x] Fixed: the editor numbered sub-questions (i) by default while the CAF format prints (a). Both now use (a), (b), with (i), (ii) for parts inside them.
- Verification:
  - Sample PDFs compared visually with the Audit paper. Tests: shared 11/11, server 40/40, including new tests for drafts, names, header page numbers and page 1 without a header.
  - Browser walkthrough on an isolated instance: write question → submit → approve → CAF 8 paper with names → draft PDFs; no horizontal overflow on 8 screens at 768 px.
  - `dev.db` was backed up to `server/backups/skans-20261022-092456/`, then upgraded with the non-destructive seed.

## Follow-up: one SKANS format, Research Officer role, teacher-friendly screens (22 October 2026)

- [x] **One paper format:** SKANS CAF Examination with the SKANS logo.
  - The SKANS Internal Test format was removed; the seed deletes any other format, or only hides it if a saved paper uses it.
  - Every subject points to the one format.
  - The format choice is gone from Subjects and Papers.
  - The Paper format page shows the single format (no duplicate, no logo or batch options).
- [x] **Research Officer role:** exactly the rights of a teacher. Admins create Research Officers in Users (new filter chip). On a paper's "Prepared by", Research Officers are tappable chips, and Teacher and Admin are pick-lists of real users. Covered by a new server test.
- [x] **Old subjects removed:** FAR1, FAR2, AUD, TAX, CMA, BL, CL and MFA are deleted by the seed (any that still holds questions or papers is only hidden). Only the 8 CAF papers remain.
- [x] **Teacher-friendly screens:**
  - Dashboard: a large "Write a new question" card, and coloured icon tiles (drafts, in review, returned, approved).
  - Question list: labelled Submit, Edit and Review buttons.
  - Editor: the question-type drop-down is replaced by six icon tiles (MCQ, MCQ set, True/False, Short, Long, Case study) with one-line hints.
- Verification:
  - Tests: shared 11/11, server 41/41.
  - Browser walkthrough (isolated instance): created a teacher and two Research Officers; subjects show no format choice; one format listed; builder has no format choice and the officer chips fill "Sana Malik, Bilal Ahmed"; the teacher wrote a Long question via the tiles; Research Officer navigation is Dashboard and Questions only.
  - `dev.db` was backed up to `server/backups/skans-20261022-095402/`; the seed then removed the 8 old subjects and the Internal Test format.

## Follow-up: elegant sign-in, welcome message, fixed sidebar (22 October 2026)

- [x] **Sign-in page redesigned:** split screen with a navy SKANS brand panel (logo, "Question Bank", one-line tagline) and a clean form ("Welcome back", icon fields, show/hide password, large Sign in button). Phones show a single column with the colour logo.
- [x] **Welcome message:** after signing in, a toast greets the user by full name with their username and role (for example "Welcome, System Administrator · Signed in as admin · Administrator").
- [x] **Sidebar collapse button removed:** the sidebar is always full width on large screens; the saved collapse setting is no longer used.
- Verification: typecheck and client build clean; browser check on an isolated instance (temporary database, since removed): desktop and phone sign-in, wrong-password error, forced password change, welcome toast, no collapse button.

## Follow-up: recycle bin for everyone, several True / False at once (22 October 2026)

- [x] **Delete permanently for teachers and Research Officers:** anyone who may move a question to the recycle bin may also delete it for good (admin: any question; author: own non-approved questions). Questions used in a paper are still refused. The bin rows now show labelled **Restore** and **Delete permanently** buttons. Server rule `canPurgeQuestion` and two new tests.
- [x] **Several True / False statements at once:** a new True / False question has **Add another statement**; each statement has its own True / False choice and is saved as its own question (same subject, topic, difficulty and marks each), so each can be reviewed and picked for papers separately. Consecutive True / False questions already print together on the paper.
- [x] **Icons on the True / False choice:** green tick for True, red cross for False.
- Verification: shared 11/11, server 43/43; browser check on an isolated instance (temporary database, since removed): teacher saved three statements in one go, moved one to the bin and deleted it permanently.

## Follow-up: (I) numbering, ICAP-style tables, readable titles, window buttons (22 October 2026)

- [x] **Capital Roman numbering (I), (II), (III)** as used in the CAF-4 sample paper:
  - a new sub-question numbering choice in the question editor and in **Paper format** (sub-questions and parts inside them);
  - numbered lists inside question text can be (i), (I), (a), (A) or (1): click the numbered-list button, then pick the style. The editor shows the list exactly as printed, in brackets. The server keeps only these five values (sanitiser) and the paper prints them; covered by a test that checks the PDF.
- [x] **Tables like the ICAP papers:** tables are only as wide as their columns (drag a column edge to resize), figures can be aligned right, cell spacing is tighter.
- [x] **Typing below a table:** an empty line is always kept after a table at the end, and the table toolbar has **↵ Text below**.
- [x] **Readable titles:** the "Topic" field is now **Title**. When it is left empty, lists (review queue, questions, paper builder) show the start of the question text instead of "Untitled question".
- [x] **Window buttons** on the larger pop-up windows (question editor, paper preview, question preview in the paper builder): minimise to a bar at the bottom (work is kept), maximise / restore down, close. The question preview in the paper builder also has **Add to paper**.
- Verification: shared 11/11, server 44/44; browser check on an isolated instance (temporary database, since removed).

## Follow-up: ICAP amounts tables (22 October 2026)

- [x] **Amounts table** button in the editor toolbar: inserts the usual ICAP layout, with labels on the left, figures on the right (aligned right) under a **Rupees** heading, and the empty top-left corner left open.
- [x] **No border** button for any selected cell(s) (stored as `class="nb"`; the server keeps only this class). The editor shows such cells with a faint dashed outline; the paper prints no lines for them. The table's outer frame now comes from the cells, so an open corner really is open.
- Line style unchanged: the sample PDFs (FAR, TPC, AAE) all draw table rules as very fine dotted lines, which the CAF format already uses.
- Verification: shared 11/11, server 45/45 (new test for no-border cells); editor and printed layout checked on an isolated instance (temporary database, since removed).

## Follow-up: reset to standard, Calisto MT check (22 October 2026)

- [x] **Reset in Paper format → Edit:** every number that differs from the SKANS standard (formatting-sheet values in `CAF_TEMPLATE_CONFIG`) is highlighted with a ↺ button showing the standard value; **Reset to standard** restores every setting at once (with confirmation; name and code kept; saved only on Save).
- [x] **Calisto MT check:** the format editor shows whether the licensed font is installed on the server (`GET /api/templates/font-status`, admin only, with test). If missing, papers print in Tinos (Times-compatible) and the editor says which four files to copy where. Installing the font later now works without a server restart.
- [x] `.gitignore` now excludes `*.ttf` / `*.otf` so a licensed font copy can never be committed.
- Verification: shared 11/11, server 46/46; browser check on an isolated instance (temporary database, since removed).

## Follow-up: Calisto MT removed; free built-in fonts only (22 October 2026)

- [x] **Calisto MT removed from the project** (SKANS decision: no licensed-font risk). No code reads it from the server any more; the font-status check and banner are gone.
- [x] **Default paper font is now the Times New Roman style (Tinos)**. Formats saved earlier with Calisto MT are read as Times style automatically (schema mapping, test added), so existing formats and finalised-paper snapshots keep working and the database needs no change.
- [x] Font choices are only the three free, built-in fonts: Times New Roman style (Tinos, Apache 2.0), Arial style (Arimo, Apache 2.0), Calibri style (Carlito, SIL OFL). They are embedded in every PDF.
- The running header line still uses the computer's own font of the chosen style (Calibri on Windows), because Chromium cannot use embedded fonts there (tried; the header disappears). If missing, the nearest font is used; nothing is shipped.
- Verification: shared 11/11, server 45/45; generated sample PDF contains Tinos for all paper text and Calibri for the header line only.

## Follow-up: CAF 8 AAE demo mock paper (22 October 2026)

- [x] **Demo mock paper built in the app** (`npm run demo:paper`): CAF 8 Audit and Assurance Essentials, Autumn 2026, 160 marks, 4 hours.
  - SECTION A: 100 MCQs (Q1 and Q4: 30 single MCQs each; Q2, Q3, Q5, Q6: MCQ sets of 10 with a scenario), including (I)/(II) statement MCQs and an amounts table.
  - SECTION B: Q7-Q8 short (8 marks each), Q9-Q10 long with sub-parts (14 each), Q11 case study (16).
  - All text is original; entity names are fictitious. Every question goes through the app's validation and sanitising, is approved, and the paper is saved FINAL with a version snapshot; PDFs are printed from that snapshot exactly like the download buttons.
- [x] **Renderer fixes found with the long paper:** long answer-key tables may now continue onto the next page (the first page of the key was empty), and item lists of 17 or more get a wider hanging indent so labels like (xxviii) no longer touch the text.
- `dev.db` backed up to `server/backups/skans-20261022-153538/` before the paper was added (paper #29, 69 questions). Trial runs used a temporary copy, since removed.
- Verification: server 45/45; PDFs reviewed page by page (17-page paper, 8-page answer key).

## Full system test and clean-up (22 October 2026)

**Automated:** typecheck clean in all three workspaces; shared 11/11, server 45/45 tests; production client build OK. (`npm run build` stops at `prisma generate` with EPERM only while the dev server is running, because Windows locks Prisma's engine file; stop `npm run dev` before building.)

**End-to-end browser walkthrough** (isolated instance, fresh temporary database, 46 steps, all passing after fixing the test script):
- sign-in (wrong password refused, forced password change, weak password refused with a clear reason), lockout after 5 wrong passwords;
- admin: users (create teacher / Research Officer / second teacher, duplicate username refused, reset password, deactivate / activate, signed out afterwards), subjects (8 CAF papers), paper format (change, reset to standard, save), audit log;
- teacher: menu limited, admin pages blocked by URL and API (403); every question type (MCQ, MCQ set, several True/False at once, short with amounts table and (I) list, long with parts, case study); empty question blocked; duplicate, bin, restore, delete permanently; search;
- Research Officer has teacher rights; a teacher of another subject sees nothing from FAR; teachers do not see each other's drafts;
- review: titles shown, return requires a comment, approve, teacher fixes and resubmits, approved questions locked;
- papers: builder, preview, Finalise disabled until marks match, save, draft PDF named `_DRAFT`, finalise, clean paper + answer key, version history, question in a final paper cannot be purged, duplicate;
- security: script/onerror stripped from question HTML, request without CSRF token refused, CSP present, no X-Powered-By, session cookie HttpOnly + SameSite=strict; phone width has no sideways scrolling; logout ends the session. No browser console errors.

**Bug found and fixed:** validation errors showed only "Please correct the highlighted fields." with nothing highlighted (e.g. a weak password). The client now shows each reason, e.g. "New password: At least 10 characters. New password: Must contain a digit".

**Clean-up:**
- removed 6 unused client libraries (@dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities, @tanstack/react-query, clsx, pdfjs-dist) and 3 pieces of unused server code;
- the three ICAP sample PDFs are no longer tracked in git (copyrighted reference material; kept on disk, `samples/` is now ignored);
- removed the outdated `docs/PROTOTYPE-HISTORY.md` (17 October audit; history is in this file);
- deleted obsolete generated PDFs for the removed "SKANS Internal" format from `output/`.

## Move to PostgreSQL, daily backups, library upgrades, permanent browser tests (23 October 2026)

**PostgreSQL 17** (installed on the development PC as a Windows service; application user `skans`, database `skans_qb`):
- Prisma schema switched to PostgreSQL with versioned migrations (`server/prisma/migrations/`); `db:setup` and `db:reset` use `prisma migrate deploy`.
- All data copied from SQLite with `npm run db:copy-from-sqlite` (read-only source, empty target, one transaction, original ids and password hashes, id counters moved on). Every table matched (3 users, 8 subjects, 80 questions, 6 papers, 86 paper items, 13 versions, 108 audit entries); values compared field by field. SQLite backup taken first (`server/backups/skans-20261023-095559`); `dev.db` kept.
- Text filters made case-insensitive (PostgreSQL is case-sensitive by default).
- Server tests and browser tests each create and drop their own temporary database.

**Backups:** `npm run db:backup` now uses `pg_dump` (custom format) plus logos and a SHA-256 checksum; keeps 14 daily + 6 monthly backups and never deletes the old SQLite backups; optional second copy (`BACKUP_COPY_DIR`). New `db:verify-backup` (restore into a temporary database and compare every table) and `db:restore -- <folder> --yes` (checksum check, safety backup first, one transaction). `server/scripts/schedule-backup.ps1` registered two Windows tasks on this PC: nightly backup at 23:00 and a weekly restore check on Sundays (missed runs catch up; log in `server/logs/backup.log`). Tested: backup, verify, full restore into a throw-away database, scheduled task run (result 0).

**Demo / test data:** `npm run data:cleanup -- --demo` (demo paper #29 + 69 questions) or `-- --all-content` (every paper and question); lists only, or deletes with `--yes` after an automatic backup; never touches users, subjects, format or audit log. Tested with `--yes` on a restored copy; **not yet run on the real database** (the teacher is reviewing the demo paper).

**Library upgrades (npm audit: 48 findings, 2 critical, 8 high -> 0):** csv-parse 7, React Router 7, Vitest 5, Prisma 7 (prisma.config.ts + node-postgres driver adapter), TipTap 3 (editor redraws on every change for the toolbar; table extensions merged into one package), Tailwind CSS 4 (official upgrade tool; our classes moved into the components layer so utilities such as `lg:hidden` win as before; screens compared pixel by pixel with the Tailwind 3 build and matched).

**Permanent browser tests:** `npm run test:e2e`, 34 Playwright tests (the earlier 46-step walkthrough, condensed) on a temporary PostgreSQL database.

Verification: typecheck clean; shared 11/11, server 45/45, browser 34/34; npm audit 0 vulnerabilities; no test databases left behind.

## Public beta through a Cloudflare quick tunnel (23 October 2026)

- Separate database `skans_beta` (8 CAF subjects, paper format, AAE demo paper, a new `admin` with a one-time password); real data in `skans_qb` is not reachable from the beta.
- `server/.env.beta` (git-ignored): production mode, HTTPS-aware (`TRUST_PROXY=1`), port 4300, own session secret and backup folder.
- `cloudflared` installed; `server/scripts/beta.ps1` starts/stops the app and tunnel, records the public link, installs start-at-sign-in and a nightly beta backup (23:15).
- Checked through the public link with a temporary account (then deleted with its log entries): HTTPS, HSTS, Secure + HttpOnly session cookie surviving reloads, paper list, question editor, question paper PDF (449 KB) and answer key PDF (543 KB), no browser errors. Beta backup task run once: OK.
- Noted for after the beta: titles in the paper builder's "In this paper" list are squeezed by the row controls; a finalised paper still shows a "Finalise" button.

## Full test pass as a tester (24 October 2026)

**Results:** typecheck and unused-code check clean; unit 11/11; integration 47/47 (2 new); end-to-end 34/34; exploratory 66 probes against an isolated server (authentication, permissions/IDOR, validation, injection, Urdu text in PDFs, business rules, concurrency, load, rate limit). Performance: 610 questions listed in 18 ms and searched in 20 ms; a 7-page PDF in 0.6 s; 4 PDFs at once in 1.4 s.

**Defects found and fixed:**
1. The beta did not come back after the laptop slept or restarted (`beta.ps1` stopped on a "process not found" message in Windows PowerShell 5). Fixed; the beta also keeps the PC awake while it runs. The beta was restarted (new link).
2. Nightly backups failed last night: `npm run` is terminated when Task Scheduler starts it on this PC, and the beta and real backups shared one log file. Tasks now run Node directly with separate logs; tested together and the weekly check passes.
3. The server accepted questions with empty HTML text (`<p></p>`, `&nbsp;`) or 0 marks through the API (the editor already blocked them). Fixed with tests.
4. One end-to-end test was flaky (it accepted the earlier "Draft saved" message as the finalise confirmation). Fixed.
5. `npm run test:e2e` rebuilt `client/dist`, the files the running beta serves. Browser tests now build into `client/dist-test` (the beta's files were checked unchanged by fingerprint).
6. New security advisories since yesterday: body-parser and multer updated (safe updates).

**Open (not fixed):** zod advisory (memory use on very large lists) needs zod 4, a major upgrade; risk is limited by the 3 MB request limit (a 300,000-item list was refused in 0.27 s). Two people saving the same paper at once: the last save wins without a warning. Not tested: Firefox/Safari, screen readers, idle session expiry (8 h).
