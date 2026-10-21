import { parse as parseHtml, type HTMLElement } from 'node-html-parser';
import {
  fillTokens,
  formatDate,
  formatDurationCaf,
  formatDurationSkans,
  formatMarks,
  numberWord,
  partLabel,
  partMarks,
  type LabelStyle,
  type McqGroupContent,
  type McqOption,
  type PaperHeader,
  type PartsContent,
  type QuestionType,
  type TemplateConfig,
} from '@skans/shared';
import { escapeHtml, htmlToText, sanitizeRich } from '../lib/sanitize';
import { fontFacesFor, fontStack, logoDataUri } from './assets';

/**
 * Renders a paper (or its answer key) to a single self-contained HTML document.
 * The SAME document is printed by Chromium for the PDF and for the live preview, so what the
 * the administrator sees in the builder is exactly what gets downloaded.
 */

export interface RenderQuestion {
  id: number;
  type: QuestionType;
  marks: number;
  body: string;
  content: Record<string, unknown>;
  answer: string;
  advice: string;
}

export interface RenderItem {
  question: RenderQuestion;
  section: string;
  marks: number; // effective marks for this paper
  newPage: boolean;
}

export interface RenderInput {
  mode: 'paper' | 'key';
  config: TemplateConfig;
  subject: { code: string; name: string };
  header: PaperHeader;
  items: RenderItem[];
  title?: string;
  watermark?: string | null;
}

type Block =
  | { kind: 'single'; item: RenderItem }
  | { kind: 'mcqset'; items: RenderItem[] }
  | { kind: 'tfset'; items: RenderItem[] };

// ---------------------------------------------------------------- helpers

/** Inline **bold** in configuration text (instructions, intros); everything else escaped. */
function inlineMd(text: string): string {
  return escapeHtml(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

/** CSS `content:` value for a margin box, turning {page}/{pages} into counters. */
function cssContent(text: string): string {
  if (!text.trim()) return 'none';
  const parts = text.split(/(\{page\}|\{pages\})/g).filter((p) => p !== '');
  return parts
    .map((p) => {
      if (p === '{page}') return 'counter(page)';
      if (p === '{pages}') return 'counter(pages)';
      return `"${p.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ')}"`;
    })
    .join(' ');
}

/**
 * Normalises stored rich text for print:
 *  - sanitises again (defence in depth)
 *  - moves leading all-<th> rows into <thead> so header rows repeat on every page
 *  - wraps tables so short tables never split across pages
 */
function richHtml(html: string): string {
  const clean = sanitizeRich(html);
  if (!clean.includes('<table')) return clean;
  const root = parseHtml(clean);
  for (const table of root.querySelectorAll('table')) {
    if (!table.querySelector('thead')) {
      const tbody = table.querySelector('tbody') ?? table;
      const rows = tbody.childNodes.filter((n): n is HTMLElement => (n as HTMLElement).tagName === 'TR');
      const headerRows: HTMLElement[] = [];
      for (const r of rows) {
        const cells = r.childNodes.filter((n): n is HTMLElement => ['TD', 'TH'].includes((n as HTMLElement).tagName));
        if (cells.length && cells.every((c) => c.tagName === 'TH')) headerRows.push(r);
        else break;
      }
      if (headerRows.length && headerRows.length < rows.length) {
        const thead = `<thead>${headerRows.map((r) => r.toString()).join('')}</thead>`;
        headerRows.forEach((r) => r.remove());
        const colgroup = table.querySelector('colgroup');
        const colHtml = colgroup?.toString() ?? '';
        colgroup?.remove();
        table.set_content(colHtml + thead + table.innerHTML);
      }
    }
    const wrapper = parseHtml('<div class="tbl"></div>').querySelector('div')!;
    table.replaceWith(wrapper);
    wrapper.appendChild(table);
  }
  return root.toString();
}

/** Removes a single wrapping <p> so short option text can sit inline. */
function unwrapP(html: string): string {
  const m = /^<p(?: style="[^"]*")?>([\s\S]*)<\/p>$/.exec(html.trim());
  if (m && !m[1].includes('<p')) return m[1];
  return html;
}

/**
 * Appends the marks to the last paragraph of a block of rich text (so "(08 marks)" sits on the
 * last line, right-aligned as on the reference examination paper), or adds a separate line when the text ends in a
 * table or is empty.
 */
function withMarks(html: string, marksHtml: string): string {
  if (!marksHtml) return html;
  const trimmed = html.trim();
  const m = /<\/p>((?:\s*<\/(?:li|ol|ul)>)*)\s*$/.exec(trimmed);
  if (m && !/<\/table>\s*(<\/div>)?\s*$/.test(trimmed)) {
    const at = trimmed.length - m[0].length;
    return `${trimmed.slice(0, at)}${marksHtml}${trimmed.slice(at)}`;
  }
  return `${trimmed}<p class="marks-line">${marksHtml}</p>`;
}

function optionColumns(options: McqOption[], layout: string): number {
  if (layout === '1' || layout === '2' || layout === '4') return Number(layout);
  const lens = options.map((o) => htmlToText(o.html).length);
  if (options.some((o) => /<(table|ul|ol)/.test(o.html))) return 1;
  const max = Math.max(0, ...lens);
  if (max <= 20 && options.length === 4) return 4;
  if (max <= 42) return 2;
  return 1;
}

// ---------------------------------------------------------------- renderer

export function renderPaperHtml(input: RenderInput): string {
  const { config: cfg, header, subject, mode } = input;
  const isKey = mode === 'key';

  const marksText = (m: number) => formatMarks(m, cfg.marks.pattern, cfg.marks.singularPattern);
  const marksSpan = (m: number) =>
    m > 0
      ? cfg.marks.position === 'right'
        ? `<span class="marks marks-right">${escapeHtml(marksText(m))}</span>`
        : `<strong class="marks marks-inline">${escapeHtml(marksText(m))}</strong>`
      : '';

  // ---- group consecutive standalone MCQ / True-False items into one numbered question
  const sectionNames = cfg.sections.enabled ? cfg.sections.names : [];
  const sectionOrder = (s: string) => {
    const i = sectionNames.indexOf(s);
    return i === -1 ? -1 : i;
  };
  const ordered = input.items
    .map((it, idx) => ({ it, idx }))
    .sort((a, b) => sectionOrder(a.it.section) - sectionOrder(b.it.section) || a.idx - b.idx)
    .map((x) => ({ ...x.it, section: sectionNames.includes(x.it.section) ? x.it.section : '' }));

  const sections: { name: string; blocks: Block[] }[] = [];
  for (const item of ordered) {
    let sec = sections[sections.length - 1];
    if (!sec || sec.name !== item.section) {
      sec = { name: item.section, blocks: [] };
      sections.push(sec);
    }
    const last = sec.blocks[sec.blocks.length - 1];
    const t = item.question.type;
    if (cfg.mcq.groupConsecutive && t === 'MCQ' && !item.newPage) {
      if (last?.kind === 'mcqset') last.items.push(item);
      else sec.blocks.push({ kind: 'mcqset', items: [item] });
    } else if (cfg.mcq.groupConsecutive && t === 'TRUE_FALSE' && !item.newPage) {
      if (last?.kind === 'tfset') last.items.push(item);
      else sec.blocks.push({ kind: 'tfset', items: [item] });
    } else {
      sec.blocks.push({ kind: 'single', item });
    }
  }
  const questionCount = sections.reduce((s, x) => s + x.blocks.length, 0);
  const sessionText = header.session || '';
  const dateText = header.examDate ? formatDate(header.examDate, cfg.header.dateFormat) : '';
  const tokens = {
    session: sessionText,
    subject: header.titleOverride || subject.name,
    code: subject.code,
    batch: header.batchNo,
    test: header.testNo,
    date: dateText,
    count: questionCount,
    countWord: numberWord(questionCount),
  };

  // ---- header block
  const title = header.titleOverride || input.title || subject.name;
  let headerHtml = '';
  const logo = cfg.header.logo === 'skans' ? logoDataUri('skans-logo') : null;
  if (cfg.layout === 'CAF') {
    const meta = [
      dateText,
      header.maxMarks ? `${header.maxMarks} marks` : '',
      header.durationMinutes ? formatDurationCaf(header.durationMinutes, header.readingMinutes) : '',
    ]
      .filter(Boolean)
      .map(escapeHtml)
      .join('<br>');
    headerHtml = `
<header class="caf-head">
  <div class="caf-head-text">
    ${cfg.header.instituteLine ? `<div class="inst">${escapeHtml(cfg.header.instituteLine)}</div>` : ''}
    <h1 class="subj">${escapeHtml(title)}${isKey ? ' <span class="key-tag">– Answer Key</span>' : ''}</h1>
    <div class="meta">${meta}</div>
  </div>
  ${logo ? `<div class="caf-logo"><img src="${logo}" alt="SKANS"></div>` : ''}
</header>`;
  } else {
    const left = [
      cfg.header.showBatch ? ['Batch No', header.batchNo] : null,
      cfg.header.showTeacher ? ['Teacher Name', header.teacherName] : null,
      cfg.header.showTest ? ['Test', header.testNo] : null,
    ].filter((x): x is string[] => !!x);
    const right = [
      ['Time allowed', formatDurationSkans(header.durationMinutes)],
      ['Maximum Marks', String(header.maxMarks)],
      ['Additional Reading Time', `${header.readingMinutes} min`],
      ['Test Date', dateText],
    ];
    const kv = (rows: string[][]) =>
      rows.map(([k, v]) => `<div class="kv"><span>${escapeHtml(k)}:</span> ${escapeHtml(v || '')}</div>`).join('');
    headerHtml = `
<header class="skans-head">
  ${logo ? `<div class="skans-logo"><img src="${logo}" alt=""></div>` : `<div class="skans-logo-text">${escapeHtml(cfg.header.instituteLine)}</div>`}
  <div class="skans-meta"><div class="col left">${kv(left)}</div><div class="col right">${kv(right)}</div></div>
  <div class="rule"></div>
  <h1 class="skans-title">${escapeHtml(title)}${isKey ? ' – ANSWER KEY' : ''}</h1>
  <div class="rule"></div>
</header>`;
  }

  // ---- instructions (paper only)
  let instructionsHtml = '';
  const lines = header.instructionsOverride ?? cfg.instructions.lines;
  if (isKey) {
    instructionsHtml = `<div class="key-banner">ANSWER KEY &amp; MARKING SCHEME</div>`;
  } else if (lines.length) {
    const label = (i: number) =>
      cfg.instructions.numbering === 'roman'
        ? partLabel(i + 1, 'roman')
        : cfg.instructions.numbering === 'number'
          ? `${i + 1}.`
          : '';
    const rows = lines
      .map(
        (l, i) =>
          `<div class="instr-line">${label(i) ? `<span class="instr-lbl">${label(i)}</span>` : ''}<span class="instr-txt">${inlineMd(fillTokens(l, tokens))}</span></div>`,
      )
      .join('');
    instructionsHtml = `<div class="instructions ${cfg.instructions.boxed ? 'boxed' : 'plain'}">
  ${cfg.instructions.title ? `<div class="instr-title">${inlineMd(cfg.instructions.title)}</div>` : ''}
  ${rows}
</div>${cfg.layout === 'SKANS' ? '<div class="rule"></div>' : ''}`;
  }

  // ---- question content renderers
  const partStyle = (q: RenderQuestion): LabelStyle =>
    ((q.content as PartsContent).partLabelStyle as LabelStyle | null) ?? cfg.questions.partLabelStyle;

  const renderOptions = (options: McqOption[], layout: string, trailing = '') => {
    const cols = optionColumns(options, layout);
    const opts = options
      .map((o, i) => {
        const last = i === options.length - 1;
        const correct = isKey && o.correct ? ' correct' : '';
        return `<div class="opt${correct}"><span class="ol">(${String.fromCharCode(97 + i)})</span><span class="ot">${unwrapP(richHtml(o.html))}${last && cols === 1 ? trailing : ''}</span></div>`;
      })
      .join('');
    return `<div class="opts c${cols}">${opts}</div>${cols !== 1 && trailing ? `<div class="marks-line">${trailing}</div>` : ''}`;
  };

  const correctLetter = (options: McqOption[]) => {
    const i = options.findIndex((o) => o.correct);
    return i >= 0 ? `(${String.fromCharCode(97 + i)})` : '–';
  };

  // Item marks are printed when the template asks for them, or when the MCQs of one question do not
  // all carry one mark (otherwise the paper would hide how many marks each item is worth).
  const renderMcqItem = (label: string, stem: string, options: McqOption[], layout: string, marks: number, forceMarks = false) => {
    const trailing = (cfg.marks.showMcqItemMarks || forceMarks) && marks > 0 ? marksSpan(marks) : '';
    return `<div class="item"><span class="lbl">${label}</span><div class="item-body">${richHtml(stem)}${renderOptions(options, layout, trailing)}</div></div>`;
  };

  const renderParts = (q: RenderQuestion) => {
    const c = q.content as PartsContent;
    const style = partStyle(q);
    const subStyle: LabelStyle = style === cfg.questions.subPartLabelStyle ? (style === 'roman' ? 'alpha' : 'roman') : cfg.questions.subPartLabelStyle;
    return c.parts
      .map((p, i) => {
        const subs = (p.parts ?? [])
          .map(
            (s, j) =>
              `<div class="item sub"><span class="lbl">${partLabel(j + 1, subStyle)}</span><div class="item-body">${withMarks(richHtml(s.html), marksSpan(s.marks))}</div></div>`,
          )
          .join('');
        const own = subs ? richHtml(p.html) : withMarks(richHtml(p.html), marksSpan(p.marks));
        return `<div class="item part"><span class="lbl">${partLabel(i + 1, style)}</span><div class="item-body">${own}${subs}</div></div>`;
      })
      .join('');
  };

  const questionBody = (item: RenderItem): string => {
    const q = item.question;
    switch (q.type) {
      case 'MCQ': {
        const c = q.content as { options: McqOption[]; layout?: string };
        const trailing = marksSpan(item.marks);
        return `${richHtml(q.body)}${renderOptions(c.options ?? [], c.layout ?? 'auto', trailing)}`;
      }
      case 'TRUE_FALSE':
        return withMarks(richHtml(q.body), `<span class="tf-hint">(True / False)</span> ${marksSpan(item.marks)}`);
      case 'MCQ_GROUP': {
        const c = q.content as McqGroupContent;
        const mixed = (c.items ?? []).some((it) => it.marks !== 1);
        const items = (c.items ?? [])
          .map((it, i) => renderMcqItem(partLabel(i + 1, 'roman'), it.stem, it.options, it.layout, it.marks, mixed))
          .join('');
        return `${richHtml(q.body)}<div class="items">${items}</div>`;
      }
      case 'LONG':
      case 'CASE_STUDY': {
        const c = q.content as PartsContent;
        if (c.parts?.length) return `${richHtml(q.body)}<div class="items">${renderParts(q)}</div>`;
        return withMarks(richHtml(q.body), marksSpan(item.marks));
      }
      default:
        return withMarks(richHtml(q.body), marksSpan(item.marks));
    }
  };

  // ---- answer key renderers
  const adviceHtml = (q: RenderQuestion) =>
    q.advice && htmlToText(q.advice) ? `<div class="advice"><div class="advice-title">Examiner's advice</div>${richHtml(q.advice)}</div>` : '';

  const keyBody = (item: RenderItem): string => {
    const q = item.question;
    const answer = q.answer && htmlToText(q.answer) ? richHtml(q.answer) : '';
    switch (q.type) {
      case 'MCQ': {
        const c = q.content as { options: McqOption[] };
        return `<p><strong>Correct answer: ${correctLetter(c.options ?? [])}</strong> ${marksSpan(item.marks)}</p>${answer}${adviceHtml(q)}`;
      }
      case 'TRUE_FALSE':
        return `<p><strong>Answer: ${(q.content as { correct?: boolean }).correct ? 'True' : 'False'}</strong> ${marksSpan(item.marks)}</p>${answer}${adviceHtml(q)}`;
      case 'MCQ_GROUP': {
        const c = q.content as McqGroupContent;
        const rows = (c.items ?? [])
          .map(
            (it, i) =>
              `<tr><td class="c">${partLabel(i + 1, 'roman')}</td><td class="c"><strong>${correctLetter(it.options)}</strong></td><td>${unwrapP(richHtml(it.options.find((o) => o.correct)?.html ?? ''))}</td><td class="c">${it.marks}</td></tr>`,
          )
          .join('');
        return `<div class="tbl"><table class="key-table"><thead><tr><th>MCQ</th><th>Answer</th><th>Correct option</th><th>Marks</th></tr></thead><tbody>${rows}</tbody></table></div>${answer}${adviceHtml(q)}`;
      }
      case 'LONG':
      case 'CASE_STUDY': {
        const c = q.content as PartsContent;
        const style = partStyle(q);
        const parts = (c.parts ?? [])
          .map((p, i) => {
            const subs = (p.parts ?? [])
              .map(
                (s, j) =>
                  `<div class="item sub"><span class="lbl">${partLabel(j + 1, style === 'roman' ? 'alpha' : 'roman')}</span><div class="item-body">${withMarks(s.answer ? richHtml(s.answer) : '<p class="muted">No model answer recorded.</p>', marksSpan(s.marks))}</div></div>`,
              )
              .join('');
            const own = subs
              ? p.answer
                ? richHtml(p.answer)
                : ''
              : withMarks(p.answer ? richHtml(p.answer) : '<p class="muted">No model answer recorded.</p>', marksSpan(partMarks(p)));
            return `<div class="item part"><span class="lbl">${partLabel(i + 1, style)}</span><div class="item-body">${own}${subs}</div></div>`;
          })
          .join('');
        const total = `<p class="marks-total">Total: ${escapeHtml(marksText(item.marks))}</p>`;
        return `${answer}${parts ? `<div class="items">${parts}</div>` : ''}${!parts && !answer ? '<p class="muted">No model answer recorded.</p>' : ''}${total}${adviceHtml(q)}`;
      }
      default:
        return `${withMarks(answer || '<p class="muted">No model answer recorded.</p>', marksSpan(item.marks))}${adviceHtml(q)}`;
    }
  };

  // ---- question blocks
  let n = 0;
  let first = true;
  const headingFor = (num: number) => escapeHtml(fillTokens(cfg.questions.headingPattern, { ...tokens, n: num }));

  const wrapQuestion = (num: number, inner: string, newPage: boolean, keepTogether = false) => {
    const breakCls = (!first && (newPage || cfg.questions.startOnNewPage) ? ' page-break' : '') + (keepTogether ? ' keep' : '');
    first = false;
    if (cfg.questions.style === 'hanging') {
      return `<section class="q hanging${breakCls}"><span class="q-num">${headingFor(num)}</span><div class="q-content">${inner}</div></section>`;
    }
    return `<section class="q block${breakCls}"><h2 class="q-head">${headingFor(num)}</h2><div class="q-content">${inner}</div></section>`;
  };

  const renderBlock = (block: Block): string => {
    n += 1;
    if (block.kind === 'single') {
      // Short questions are kept on one page; long ones may flow across pages.
      const short = ['SHORT', 'MCQ', 'TRUE_FALSE'].includes(block.item.question.type);
      return wrapQuestion(n, isKey ? keyBody(block.item) : questionBody(block.item), block.item.newPage, short);
    }
    if (block.kind === 'mcqset') {
      if (isKey) {
        const rows = block.items
          .map((it, i) => {
            const c = it.question.content as { options: McqOption[] };
            return `<tr><td class="c">${partLabel(i + 1, 'roman')}</td><td class="c"><strong>${correctLetter(c.options ?? [])}</strong></td><td>${unwrapP(richHtml(c.options?.find((o) => o.correct)?.html ?? ''))}</td><td class="c">${it.marks}</td></tr>`;
          })
          .join('');
        const explanations = block.items
          .filter((it) => htmlToText(it.question.answer) || htmlToText(it.question.advice))
          .map(
            (it) =>
              `<div class="item"><span class="lbl">${partLabel(block.items.indexOf(it) + 1, 'roman')}</span><div class="item-body">${richHtml(it.question.answer)}${adviceHtml(it.question)}</div></div>`,
          )
          .join('');
        return wrapQuestion(
          n,
          `<div class="tbl"><table class="key-table"><thead><tr><th>MCQ</th><th>Answer</th><th>Correct option</th><th>Marks</th></tr></thead><tbody>${rows}</tbody></table></div>${explanations ? `<div class="items">${explanations}</div>` : ''}`,
          false,
        );
      }
      const mixed = block.items.some((it) => it.marks !== 1);
      const items = block.items
        .map((it, i) => {
          const c = it.question.content as { options: McqOption[]; layout?: string };
          return renderMcqItem(partLabel(i + 1, 'roman'), it.question.body, c.options ?? [], c.layout ?? 'auto', it.marks, mixed);
        })
        .join('');
      return wrapQuestion(n, `${cfg.mcq.groupIntro ? `<p>${inlineMd(cfg.mcq.groupIntro)}</p>` : ''}<div class="items">${items}</div>`, false);
    }
    // True / False set
    const items = block.items
      .map((it, i) => {
        const tf = isKey
          ? `<p><strong>${(it.question.content as { correct?: boolean }).correct ? 'True' : 'False'}</strong> ${marksSpan(it.marks)}</p>${richHtml(it.question.answer)}`
          : withMarks(richHtml(it.question.body), cfg.marks.showMcqItemMarks ? marksSpan(it.marks) : '');
        return `<div class="item"><span class="lbl">${partLabel(i + 1, 'roman')}</span><div class="item-body">${tf}</div></div>`;
      })
      .join('');
    return wrapQuestion(n, `${!isKey && cfg.mcq.trueFalseIntro ? `<p>${inlineMd(cfg.mcq.trueFalseIntro)}</p>` : ''}<div class="items">${items}</div>`, false);
  };

  const body = sections
    .map((sec) => {
      const divider = sec.name ? `<div class="section-div">${escapeHtml(sec.name)}</div>` : '';
      return divider + sec.blocks.map(renderBlock).join('\n');
    })
    .join('\n');

  const empty = input.items.length === 0 ? `<p class="empty">No questions have been added to this paper yet.</p>` : '';
  const endText = cfg.endText ? `<div class="the-end">${escapeHtml(cfg.endText)}</div>` : '';
  const watermark = input.watermark ? `<div class="watermark"><span>${escapeHtml(input.watermark)}</span></div>` : '';
  // Chromium only downloads a web font that page content uses. When the running header has its
  // own font (e.g. Carlito on the CAF template) and nothing else uses it, the @page margin boxes
  // would stay invisible, so an invisible text run in that font forces it to load.
  const headerFontLoader = cfg.runningHeader.enabled
    ? `<div class="font-loader" aria-hidden="true">${escapeHtml(`${cfg.runningHeader.left} ${cfg.runningHeader.center} ${cfg.runningHeader.right} Page 0123456789 of`)}</div>`
    : '';

  // ---- styles
  const rh = cfg.runningHeader;
  const pos = rh.position;
  const marginBoxes = rh.enabled
    ? `@${pos}-left{content:${cssContent(fillTokens(rh.left, { ...tokens, page: '{page}', pages: '{pages}' }))};}
       @${pos}-center{content:${cssContent(fillTokens(rh.center, { ...tokens, page: '{page}', pages: '{pages}' }))};}
       @${pos}-right{content:${cssContent(fillTokens(rh.right, { ...tokens, page: '{page}', pages: '{pages}' }))};}`
    : '';
  const firstPage =
    rh.enabled && rh.skipFirstPage
      ? `@page:first{@${pos}-left{content:none;}@${pos}-center{content:none;}@${pos}-right{content:none;}}`
      : '';
  const marginBoxStyle = `font-family:${fontStack(cfg.fonts.runningHeader)};font-size:9.5pt;color:#000;vertical-align:${pos === 'top' ? 'bottom' : 'top'};padding-${pos === 'top' ? 'bottom' : 'top'}:5mm;`;

  const p = cfg.page;
  const css = `
${fontFacesFor([cfg.fonts.body, cfg.fonts.heading, cfg.fonts.runningHeader])}
@page{size:A4;margin:${p.marginTopMm}mm ${p.marginRightMm}mm ${p.marginBottomMm}mm ${p.marginLeftMm}mm;${marginBoxes}}
${firstPage}
@page{@${pos}-left{${marginBoxStyle}text-align:left;}@${pos}-center{${marginBoxStyle}text-align:center;}@${pos}-right{${marginBoxStyle}text-align:right;}}
${BASE_CSS}
body{font-family:${fontStack(cfg.fonts.body)};font-size:${cfg.fonts.sizePt}pt;line-height:${cfg.fonts.lineHeight};}
.q-head,.q-num,.caf-head,.skans-head,.section-div,.instructions,.the-end,.key-banner{font-family:${fontStack(cfg.fonts.heading)};}
.q{margin-top:${cfg.questions.gapMm}mm;}
.font-loader{font-family:${fontStack(cfg.fonts.runningHeader)};position:absolute;left:0;top:0;height:0;overflow:hidden;visibility:hidden;white-space:nowrap;}
`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(input.title || title)}</title>
<style>${css}</style>
</head>
<body class="layout-${cfg.layout.toLowerCase()} mode-${mode}">
${watermark}
${headerFontLoader}
${headerHtml}
${instructionsHtml}
<main>
${body}
${empty}
</main>
${endText}
</body>
</html>`;
}

const BASE_CSS = `
*{box-sizing:border-box;}
html{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
body{margin:0;color:#000;background:#fff;}
p{margin:0 0 5pt;text-align:justify;orphans:2;widows:2;}
strong{font-weight:700;}
h1,h2{margin:0;font-weight:700;}
.muted{color:#555;font-style:italic;}
.empty{color:#666;font-style:italic;text-align:center;margin-top:20mm;}

/* CAF examination header: title block left, SKANS logo top right (as on the reference paper) */
.caf-head{display:flex;justify-content:space-between;align-items:flex-start;gap:6mm;margin:2mm 0 4mm;}
.caf-head .inst{font-size:13pt;font-weight:700;margin-bottom:3.5mm;}
.caf-head .subj{font-size:17pt;margin-bottom:3.5mm;}
.caf-head .key-tag{font-size:13pt;color:#000;}
.caf-head .meta{font-size:11pt;line-height:1.15;}
.caf-logo{flex:0 0 44mm;text-align:right;}
.caf-logo img{width:44mm;height:auto;}

/* SKANS header */
.skans-head{margin-bottom:2mm;}
.skans-logo img{width:46mm;height:auto;}
.skans-logo-text{font-size:18pt;font-weight:700;color:#2E3192;}
.skans-meta{display:flex;justify-content:space-between;padding:3mm 6mm 6mm 12mm;font-weight:700;font-size:10.5pt;}
.skans-meta .kv{margin-bottom:4.2mm;}
.skans-meta .col.right{padding-top:6mm;}
.rule{border-top:1.2pt solid #000;margin:0;}
.skans-title{text-align:center;font-size:16pt;padding:5mm 0;}

/* instructions */
.instructions{margin:0 0 4mm;font-size:10.5pt;}
.instructions.boxed{border:0.9pt solid #000;padding:1.5mm 2mm 1.5mm;line-height:1.1;}
.instructions.boxed .instr-title{font-weight:700;text-decoration:underline;}
.instructions.plain{padding:5mm 2mm 3mm;font-weight:700;}
.instructions.plain .instr-title{font-size:13pt;text-decoration:underline;margin-bottom:5mm;}
.instructions.plain .instr-line{margin-bottom:4.5mm;}
.instr-line{display:flex;}
.instr-lbl{flex:0 0 9mm;}
.instructions.plain .instr-lbl{flex:0 0 auto;margin-right:1.2mm;}
.instr-txt{flex:1;}
.key-banner{text-align:center;font-weight:700;font-size:12pt;letter-spacing:.5pt;border-top:2.2pt solid #000;border-bottom:.75pt solid #000;padding:1.5mm 0;margin:0 0 5mm;}

/* sections & questions */
.section-div{border-top:2.4pt solid #000;border-bottom:.75pt solid #000;text-align:center;font-weight:700;font-size:10.5pt;padding:1.2mm 0;margin:4mm 0 2mm;break-after:avoid;page-break-after:avoid;}
.section-div + .q{margin-top:3mm;}
.page-break{break-before:page;page-break-before:always;}
.q.keep{break-inside:avoid;page-break-inside:avoid;}
.q-head{font-size:11pt;margin:0 0 3.5mm;break-after:avoid;page-break-after:avoid;}
.q.hanging{position:relative;padding-left:9mm;}
.q.hanging .q-num{position:absolute;left:0;top:0;font-weight:700;font-size:11.5pt;line-height:1.25;}
.layout-skans .q-content{font-family:inherit;}
.q-content > p:first-child, .q-content > .items:first-child{break-before:avoid;}

.items{margin:2mm 0 0;}
.item{position:relative;padding-left:9mm;margin:0 0 4mm;}
.item > .lbl{position:absolute;left:0;top:0;}
.item.part{margin-bottom:3mm;}
.item.sub{margin:1.5mm 0 2mm;}
.items > .item:not(.part){break-inside:avoid;page-break-inside:avoid;}

/* MCQ options */
.opts{display:grid;column-gap:5mm;row-gap:.4mm;margin:1.5mm 0 1mm;}
.opts.c1{grid-template-columns:1fr;}
.opts.c2{grid-template-columns:1fr 1fr;}
.opts.c4{grid-template-columns:repeat(4,1fr);}
.opt{display:flex;break-inside:avoid;}
.opt .ol{flex:0 0 9mm;}
.opt .ot{flex:1;text-align:left;}
.opt .ot p{margin:0;text-align:left;}
.opt.correct .ot,.opt.correct .ol{font-weight:700;text-decoration:underline;}
.tf-hint{font-style:italic;}

/* marks */
.marks{font-weight:700;white-space:nowrap;}
.marks-right{float:right;margin-left:4mm;}
.marks-inline{margin-left:1.2mm;}
.marks-line{text-align:right;margin:0;clear:both;}
/* On its own line (after a table or option grid) the marks must not float, or they drift into the next block. */
.marks-line > .marks-right{float:none;margin-left:0;}
.layout-skans .marks-line{text-align:left;}
.marks-total{text-align:right;font-weight:700;margin-top:2mm;}

/* rich text */
.q-content ol{list-style:none;counter-reset:li;padding-left:9mm;margin:0 0 5pt;}
.q-content ol > li{counter-increment:li;position:relative;margin-bottom:2pt;}
.q-content ol > li::before{content:"(" counter(li, lower-roman) ")";position:absolute;left:-9mm;}
.q-content ol ol > li::before{content:"(" counter(li, lower-alpha) ")";}
.q-content ul{list-style:square;padding-left:9mm;margin:0 0 5pt;}
.q-content ul > li{padding-left:2mm;margin-bottom:1pt;}
.q-content li > p{margin:0 0 2pt;}
.q-content h3,.q-content h4{font-size:inherit;margin:3pt 0 2pt;}
.q-content blockquote{margin:2mm 6mm;padding:2mm 4mm;border:0.6pt solid #000;}
.q-content hr{border:0;border-top:.6pt solid #000;}
sub,sup{font-size:70%;line-height:0;}

/* tables: solid outer border, dashed inner rules (reference paper style); never split short tables */
.tbl{break-inside:avoid;page-break-inside:avoid;margin:2mm 0 3mm;display:flex;justify-content:center;}
.tbl table{border-collapse:collapse;border:.8pt solid #000;font-size:inherit;line-height:1.1;max-width:100%;}
.tbl th,.tbl td{border:.6pt dashed #333;padding:.3mm 2mm;vertical-align:top;}
.tbl th{font-weight:700;text-align:center;}
.tbl td p,.tbl th p{margin:0;text-align:inherit;}
.tbl td p:not([style]){text-align:left;}
.tbl th p:not([style]){text-align:center;}
.tbl thead{display:table-header-group;}
.tbl tr{break-inside:avoid;page-break-inside:avoid;}
/* borderless tables: used to lay out short lists in columns (e.g. "(i) ... (ii) ...") */
.tbl:has(> table.borderless){justify-content:flex-start;margin:1mm 0 2mm;}
.tbl table.borderless,.tbl table.borderless th,.tbl table.borderless td{border:0;}
.tbl table.borderless td{padding:.4mm 6mm .4mm 0;}
.tbl table.borderless{line-height:inherit;}
.key-table td.c{text-align:center;}
.key-table{min-width:120mm;}

.advice{border-left:2pt solid #000;padding:1mm 3mm;margin:2mm 0 3mm;font-size:.95em;break-inside:avoid;}
.advice-title{font-weight:700;font-style:italic;margin-bottom:1mm;}

.the-end{text-align:center;font-weight:700;margin-top:6mm;}

.watermark{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:10;}
.watermark span{transform:rotate(-35deg);font-family:Arial,sans-serif;font-size:26pt;font-weight:700;color:rgba(46,49,146,.13);white-space:nowrap;letter-spacing:1pt;}
`;
