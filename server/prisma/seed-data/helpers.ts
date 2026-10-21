/** Small HTML builders so seed questions read like the printed papers. */

export const p = (...lines: string[]) => lines.map((l) => `<p>${l}</p>`).join('');
export const pr = (s: string) => `<p style="text-align: right">${s}</p>`;
export const pc = (s: string) => `<p style="text-align: center">${s}</p>`;
export const ol = (...items: string[]) => `<ol>${items.map((i) => `<li>${i.startsWith('<') ? i : `<p>${i}</p>`}</li>`).join('')}</ol>`;
export const ul = (...items: string[]) => `<ul>${items.map((i) => `<li><p>${i}</p></li>`).join('')}</ul>`;
export const required = (text: string) => `<p><strong>Required:</strong><br>${text}</p>`;

/** Table where the first `headerRows` rows are header cells. Cells starting with ">" are right-aligned, "^" centred. */
export function table(rows: (string | { t: string; colspan?: number; rowspan?: number })[][], headerRows = 1, opts: { borderless?: boolean } = {}) {
  const cell = (c: string | { t: string; colspan?: number; rowspan?: number }, th: boolean) => {
    const o = typeof c === 'string' ? { t: c } : c;
    let text = o.t;
    let content: string;
    if (text.startsWith('>')) content = pr(text.slice(1));
    else if (text.startsWith('^')) content = pc(text.slice(1));
    else content = `<p>${text}</p>`;
    if (text === '') content = '<p></p>';
    const attrs = `${o.colspan ? ` colspan="${o.colspan}"` : ''}${o.rowspan ? ` rowspan="${o.rowspan}"` : ''}`;
    const tag = th ? 'th' : 'td';
    text = '';
    return `<${tag}${attrs}>${content}</${tag}>`;
  };
  const body = rows.map((r, i) => `<tr>${r.map((c) => cell(c, i < headerRows)).join('')}</tr>`).join('');
  return `<table${opts.borderless ? ' class="borderless"' : ''}><tbody>${body}</tbody></table>`;
}

export function opts(correct: string, ...texts: string[]) {
  return texts.map((t, i) => ({ key: String.fromCharCode(97 + i), html: `<p>${t}</p>`, correct: String.fromCharCode(97 + i) === correct }));
}

export type SeedStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';

export interface SeedQuestion {
  key?: string; // reference used by the seeded papers
  subject?: string; // subject code; inferred from the source for the hand-written questions
  type: 'MCQ' | 'MCQ_GROUP' | 'TRUE_FALSE' | 'SHORT' | 'LONG' | 'CASE_STUDY';
  topic: string;
  marks: number;
  difficulty?: 'EASY' | 'MEDIUM' | 'HARD';
  source: string;
  body: string;
  content?: Record<string, unknown>;
  answer?: string;
  advice?: string;
  comments?: string;
  status: SeedStatus;
  by: string; // username
  reviewComment?: string;
}
