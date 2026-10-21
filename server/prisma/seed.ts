/**
 * Demo/initial data.
 *
 *   npm run db:seed            Non-destructive and idempotent. Creates templates, subjects and demo
 *                              accounts that do not exist yet (existing rows are never modified, so
 *                              passwords and admin edits survive). Demo questions and sample papers
 *                              are only added when the question bank is completely empty.
 *   npm run db:reset           DESTRUCTIVE. Recreates the schema and the demo dataset from scratch.
 *                              Refused when NODE_ENV=production unless --force is also given.
 */
import bcrypt from 'bcryptjs';
import type { Prisma } from '@prisma/client';
import { CA_PAPERS, computeQuestionMarks, ICAP_TEMPLATE_CONFIG, SKANS_TEMPLATE_CONFIG } from '@skans/shared';
import { prisma } from '../src/db';
import { buildSnapshot, paperInclude, parseTemplateConfig } from '../src/lib/papers';
import { buildSearchText } from '../src/lib/questions';
import { ol, opts, p, table, type SeedQuestion } from './seed-data/helpers';

const DEMO_PASSWORD = 'SkansDemo2026';
const RESET = process.argv.includes('--reset');
const FORCE = process.argv.includes('--force');

// The school teaches CAF only.
const subjects = CA_PAPERS.filter(({ code, level }) =>
  level === 'CAF' && ['AUD', 'TAX', 'FAR1', 'FAR2', 'CMA', 'BL', 'CL', 'MFA', 'FAR', 'DSR', 'TPC', 'BLD', 'MA', 'BIA'].includes(code),
);

const users = [
  { username: 'admin', fullName: 'SKANS IT Administrator', role: 'ADMIN', subjects: subjects.map((s) => s.code) },
  { username: 'hoa_far', fullName: 'HOA - Financial Reporting', role: 'HOA', subjects: ['FAR', 'FAR1', 'FAR2', 'CMA', 'TAX'] },
  { username: 'hoa_audit', fullName: 'HOA - Audit and Assurance', role: 'HOA', subjects: ['AUD'] },
  { username: 'teacher_far', fullName: 'FAR Teacher', role: 'TEACHER', subjects: ['FAR', 'FAR1', 'FAR2'] },
  { username: 'teacher_tax', fullName: 'Tax Teacher', role: 'TEACHER', subjects: ['TAX', 'TPC'] },
  { username: 'teacher_audit', fullName: 'Audit Teacher', role: 'TEACHER', subjects: ['AUD'] },
];

export const CAF_TEMPLATE = {
  code: 'ICAP_EXAM',
  name: 'CAF Examination Paper',
  description:
    'CAF examination-paper layout modelled on the reference paper supplied by the school. Fonts, margins, logo and wording are provisional until the administration approves the official specification.',
};
export const SKANS_TEMPLATE = {
  code: 'SKANS_INTERNAL',
  name: 'SKANS Internal Test',
  description:
    'SKANS internal test layout. Logo, fonts and spacing are provisional until the approved sample and authorised logo file are supplied.',
};

const questions: SeedQuestion[] = [
  {
    key: 'far-group',
    type: 'MCQ_GROUP',
    topic: 'Conceptual framework',
    marks: 4,
    source: 'FAR Spring 2026 style',
    body: p('Select the most appropriate answer for each of the following questions.'),
    content: {
      items: [
        { id: 'far-g1', stem: p('Which characteristic makes financial information useful to users?'), options: opts('a', 'Relevance', 'Secrecy', 'Complexity', 'Delay'), layout: '2', marks: 1 },
        { id: 'far-g2', stem: p('An asset is recognised when it is a present economic resource controlled by the entity as a result of past events.'), options: opts('a', 'True', 'False'), layout: '2', marks: 1 },
        { id: 'far-g3', stem: p('Which measurement basis generally uses current entry price?'), options: opts('b', 'Historical cost', 'Current cost', 'Fair value', 'Value in use'), layout: '2', marks: 1 },
        { id: 'far-g4', stem: p('Faithful representation requires information to be complete, neutral and free from error.'), options: opts('a', 'True', 'False'), layout: '2', marks: 1 },
      ],
    },
    answer: p('1(a), 2(a), 3(b), 4(a).'),
    status: 'APPROVED',
    by: 'teacher_far',
  },
  {
    key: 'far-alpha',
    type: 'MCQ',
    topic: 'Financial instruments',
    marks: 5,
    source: 'FAR Spring 2026 style - Alpha Trader',
    body: p('Alpha Trader acquired a portfolio of shares for investment. The following information is available at the reporting date:') +
      table([['Investment', 'Cost (Rs.)', 'Fair value (Rs.)'], ['A', '>120,000', '>126,000'], ['B', '>80,000', '>73,000'], ['C', '>50,000', '>54,000']], 1),
    content: { options: opts('b', 'Recognise a loss of Rs. 3,000', 'Recognise a gain of Rs. 3,000', 'Recognise a gain of Rs. 7,000', 'Make no entry'), layout: '1' },
    answer: p('The net fair value gain is Rs. 3,000, therefore option (b) is correct.'),
    status: 'APPROVED',
    by: 'teacher_far',
  },
  {
    key: 'far-fair-value',
    type: 'LONG',
    topic: 'Fair value measurement',
    marks: 11,
    source: 'FAR Spring 2026 style',
    body: p('A company acquired a cash-generating unit containing land, plant and equipment. At year end management identified indicators of impairment and prepared the following fair value information:'),
    content: {
      parts: [
        {
          id: 'a',
          html: p('Determine the recoverable amount of each asset from the following information:') +
            table([['Asset', 'Carrying amount', 'Fair value', 'Disposal costs'], ['Land', '>2,000,000', '>2,150,000', '>20,000'], ['Plant', '>1,600,000', '>1,450,000', '>15,000'], ['Equipment', '>900,000', '>820,000', '>10,000']], 1),
          marks: 8,
          answer: p('The recoverable amount is the higher of fair value less costs of disposal and value in use. Use the fair value less costs of disposal column in the comparison.'),
          parts: [],
        },
        {
          id: 'b',
          html: p('Explain the accounting treatment of any impairment loss.'),
          marks: 3,
          answer: p('Recognise an impairment loss in profit or loss to the extent the carrying amount exceeds the recoverable amount.'),
          parts: [],
        },
      ],
      partLabelStyle: 'roman',
    },
    answer: p('Award marks for calculation, comparison and a clear impairment conclusion.'),
    advice: p('Accept a well-supported calculation using the stated assumptions.'),
    status: 'APPROVED',
    by: 'teacher_far',
  },
  {
    key: 'far-coal',
    type: 'LONG',
    topic: 'Financial statements',
    marks: 10,
    source: 'FAR Spring 2026 style - Coal Limited',
    body: p('Coal Limited extracted the following trial balance at 30 June 2026. Prepare the relevant extracts and identify any missing adjustment information.'),
    content: {
      parts: [{ id: 'a', html: table([['Account', 'Debit (Rs.)', 'Credit (Rs.)'], ['Revenue', '', '>8,500,000'], ['Cost of sales', '>5,100,000', ''], ['Administrative expenses', '>1,250,000', ''], ['Trade receivables', '>1,800,000', ''], ['Trade payables', '', '>1,100,000'], ['Share capital', '', '>2,000,000']], 1), marks: 10, answer: p('Prepare the statement extracts after considering accruals, depreciation and tax adjustments.') }],
      partLabelStyle: 'roman',
    },
    answer: p('A complete answer reconciles the trial balance and clearly states assumptions.'),
    status: 'APPROVED',
    by: 'teacher_far',
  },
  {
    key: 'far-short',
    type: 'SHORT',
    topic: 'Revenue',
    marks: 4,
    source: 'FAR revision bank',
    body: p('State the five-step model for recognising revenue from contracts with customers.'),
    answer: ol('Identify the contract.', 'Identify the performance obligations.', 'Determine the transaction price.', 'Allocate the transaction price.', 'Recognise revenue when or as obligations are satisfied.'),
    status: 'DRAFT',
    by: 'teacher_far',
  },
  {
    key: 'far-reject',
    type: 'TRUE_FALSE',
    topic: 'Inventories',
    marks: 1,
    source: 'FAR revision bank',
    body: p('Inventories are always measured at fair value through profit or loss.'),
    content: { correct: false },
    answer: p('False. Inventories are measured at the lower of cost and net realisable value.'),
    status: 'REJECTED',
    by: 'teacher_far',
    reviewComment: 'Please clarify the measurement basis and cite the relevant standard.',
  },
  {
    key: 'audit-mcq',
    type: 'MCQ',
    topic: 'Audit evidence',
    marks: 1,
    source: 'Audit Spring 2026 style',
    body: p('Which procedure generally provides the most reliable evidence about the existence of a bank balance?'),
    content: { options: opts('c', 'Inspecting the cash book', 'Reviewing management representation', 'Obtaining a direct bank confirmation', 'Reperforming the bank reconciliation'), layout: '1' },
    answer: p('Option (c), a direct external confirmation.'),
    status: 'APPROVED',
    by: 'teacher_audit',
  },
  {
    key: 'audit-scenario',
    type: 'LONG',
    topic: 'Risk assessment',
    marks: 8,
    source: 'Audit scenario bank',
    body: p('During planning, the audit team identifies rapid growth, pressure to meet a bank covenant and a new finance system. Explain the audit risks and suitable responses.'),
    content: { parts: [{ id: 'a', html: p('Discuss four risks and one response for each.'), marks: 8, answer: p('Consider revenue recognition, management override, system migration and going concern. Responses include substantive testing, IT controls testing and expanded going-concern procedures.') }], partLabelStyle: 'roman' },
    answer: p('Award one mark for each valid risk and response pair.'),
    status: 'SUBMITTED',
    by: 'teacher_audit',
  },
  {
    key: 'tax-q1',
    type: 'SHORT',
    topic: 'Income tax',
    marks: 5,
    source: 'Tax Batch 1',
    body: p('Compute taxable income where accounting profit is Rs. 4,000,000, including depreciation of Rs. 500,000 and tax depreciation of Rs. 700,000.'),
    answer: p('Taxable income is adjusted for the accounting depreciation and tax depreciation: Rs. 3,800,000 before other adjustments.'),
    status: 'APPROVED',
    by: 'teacher_tax',
  },
  {
    key: 'tax-q2',
    type: 'MCQ',
    topic: 'Sales tax',
    marks: 5,
    source: 'Tax Batch 1',
    body: p('A registered person makes a taxable supply of Rs. 1,000,000. Assuming an 18% rate, calculate the output tax.'),
    content: { options: opts('a', 'Rs. 180,000', 'Rs. 118,000', 'Rs. 820,000', 'Rs. 1,180,000'), layout: '2' },
    answer: p('Rs. 1,000,000 x 18% = Rs. 180,000.'),
    status: 'APPROVED',
    by: 'teacher_tax',
  },
  {
    key: 'tax-q3',
    type: 'LONG',
    topic: 'Tax computation',
    marks: 10,
    source: 'Tax Batch 1',
    body: p('Prepare a concise computation of taxable business income from the following information.'),
    content: { parts: [{ id: 'a', html: table([['Particulars', 'Rs.'], ['Accounting profit', '>6,200,000'], ['Add: inadmissible expense', '>350,000'], ['Less: allowable tax allowance', '>200,000']], 1), marks: 10, answer: p('Taxable income before applicable credits is Rs. 6,350,000.') }], partLabelStyle: 'alpha' },
    answer: p('Show each adjustment and arrive at Rs. 6,350,000 before credits.'),
    status: 'APPROVED',
    by: 'teacher_tax',
  },
  {
    key: 'tax-q4',
    type: 'TRUE_FALSE',
    topic: 'Tax administration',
    marks: 5,
    source: 'Tax Batch 1',
    body: p('A tax return should be supported by records sufficient to substantiate the amounts reported.'),
    content: { correct: true },
    answer: p('True. Adequate records support the return and allow verification.'),
    status: 'APPROVED',
    by: 'teacher_tax',
  },
];

function extraQuestions(subjectCode: string, author: string, count: number): SeedQuestion[] {
  return Array.from({ length: count }, (_, index) => ({
    key: `${subjectCode.toLowerCase()}-${index + 1}`,
    subject: subjectCode,
    type: index % 3 === 0 ? 'MCQ' : index % 3 === 1 ? 'TRUE_FALSE' : 'SHORT',
    topic: `${subjectCode} revision topic ${index + 1}`,
    marks: index % 3 === 0 ? 1 : 2,
    source: 'SKANS revision bank',
    body: p(`Which statement best describes ${subjectCode} revision concept ${index + 1}?`),
    content: index % 3 === 0 ? { options: opts('a', 'The applicable principle', 'An unrelated principle', 'A procedural note', 'None of these'), layout: '2' } : index % 3 === 1 ? { correct: index % 2 === 0 } : {},
    answer: p('Award marks for the correct principle and a concise explanation.'),
    status: (['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'] as const)[index % 4],
    by: author,
    reviewComment: index % 4 === 3 ? 'Add a more specific source reference.' : undefined,
  }));
}

type Tx = Prisma.TransactionClient;

async function wipe(tx: Tx) {
  await tx.paperVersion.deleteMany();
  await tx.paperItem.deleteMany();
  await tx.paper.deleteMany();
  await tx.question.deleteMany();
  await tx.auditLog.deleteMany();
  await tx.userSubject.deleteMany();
  await tx.subject.deleteMany();
  await tx.paperTemplate.deleteMany();
  await tx.user.deleteMany();
  await tx.session.deleteMany();
}

/** Creates rows that are missing; never changes rows that already exist. */
async function ensureReferenceData(tx: Tx, passwordHash: string) {
  const ensureTemplate = (t: typeof CAF_TEMPLATE, config: unknown) =>
    tx.paperTemplate.upsert({ where: { code: t.code }, update: {}, create: { ...t, config: JSON.stringify(config) } });
  const caf = await ensureTemplate(CAF_TEMPLATE, ICAP_TEMPLATE_CONFIG);
  const skans = await ensureTemplate(SKANS_TEMPLATE, SKANS_TEMPLATE_CONFIG);

  const subjectRows = new Map<string, { id: number }>();
  for (const subject of subjects) {
    const row = await tx.subject.upsert({
      where: { code: subject.code },
      update: {},
      create: { code: subject.code, name: subject.name, level: subject.level, templateId: subject.layout === 'ICAP' ? caf.id : skans.id },
    });
    subjectRows.set(subject.code, row);
  }

  const userRows = new Map<string, { id: number }>();
  let createdUsers = 0;
  for (const user of users) {
    const existing = await tx.user.findUnique({ where: { username: user.username } });
    if (existing) {
      userRows.set(user.username, existing);
      continue;
    }
    const row = await tx.user.create({
      data: {
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        passwordHash,
        mustChangePassword: false,
        subjects: { create: user.subjects.flatMap((code) => (subjectRows.has(code) ? [{ subjectId: subjectRows.get(code)!.id }] : [])) },
      },
    });
    userRows.set(user.username, row);
    createdUsers += 1;
  }
  return { caf, skans, subjectRows, userRows, createdUsers };
}

async function seedDemoContent(tx: Tx, ref: Awaited<ReturnType<typeof ensureReferenceData>>) {
  const { caf, skans, subjectRows, userRows } = ref;
  const allQuestions = [
    ...questions,
    ...extraQuestions('CMA', 'teacher_far', 10),
    ...extraQuestions('BL', 'teacher_far', 8),
    ...extraQuestions('AUD', 'teacher_audit', 6),
    ...extraQuestions('MFA', 'admin', 4),
  ];
  const questionRows = new Map<string, { id: number }>();
  for (const [index, question] of allQuestions.entries()) {
    const subjectCode = question.subject ?? (question.source.startsWith('Tax') ? 'TAX' : question.source.toLowerCase().includes('audit') ? 'AUD' : 'FAR');
    const subject = subjectRows.get(subjectCode)!;
    const author = userRows.get(question.by)!;
    const content = question.content ?? {};
    const reviewer = question.by === 'teacher_audit' ? 'hoa_audit' : 'hoa_far';
    const row = await tx.question.create({
      data: {
        subjectId: subject.id,
        topic: question.topic,
        type: question.type,
        // Marks always follow the question structure, exactly as the API computes them.
        marks: computeQuestionMarks(question.type, content, question.marks),
        difficulty: question.difficulty ?? (index % 3 === 0 ? 'EASY' : index % 3 === 1 ? 'MEDIUM' : 'HARD'),
        source: question.source,
        body: question.body,
        content: JSON.stringify(content),
        answer: question.answer ?? '',
        advice: question.advice ?? '',
        comments: question.comments ?? '',
        searchText: buildSearchText(question.topic, question.source, question.body, content, question.answer ?? ''),
        status: question.status,
        reviewComment: question.reviewComment ?? '',
        ...(question.status === 'APPROVED' || question.status === 'REJECTED'
          ? { reviewedById: userRows.get(reviewer)!.id, reviewedAt: new Date() }
          : {}),
        createdById: author.id,
        updatedById: author.id,
      },
    });
    if (question.key) questionRows.set(question.key, row);
  }

  const hoa = userRows.get('hoa_far')!.id;
  const samplePaper = async (data: {
    title: string;
    subject: string;
    templateId: number;
    header: object;
    keys: string[];
    section?: (i: number) => string;
  }) => {
    const paper = await tx.paper.create({
      data: {
        title: data.title,
        subjectId: subjectRows.get(data.subject)!.id,
        templateId: data.templateId,
        status: 'FINAL',
        header: JSON.stringify(data.header),
        createdById: hoa,
        updatedById: hoa,
        items: {
          create: data.keys.map((key, position) => ({
            questionId: questionRows.get(key)!.id,
            section: data.section?.(position) ?? '',
            position,
            marksOverride: null,
            newPage: false,
          })),
        },
      },
    });
    // Final papers print from a frozen snapshot, so each sample paper gets its first version.
    const full = await tx.paper.findUniqueOrThrow({ where: { id: paper.id }, include: paperInclude });
    const snapshot = buildSnapshot(full, parseTemplateConfig(full.template.config));
    await tx.paperVersion.create({
      data: { paperId: paper.id, version: 1, note: 'Sample paper (seed)', snapshot: JSON.stringify(snapshot), createdById: hoa },
    });
    await tx.paper.update({ where: { id: paper.id }, data: { currentVersion: 1 } });
  };

  // Only APPROVED questions may appear in a paper; the totals below equal maxMarks exactly.
  await samplePaper({
    title: 'FAR Spring 2026 Examination',
    subject: 'FAR',
    templateId: caf.id,
    header: { session: 'Spring 2026', examDate: '2026-04-15', durationMinutes: 180, readingMinutes: 15, maxMarks: 30, batchNo: '', teacherName: '', testNo: '', titleOverride: '', instructionsOverride: null },
    keys: ['far-group', 'far-alpha', 'far-fair-value', 'far-coal'],
    section: (i) => (i < 2 ? 'SECTION A' : 'SECTION B'),
  });
  await samplePaper({
    title: 'Tax Batch 1 Internal Test',
    subject: 'TAX',
    templateId: skans.id,
    header: { session: 'Batch 1', examDate: '2026-05-01', durationMinutes: 120, readingMinutes: 10, maxMarks: 25, batchNo: '1', teacherName: 'Tax Faculty', testNo: '1', titleOverride: 'Taxation', instructionsOverride: null },
    keys: ['tax-q1', 'tax-q2', 'tax-q3', 'tax-q4'],
  });
  return allQuestions.length;
}

async function main() {
  if (RESET && process.env.NODE_ENV === 'production' && !FORCE) {
    throw new Error('Refusing to reset a production database. Re-run with --reset --force if you really mean it.');
  }
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  await prisma.$transaction(
    async (tx) => {
      if (RESET) await wipe(tx);
      const ref = await ensureReferenceData(tx, passwordHash);
      console.log(`[seed] ${subjects.length} CAF subjects and 2 templates present; ${ref.createdUsers} demo account(s) created.`);
      if ((await tx.question.count()) === 0) {
        const n = await seedDemoContent(tx, ref);
        console.log(`[seed] Question bank was empty: added ${n} demo questions and 2 sample papers.`);
      } else {
        console.log('[seed] Question bank already has data: demo questions and papers were not added.');
      }
    },
    { timeout: 120_000 },
  );
  if (RESET) console.log(`[seed] Database reset. Demo password for all demo accounts: ${DEMO_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
