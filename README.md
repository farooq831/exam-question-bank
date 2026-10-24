<div align="center">

<img src="client/public/branding/skans-logo.png" alt="Logo" width="260" />

# Exam Question Bank & Paper Builder

**A complete web system for writing, reviewing and printing professional examination papers.**<br/>
Teachers write questions, administrators review them, and approved questions become<br/>
print-ready question papers and answer keys in PDF, in the CAF (ICAP) examination format.

<br/>

![React](https://img.shields.io/badge/React_18-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite_6-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS_4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
<br/>
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma_7-2D3748?style=for-the-badge&logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL_17-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![Playwright](https://img.shields.io/badge/Playwright-2EAD33?style=for-the-badge&logo=playwright&logoColor=white)

![Tests](https://img.shields.io/badge/tests-92_passing-brightgreen?style=flat-square)
![Roles](https://img.shields.io/badge/roles-Admin_·_Teacher_·_Research_Officer-1b2a4b?style=flat-square)
![Output](https://img.shields.io/badge/output-PDF_paper_+_answer_key-c08a2e?style=flat-square)

[**🎬 Video guides**](#-video-guides) ·
[**✨ Features**](#-features) ·
[**🖼️ Screenshots**](#️-screenshots) ·
[**🧱 Tech stack**](#-tech-stack) ·
[**🚀 Quick start**](#-quick-start) ·
[**📘 Full guide**](docs/SETUP.md)

</div>

---

## 📖 About the project

Preparing exam papers by hand in Word is slow and error-prone: questions get lost in folders, numbering
breaks, marks don't add up, and answer keys drift away from the paper. This system replaces that
workflow with one central, secure question bank:

1. **Teachers** write questions of six types, with tables, amounts tables, numbered statements and a model answer.
2. **Administrators** review every question and either approve it or return it with a comment.
3. Approved questions are picked into a **paper builder**, ordered into sections and checked against the maximum marks.
4. One click produces a **question paper PDF** and a separate **answer key PDF**, formatted like a real CAF examination.

It was built for **SKANS School of Accountancy** (CAF level), and is in active beta use by its teachers and administrators.

---

## 🎬 Video guides

Two step-by-step tutorials recorded from the real application. Each has on-screen subtitles in the
style of an instructor, a chapter title card for every topic, and chapter markers inside the MP4.

<table>
<tr>
<td width="50%" align="center">

### 👩‍🏫 Teacher Guide
**15 min · 16 chapters**

<!-- To make the video play right here on GitHub: edit this README on github.com, drag
     docs/media/videos/teacher-guide.mp4 into the editor and replace this comment with the link GitHub creates. -->

<a href="docs/media/videos/teacher-guide.mp4"><img src="docs/media/teacher-thumb.png" alt="Teacher guide video" width="100%"/></a>

▶️ [**Watch the Teacher Guide (MP4)**](docs/media/videos/teacher-guide.mp4)

</td>
<td width="50%" align="center">

### 🛡️ Administrator Guide
**12 min · 15 chapters**

<!-- To make the video play right here on GitHub: edit this README on github.com, drag
     docs/media/videos/admin-guide.mp4 into the editor and replace this comment with the link GitHub creates. -->

<a href="docs/media/videos/admin-guide.mp4"><img src="docs/media/admin-thumb.png" alt="Administrator guide video" width="100%"/></a>

▶️ [**Watch the Administrator Guide (MP4)**](docs/media/videos/admin-guide.mp4)

</td>
</tr>
<tr>
<td valign="top">

<details>
<summary><b>📑 Chapters</b></summary>

| Time | Chapter |
|---:|---|
| 0:00 | Introduction |
| 0:26 | 1 · Signing in for the first time |
| 1:29 | 2 · Your dashboard |
| 2:02 | 3 · Starting a new question |
| 3:08 | 4 · Writing an MCQ |
| 4:51 | 5 · Writing an MCQ set |
| 6:16 | 6 · True / False statements |
| 6:59 | 7 · Text tools |
| 8:01 | 8 · Tables and amounts tables |
| 9:20 | 9 · Long questions with sub-questions |
| 10:28 | 10 · Case studies |
| 10:54 | 11 · Answer key and private notes |
| 11:36 | 12 · The editor window |
| 12:21 | 13 · Your questions list |
| 13:08 | 14 · Duplicate and the recycle bin |
| 13:49 | 15 · When a question is returned |
| 14:42 | 16 · Your account |

</details>

</td>
<td valign="top">

<details>
<summary><b>📑 Chapters</b></summary>

| Time | Chapter |
|---:|---|
| 0:00 | Introduction |
| 0:21 | 1 · Signing in and the admin dashboard |
| 1:01 | 2 · Managing users |
| 2:36 | 3 · Subjects |
| 3:00 | 4 · Reviewing questions |
| 4:09 | 5 · Questions as administrator |
| 4:30 | 6 · Building a paper: details |
| 5:17 | 7 · Building a paper: questions |
| 6:19 | 8 · Preview and saving a draft |
| 6:51 | 9 · Downloading drafts for review |
| 7:32 | 10 · Finalising the paper |
| 8:11 | 11 · Versions and reopening |
| 8:44 | 12 · The paper library |
| 9:18 | 13 · Paper format |
| 10:02 | 14 · The audit log |
| 10:26 | 15 · Signing out and good habits |

</details>

</td>
</tr>
</table>

<div align="center">

**A quick look:**

<img src="docs/media/teacher-preview.gif" alt="Writing a question with an amounts table" width="49%"/>
<img src="docs/media/admin-preview.gif" alt="Adding questions to a paper" width="49%"/>

<sub>Left: a teacher building an ICAP-style amounts table. Right: an administrator adding approved questions to a paper.<br/>
Subtitle files (.srt) are in <a href="docs/media/videos">docs/media/videos</a>. The videos are recreated automatically with <code>npm run docs:videos -w server</code>.</sub>

</div>

---

## ✨ Features

<table>
<tr>
<td width="50%" valign="top">

### ✍️ Question writing
- **Six question types**: MCQ, MCQ set, True / False (several statements at once), Short, Long and Case study
- Sub-questions **(a), (b)** with parts **(i), (ii)**, and marks added up automatically
- Rich-text editor: bold, italic, underline, super/subscript, lists numbered **(i) (I) (a) (A) (1)**
- **Tables and ICAP-style amounts tables** (open top-left corner, right-aligned figures, merge cells, no-border cells)
- Model answer and examiner's advice (printed **only** in the answer key), plus private notes that never print
- Drafts, duplicate, recycle bin with restore and permanent delete
- Editor window with minimise, maximise and restore, like a desktop app

</td>
<td width="50%" valign="top">

### ✅ Review workflow
- Draft → **Submitted** → **Approved** or **Returned** with a required comment
- The reviewer's comment appears in the teacher's list and at the top of the editor
- Teachers see only **their own subjects**; questions in review are locked
- Dashboards with counters for drafts, items in review, returned and approved questions

### 👥 Users and security
- Three roles: **Administrator, Teacher, Research Officer**
- Temporary password → **forced own password** at first sign-in
- Account lock after 5 wrong passwords, admin unlock and password reset
- bcrypt hashing, CSRF tokens, Helmet CSP, rate limits and secure sessions
- A full **audit log** of sign-ins, edits, reviews, downloads and deletions

</td>
</tr>
<tr>
<td valign="top">

### 📄 Paper builder and PDFs
- Paper details: subject, session, date, maximum marks, duration and reading time
- Search approved questions, preview them, add, reorder, set sections, override marks, start a new page
- **Live preview** that matches the PDF exactly (one HTML renderer for both)
- **Question paper** and **answer key** PDFs, with a DRAFT watermark until finalised
- Optional name-and-time watermark for tracing leaked copies
- Finalise only when the marks match; final papers are frozen; version history with restore

</td>
<td valign="top">

### ⚙️ Administration and operations
- **Paper format editor**: fonts, sizes, spacing, margins, header and instructions, with *reset to standard*
- Subjects grouped as CAF Group A / Group B
- **PostgreSQL** with migrations; **nightly backups** (14 daily + 6 monthly) with checksums and a restore command
- Free public beta through a Cloudflare tunnel; Windows Server guide (NSSM service, HTTPS)
- Works on desktop, tablet and phone
- PDF guides for users, beta testers and server setup, all generated by scripts

</td>
</tr>
</table>

---

## 🖼️ Screenshots

<div align="center">

| Sign in | Admin dashboard |
|:---:|:---:|
| <img src="docs/media/screenshots/01-login.png" width="100%"/> | <img src="docs/media/screenshots/02-admin-dashboard.png" width="100%"/> |
| **Six question types** | **MCQ editor** |
| <img src="docs/media/screenshots/04-question-types.png" width="100%"/> | <img src="docs/media/screenshots/05-mcq-editor.png" width="100%"/> |
| **ICAP-style amounts table** | **Long question with sub-questions** |
| <img src="docs/media/screenshots/06-amounts-table.png" width="100%"/> | <img src="docs/media/screenshots/07-long-question.png" width="100%"/> |
| **Question bank** | **Review queue** |
| <img src="docs/media/screenshots/03-question-bank.png" width="100%"/> | <img src="docs/media/screenshots/08-review-queue.png" width="100%"/> |
| **Paper details** | **Paper builder** |
| <img src="docs/media/screenshots/10-paper-details.png" width="100%"/> | <img src="docs/media/screenshots/11-paper-builder.png" width="100%"/> |
| **Question paper preview (= PDF)** | **Answer key preview** |
| <img src="docs/media/screenshots/12-paper-preview.png" width="100%"/> | <img src="docs/media/screenshots/13-answer-key-preview.png" width="100%"/> |
| **Users and roles** | **Paper format editor** |
| <img src="docs/media/screenshots/14-users.png" width="100%"/> | <img src="docs/media/screenshots/15-paper-format.png" width="100%"/> |
| **Audit log** | **Teacher dashboard** |
| <img src="docs/media/screenshots/16-audit-log.png" width="100%"/> | <img src="docs/media/screenshots/18-teacher-dashboard.png" width="100%"/> |

<details>
<summary><b>More: paper library, subjects and phone view</b></summary>
<br/>

| Paper library | Subjects | Phone |
|:---:|:---:|:---:|
| <img src="docs/media/screenshots/09-paper-library.png" width="100%"/> | <img src="docs/media/screenshots/17-subjects.png" width="100%"/> | <img src="docs/media/screenshots/19-phone.png" width="60%"/> |

</details>

</div>

---

## 🔄 How it works

```mermaid
flowchart LR
    T["👩‍🏫 Teacher<br/>writes question"] -->|Submit| R{"🛡️ Admin<br/>review"}
    R -->|Return + comment| T
    R -->|Approve| B[("📚 Approved<br/>question bank")]
    B --> P["📝 Paper builder<br/>sections · marks · order"]
    P --> V["👁️ Live preview"]
    P -->|Finalise| F["📄 Question paper PDF<br/>🔑 Answer key PDF"]
```

| Role | Can do |
|---|---|
| **Administrator** | Everything: users, subjects, review, papers, PDFs, paper format and audit log |
| **Teacher** | Write, edit and submit questions in their own subjects; fix returned questions |
| **Research Officer** | The same as a teacher, usually across several subjects; named in the answer key |

---

## 🧱 Tech stack

| Layer | Technology | Why |
|---|---|---|
| **Front end** | React 18, TypeScript, Vite 6, React Router 7 | Fast, typed single-page app with instant reloads during development |
| **Styling** | Tailwind CSS 4 | A consistent, responsive design system without large CSS files |
| **Editor** | TipTap 3 (ProseMirror) | Word-like editing with tables, lists and custom numbering styles |
| **Back end** | Node.js, Express 4, TypeScript (tsx) | A simple, well-known REST API in the same language as the front end |
| **Database** | PostgreSQL 17 + Prisma 7 | Reliable relational data, migrations, type-safe queries and real backups |
| **Validation** | Zod (shared by client and server) | One set of rules: the browser and the server validate the same way |
| **PDF** | Playwright / Chromium | Pixel-accurate PDFs from the same HTML as the live preview |
| **Security** | bcrypt, express-session, CSRF, Helmet, rate limiting, sanitize-html | Protection against common web attacks |
| **Testing** | Vitest, Supertest, Playwright | **92 automated tests**: 11 unit, 47 integration and 34 end-to-end browser tests |

```
├── client/   React web app (pages, editor, paper builder)
├── server/   Express API, Prisma schema & migrations, PDF renderer, scripts, tests
├── shared/   Zod schemas, types, marks rules, paper-format config (used by both)
├── docs/     Full setup guide, screenshots and video guides
└── scripts/  Setup and release helpers
```

---

## 🚀 Quick start

**Requirements:** Node.js 20+, PostgreSQL 15+ and about 400 MB of free disk space.

```bash
# 1. Get the code
git clone https://github.com/farooq831/exam-question-bank.git
cd exam-question-bank

# 2. Create the PostgreSQL user and database (see docs/SETUP.md › PostgreSQL),
#    then install packages, apply migrations and create the first admin account
npm run setup

# 3. Start the API (port 4000) and the web app (port 5173)
npm run dev
```

Open **http://localhost:5173** and sign in as `admin` with the password printed by `npm run setup`.
You will be asked to choose your own password.

| Useful command | What it does |
|---|---|
| `npm test` | Unit and integration tests |
| `npm run test:e2e` | End-to-end browser tests |
| `npm run demo:paper` | Creates a complete 160-mark demo paper with answer key |
| `npm run db:backup` / `npm run db:restore` | Back up or restore the database |
| `npm run build && npm start` | Production build and server |

📘 **Everything else** (environment variables, roles, paper format, fonts, deployment on a Windows server, HTTPS,
backups and troubleshooting) is in the [**full setup guide**](docs/SETUP.md).

---

## 🛣️ Roadmap

- [x] Question bank with six question types, tables and answer keys
- [x] Review workflow and audit log
- [x] Paper builder with live preview and PDF output
- [x] PostgreSQL, nightly backups and automated tests
- [x] Public beta with real teachers
- [ ] Deployment on the school's own server (HTTPS)
- [ ] Email password reset
- [ ] Question statistics and reuse history

---

<div align="center">

**Developed by [@farooq831](https://github.com/farooq831)** · Built with ❤️ for teachers and examiners

<sub>The logo and name belong to SKANS School of Accountancy. Example questions in the demo are original
and not taken from any published examination. © 2026. All rights reserved.</sub>

</div>
