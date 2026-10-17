# SKANS Question Bank & Exam Paper Generator - Audit

Audit performed on 17 October 2026 before application changes.

## Baseline commands

| Command | Result |
|---|---|
| `npm install` | Passed. npm reports 48 audit findings (38 moderate, 8 high, 2 critical); no dependency changes were required. |
| `npm run setup` | Failed after Prisma generation and `db push`: `server/prisma/seed.ts` is missing. Chromium installation was not reached. |
| `npm run typecheck` | Shared and server typechecks pass. Client fails because `client/tsconfig.json` is missing, so `tsc` prints help and exits non-zero. |
| `npm test` | Shared: 10 tests pass. Server: fails because no test files exist. |
| `npm run dev` | Not yet usable: the client has no source entrypoint/package Vite configuration, and the server setup cannot seed the database. |

## Specification checklist

Status meanings: **Done** is evidenced by an implemented and testable surface; **Partial** means server/shared groundwork exists but the end-to-end feature is incomplete; **Missing** means no usable implementation was found.

### Foundation and security

- [ ] **Partial** - Login, session auth, HttpOnly cookies, CSRF, helmet, rate limiting, lockout, zod validation, sanitized HTML. Evidence: [server/src/app.ts](<D:/0🔒  🔒/6 semester/web tech/Web Technologies course for Final exam/Web Technologies course for Final exam/JavaScript/completed worl/paper_demo/server/src/app.ts>), [server/src/middleware/auth.ts](<D:/0🔒  🔒/6 semester/web tech/Web Technologies course for Final exam/Web Technologies course for Final exam/JavaScript/completed worl/paper_demo/server/src/middleware/auth.ts>), [server/src/routes/auth.ts](<D:/0🔒  🔒/6 semester/web tech/Web Technologies course for Final exam/Web Technologies course for Final exam/JavaScript/completed worl/paper_demo/server/src/routes/auth.ts>), and [server/src/lib/sanitize.ts](<D:/0🔒  🔒/6 semester/web tech/Web Technologies course for Final exam/Web Technologies course for Final exam/JavaScript/completed worl/paper_demo/server/src/lib/sanitize.ts>) contain the server mechanisms; there is no client to exercise them and no server tests.
- [x] **Done** - Login, logout, change-password UI, session cookies, CSRF token handling, protected routing, role-aware shell, and toast/confirm components are implemented in [client/src](<D:/0🔒  🔒/6 semester/web tech/Web Technologies course for Final exam/Web Technologies course for Final exam/JavaScript/completed worl/paper_demo/client/src>) and backed by [server/src/routes/auth.ts](<D:/0🔒  🔒/6 semester/web tech/Web Technologies course for Final exam/Web Technologies course for Final exam/JavaScript/completed worl/paper_demo/server/src/routes/auth.ts>).
- [x] **Done** - Server dashboard endpoint and a thin authenticated dashboard UI exist in [server/src/routes/dashboard.ts](<D:/0🔒  🔒/6 semester/web tech/Web Technologies course for Final exam/Web Technologies course for Final exam/JavaScript/completed worl/paper_demo/server/src/routes/dashboard.ts>) and [client/src/App.tsx](<D:/0🔒  🔒/6 semester/web tech/Web Technologies course for Final exam/Web Technologies course for Final exam/JavaScript/completed worl/paper_demo/client/src/App.tsx>).

### Question bank

- [x] **Done** - Server CRUD, status transitions, visibility, subject access, soft delete/restore, duplicate, review, search/filter, and import routes are wired to a polished list/editor UI in [client/src/QuestionBank.tsx](<D:/0🔒  🔒/6 semester/web tech/Web Technologies course for Final exam/Web Technologies course for Final exam/JavaScript/completed worl/paper_demo/client/src/QuestionBank.tsx>) and [server/src/routes/questions.ts](<D:/0🔒  🔒/6 semester/web tech/Web Technologies course for Final exam/Web Technologies course for Final exam/JavaScript/completed worl/paper_demo/server/src/routes/questions.ts>).
- [x] **Done** - Shared schemas/types cover MCQ, MCQ group, true/false, short, long, and case study content; TipTap supports tables, table row/column controls, merge/header rows, paste, formatting, lists, and rich answer/advice fields in [client/src/components/RichEditor.tsx](<D:/0🔒  🔒/6 semester/web tech/Web Technologies course for Final exam/Web Technologies course for Final exam/JavaScript/completed worl/paper_demo/client/src/components/RichEditor.tsx>).

### Templates, paper builder, preview, and PDF

- [ ] **Partial** - Template configuration and rendering helpers exist in [shared/src/template.ts](<D:/0🔒  🔒/6 semester/web tech/Web Technologies course for Final exam/Web Technologies course for Final exam/JavaScript/completed worl/paper_demo/shared/src/template.ts>), [server/src/routes/templates.ts](<D:/0🔒  🔒/6 semester/Web Technologies course for Final exam/Web Technologies course for Final exam/JavaScript/completed worl/paper_demo/server/src/routes/templates.ts>), and [server/src/render/paperHtml.ts](<D:/0🔒  🔒/6 semester/web tech/Web Technologies course for Final exam/Web Technologies course for Final exam/JavaScript/completed worl/paper_demo/server/src/render/paperHtml.ts>), but no seed or template editor UI exists.
- [x] **Done** - Paper CRUD, ordering, versions, marks validation, finalise, duplicate, and downloads are wired to the HOA-only builder in [client/src/PaperBuilder.tsx](<D:/0🔒  🔒/6 semester/web tech/Web Technologies course for Final exam/Web Technologies course for Final exam/JavaScript/completed worl/paper_demo/client/src/PaperBuilder.tsx>) and [server/src/routes/papers.ts](<D:/0🔒  🔒/6 semester/web tech/Web Technologies course for Final exam/Web Technologies course for Final exam/JavaScript/completed worl/paper_demo/server/src/routes/papers.ts>).
- [x] **Done** - Builder uses the existing server renderer for live HTML preview, supports approved-question selection, sections, drag/drop and move controls, marks overrides, save/reopen, paper/key download, and optional watermark.
- [ ] **Partial** - Playwright PDF generation and separate answer-key endpoint exist in [server/src/render/pdf.ts](<D:/0🔒  🔒/6 semester/web tech/Web Technologies course for Final exam/Web Technologies course for Final exam/JavaScript/completed worl/paper_demo/server/src/render/pdf.ts>); sample comparison and validation are missing, and browser installation was not reached.

### Administration and import

- [ ] **Partial** - User/subject/template CRUD, password reset/unlock, and audit-log endpoints exist in the server routes; the thin admin UI in [client/src/Admin.tsx](<D:/0🔒  🔒/6 semester/web tech/Web Technologies course for Final exam/Web Technologies course for Final exam/JavaScript/completed worl/paper_demo/client/src/Admin.tsx>) provides user visibility, audit visibility, and password reset. Full user/subject/template edit forms remain out of scope for the tomorrow demo.
- [ ] **Partial** - CSV sample/download and validation/import endpoint exist in [server/src/routes/import.ts](<D:/0🔒  🔒/6 semester/web tech/Web Technologies course for Final exam/Web Technologies course for Final exam/JavaScript/completed worl/paper_demo/server/src/routes/import.ts>); import UI/report display is missing.

### Seed data and documentation

- [x] **Done** - Idempotent seed entrypoint, six demo users, 16 subjects, 41 questions across FAR/AUD/TAX and additional subjects/statuses, table-rich questions, two templates assigned to every subject, and two sample papers. Evidence: [server/prisma/seed.ts](<D:/0🔒  🔒/6 semester/web tech/Web Technologies course for Final exam/Web Technologies course for Final exam/JavaScript/completed worl/paper_demo/server/prisma/seed.ts>) and [server/prisma/seed-data/helpers.ts](<D:/0🔒  🔒/6 semester/web tech/Web Technologies course for Final exam/Web Technologies course for Final exam/JavaScript/completed worl/paper_demo/server/prisma/seed-data/helpers.ts>). `npm run setup` now completes, including Playwright Chromium installation.
- [ ] **Partial** - README now documents setup, demo accounts, and current structure in [README.md](<D:/0🔒  🔒/6 semester/web tech/Web Technologies course for Final exam/Web Technologies course for Final exam/JavaScript/completed worl/paper_demo/README.md>); template extension and deployment notes remain for the documentation milestone.
- [ ] **Done** - Reference PDFs are present: [samples/](<D:/0🔒  🔒/6 semester/web tech/Web Technologies course for Final exam/Web Technologies course for Final exam/JavaScript/completed worl/paper_demo/samples>) contains FAR, AUDIT, and TAX sample papers.

## Errors and blockers found

1. `npm run setup` cannot seed because `server/prisma/seed.ts` is missing.
2. `npm run typecheck` cannot typecheck the client because `client/tsconfig.json` and client source entrypoints are missing.
3. `npm test` fails in the server workspace because there are no server test files.
4. `npm run dev` cannot provide a working full-stack app until the client and seed are restored.
5. The dependency audit reports 48 findings (38 moderate, 8 high, 2 critical); this is recorded for later review and is not being changed blindly.

## Milestone 1 result

- **Backend setup:** Done. `npm run setup` passes through schema push, seed, and Chromium installation.
- **Seed:** Done. `npm run db:seed` is repeatable and recreates the deterministic demo dataset.
- **Runtime:** Done. `GET http://localhost:4000/api/health` returned HTTP 200 with `{"ok":true}`.
- **Validation:** Server build/typecheck and shared tests pass. Server tests remain out of scope until Milestone 7.
- **Still intentionally unavailable:** Client UI and all browser demo flow features; they are not exposed by the current milestone.

## Milestone 2 result

- [x] **Done** - `npm run pdf:samples -w server` generates FAR and TAX paper PDFs plus separate answer keys in `output/` using the existing HTML renderer and Playwright.
- [x] **Done** - TAX output is one page like [samples/TAX BATCH 1.pdf](<D:/0🔒  🔒/6 semester/web tech/Web Technologies course for Final exam/Web Technologies course for Final exam/JavaScript/completed worl/paper_demo/samples/TAX BATCH 1.pdf>); FAR output is two pages because the seeded demo contains fewer questions than [samples/FAR-Spring-2026.pdf](<D:/0🔒  🔒/6 semester/web tech/Web Technologies course for Final exam/Web Technologies course for Final exam/JavaScript/completed worl/paper_demo/samples/FAR-Spring-2026.pdf>).
- [x] **Done** - PDF text inspection confirms generated paper PDFs contain no URL, `about:blank`, `file://`, Chrome, or browser date text. PDF metadata is set to `SKANS Question Bank`.
- [x] **Done** - Existing renderer embeds Tinos/Arimo/Carlito fonts, preserves table header rows, prevents short tables from splitting, and emits `Page X of Y` through CSS margin boxes.
- [ ] **Partial** - Automated raster PNG rendering and pixel-level comparison against reference page 1 were not added because no PDF raster utility is available in the current environment; page counts and extracted page text were compared instead. This remains a visual QA limitation, not a hidden UI feature.

## Milestone 3 result

- [x] **Done** - Vite, TypeScript, Tailwind, router, API client with cookie credentials and CSRF headers, auth context, protected routes, responsive sidebar, toast, and confirmation components are in [client/](<D:/0🔒  🔒/6 semester/web tech/Web Technologies course for Final exam/Web Technologies course for Final exam/JavaScript/completed worl/paper_demo/client>).
- [x] **Done** - Headless browser smoke test successfully loaded the login page, signed in as `teacher_far`, and displayed the teacher dashboard.
- [x] **Done** - Client typecheck and production build pass.
- [ ] **Out of scope for this milestone** - Paper builder, admin navigation, and CSV UI were intentionally not linked yet; no fake buttons are exposed.

## Milestone 4 result

- [x] **Done** - Question list supports keyword, subject, type, status, minimum-marks filters, pagination, preview, edit, duplicate, and soft-delete actions.
- [x] **Done** - Teacher create/edit supports rich HTML tables, MCQ options/correct answer, MCQ groups, true/false, long/case-study parts, answers, advice, and comments.
- [x] **Done** - Teacher submit and HOA approve/reject actions are wired to the existing server permissions.
- [x] **Done** - Headless browser smoke test created a new table question as `teacher_far`, saved it, and submitted it successfully.
- [ ] **Partial** - The current editor initializes options/parts when editing but does not yet hydrate previously saved MCQ option rows and long-question parts into editable controls; preview remains complete. This is a small edit-UX limitation to address if time remains.

## Milestone 5 result

- [x] **Done** - HOA-only paper builder is linked from the role-aware sidebar and protected by the existing server RBAC.
- [x] **Done** - Headless browser smoke test selected an approved question, showed the marks total, rendered the exact server HTML preview in an iframe, and saved a draft.
- [x] **Done** - Client typecheck/build and server typecheck pass.
- [ ] **Partial** - The builder intentionally keeps rule-based auto-generation and version-history browsing out of the thin demo UI; the existing server endpoints remain available but are not represented by fake controls.

## Milestone 6 result

- [x] **Done** - Dashboards now show server-backed role-scoped question counts and HOA/teacher review indicators.
- [ ] **Partial** - ADMIN navigation provides user list, subject count, audit log, and password reset. Full CRUD forms for users, subjects, and template JSON editing are intentionally out of scope and not exposed as fake buttons.
- [x] **Done** - Browser smoke test loaded the ADMIN dashboard and administration page with seeded account/audit data.

## Milestone 7 result

- [x] **Done** - Focused server tests cover unauthenticated access, teacher paper RBAC, teacher subject isolation, marks-total validation, template rendering, and real PDF generation. Evidence: [server/tests/workflow.test.ts](<D:/0🔒  🔒/6 semester/web tech/Web Technologies course for Final exam/Web Technologies course for Final exam/JavaScript/completed worl/paper_demo/server/tests/workflow.test.ts>).
- [x] **Done** - Full `npm test`, `npm run typecheck`, `npm run build`, and `npm run setup` validation completed; the RBAC regression found during testing was fixed in [server/src/routes/questions.ts](<D:/0🔒  🔒/6 semester/web tech/Web Technologies course for Final exam/Web Technologies course for Final exam/JavaScript/completed worl/paper_demo/server/src/routes/questions.ts>).
- [x] **Done** - [README.md](<D:/0🔒  🔒/6 semester/web tech/Web Technologies course for Final exam/Web Technologies course for Final exam/JavaScript/completed worl/paper_demo/README.md>) now includes setup, demo flow/accounts, structure, template extension, deployment, and scope notes.

## Demo follow-up fix

- [x] **Done** - ADMIN no longer sees the question-bank navigation because the server intentionally denies ADMIN question content access; ADMIN is directed to dashboard/administration instead.
- [x] **Done** - Client API retries one failed mutating request after refreshing the CSRF token when a stale tab/server restart produces the standard security-token error. RBAC responses are not retried or weakened.

## ADMIN workspace follow-up

- [x] **Done** - ADMIN now has working tabs for user CRUD, subject CRUD, paper-template editing, password reset/unlock, and filtered audit-log viewing. These controls call the existing server endpoints and remain hidden from non-ADMIN users.
- [x] **Done** - Template JSON editing preserves in-progress text and relies on the server's shared template schema for final validation.
