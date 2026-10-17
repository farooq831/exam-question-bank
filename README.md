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

The current milestone restores the backend and seed. The React client, paper builder UI, visual
PDF comparison tooling, and automated server tests are being completed in later milestones.
