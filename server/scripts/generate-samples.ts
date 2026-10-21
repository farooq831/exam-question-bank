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
import { renderPaperHtml, type RenderItem } from '../src/render/paperHtml';

const outputDir = path.resolve(process.cwd(), '..', 'output');
const opt = (texts: string[], correct: number) => texts.map((t, i) => ({ key: String.fromCharCode(97 + i), html: `<p>${t}</p>`, correct: i === correct }));
const table = `<table><tbody><tr><th><p>Particulars</p></th><th><p>Rs.</p></th></tr><tr><td><p>Revenue</p></td><td><p style="text-align: right">8,500,000</p></td></tr><tr><td><p>Cost of sales</p></td><td><p style="text-align: right">(5,100,000)</p></td></tr><tr><td><p>Gross profit</p></td><td><p style="text-align: right">3,400,000</p></td></tr></tbody></table>`;

/** Example content only — it is never saved to the database. */
const items: RenderItem[] = [
  {
    section: 'SECTION A', newPage: false, marks: 2,
    question: { id: 1, type: 'MCQ_GROUP', marks: 2, body: '', answer: '', advice: '', content: { items: [
      { id: 'a', stem: '<p>Which qualitative characteristic makes financial information useful?</p>', options: opt(['Relevance', 'Secrecy', 'Complexity', 'Delay'], 0), layout: 'auto', marks: 1 },
      { id: 'b', stem: '<p>Which measurement basis uses current entry price?</p>', options: opt(['Historical cost', 'Current cost', 'Fair value', 'Value in use'], 1), layout: 'auto', marks: 1 },
    ] } },
  },
  {
    section: 'SECTION B', newPage: false, marks: 10,
    question: { id: 2, type: 'LONG', marks: 10, body: `<p>The following information relates to Alpha Limited for the year ended 30 June 2026:</p>${table}`, answer: '<p>Model answer appears in the answer key only.</p>', advice: '<p>Award marks for clear workings.</p>', content: { partLabelStyle: null, parts: [
      { id: 'a', html: '<p>Prepare the statement of profit or loss extract.</p>', marks: 6, answer: '<p>Gross profit Rs. 3,400,000.</p>', parts: [] },
      { id: 'b', html: '<p>Explain two adjustments that may be required.</p>', marks: 4, answer: '', parts: [
        { id: 'b1', html: '<p>Accruals.</p>', marks: 2, answer: '<p>Expenses incurred but not paid.</p>' },
        { id: 'b2', html: '<p>Depreciation.</p>', marks: 2, answer: '<p>Systematic allocation of cost.</p>' },
      ] },
    ] } },
  },
  {
    section: 'SECTION B', newPage: false, marks: 3,
    question: { id: 3, type: 'SHORT', marks: 3, body: '<p>State the five steps for recognising revenue from contracts with customers.</p>', answer: '<p>Identify the contract, obligations, price, allocate, recognise.</p>', advice: '', content: {} },
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
  const header = paperHeaderSchema.parse({ session: 'Autumn 2026', examDate: '2026-11-02', durationMinutes: 60, readingMinutes: 10, maxMarks: 15, batchNo: '1', teacherName: 'Teacher Name', testNo: '1' });
  for (const { code, config } of await formats()) {
    for (const mode of ['paper', 'key'] as const) {
      const html = renderPaperHtml({ mode, config, subject: { code: 'FAR', name: 'Financial Accounting and Reporting' }, header, title: 'Financial Accounting and Reporting', items, watermark: null });
      const { pdf, pageCount } = await htmlToPdf(html, `${code}-${mode}`);
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
