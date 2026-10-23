/**
 * Builds the Windows Server setup guide as a PDF:
 *   npm run docs:server-guide   -> output/guide/SKANS-Server-Setup-Guide-Windows.pdf
 */
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { renderServerGuideHtml } from './server-guide-content';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..', '..');
const outDir = path.join(root, 'output', 'guide');

async function main() {
  mkdirSync(outDir, { recursive: true });
  const logo = `data:image/png;base64,${readFileSync(path.join(root, 'client', 'public', 'branding', 'skans-logo.png')).toString('base64')}`;
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(renderServerGuideHtml({ logo }), { waitUntil: 'load' });
    const file = path.join(outDir, 'SKANS-Server-Setup-Guide-Windows.pdf');
    await page.pdf({
      path: file,
      format: 'A4',
      printBackground: true,
      margin: { top: '15mm', bottom: '16mm', left: '14mm', right: '14mm' },
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: '<div style="font-family:Segoe UI,Arial,sans-serif;font-size:8px;color:#64748b;width:100%;padding:0 14mm;display:flex;justify-content:space-between"><span>SKANS Question Bank · Server Setup Guide (Windows)</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>',
    });
    console.log(`Guide written: ${file}`);
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error('[server-guide]', e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
