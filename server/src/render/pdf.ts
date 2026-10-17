import { chromium, type Browser } from 'playwright';
import { PDFDocument } from 'pdf-lib';

/**
 * Prints paper HTML to PDF with headless Chromium. One browser is kept warm and shared; each job
 * gets its own isolated context with JavaScript disabled and all network requests blocked (the
 * HTML is fully self-contained: fonts and logos are embedded as data URIs).
 *
 * Header/footer: page numbers ("Page X of Y") and running headers come from CSS @page margin
 * boxes generated from the template, so Chromium's default URL/date header is never printed.
 */

let browserPromise: Promise<Browser> | null = null;
const MAX_CONCURRENT = 2;
let active = 0;
const queue: (() => void)[] = [];

async function getBrowser(): Promise<Browser> {
  if (browserPromise) {
    const b = await browserPromise.catch(() => null);
    if (b && b.isConnected()) return b;
  }
  browserPromise = chromium.launch({ headless: true, args: ['--disable-gpu', '--no-first-run'] });
  const b = await browserPromise;
  b.on('disconnected', () => {
    browserPromise = null;
  });
  return b;
}

async function acquire() {
  if (active < MAX_CONCURRENT) {
    active += 1;
    return;
  }
  await new Promise<void>((resolve) => queue.push(resolve));
  active += 1;
}

function release() {
  active -= 1;
  queue.shift()?.();
}

export interface PdfResult {
  pdf: Buffer;
  pageCount: number;
}

export async function htmlToPdf(html: string, title = 'Paper'): Promise<PdfResult> {
  await acquire();
  try {
    const browser = await getBrowser();
    const context = await browser.newContext({ javaScriptEnabled: false });
    try {
      await context.route('**/*', (route) => {
        const url = route.request().url();
        if (url.startsWith('data:') || url === 'about:blank') return route.continue();
        return route.abort();
      });
      const page = await context.newPage();
      await page.setContent(html, { waitUntil: 'load', timeout: 30_000 });
      await page.evaluate(() => document.fonts?.ready).catch(() => undefined);
      const raw = await page.pdf({
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
        displayHeaderFooter: false,
      });
      // Set clean document metadata (no URLs) and count pages.
      const doc = await PDFDocument.load(raw);
      doc.setTitle(title);
      doc.setProducer('SKANS Question Bank');
      doc.setCreator('SKANS Question Bank');
      const pdf = Buffer.from(await doc.save());
      return { pdf, pageCount: doc.getPageCount() };
    } finally {
      await context.close().catch(() => undefined);
    }
  } finally {
    release();
  }
}

export async function closeBrowser() {
  if (browserPromise) {
    const b = await browserPromise.catch(() => null);
    browserPromise = null;
    await b?.close().catch(() => undefined);
  }
}
