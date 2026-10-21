# SKANS Question Bank & Examination Paper Management System

Question bank, academic review and examination-paper generation for **SKANS School of
Accountancy** (CAF level). Teachers write questions; Heads of Academics (HOA) and administrators
review them; approved questions are assembled into papers that are printed to PDF together with a
separate answer key.

> The CAF reference paper supplied by the school is used only as a **formatting reference**. This
> is not an ICAP system. No examining-body branding is included; logos are printed only when the
> school adds authorised files (see [Branding](#authorised-branding-assets)).

Contents: [Setup](#setup) · [Environment](#environment-variables) · [Database](#database) ·
[Demo accounts](#demo-accounts) · [Roles](#role-permissions) · [Commands](#development-commands) ·
[Templates](#adding-or-changing-a-paper-template) · [Branding](#authorised-branding-assets) ·
[PostgreSQL](#migrating-from-sqlite-to-postgresql) · [Deployment](#local-school-server-deployment) ·
[Backups](#backups) · [Browsers](#tablet-and-browser-support) · [Limitations](#current-limitations)

## Architecture

| Part | Technology |
|---|---|
| `client/` | React 18, Vite, TypeScript, Tailwind CSS, React Router, TipTap editor |
| `server/` | Node.js, Express 4, TypeScript (run with `tsx`), Prisma, Playwright/Chromium for PDFs |
| `shared/` | Zod schemas, types, marks rules and template configuration used by client and server |
| Database | SQLite for development and a single school server; schema kept portable to PostgreSQL |

One HTML renderer (`server/src/render/paperHtml.ts`) produces both the live preview and the PDF,
so the preview is what gets printed.

## Setup

Requirements: **Node.js 20+** (tested on 24) and npm 10+. About 400 MB of disk space for
dependencies and Chromium.

```bash
npm run setup     # creates server/.env with a random secret, installs packages,
                  # creates/updates the SQLite schema, seeds demo data, installs Chromium
npm run dev       # API on http://localhost:4000, web app on http://localhost:5173
```

Open http://localhost:5173 and sign in with a [demo account](#demo-accounts).

`npm run setup` is safe to repeat. It never deletes data (see [Database](#database)).

## Environment variables

`server/.env` (created by `npm run setup` from `server/.env.example`). For production, start from
`server/.env.production.example`. Never commit a real `.env`.

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `file:./dev.db` | Prisma connection. Relative SQLite paths are relative to `server/prisma/`. |
| `SESSION_SECRET` | *(generated)* | Signs session cookies; at least 32 characters, unique per installation. |
| `NODE_ENV` | `development` | `production` enables Secure cookies, HSTS and HTTPS upgrade. |
| `PORT` | `4000` | API/web port of the Node process. |
| `TRUST_PROXY` | `0` | Set `1` behind Nginx (needed for Secure cookies and correct client IPs). |
| `CLIENT_ORIGIN` | `http://localhost:5173` | Origin of the web client (informational). |
| `MAX_FAILED_LOGINS` | `5` | Failed sign-ins before an account is locked. |
| `LOCKOUT_MINUTES` | `15` | Lock duration (an administrator can unlock earlier). |
| `SESSION_TTL_MINUTES` | `480` | Idle session lifetime. |
| `BRANDING_DIR` | `../client/public/branding` | Folder with authorised logo files. |

## Database

Prisma schema: `server/prisma/schema.prisma`. Enumerations and JSON payloads are stored as text so
the same schema works on SQLite and PostgreSQL.

| Command | What it does | Destructive? |
|---|---|---|
| `npm run db:setup -w server` | Generate the Prisma client, apply the schema (`prisma db push`), run the seed | No |
| `npm run db:seed -w server` | Create **missing** templates, CAF subjects and demo accounts; add demo questions and sample papers **only if the question bank is empty** | No |
| `npm run db:reset` | Recreate the schema and the demo dataset from scratch | **Yes**. Refused when `NODE_ENV=production` unless `--force` is added. |
| `npm run db:backup` | Consistent online copy of the SQLite database and branding folder | No |

The seed never changes existing rows. Passwords, edited templates and assigned subjects survive.
Normal application start-up never modifies data.

## Demo accounts

All demo accounts use the password **`SkansDemo2026`**. Change or deactivate them before real use.

| Username | Role | Subjects |
|---|---|---|
| `admin` | Administrator | All subjects |
| `hoa_far` | Head of Academics | FAR, FAR1, FAR2, CMA, TAX |
| `hoa_audit` | Head of Academics | AUD |
| `teacher_far` | Teacher | FAR, FAR1, FAR2 |
| `teacher_tax` | Teacher | TAX, TPC |
| `teacher_audit` | Teacher | AUD |

Sample papers: "FAR Spring 2026 Examination" (CAF format) and "Tax Batch 1 Internal Test"
(SKANS format), both final.

Emergency administrator recovery on the server console:
`npm run reset-admin -- <username> <new-password>`.

## Role permissions

Every rule is enforced by the server (`server/src/lib/access.ts`, route guards). The interface only
hides actions that would be refused.

| Capability | Admin | HOA | Teacher |
|---|---|---|---|
| Subjects visible | All | Assigned | Assigned |
| Create questions | — | Assigned subjects | Assigned subjects |
| Edit questions | — | Any in assigned subjects | Own **draft/rejected** only |
| Submit for review | Own | Own | Own |
| Approve / reject (comment required to reject) | Submitted questions, any subject | Submitted questions, assigned subjects | No |
| See other teachers' drafts | Yes | No | No |
| See approved questions | All | Assigned | Assigned |
| Build, preview, finalise papers; download paper and answer key PDFs | All subjects | Assigned subjects | No |
| Users (create/edit/deactivate, reset password, unlock) | Yes | No | No |
| Subjects and default formats | Yes | Switch format of assigned subject | No |
| Templates | Yes | Only templates whose subjects are all assigned to them | No |
| Audit log | Yes | No | No |

Only **approved**, non-deleted questions of the paper's subject can be added to a paper. A paper
can only be finalised when its marks total equals the maximum marks. Final papers print from a
frozen version snapshot.

Security controls:

- **Accounts:** bcrypt password hashing, lockout after repeated failures, and a forced password change after an administrator reset.
- **Sessions:** HttpOnly `SameSite=Strict` session cookies (Secure in production), regenerated at sign-in and password change.
- **Request protection:** synchroniser CSRF tokens on every unsafe request, plus rate limits for sign-in and the API.
- **Input and headers:** Helmet CSP, zod validation, and an HTML sanitiser on save and on render.
- **Audit:** an audit log of sign-ins, changes, reviews, finalisation and every PDF download.

## Development commands

```bash
npm run dev            # API + client with live reload
npm run typecheck      # shared, server and client
npm test               # shared unit tests + server API/PDF tests
npm run build          # production client build (client/dist) + server typecheck
npm start              # production server (serves client/dist and the API on PORT)
npm run pdf:samples    # writes sample paper + answer key PDFs for the seeded papers to output/
```

### Tests

`npm test` runs:

- **Shared unit tests:** marks rules, formatting, schemas.
- **Server tests:** about 40 Supertest + Playwright tests in `server/tests/`.

The server tests cover:

- **Authentication:** login/logout, cookie flags, CSRF, password change, lockout and unlock, deactivation.
- **Permissions:** every ADMIN/HOA/TEACHER rule and teacher subject isolation.
- **Workflow:** review with a required rejection comment, approved-only papers, marks validation, audit records.
- **Output:** HTML preview, and question-paper and answer-key PDF generation with text extraction, which checks:
  - no URLs or browser date stamps
  - private notes are absent
  - "Page X of Y" on every page
  - repeated table header rows
  - page count

The server tests create a **fresh temporary SQLite database** for each run and delete it afterwards.
They never touch `dev.db`. Chromium must be installed (`npm run browsers -w server`).

## Adding or changing a paper template

Paper formats are data (`PaperTemplate.config`), validated by `templateConfigSchema` in
`shared/src/template.ts`. Two formats ship:

- **CAF Examination Paper** (internal key `ICAP_EXAM`, layout `ICAP`)
- **SKANS Internal Test** (`SKANS_INTERNAL`, layout `SKANS`)

Their fonts, sizes, margins and wording are **provisional** until the administration supplies the
approved specification.

To change one: **Templates → Edit**.

- **Common settings** covers fonts, size, line height, margins, institute line, logo, date format, batch/teacher/test fields, instructions, heading pattern, marks format and position, sections, running header/footer, page numbers and end text.
- **Advanced (JSON)** exposes every setting.

Placeholders:

- Headings and running header: `{n}`, `{session}`, `{subject}`, `{code}`, `{page}`, `{pages}`, `{batch}`, `{test}`, `{date}`
- Marks: `{n}`, and `{nn}` (zero-padded)
- Instructions: `{count}`, `{countWord}`, `**bold**`

To add a format: **Templates → Duplicate** an existing one, adjust it, then assign it to subjects
in **Subjects**. Check the result with **Paper builder → Review & output → Preview**.

To ship a new default format with the code, add a config constant next to `ICAP_TEMPLATE_CONFIG` and
an `ensureTemplate` call in `server/prisma/seed.ts`.

When the approved sample arrives, set each value from it. Then compare a generated PDF with the
sample page by page before calling the format final.

## Authorised branding assets

Drop authorised files into `client/public/branding/`, or into the folder set in `BRANDING_DIR`:

- `skans-logo.png`: SKANS internal tests
- `exam-body-logo.png`: CAF format, only with written permission from the examining body

Files are picked up immediately. Without them, the SKANS header prints the institute name as text
and the CAF header prints no logo. See `client/public/branding/README.md`.

## Migrating from SQLite to PostgreSQL

1. Create a database and user, for example `skans_qb` owned by `skans_app`.
2. In `server/prisma/schema.prisma` change `provider = "sqlite"` to `provider = "postgresql"`.
3. Set `DATABASE_URL="postgresql://skans_app:…@127.0.0.1:5432/skans_qb?schema=public"`.
4. Create the tables: `npx prisma migrate dev --name init` in `server/`. This also creates a
   `prisma/migrations` folder; commit it, and use `npx prisma migrate deploy` on servers.
5. Move existing data. No copy script is included. Use [pgloader](https://pgloader.io)
   (`pgloader sqlite:///path/to/skans.db postgresql://…`) into the new schema, then reset the
   sequences (`SELECT setval(...)` per table). Alternatively, start fresh with `npm run db:seed`.
6. Run `npm test` against a copy, then sign in and download a paper to verify.

Differences to check:

- `contains` filters on titles and topics become case-sensitive on PostgreSQL. Question
  full-text search is unaffected because it uses a lower-cased index column.
- JSON columns remain text. They can be converted to `jsonb` later.

## Local school-server deployment

1. Install Node.js 20+ LTS on the server (Linux or Windows). Copy the repository, then run:
   ```bash
   npm ci
   npm run browsers -w server
   npm run db:setup -w server
   npm run build
   ```
2. Create `server/.env` from `server/.env.production.example`. Set `NODE_ENV=production` and
   `TRUST_PROXY=1`, a new `SESSION_SECRET`, an absolute `DATABASE_URL`, and `BRANDING_DIR`.
3. Run `npm start` under a service manager, for example a systemd unit or NSSM on Windows, so it
   restarts automatically. It serves the built client and the API on `PORT`, bound behind Nginx.
4. Sign in as `admin`, change the password, create real accounts, and **deactivate the demo
   accounts**.

### HTTPS with Nginx

```nginx
server {
    listen 443 ssl http2;
    server_name qb.skans.local;
    ssl_certificate     /etc/ssl/skans/qb.crt;   # school CA or trusted certificate
    ssl_certificate_key /etc/ssl/skans/qb.key;
    client_max_body_size 5m;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;   # large PDFs
    }
}
server { listen 80; server_name qb.skans.local; return 301 https://$host$request_uri; }
```

Secure cookies are only sent over HTTPS. Without `TRUST_PROXY=1` behind Nginx, sign-in will not
persist; the server prints a warning at start-up.

### Firewall

- Allow inbound **443** (and 80 for the redirect) **from the school network or VPN only**.
- Block the Node port (4000) from other machines. Nginx connects through `127.0.0.1`.
- If PostgreSQL is used, allow 5432 only from the application server.
- Do not expose the server directly to the internet. Use the school VPN for remote staff.

## Backups

- **SQLite:** `npm run db:backup` (or `npm run db:backup -- D:\Backups`) writes a consistent copy
  of the database and the branding folder to `server/backups/skans-YYYYMMDD-HHMMSS/` while the
  application keeps running. Schedule it daily (cron or Task Scheduler). Keep at least 14 days,
  and copy backups to another machine.
- **PostgreSQL:** `pg_dump -Fc skans_qb > skans-$(date +%F).dump` daily, plus a copy of the
  branding folder.
- **Restore (SQLite):** stop the service, copy `database.db` over the file in `DATABASE_URL`,
  restore the branding folder, then start the service.
- **Restore (PostgreSQL):** `pg_restore -c -d skans_qb file.dump`.
- Test a restore every term on a spare machine. A backup that has never been restored is not a
  backup.

## Tablet and browser support

- **Supported browsers:** current Chrome, Edge, Firefox and Safari, including iPadOS Safari.
- **Small screens:** below 1024 px wide (iPad portrait and landscape) the sidebar becomes a drawer. On desktop it collapses to an icon rail.
- **Layout:** lists use cards rather than wide tables, and controls are at least 40–44 px for touch.
- **Paper builder:** split into four steps, with arrow buttons for reordering on touch screens; drag-and-drop works with a mouse.
- **Downloads:** PDF downloads are plain links, so they work without pop-up permission on iPad.

## Current limitations

- **PDF layout:** it is close to, but **not certified as an exact match** of, the approved papers. Final fonts, sizes, margins and wording must be set from the official specification, then compared page by page. No pixel-diff tool is included.
- **Logos:** none ship. Add authorised files to enable them.
- **CSV import:** the endpoint (`POST /api/import/questions`) exists but has no interface yet.
- **Auto-generation:** rule-based paper auto-generation (`POST /api/papers/auto-generate`) has no interface yet.
- **Submission date:** the review queue shows the question's last update time. A submitted question cannot be edited by its author, so this time equals the submission time unless an HOA edits it.
- **Dependency advisories:** `npm audit` reports moderate/high advisories in transitive packages (TipTap, React Router, Prisma tooling, csv-parse). Their fixes need major-version upgrades, which should be planned and tested rather than forced. The reachable csv-parse prototype issue is mitigated in code and covered by a test.
- **Production runtime:** the server runs TypeScript through `tsx`. There is no separate compile step.
