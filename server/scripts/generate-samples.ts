/**
 * Renders a built-in example paper through every active paper format, so formatting can be checked
 * without any questions in the database:
 *   npm run pdf:samples   -> output/<FORMAT_CODE>-paper.pdf and -answer-key.pdf
 * Uses the formats saved in the database (falls back to the defaults if none exist yet).
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CAF_TEMPLATE_CONFIG, SKANS_TEMPLATE_CONFIG, paperHeaderSchema, type TemplateConfig } from '@skans/shared';
import { prisma } from '../src/db';
import { parseTemplateConfig } from '../src/lib/papers';
import { closeBrowser, htmlToPdf } from '../src/render/pdf';
import { renderPaper, type RenderItem } from '../src/render/paperHtml';

const outputDir = path.resolve(process.cwd(), '..', 'output');
const opt = (texts: string[], correct: number) => texts.map((t, i) => ({ key: String.fromCharCode(97 + i), html: `<p>${t}</p>`, correct: i === correct }));
const table = `<table><tbody><tr><th><p style="text-align: left">Item category</p></th><th><p>Quantity per records</p></th><th><p>Physical quantity</p></th></tr><tr><td><p>Component A - units</p></td><td><p style="text-align: center">120</p></td><td><p style="text-align: center">114</p></td></tr><tr><td><p>Fasteners - units</p></td><td><p style="text-align: center">48,000</p></td><td><p style="text-align: center">50,500</p></td></tr></tbody></table>`;
const longOpt = 'A long option that wraps onto a second line so the hanging indent of the option text can be checked against the reference paper';

/** Example content only (invented text, structured like the reference paper). It is never saved. */
const items: RenderItem[] = [
  {
    section: 'SECTION A', newPage: false, marks: 3,
    question: { id: 1, type: 'MCQ_GROUP', marks: 3, body: '', answer: '', advice: '', content: { items: [
      { id: 'a', stem: '<p>When an engagement team evaluates whether the criteria used in an assurance engagement are suitable, which of the following best describes the approach that should be followed?</p>', options: opt([longOpt, 'Criteria issued by a recognised body through a transparent process are presumed suitable', 'Criteria used by other entities in the same industry are always suitable', 'Criteria accepted by the intended users are presumed suitable'], 1), layout: '1', marks: 1 },
      { id: 'b', stem: '<p>Which of the following procedures provides the most relevant evidence about the valuation of capitalised development costs?</p>', options: opt(['Inspecting project logs and technical documentation', 'Reviewing feasibility studies and resource plans', 'Examining licensing agreements', 'Tracing a sample of ledger entries to supporting documents'], 1), layout: '1', marks: 1 },
      { id: 'c', stem: '<p>You are planning the audit of Example Traders Limited. During planning you note the following:</p><ul><li><p>A bank covenant requires a minimum net profit margin of 5%.</p></li><li><p>The company migrated to a new ERP system during the year.</p></li></ul><p>What is the most appropriate conclusion regarding materiality?</p>', options: opt(['Set performance materiality close to overall materiality', 'Revise overall materiality upward', 'Set performance materiality significantly lower', 'Apply a separate lower materiality'], 2), layout: '1', marks: 1 },
    ] } },
  },
  {
    section: 'SECTION A', newPage: false, marks: 9,
    question: { id: 2, type: 'SHORT', marks: 9, body: '<p>Your firm is the external auditor of Example Apparel Limited (EAL) for the year ended 31 December 2025. During planning, the following matters were noted:</p><ol><li><p>The lender has imposed a covenant requiring a minimum net profit margin of 8%.</p></li><li><p>The finance director retains sole access to the year-end adjustments module of the accounting system.</p></li></ol><p><strong>Required:</strong><br>Identify and explain the fraud risk factors present in the above scenario.</p>', answer: '<p>Model answer appears in the answer key only.</p>', advice: '<p>Award one mark per well-explained factor.</p>', content: {} },
  },
  {
    section: 'SECTION B', newPage: false, marks: 9,
    question: { id: 3, type: 'LONG', marks: 9, body: `<p>Example Manufacturing Limited holds high-value components and a large volume of low-value items. The following differences were identified during the inventory count:</p>${table}`, answer: '', advice: '', content: { partLabelStyle: null, parts: [
      { id: 'a', html: '<p>Discuss the weaknesses in the inventory count procedures and explain how they could affect the reliability of the count results.</p>', marks: 5, answer: '<p>Answer for part (a).</p>', parts: [] },
      { id: 'b', html: '<p><strong>Required:</strong></p>', marks: 4, answer: '', parts: [
        { id: 'b1', html: '<p>Describe any <strong>two</strong> audit procedures to investigate the differences.</p>', marks: 2, answer: '<p>Answer (b)(i).</p>' },
        { id: 'b2', html: '<p>Discuss whether the pricing error should be projected.</p>', marks: 2, answer: '<p>Answer (b)(ii).</p>' },
      ] },
    ] } },
  },
];

async function formats(): Promise<{ code: string; config: TemplateConfig }[]> {
  const rows = await prisma.paperTemplate.findMany({ where: { isActive: true } }).catch(() => []);
  if (rows.length) return rows.map((r) => ({ code: r.code, config: parseTemplateConfig(r.config) }));
  return [
    { code: 'SKANS_CAF', config: CAF_TEMPLATE_CONFIG },
    { code: 'SKANS_INTERNAL', config: SKANS_TEMPLATE_CONFIG },
  ];
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  const header = paperHeaderSchema.parse({ session: 'Spring 2026', examDate: '2026-03-03', durationMinutes: 180, readingMinutes: 15, maxMarks: 100, batchNo: '1', teacherName: 'Teacher Name', testNo: '1', researchOfficers: 'Research Officer Name', adminName: 'Admin Name' });
  for (const { code, config } of await formats()) {
    for (const mode of ['paper', 'key'] as const) {
      const { html, runningHeader } = renderPaper({ mode, config, subject: { code: 'AAE', name: 'Audit and Assurance Essentials' }, header, title: 'Audit and Assurance Essentials', items, watermark: null });
      const { pdf, pageCount } = await htmlToPdf(html, `${code}-${mode}`, runningHeader);
      const file = path.join(outputDir, `${code}-${mode === 'paper' ? 'paper' : 'answer-key'}.pdf`);
      await writeFile(file, pdf);
      console.log(`${file} (${pageCount} page${pageCount === 1 ? '' : 's'})`);
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeBrowser();
    await prisma.$disconnect();
  });
