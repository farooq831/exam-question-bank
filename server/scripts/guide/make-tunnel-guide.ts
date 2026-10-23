/**
 * Builds the "Share your local web app with a public link" guide (Cloudflare Tunnel) as a PDF:
 *
 *   npm run docs:tunnel-guide   -> output/guide/Public-Link-Guide-Cloudflare-Tunnel.pdf
 *
 * Uses docs/img/beta-login.png (the SKANS beta opened through the tunnel) when present.
 */
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { renderTunnelGuideHtml } from './tunnel-guide-content';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..', '..');
const outDir = path.join(root, 'output', 'guide');
const dataUri = (file: string) => `data:image/png;base64,${readFileSync(file).toString('base64')}`;

async function main() {
  mkdirSync(outDir, { recursive: true });
  const betaLogin = path.join(root, 'docs', 'img', 'beta-login.png');
  const html = renderTunnelGuideHtml({
    logo: dataUri(path.join(root, 'client', 'public', 'branding', 'skans-logo.png')),
    betaLogin: existsSync(betaLogin) ? dataUri(betaLogin) : undefined,
  });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    const file = path.join(outDir, 'Public-Link-Guide-Cloudflare-Tunnel.pdf');
    await page.pdf({
      path: file,
      format: 'A4',
      printBackground: true,
      margin: { top: '15mm', bottom: '16mm', left: '15mm', right: '15mm' },
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: '<div style="font-family:Segoe UI,Arial,sans-serif;font-size:8px;color:#64748b;width:100%;padding:0 15mm;display:flex;justify-content:space-between"><span>Share your local web app with a public link · Cloudflare Tunnel guide</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>',
    });
    console.log(`Guide written: ${file}`);
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error('[tunnel-guide]', e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
