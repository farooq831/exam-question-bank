import { chromium, type Browser } from 'playwright';
import { PDFDocument } from 'pdf-lib';
import type { RunningHeader } from './paperHtml';

/**
 * Prints paper HTML to PDF with headless Chromium. One browser is kept warm and shared; each job
 * gets its own isolated context with JavaScript disabled and all network requests blocked (the
 * HTML is fully self-contained: fonts and logos are embedded as data URIs).
 *
 * Header/footer: the running header ("Session ▌ Paper … Page X of Y") is printed with Chromium's
 * header/footer template generated from the paper format, so Chromium's default URL/date header is
 * never printed. When page 1 must not carry it, page 1 is taken from a second render without it
 * (both renders share the same layout, so pagination is identical).
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

export async function htmlToPdf(html: string, title = 'Paper', runningHeader: RunningHeader | null = null): Promise<PdfResult> {
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
      const base = { format: 'A4' as const, printBackground: true, preferCSSPageSize: true };
      const empty = '<span></span>';
      const raw = runningHeader
        ? await page.pdf({
            ...base,
            displayHeaderFooter: true,
            headerTemplate: runningHeader.position === 'top' ? runningHeader.template : empty,
            footerTemplate: runningHeader.position === 'bottom' ? runningHeader.template : empty,
          })
        : await page.pdf({ ...base, displayHeaderFooter: false });
      const doc = await PDFDocument.load(raw);
      if (runningHeader?.skipFirstPage && doc.getPageCount() > 0) {
        const plain = await PDFDocument.load(await page.pdf({ ...base, displayHeaderFooter: false }));
        if (plain.getPageCount() === doc.getPageCount()) {
          const [first] = await doc.copyPages(plain, [0]);
          doc.removePage(0);
          doc.insertPage(0, first);
        }
      }
      // Set clean document metadata (no URLs) and count pages.
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
