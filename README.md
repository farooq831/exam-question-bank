# SKANS Question Bank & Exam Paper Generator

Prototype for SKANS School of Accountancy examination question management and paper generation.

## Setup

Requirements: Node.js 20 or newer.

```powershell
npm run setup
npm run dev
```

The setup command creates `server/.env`, installs workspace dependencies, applies the SQLite
schema, seeds demo data, and installs Playwright Chromium. The API runs on port 4000 and the
Vite client runs on port 5173 once the client milestone is complete.

## Demo accounts

All seeded demo accounts use the password `SkansDemo2026`.

| Username | Role | Assigned subjects |
|---|---|---|
| `admin` | Administrator | All seeded subjects |
| `hoa_far` | Head of Academics | FAR, FAR1, FAR2, CMA, TAX |
| `hoa_audit` | Head of Academics | AUD, AAE |
| `teacher_far` | Teacher | FAR, FAR1, FAR2 |
| `teacher_tax` | Teacher | TAX, TPC |
| `teacher_audit` | Teacher | AUD, AAE |

This password is for the local prototype only. Change it before using the application on a school
server.

## Current implementation

- SQLite/Prisma schema and idempotent seed data are in [server/prisma](./server/prisma).
- Shared validation, marks calculation, and template configuration are in [shared/src](./shared/src).
- Express API routes are in [server/src/routes](./server/src/routes).
- PDF rendering uses Playwright and the same HTML renderer intended for the live preview.
- Reference papers are in [samples](./samples).

## Milestone demo flow

1. Start the app with `npm run dev`.
2. Sign in as `teacher_far`, open **Question bank**, create a question, insert a table from the
   editor toolbar, save it, and submit it.
3. Sign out and sign in as `hoa_far`; open **Question bank**, approve the submitted question.
4. Open **Paper builder**, choose the subject, add approved questions, arrange sections/order, and
   set maximum marks to the live total.
5. Save, preview, finalise, and download the paper and answer key PDFs. Enable the watermark
   checkbox when a username/timestamp watermark is wanted.

## Adding a paper template

Paper formats are data in `PaperTemplate.config`, validated by `templateConfigSchema` in
`shared/src/template.ts`. To add one:

1. Copy `ICAP_TEMPLATE_CONFIG` or `SKANS_TEMPLATE_CONFIG`.
2. Change the layout, fonts, page margins, header, instructions, sections, marks, and filename
   patterns.
3. Add an upsert/create entry in `server/prisma/seed.ts`, or create it through the template API.
4. Assign the template to each applicable subject through the subject record.
5. Run `npm run db:seed -w server` and `npm run pdf:samples -w server` to verify the output.

The renderer in `server/src/render/paperHtml.ts` is shared by live HTML preview and Playwright PDF
generation. Do not create a second client-only paper renderer.

## Local school-server deployment notes

- Put the application behind Nginx and use HTTPS with a school-issued or trusted certificate.
- Set `NODE_ENV=production`, `TRUST_PROXY=1`, a long random `SESSION_SECRET`, and the production
  `DATABASE_URL` in an environment file outside the repository.
- Restrict the firewall to the school network/VPN; expose only Nginx, not the Node port.
- Back up the SQLite database and branding files daily, and test restoring a backup.
- For multi-user production scale, migrate the Prisma provider to PostgreSQL, run a migration, and
  move backups to the school database backup process.

## Scope notes

The server CSV import endpoint is retained, but its UI is intentionally hidden for the prototype.
Full admin CRUD forms, visual PNG diff tooling, rule-based paper auto-generation controls, and
version-history browsing are also out of scope for the tomorrow demo and are recorded in
`PROGRESS.md`.
