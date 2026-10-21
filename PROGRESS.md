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
