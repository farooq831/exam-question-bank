import type { DateFormat, LabelStyle } from './constants';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function toRoman(n: number): string {
  const map: [number, string][] = [
    [1000, 'm'],
    [900, 'cm'],
    [500, 'd'],
    [400, 'cd'],
    [100, 'c'],
    [90, 'xc'],
    [50, 'l'],
    [40, 'xl'],
    [10, 'x'],
    [9, 'ix'],
    [5, 'v'],
    [4, 'iv'],
    [1, 'i'],
  ];
  let out = '';
  let rest = Math.max(0, Math.floor(n));
  for (const [v, s] of map) {
    while (rest >= v) {
      out += s;
      rest -= v;
    }
  }
  return out;
}

export function toAlpha(n: number): string {
  let s = '';
  let x = n;
  while (x > 0) {
    const r = (x - 1) % 26;
    s = String.fromCharCode(97 + r) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
}

/** 1-based label for a part, e.g. style roman, 2 -> "(ii)". */
export function partLabel(index1: number, style: LabelStyle): string {
  const core = style === 'roman' ? toRoman(index1) : style === 'alpha' ? toAlpha(index1) : String(index1);
  return `(${core})`;
}

export function pad2(n: number): string {
  const s = Number.isInteger(n) ? String(n) : String(n);
  return Number.isInteger(n) && n < 10 && n >= 0 ? `0${s}` : s;
}

/** Applies a marks pattern such as "({nn} marks)". */
export function formatMarks(marks: number, pattern: string, singularPattern?: string): string {
  const p = marks === 1 && singularPattern ? singularPattern : pattern;
  return p.replaceAll('{nn}', pad2(marks)).replaceAll('{n}', String(marks));
}

/** Formats an ISO date (YYYY-MM-DD) without timezone surprises. */
export function formatDate(iso: string, fmt: DateFormat): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return '';
  const [, y, mo, d] = m;
  const month = Number(mo);
  const day = Number(d);
  switch (fmt) {
    case 'D MMMM YYYY':
      return `${day} ${MONTHS[month - 1]} ${y}`;
    case 'MM/DD/YYYY':
      return `${mo}/${d}/${y}`;
    case 'DD/MM/YYYY':
      return `${d}/${mo}/${y}`;
    case 'DD-MMM-YYYY':
      return `${d}-${MONTHS[month - 1].slice(0, 3)}-${y}`;
  }
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/** CAF examination style: "3 hours and 15 minutes (including 15 minutes' reading time)". */
export function formatDurationCaf(durationMinutes: number, readingMinutes: number): string {
  const total = durationMinutes + readingMinutes;
  const h = Math.floor(total / 60);
  const m = total % 60;
  const parts: string[] = [];
  if (h) parts.push(plural(h, 'hour'));
  if (m) parts.push(plural(m, 'minute'));
  const main = parts.join(' and ') || '0 minutes';
  return readingMinutes > 0 ? `${main} (including ${plural(readingMinutes, 'minute')}' reading time)` : main;
}

/** SKANS internal style: "1 Hour(s)" / "1 Hour(s) 30 min". */
export function formatDurationSkans(durationMinutes: number): string {
  const h = Math.floor(durationMinutes / 60);
  const m = durationMinutes % 60;
  if (h && m) return `${h} Hour(s) ${m} min`;
  if (h) return `${h} Hour(s)`;
  return `${m} min`;
}

const WORDS = [
  'ZERO',
  'ONE',
  'TWO',
  'THREE',
  'FOUR',
  'FIVE',
  'SIX',
  'SEVEN',
  'EIGHT',
  'NINE',
  'TEN',
  'ELEVEN',
  'TWELVE',
  'THIRTEEN',
  'FOURTEEN',
  'FIFTEEN',
  'SIXTEEN',
  'SEVENTEEN',
  'EIGHTEEN',
  'NINETEEN',
  'TWENTY',
];
export function numberWord(n: number): string {
  return WORDS[n] ?? String(n);
}

/** Replaces {token} placeholders; unknown tokens are left as-is. */
export function fillTokens(text: string, tokens: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (all, key: string) => (key in tokens ? String(tokens[key]) : all));
}

/** Makes a value safe for use in a download file name. */
export function safeFileName(name: string): string {
  return (
    name
      .replace(/\s+/g, '')
      .replace(/[^A-Za-z0-9_.-]/g, '')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 120) || 'paper'
  );
}
