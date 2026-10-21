import { Router } from 'express';
import multer from 'multer';
import { parse as parseCsv } from 'csv-parse/sync';
import { questionInputSchema, type ImportReport, type QuestionInput } from '@skans/shared';
import { prisma } from '../db';
import { audit } from '../lib/audit';
import { ah, badRequest } from '../lib/http';
import { sanitizeQuestionInput } from '../lib/questions';
import { escapeHtml } from '../lib/sanitize';
import { requireRole } from '../middleware/auth';

const router = Router();
router.use(requireRole('ADMIN', 'TEACHER'));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ok = /\.csv$/i.test(file.originalname) && /(csv|excel|text\/plain|octet-stream)/i.test(file.mimetype);
    if (ok) {
      cb(null, true);
    } else {
      cb(badRequest('Please upload a .csv file.'));
    }
  },
});

export const CSV_COLUMNS = [
  'subject_code',
  'topic',
  'type',
  'marks',
  'difficulty',
  'source',
  'question',
  'option_a',
  'option_b',
  'option_c',
  'option_d',
  'correct',
  'answer',
  'advice',
  'comments',
] as const;

const SAMPLE_ROWS = [
  [
    'FAR',
    'IAS 16 Property, plant and equipment',
    'MCQ',
    '1',
    'EASY',
    'SKANS Mock 2026',
    'Which of the following costs should NOT be capitalised as part of the cost of an item of property, plant and equipment?',
    'Site preparation costs',
    'Initial delivery and handling costs',
    'Costs of opening a new facility',
    'Professional fees',
    'c',
    'IAS 16.19 - costs of opening a new facility are not costs of PPE.',
    '',
    '',
  ],
  [
    'TAX',
    'Constitutional framework',
    'TRUE_FALSE',
    '1',
    'EASY',
    'SKANS Test 3',
    'Sales tax on services is a provincial subject under the Constitution of Pakistan.',
    '',
    '',
    '',
    '',
    'TRUE',
    '',
    '',
    '',
  ],
  [
    'AUD',
    'Audit evidence',
    'SHORT',
    '4',
    'MEDIUM',
    'Spring 2025 mock',
    'Explain the difference between tests of controls and substantive procedures.\nGive one example of each.',
    '',
    '',
    '',
    '',
    '',
    'Tests of controls evaluate operating effectiveness of controls; substantive procedures detect material misstatement at assertion level.',
    'Candidates often confuse the two - examples must be specific.',
    'Imported from CSV',
  ],
];

function toCsvLine(values: readonly string[]) {
  return values.map((v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)).join(',');
}

router.get('/sample.csv', (_req, res) => {
  const csv = [toCsvLine(CSV_COLUMNS), ...SAMPLE_ROWS.map(toCsvLine)].join('\r\n') + '\r\n';
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="question_import_sample.csv"');
  res.send(csv);
});

/** Plain text (or simple HTML) from a CSV cell to rich text paragraphs. */
function cellToHtml(text: string): string {
  const t = text.trim();
  if (!t) return '';
  if (/<\/?(p|table|strong|em|ul|ol|br)\b/i.test(t)) return t; // already HTML - sanitised later
  return t
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map((l) => `<p>${escapeHtml(l.trim())}</p>`)
    .join('');
}

router.post(
  '/questions',
  upload.single('file'),
  ah(async (req, res) => {
    if (!req.file) throw badRequest('No file uploaded.');
    const dryRun = req.query.dryRun === '1';
    const submit = req.query.submit === '1';
    let records: Record<string, string>[];
    try {
      records = parseCsv(req.file.buffer.toString('utf8').replace(/^﻿/, ''), {
        // Header names become object keys; refuse names that could replace the record prototype
        // (csv-parse advisory GHSA-8cw4-87c7-c6xx).
        columns: (h: string[]) =>
          h.map((x) => {
            const key = x.trim().toLowerCase();
            if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error(`Invalid column name "${key}".`);
            return key;
          }),
        skip_empty_lines: true,
        trim: false,
        relax_column_count: true,
      });
    } catch (e) {
      throw badRequest(`Could not read the CSV file: ${(e as Error).message}`);
    }
    if (records.length > 1000) throw badRequest('A maximum of 1000 rows can be imported at once.');

    const report: ImportReport = { dryRun, totalRows: records.length, imported: 0, errors: [], warnings: [] };
    const header = records.length ? Object.keys(records[0]) : [];
    const missing = ['subject_code', 'type', 'marks', 'question'].filter((c) => !header.includes(c));
    if (missing.length) {
      report.errors.push({ row: 1, field: missing.join(', '), message: 'Required column(s) missing from header row.' });
      return res.json(report);
    }

    const subjects = await prisma.subject.findMany();
    const byCode = new Map(subjects.map((s) => [s.code.toUpperCase(), s]));
    const valid: QuestionInput[] = [];

    records.forEach((r, i) => {
      const row = i + 2; // header is row 1
      const err = (field: string, message: string) => report.errors.push({ row, field, message });
      const subject = byCode.get((r.subject_code ?? '').trim().toUpperCase());
      if (!subject) return err('subject_code', `Unknown subject code "${r.subject_code}".`);
      if (!req.user!.subjectIds.includes(subject.id)) return err('subject_code', `Subject ${subject.code} is not assigned to you.`);
      const type = (r.type ?? '').trim().toUpperCase().replace(/[\s/-]+/g, '_');
      const typeMap: Record<string, string> = { TF: 'TRUE_FALSE', TRUEFALSE: 'TRUE_FALSE', TRUE_FALSE: 'TRUE_FALSE', MCQ: 'MCQ', SHORT: 'SHORT', LONG: 'LONG' };
      const t = typeMap[type];
      if (!t) return err('type', `Type must be MCQ, TRUE_FALSE, SHORT or LONG (got "${r.type}").`);
      const marks = Number((r.marks ?? '').trim());
      if (!Number.isFinite(marks) || marks <= 0) return err('marks', 'Marks must be a positive number.');
      const correct = (r.correct ?? '').trim().toLowerCase();
      let content: unknown = {};
      if (t === 'MCQ') {
        const opts = ['a', 'b', 'c', 'd'].map((k) => (r[`option_${k}`] ?? '').trim()).filter(Boolean);
        if (opts.length < 2) return err('option_a', 'MCQ needs at least two options (option_a, option_b ...).');
        const idx = ['a', 'b', 'c', 'd'].indexOf(correct);
        if (idx < 0 || idx >= opts.length) return err('correct', 'Correct must be the letter of one of the options (a-d).');
        content = { layout: 'auto', options: opts.map((o, k) => ({ key: String.fromCharCode(97 + k), html: `<p>${escapeHtml(o)}</p>`, correct: k === idx })) };
      } else if (t === 'TRUE_FALSE') {
        if (!['true', 'false', 't', 'f'].includes(correct)) return err('correct', 'Correct must be TRUE or FALSE.');
        content = { correct: correct.startsWith('t') };
      } else if (t === 'LONG') {
        content = { parts: [], partLabelStyle: null };
      }
      const difficulty = (r.difficulty ?? '').trim().toUpperCase() || 'MEDIUM';
      const candidate = {
        subjectId: subject.id,
        topic: (r.topic ?? '').trim(),
        type: t,
        marks,
        difficulty,
        source: (r.source ?? '').trim(),
        body: cellToHtml(r.question ?? ''),
        answer: cellToHtml(r.answer ?? ''),
        advice: cellToHtml(r.advice ?? ''),
        comments: (r.comments ?? '').trim(),
        content,
      };
      if (!candidate.body) return err('question', 'Question text is empty.');
      const parsed = questionInputSchema.safeParse(candidate);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) err(issue.path.join('.') || 'row', issue.message);
        return;
      }
      if (!candidate.answer) report.warnings.push({ row, message: 'No answer / solution provided.' });
      valid.push(parsed.data);
    });

    if (!dryRun && report.errors.length === 0 && valid.length) {
      await prisma.$transaction(
        valid.map((q) =>
          prisma.question.create({
            data: { ...sanitizeQuestionInput(q), status: submit ? 'SUBMITTED' : 'DRAFT', createdById: req.user!.id, updatedById: req.user!.id },
          }),
        ),
      );
      report.imported = valid.length;
      await audit(req, 'QUESTION_IMPORT', 'Question', '', { rows: valid.length, file: req.file.originalname.slice(0, 100) });
    }
    res.json(report);
  }),
);

export default router;
