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
- [ ] **Missing** - Login UI, logout UI, change-password UI, and role dashboards. The [client/src/](<D:/0🔒  🔒/6 semester/web tech/Web Technologies course for Final exam/Web Technologies course for Final exam/JavaScript/completed worl/paper_demo/client/src/>) directory contains no application source files.
- [ ] **Partial** - Server dashboard endpoint exists in [server/src/routes/dashboard.ts](<D:/0🔒  🔒/6 semester/web tech/Web Technologies course for Final exam/Web Technologies course for Final exam/JavaScript/completed worl/paper_demo/server/src/routes/dashboard.ts>); no dashboard UI.

### Question bank

- [ ] **Partial** - Server CRUD, status transitions, visibility, subject access, soft delete/restore, duplicate, review, search/filter, and import routes exist in [server/src/routes/questions.ts](<D:/0🔒  🔒/6 semester/web tech/Web Technologies course for Final exam/Web Technologies course for Final exam/JavaScript/completed worl/paper_demo/server/src/routes/questions.ts>), [server/src/lib/questions.ts](<D:/0🔒  🔒/6 semester/web tech/Web Technologies course for Final exam/Web Technologies course for Final exam/JavaScript/completed worl/paper_demo/server/src/lib/questions.ts>), and [server/src/routes/import.ts](<D:/0🔒  🔒/6 semester/web tech/Web Technologies course for Final exam/Web Technologies course for Final exam/JavaScript/completed worl/paper_demo/server/src/routes/import.ts>). No UI or tests.
- [ ] **Partial** - Shared schemas/types cover MCQ, MCQ group, true/false, short, long, and case study content in [shared/src/schemas.ts](<D:/0🔒  🔒/6 semester/web tech/Web Technologies course for Final exam/Web Technologies course for Final exam/JavaScript/completed worl/paper_demo/shared/src/schemas.ts>) and [shared/src/types.ts](<D:/0🔒  🔒/6 semester/web tech/Web Technologies course for Final exam/Web Technologies course for Final exam/JavaScript/completed worl/paper_demo/shared/src/types.ts>); TipTap table editing cannot be used without a client.

### Templates, paper builder, preview, and PDF

- [ ] **Partial** - Template configuration and rendering helpers exist in [shared/src/template.ts](<D:/0🔒  🔒/6 semester/web tech/Web Technologies course for Final exam/Web Technologies course for Final exam/JavaScript/completed worl/paper_demo/shared/src/template.ts>), [server/src/routes/templates.ts](<D:/0🔒  🔒/6 semester/Web Technologies course for Final exam/Web Technologies course for Final exam/JavaScript/completed worl/paper_demo/server/src/routes/templates.ts>), and [server/src/render/paperHtml.ts](<D:/0🔒  🔒/6 semester/web tech/Web Technologies course for Final exam/Web Technologies course for Final exam/JavaScript/completed worl/paper_demo/server/src/render/paperHtml.ts>), but no seed or template editor UI exists.
- [ ] **Partial** - Paper CRUD, ordering, versions, marks validation, finalize, duplicate, and download endpoints exist in [server/src/routes/papers.ts](<D:/0🔒  🔒/6 semester/web tech/Web Technologies course for Final exam/Web Technologies course for Final exam/JavaScript/completed worl/paper_demo/server/src/routes/papers.ts>) and [server/src/lib/papers.ts](<D:/0🔒  🔒/6 semester/web tech/Web Technologies course for Final exam/Web Technologies course for Final exam/JavaScript/completed worl/paper_demo/server/src/lib/papers.ts>); paper builder/live preview UI is missing.
- [ ] **Partial** - Playwright PDF generation and separate answer-key endpoint exist in [server/src/render/pdf.ts](<D:/0🔒  🔒/6 semester/web tech/Web Technologies course for Final exam/Web Technologies course for Final exam/JavaScript/completed worl/paper_demo/server/src/render/pdf.ts>); sample comparison and validation are missing, and browser installation was not reached.

### Administration and import

- [ ] **Partial** - User CRUD/reset/unlock, subject CRUD, template CRUD, and audit-log endpoints exist in [server/src/routes/users.ts](<D:/0🔒  🔒/6 semester/web tech/Web Technologies course for Final exam/Web Technologies course for Final exam/JavaScript/completed worl/paper_demo/server/src/routes/users.ts>), [server/src/routes/subjects.ts](<D:/0🔒  🔒/6 semester/web tech/Web Technologies course for Final exam/Web Technologies course for Final exam/JavaScript/completed worl/paper_demo/server/src/routes/subjects.ts>), [server/src/routes/templates.ts](<D:/0🔒  🔒/6 semester/web tech/Web Technologies course for Final exam/Web Technologies course for Final exam/JavaScript/completed worl/paper_demo/server/src/routes/templates.ts>), and [server/src/routes/audit.ts](<D:/0🔒  🔒/6 semester/web tech/Web Technologies course for Final exam/Web Technologies course for Final exam/JavaScript/completed worl/paper_demo/server/src/routes/audit.ts>). Admin UI is missing.
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
