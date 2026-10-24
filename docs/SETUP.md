# Setup, configuration and operations guide

[← Back to the project overview](../README.md)

## About

Internal question bank and examination-paper system of **SKANS School of Accountancy** (CAF level).
Teachers write questions; administrators review them; approved questions are assembled into
papers that are printed to PDF together with a separate answer key.

> This is a SKANS internal system. A published CAF examination paper is used only as the
> **formatting reference** for the SKANS CAF format; papers carry the SKANS logo only.

Contents: [Setup](#setup) · [Environment](#environment-variables) · [Database](#database) ·
[First sign-in](#first-sign-in) · [Roles](#role-permissions) · [Commands](#development-commands) ·
[Subjects](#caf-subjects) · [Format](#paper-format) · [Branding](#authorised-branding-assets) ·
[PostgreSQL](#postgresql) · [Deployment](#local-school-server-deployment) ·
[Backups](#backups) · [Browsers](#tablet-and-browser-support) · [Limitations](#current-limitations)

## Architecture

| Part | Technology |
|---|---|
| `client/` | React 18, Vite 6, TypeScript, Tailwind CSS 4, React Router 7, TipTap 3 editor |
| `server/` | Node.js, Express 4, TypeScript (run with `tsx`), Prisma 7 (node-postgres adapter), Playwright/Chromium for PDFs |
| `shared/` | Zod schemas, types, marks rules and template configuration used by client and server |
| Database | PostgreSQL 17 (Prisma migrations; daily `pg_dump` backups) |

One HTML renderer (`server/src/render/paperHtml.ts`) produces both the live preview and the PDF,
so the preview is what gets printed.

## Setup

Requirements: **Node.js 20+** (tested on 24), npm 10+ and **PostgreSQL 15+** (tested on 17). About
400 MB of disk space for dependencies and Chromium. Create the database user and database once
(see [PostgreSQL](#postgresql)) and put the connection in `server/.env` before `npm run setup`.

```bash
npm run setup     # creates server/.env with a random secret, installs packages,
                  # applies the database migrations, bootstraps formats, subjects and
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
| `DATABASE_URL` | *(required)* | PostgreSQL connection, e.g. `postgresql://skans:…@localhost:5432/skans_qb?schema=public`. |
| `BACKUP_DIR` | `server/backups` | Where `npm run db:backup` writes backups. |
| `BACKUP_KEEP_DAILY` / `BACKUP_KEEP_MONTHLY` | `14` / `6` | How many daily backups, and how many monthly ones, are kept. |
| `BACKUP_COPY_DIR` | *(none)* | Second copy of every backup (another disk, USB drive or synced cloud folder). |
| `PG_BIN` | *(auto)* | Folder with `pg_dump`/`pg_restore` if they are not on PATH. |
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

Prisma schema: `server/prisma/schema.prisma`; database changes are versioned migrations in
`server/prisma/migrations/`. Enumerations and JSON payloads are stored as text and validated with
zod whenever they are read.

| Command | What it does | Destructive? |
|---|---|---|
| `npm run db:setup -w server` | Generate the Prisma client, apply migrations (`prisma migrate deploy`), run the seed | No |
| `npm run db:migrate:new -w server -- <name>` | Create a new migration after changing the schema (development only) | No |
| `npm run db:seed -w server` | Create **missing** SKANS paper formats and CAF subjects; create the first `admin` account if no administrator exists; upgrade data from older versions | No |
| `npm run db:reset` | Delete **all** data and bootstrap an empty system (formats, subjects, a new `admin`) | **Yes**. Refused when `NODE_ENV=production` unless `--force` is added. |
| `npm run db:backup` | `pg_dump` backup + logos, with automatic clean-up of old backups (see [Backups](#backups)) | No |
| `npm run db:verify-backup` | Restores the newest backup into a temporary database and compares it with the live data | No |
| `npm run db:restore -- <folder> --yes` | Replaces **all** data with a backup (takes a safety backup first) | **Yes** |
| `npm run data:cleanup -- --demo` / `--all-content` | Lists (or with `--yes` deletes, after a backup) the demo paper, or every paper and question | With `--yes` |

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
npm run test:e2e       # builds the client and runs the 34-step browser walkthrough
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
- **Server tests:** 45 Supertest + PDF tests in `server/tests/` (Vitest).

`npm run test:e2e` builds the client and runs **34 browser tests** (`server/e2e/`, Playwright) that
walk through the whole system as admin, teacher, Research Officer and a teacher of another
subject: sign-in and lockout, accounts, every question type (amounts tables, (I) lists, several
True/False at once), recycle bin, review, building and finalising a paper, draft and final PDFs,
paper format reset, audit log, permissions, CSRF and HTML cleaning, phone layout. It starts the
real server on port 4173 with its own temporary PostgreSQL database (`skans_e2e_…`, dropped
afterwards). On failure, screenshots and a trace are in `server/e2e-results/` and a report in
`server/e2e-report/`. Run both suites before every update.

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

The server tests create a **fresh temporary PostgreSQL database** (`skans_test_…`) for each run on
the server in `DATABASE_URL` (or `TEST_DATABASE_URL`), apply the migrations, bootstrap it, load
test-only fixtures (`server/tests/fixtures/`, never loaded into a real database) and drop it
afterwards. They never touch `skans_qb`. The database user needs `CREATEDB` on development and CI
machines only. Chromium must be installed (`npm run browsers -w server`).

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

## PostgreSQL

**Create the user and database once** (as the `postgres` superuser, e.g. in `psql` or pgAdmin):

```sql
CREATE ROLE skans LOGIN PASSWORD 'a-long-random-password';          -- add CREATEDB on development PCs (for the tests)
CREATE DATABASE skans_qb OWNER skans ENCODING 'UTF8' TEMPLATE template0;
```

Put the connection in `server/.env` as `DATABASE_URL`, then `npm run db:setup -w server` creates the
tables from the migrations and bootstraps the system. The application user is not a superuser.

**Moving from the earlier SQLite version** (done on 23 October 2026 for the development PC):
`npm run db:copy-from-sqlite -w server -- prisma/dev.db` copies everything (users with their
password hashes, subjects, formats, questions, papers, versions, audit log) into an **empty**
PostgreSQL database in one transaction, moves the id counters on, and compares the row counts
table by table. The SQLite file is opened read-only and kept as a backup.

Text filters (titles, topics, audit user names) ignore upper and lower case, as before.

## Public beta (from a PC, free)

For a beta test before the school server is ready, the system can run on a PC and be reached by
testers through a free **Cloudflare quick tunnel** (`cloudflared`, installed with
`winget install --id Cloudflare.cloudflared`). Everything works as on a server, including PDFs.

- `server/.env.beta` (not in git): production mode, port 4300, `TRUST_PROXY=1`, its own database
  `skans_beta`, its own secret and backup folder `server/backups-beta/`.
- `powershell -ExecutionPolicy Bypass -File server\scripts\beta.ps1 -Start` starts the app and the
  tunnel and prints the public `https://…trycloudflare.com` link (also in `server/logs/beta-url.txt`).
  `-Status`, `-Stop`, `-Start -Rebuild` (after code changes), `-Install` (start at sign-in and back up
  the beta database nightly at 23:15), `-Uninstall`.
- The quick-tunnel link **changes whenever the tunnel restarts** (for example after a reboot); send
  testers the new link from `beta-url.txt`. The PC must stay on and online during the beta.
- Testers get accounts from the beta admin (Users → Add user), with a temporary password they
  change at first sign-in. Nothing from `skans_qb` is visible in the beta.

## Local school-server deployment

1. Install Node.js 20+ LTS on the server (Linux or Windows). Copy the repository, then run:
   ```bash
   npm ci
   npm run browsers -w server
   npm run db:setup -w server
   npm run build
   ```
2. Install PostgreSQL and create the user and database (see [PostgreSQL](#postgresql)). Create
   `server/.env` from `server/.env.production.example`. Set `NODE_ENV=production` and
   `TRUST_PROXY=1`, a new `SESSION_SECRET`, `DATABASE_URL`, `BACKUP_DIR` and `BRANDING_DIR`.
   Schedule the backups (see [Backups](#backups)).
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
- PostgreSQL listens on 127.0.0.1 only (the default); keep port 5432 closed to the network.
- Do not expose the server directly to the internet. Use the school VPN for remote staff.

## Backups

`npm run db:backup` writes `skans-YYYYMMDD-HHMMSS/` into `BACKUP_DIR` (default `server/backups`)
while the system is in use:

- `database.dump`: a complete `pg_dump` (custom format, compressed);
- `branding/`: the logo files;
- `backup.json`: date, database, size and a SHA-256 checksum used to detect a damaged file.

Old backups are deleted automatically: the newest 14 are kept, plus the newest one of each of the
last 6 months (`BACKUP_KEEP_DAILY`, `BACKUP_KEEP_MONTHLY`). Only backups made by this command are
ever deleted; the SQLite backups from before the move to PostgreSQL are left alone. With
`BACKUP_COPY_DIR` every backup is also copied to a second place, such as another disk, a USB drive
or a OneDrive/Google Drive folder, with the same clean-up rules.

**Schedule it** (Windows): `powershell -ExecutionPolicy Bypass -File server\scripts\schedule-backup.ps1`
registers two Task Scheduler jobs: the backup every night at 23:00 and a restore check every
Sunday. A missed run (PC switched off) runs as soon as the PC is on again. On the school server use
`-System` (as Administrator) so it also runs when nobody is signed in; `-Remove` deletes the jobs.
Output goes to `server/logs/backup.log`. On Linux, use cron:
`0 23 * * * cd /srv/skans/app && npm run db:backup >> /var/log/skans-backup.log 2>&1`.

**Check backups work:** `npm run db:verify-backup` restores the newest backup into a temporary
database, compares every table with the live data and drops it again (runs weekly when scheduled).

**Restore:** stop the application, then `npm run db:restore -- server/backups/skans-… --yes`. It
checks the checksum, takes a safety backup of the current data, and replaces everything in one
transaction. Copy `branding/` back if the logos were lost. Everyone signs in again afterwards.

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
