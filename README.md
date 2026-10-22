# SKANS Question Bank & Examination Paper Management System

Internal question bank and examination-paper system of **SKANS School of Accountancy** (CAF level).
Teachers write questions; administrators review them; approved questions are assembled into
papers that are printed to PDF together with a separate answer key.

> This is a SKANS internal system. A published CAF examination paper is used only as the
> **formatting reference** for the SKANS CAF format; papers carry the SKANS logo only.

Contents: [Setup](#setup) · [Environment](#environment-variables) · [Database](#database) ·
[First sign-in](#first-sign-in) · [Roles](#role-permissions) · [Commands](#development-commands) ·
[Subjects](#caf-subjects) · [Format](#paper-format) · [Branding](#authorised-branding-assets) ·
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
                  # creates/updates the SQLite schema, bootstraps formats, subjects and
                  # the first admin account (password printed once), installs Chromium
npm run dev       # API on http://localhost:4000, web app on http://localhost:5173
```

Open http://localhost:5173 and sign in as described in [First sign-in](#first-sign-in).

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
| `npm run db:seed -w server` | Create **missing** SKANS paper formats and CAF subjects; create the first `admin` account if no administrator exists; upgrade data from older versions | No |
| `npm run db:reset` | Delete **all** data and bootstrap an empty system (formats, subjects, a new `admin`) | **Yes**. Refused when `NODE_ENV=production` unless `--force` is added. |
| `npm run db:backup` | Consistent online copy of the SQLite database and branding folder | No |

The seed never changes existing rows. Passwords, edited templates and assigned subjects survive.
Normal application start-up never modifies data.

## First sign-in

The system ships **without demo data**. The seed creates one administrator:

- username **`admin`**
- a random one-time password, printed **once** in the terminal by `npm run setup`, `npm run db:seed` or `npm run db:reset`. Set `SKANS_ADMIN_PASSWORD` in the environment beforehand to choose it yourself.
- the password must be changed at first sign-in.

Then, as `admin`: create teacher accounts and assign their subjects (**Users**), check subjects and
default formats (**Subjects**), and review the paper format (**Paper format**).

Emergency administrator recovery on the server console:
`npm run reset-admin -- <username> <new-password>`.

## Role permissions

Every rule is enforced by the server (`server/src/lib/access.ts`, route guards). The interface only
hides actions that would be refused.

There are three roles. **Teacher** and **Research Officer** have exactly the same rights; the
Research Officer role exists so these staff are listed correctly and can be picked as Research
Officers on papers.

| Capability | Administrator | Teacher / Research Officer |
|---|---|---|
| Subjects visible | All | Assigned only |
| Create questions (all types, tables, sub-questions) | Any subject | Assigned subjects |
| Edit questions | Any | Own **draft/returned** only |
| Submit for review | Own | Own |
| Approve / return (comment required to return) | Yes (submitted questions) | No |
| See other people's drafts | Yes | No |
| See approved questions | All | Assigned subjects |
| Move to recycle bin / restore | Any | Own non-approved |
| Delete permanently (from recycle bin, only if not used in any paper) | Any | Own non-approved |
| Build, preview, finalise papers; download paper and answer-key PDFs | Yes | No |
| Users, subjects, paper format, audit log | Yes | No |

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
npm run pdf:samples    # renders a built-in example through every paper format to output/
npm run demo:paper     # builds the CAF 8 AAE demo mock paper in the app (100 MCQs, 160 marks) + PDFs in output/demo/
```

The demo mock paper (`server/scripts/demo/aae-mock.ts`) is original content written for SKANS; nothing
is copied from ICAP papers. Back up first (`npm run db:backup`). It is saved as a FINAL paper with
approved questions tagged "SKANS demo mock paper"; `npm run demo:paper -- --replace` rebuilds it.

### Tests

`npm test` runs:

- **Shared unit tests:** marks rules, formatting, schemas.
- **Server tests:** about 40 Supertest + Playwright tests in `server/tests/`.

The server tests cover:

- **Authentication:** login/logout, cookie flags, CSRF, password change, lockout and unlock, deactivation.
- **Permissions:** every ADMIN/TEACHER rule, teacher subject isolation, and the removed HOA role.
- **Workflow:** review with a required rejection comment, approved-only papers, marks validation, audit records.
- **Output:** HTML preview, and question-paper and answer-key PDF generation with text extraction, which checks:
  - no URLs or browser date stamps
  - private notes are absent
  - "Page X of Y" on every page
  - repeated table header rows
  - page count

The server tests create a **fresh temporary SQLite database** for each run, bootstrap it, load
test-only fixtures (`server/tests/fixtures/`, never loaded into a real database) and delete it
afterwards. They never touch `dev.db`. Chromium must be installed (`npm run browsers -w server`).

## CAF subjects

The system holds the eight CAF papers set by SKANS (official names as printed on the papers):

| Group A | | Group B | |
|---|---|---|---|
| CAF 1 | FAR - Financial Accounting and Reporting | CAF 5 | MA - Management Accounting |
| CAF 2 | TPC - Taxation Principles and Compliance | CAF 6 | CR - Corporate Reporting |
| CAF 3 | DSR - Data, Systems and Risks | CAF 7 | BIA - Business Insights and Analysis |
| CAF 4 | BLD - Business Law Dynamics | CAF 8 | AAE - Audit and Assurance Essentials |

All eight use the **SKANS CAF Examination** format. The seed removes subjects from earlier versions
(FAR1, FAR2, AUD, TAX, CMA, BL, CL, MFA); one that still holds questions or papers is only hidden.

## Paper format

SKANS uses **one paper format**, stored as data (`PaperTemplate.config`) and validated by
`templateConfigSchema` in `shared/src/template.ts`:

- **SKANS CAF Examination** (`SKANS_CAF`): the standard. Formatting follows the CAF-8 *Audit
  and Assurance Essentials* paper and the administration's formatting sheet
  (`samples/Req_by _admin/Formatting Sheet.xlsx`; the `samples/` folder is kept locally and is
  not in git, because it holds ICAP and internal reference material), with the **SKANS logo at the top right**:

  | Element | Value |
  |---|---|
  | Font | Times New Roman style (Tinos, free and built in) throughout; running header in Calibri |
  | Exam title / paper name / date-marks-time lines | 15 pt bold / 18 pt bold / 12 pt |
  | Instructions, SECTION bars, QUESTION headings, body, options, marks | 11 pt (marks bold, right-aligned) |
  | Page | A4; left margin 2.14 cm; text to 560 pt (right margin 1.24 cm); bottom 1.2 cm |
  | Running header | "Spring 2026 ▌ Paper name … Page **X** of **Y**", about 1.3 cm from the top, from page 2 |
  | Spacing | single line spacing, justified body; 12 pt between paragraphs and sub-parts; 8 pt stem to options; 0 pt between options; 13 pt after QUESTION headings; 19 pt after SECTION bars |
  | Tables | dotted rules, header row repeats on following pages |


To change it: **Paper format → Edit**. The form covers fonts, all sizes, spacing, margins, title
line, instructions, question heading, marks format, sections, running header and end text;
**Advanced (JSON)** exposes everything. Every subject uses this format automatically. Finalised
papers keep the layout they were printed with.

### Fonts

Only free, open-licence fonts are used, and they are **built into the app** (npm packages
`@fontsource/tinos`, `@fontsource/arimo`, `@fontsource/carlito`) and embedded into every PDF, so
papers look the same on any server, computer or printer:

| Choice in Paper format | Font used | Licence | Same letter widths as |
|---|---|---|---|
| Times New Roman style (default) | Tinos | Apache 2.0 | Times New Roman |
| Arial style | Arimo | Apache 2.0 | Arial |
| Calibri style | Carlito | SIL Open Font License | Calibri |

The formatting sheet names Calisto MT, a licensed Microsoft/Monotype font. SKANS decided not to
use it, so it was removed from the project; formats saved earlier with Calisto MT now print in the
Times New Roman style automatically.

The one-line running header ("CAF 1 ┃ Page 1 of 4") is drawn by Chromium outside the page, where
embedded fonts cannot be used, so it takes the computer's own font of the chosen style (Calibri
comes with Windows). If that font is missing, the nearest one (Arial, Liberation Sans) is used;
nothing is shipped with the app and nothing fails.

### Resetting the paper format

Every number in **Paper format → Edit** that differs from the SKANS standard (the formatting
sheet values) is highlighted with a small ↺ button that puts that one value back.
**Reset to standard** (bottom left) puts every setting back at once; name and code stay, and
nothing is saved until you press **Save**.

### Names, drafts and review

- Each paper stores the **Teacher**, **Research Officer(s)** and **Admin** names (Paper →
  Details → Prepared by). They are printed on the **answer key** only, never on the question
  paper.
- While a paper is a **draft**, every PDF download carries a "DRAFT - FOR REVIEW" watermark and a
  `_DRAFT` file name, so drafts can be shared for review. **Finalise** the paper to print clean
  copies.

Placeholders: headings and running header `{n}`, `{session}`, `{subject}`, `{code}`, `{page}`,
`{pages}`, `{batch}`, `{test}`, `{date}` (`┃` draws the header bar); marks `{n}`, `{nn}`;
instructions `{count}`, `{countWord}`, `**bold**`.

## Authorised branding assets

`client/public/branding/` (or the folder in `BRANDING_DIR`) holds the SKANS logo:

- `skans-logo.png`: full-colour SKANS School of Accountancy logo, printed on papers (top right on the CAF format, top left on internal tests) and used on light backgrounds in the app.
- `skans-logo-dark.png`: white-lettering version for the app's navy sidebar and sign-in panel.

To replace the artwork, overwrite these files (a `.png`/`.svg` named `skans-logo` is also accepted
for printing). Changes are picked up immediately. See `client/public/branding/README.md`.

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
4. Sign in as `admin` with the one-time password printed by `db:setup`, change it, then create
   the teacher accounts.

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
- **Papers:** three tabs (Details, Questions, Download) with the main actions always visible; arrow buttons reorder questions on touch screens.
- **Downloads:** PDF downloads are plain links, so they work without pop-up permission on iPad.

## Current limitations

- **PDF layout:** it is close to, but **not certified as an exact match** of, the approved papers. Final fonts, sizes, margins and wording must be set from the official specification, then compared page by page. No pixel-diff tool is included.
- **Logos:** none ship. Add authorised files to enable them.
- **CSV import:** the endpoint (`POST /api/import/questions`) exists but has no interface yet.
- **Auto-generation:** rule-based paper auto-generation (`POST /api/papers/auto-generate`) has no interface yet.
- **Submission date:** the review queue shows the question's last update time. A submitted question cannot be edited by its author, so this time equals the submission time unless an administrator edits it.
- **Dependency advisories:** `npm audit` reports moderate/high advisories in transitive packages (TipTap, React Router, Prisma tooling, csv-parse). Their fixes need major-version upgrades, which should be planned and tested rather than forced. The reachable csv-parse prototype issue is mitigated in code and covered by a test.
- **Production runtime:** the server runs TypeScript through `tsx`. There is no separate compile step.
