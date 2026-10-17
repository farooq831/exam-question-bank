import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '../src/db';
import { paperInclude, buildSnapshot, parseTemplateConfig, snapshotToRenderInput } from '../src/lib/papers';
import { htmlToPdf, closeBrowser } from '../src/render/pdf';
import { renderPaperHtml } from '../src/render/paperHtml';

const outputDir = path.resolve(process.cwd(), '..', 'output');

async function generate(title: string, stem: string) {
  const paper = await prisma.paper.findFirst({ where: { title }, include: paperInclude });
  if (!paper) throw new Error(`Seed paper not found: ${title}`);
  const snapshot = buildSnapshot(paper, parseTemplateConfig(paper.template.config));
  for (const mode of ['paper', 'key'] as const) {
    const html = renderPaperHtml(snapshotToRenderInput(snapshot, mode, null));
    const { pdf, pageCount } = await htmlToPdf(html, `${stem}-${mode}`);
    const file = path.join(outputDir, `${stem}-${mode}.pdf`);
    await writeFile(file, pdf);
    console.log(`${file} (${pageCount} page${pageCount === 1 ? '' : 's'})`);
  }
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  await generate('FAR Spring 2026 Examination', 'FAR-Spring-2026');
  await generate('Tax Batch 1 Internal Test', 'TAX-BATCH-1');
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
