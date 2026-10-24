/**
 * Tools for recording tutorial videos of the real app with Playwright:
 * an on-screen subtitle bar, chapter title cards, a visible mouse pointer with click ripples,
 * smooth pointer movement, visible typing, and timing records that become the .srt subtitles,
 * the chapter list and the MP4 chapter markers (FFmpeg).
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import type { Locator, Page } from 'playwright';

/** Injected into every page of the recorded browser (survives page reloads via sessionStorage). */
export const overlayScript = (logo: string) => `
(() => {
  const LOGO = ${JSON.stringify(logo)};
  const css = \`
    #vk-cap{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);max-width:1120px;width:max-content;min-width:300px;
      background:rgba(15,23,42,.92);color:#fff;font:600 21px/1.35 'Segoe UI',Arial,sans-serif;padding:12px 22px;border-radius:14px;
      box-shadow:0 8px 30px rgba(0,0,0,.35);z-index:2147483646;pointer-events:none;text-align:center;border-bottom:4px solid #c08a2e}
    #vk-cap:empty{display:none}
    #vk-chap{position:fixed;top:10px;right:14px;background:rgba(27,42,75,.92);color:#fff;font:600 13px 'Segoe UI',Arial;
      padding:6px 12px;border-radius:999px;z-index:2147483646;pointer-events:none;border:1px solid #c08a2e}
    #vk-chap:empty{display:none}
    #vk-card{position:fixed;inset:0;background:linear-gradient(135deg,#1b2a4b,#22355f);display:none;flex-direction:column;
      align-items:center;justify-content:center;z-index:2147483647;color:#fff;font-family:'Segoe UI',Arial,sans-serif;text-align:center}
    #vk-card img{width:300px;background:#fff;border-radius:16px;padding:14px 18px;margin-bottom:34px}
    #vk-card .k{color:#c08a2e;font:700 20px 'Segoe UI';letter-spacing:.12em;text-transform:uppercase;margin-bottom:12px}
    #vk-card .t{font:700 46px/1.15 'Segoe UI';max-width:1000px}
    #vk-card .s{font:400 22px/1.4 'Segoe UI';color:#cbd5e1;margin-top:16px;max-width:900px}
    #vk-cur{position:fixed;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;background:rgba(192,138,46,.35);
      border:3px solid #c08a2e;z-index:2147483645;pointer-events:none;transition:transform .12s;left:-50px;top:-50px}
    .vk-rip{position:fixed;width:16px;height:16px;margin:-8px 0 0 -8px;border-radius:50%;border:3px solid #c08a2e;
      z-index:2147483645;pointer-events:none;animation:vkrip .6s ease-out forwards}
    @keyframes vkrip{to{transform:scale(3.4);opacity:0}}\`;
  const get = (k) => { try { return sessionStorage.getItem(k) || ''; } catch { return ''; } };
  const put = (k, v) => { try { sessionStorage.setItem(k, v); } catch {} };
  // A closed shadow root keeps the overlay text out of reach of the page's locators.
  let root = null;
  const $ = (id) => (root ? root.getElementById(id) : null);
  function mount() {
    if (root) return;
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483645';
    root = host.attachShadow({ mode: 'closed' });
    const st = document.createElement('style'); st.textContent = css; root.appendChild(st);
    for (const id of ['vk-cap', 'vk-chap', 'vk-cur']) { const d = document.createElement('div'); d.id = id; root.appendChild(d); }
    const card = document.createElement('div'); card.id = 'vk-card'; root.appendChild(card);
    document.documentElement.appendChild(host);
    // Recording only: notifications at the top centre, never covering buttons or the chapter badge.
    const ts = document.createElement('style');
    ts.textContent = '[data-sonner-toaster]{left:50%!important;right:auto!important;transform:translateX(-50%)!important}[data-sonner-toast]{pointer-events:none!important}';
    document.head.appendChild(ts);
    $('vk-cap').textContent = get('vk-cap');
    $('vk-chap').textContent = get('vk-chap');
    const cur = $('vk-cur');
    const pos = get('vk-pos').split(',');
    if (pos.length === 2) { cur.style.left = pos[0] + 'px'; cur.style.top = pos[1] + 'px'; }
    addEventListener('mousemove', (e) => { cur.style.left = e.clientX + 'px'; cur.style.top = e.clientY + 'px'; put('vk-pos', e.clientX + ',' + e.clientY); }, true);
    addEventListener('mousedown', (e) => {
      cur.style.transform = 'scale(.7)'; setTimeout(() => (cur.style.transform = ''), 160);
      const r = document.createElement('div'); r.className = 'vk-rip'; r.style.left = e.clientX + 'px'; r.style.top = e.clientY + 'px';
      root.appendChild(r); setTimeout(() => r.remove(), 700);
    }, true);
  }
  window.__vkSay = (t) => { put('vk-cap', t); const el = $('vk-cap'); if (el) el.textContent = t; };
  window.__vkChapter = (t) => { put('vk-chap', t); const el = $('vk-chap'); if (el) el.textContent = t; };
  window.__vkCard = (kicker, title, sub) => {
    const c = $('vk-card'); if (!c) return;
    if (!title) { c.style.display = 'none'; return; }
    c.innerHTML = (LOGO ? '<img src="' + LOGO + '">' : '') + '<div class="k"></div><div class="t"></div><div class="s"></div>';
    c.querySelector('.k').textContent = kicker; c.querySelector('.t').textContent = title; c.querySelector('.s').textContent = sub || '';
    c.style.display = 'flex';
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();`;

/** VIDEO_FAST=1: no reading pauses or slow typing (for checking the script quickly). */
const FAST = process.env.VIDEO_FAST === '1';
const pause = (ms: number) => (FAST ? Math.min(ms, 60) : ms);

interface Cue { start: number; end?: number; text: string }

export class Lesson {
  private t0 = 0;
  readonly cues: Cue[] = [];
  readonly chapters: { start: number; title: string }[] = [];
  private chapterNo = 0;
  constructor(readonly page: Page, readonly name: string) {}

  start() { this.t0 = Date.now(); }
  private now() { return Date.now() - this.t0; }
  private endCue() { const last = this.cues.at(-1); if (last && last.end === undefined) last.end = this.now(); }

  /** Shows an instructor subtitle and waits long enough to read it. */
  async say(text: string, minMs = 0) {
    this.endCue();
    this.cues.push({ start: this.now(), text });
    await this.page.evaluate((t) => (window as unknown as { __vkSay(t: string): void }).__vkSay(t), text);
    const words = text.split(/\s+/).length;
    await this.page.waitForTimeout(pause(Math.max(minMs, 1600 + words * 290)));
  }

  /** Title card for a new chapter, then the chapter name stays in the top corner. */
  async chapter(title: string, sub = '') {
    this.endCue();
    this.chapterNo += 1;
    const label = `Chapter ${this.chapterNo}`;
    this.chapters.push({ start: this.now(), title });
    await this.page.evaluate(() => (window as unknown as { __vkSay(t: string): void }).__vkSay(''));
    await this.page.evaluate(([k, t, s]) => (window as unknown as { __vkCard(k: string, t: string, s: string): void }).__vkCard(k, t, s), [label, title, sub]);
    this.cues.push({ start: this.now(), text: `${label}: ${title}` });
    await this.page.waitForTimeout(pause(3600));
    await this.page.evaluate(() => (window as unknown as { __vkCard(k: string, t: string, s: string): void }).__vkCard('', '', ''));
    await this.page.evaluate((c) => (window as unknown as { __vkChapter(t: string): void }).__vkChapter(c), `${label} · ${title}`);
  }

  /** Full-screen card without a chapter (intro and ending). */
  async card(kicker: string, title: string, sub: string, ms = 5000) {
    this.endCue();
    this.cues.push({ start: this.now(), text: `${title}${sub ? ' - ' + sub : ''}` });
    await this.page.evaluate(([k, t, s]) => (window as unknown as { __vkCard(k: string, t: string, s: string): void }).__vkCard(k, t, s), [kicker, title, sub]);
    await this.page.waitForTimeout(pause(ms));
    await this.page.evaluate(() => (window as unknown as { __vkCard(k: string, t: string, s: string): void }).__vkCard('', '', ''));
  }

  /** Moves the visible pointer smoothly to an element (and leaves it there). */
  async point(el: Locator, pause = 350) {
    const target = el.first();
    // Open any folded section (<details>) around the target first.
    await target.evaluate((e) => { for (let d = e.closest('details'); d; d = d.parentElement?.closest('details') ?? null) (d as HTMLDetailsElement).open = true; }).catch(() => {});
    await target.scrollIntoViewIfNeeded();
    const box = await target.boundingBox();
    if (box) await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: FAST ? 2 : 18 });
    await this.page.waitForTimeout(FAST ? 30 : pause);
  }

  async click(el: Locator, pause = 600) {
    const target = el.first();
    await this.point(target, 250);
    await target.click();
    await this.page.waitForTimeout(FAST ? 30 : pause);
  }

  /** Clicks into a field and types visibly. */
  async type(target: Locator, text: string, delay = 28) {
    await this.click(target, 200);
    await this.page.keyboard.type(text, { delay: FAST ? 0 : delay });
    await this.page.waitForTimeout(300);
  }

  async fill(el: Locator, text: string) {
    const target = el.first();
    await this.click(target, 150);
    await target.fill('');
    await this.page.keyboard.type(text, { delay: 30 });
    await this.page.waitForTimeout(250);
  }

  async wait(ms: number) { await this.page.waitForTimeout(pause(ms)); }

  finish() { this.endCue(); }

  /** Writes the .srt subtitles and the chapter list; returns the FFmpeg chapter metadata text. */
  writeFiles(srtFile: string, chaptersFile: string, durationMs: number): string {
    const ts = (ms: number) => {
      const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000), x = ms % 1000;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(x).padStart(3, '0')}`;
    };
    const cues = this.cues.filter((c) => c.text);
    writeFileSync(srtFile, cues.map((c, i) => `${i + 1}\n${ts(c.start)} --> ${ts(Math.max(c.start + 800, (c.end ?? c.start + 3000) - 50))}\n${c.text}\n`).join('\n'), 'utf8');
    const mmss = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`;
    writeFileSync(chaptersFile, `${this.name}\n\n0:00 Introduction\n` + this.chapters.map((c, i) => `${mmss(c.start)} Chapter ${i + 1}: ${c.title}`).join('\n') + '\n', 'utf8');
    const marks = [{ start: 0, title: 'Introduction' }, ...this.chapters.map((c, i) => ({ start: c.start, title: `Chapter ${i + 1}: ${c.title}` }))];
    return ';FFMETADATA1\ntitle=' + this.name + '\n' + marks.map((c, i) => `[CHAPTER]\nTIMEBASE=1/1000\nSTART=${c.start}\nEND=${i + 1 < marks.length ? marks[i + 1].start : durationMs}\ntitle=${c.title}`).join('\n') + '\n';
  }
}

/** WebM from Playwright -> MP4 (H.264) with chapter markers and a selectable subtitle track. */
export function toMp4(ffmpeg: string, webm: string, metaFile: string, srtFile: string, mp4: string) {
  execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-i', webm, '-f', 'ffmetadata', '-i', metaFile, '-i', srtFile,
    '-map', '0:v', '-map', '2:s', '-map_metadata', '1', '-map_chapters', '1',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '23', '-pix_fmt', 'yuv420p', '-r', '25',
    '-c:s', 'mov_text', '-metadata:s:s:0', 'language=eng', '-movflags', '+faststart', mp4], { stdio: 'inherit' });
}

export function durationMs(ffprobe: string, file: string): number {
  const out = execFileSync(ffprobe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file], { encoding: 'utf8' });
  return Math.round(parseFloat(out) * 1000);
}
