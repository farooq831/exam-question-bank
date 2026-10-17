import sanitizeHtml from 'sanitize-html';

const align = [/^(left|right|center|justify)$/];
const width = [/^\d{1,4}(\.\d+)?(px|%|mm|pt)$/];

/**
 * Whitelist for rich text written in the TipTap editor (and pasted from Word/Excel).
 * Applied on every save AND again when rendering, so stored data can never inject script or
 * styles into the paper or the browser.
 */
const options: sanitizeHtml.IOptions = {
  allowedTags: [
    'p',
    'br',
    'strong',
    'b',
    'em',
    'i',
    'u',
    's',
    'sub',
    'sup',
    'span',
    'ul',
    'ol',
    'li',
    'h3',
    'h4',
    'blockquote',
    'hr',
    'table',
    'colgroup',
    'col',
    'thead',
    'tbody',
    'tfoot',
    'tr',
    'th',
    'td',
  ],
  allowedAttributes: {
    th: ['colspan', 'rowspan', 'colwidth', 'style'],
    td: ['colspan', 'rowspan', 'colwidth', 'style'],
    col: ['style', 'span'],
    p: ['style'],
    h3: ['style'],
    h4: ['style'],
    ol: ['start'],
    table: ['style', 'class'],
  },
  allowedClasses: {
    table: ['borderless'],
  },
  allowedStyles: {
    p: { 'text-align': align },
    h3: { 'text-align': align },
    h4: { 'text-align': align },
    th: { 'text-align': align },
    td: { 'text-align': align },
    col: { width },
    table: { width },
  },
  allowedSchemes: [],
  disallowedTagsMode: 'discard',
  // Word paste produces o:p, mso styles etc. - drop them silently.
  nonTextTags: ['style', 'script', 'textarea', 'option', 'noscript', 'xml', 'head', 'title'],
  transformTags: {
    b: 'strong',
    i: 'em',
  },
  exclusiveFilter: (frame) => frame.tag === 'span' && !frame.text.trim() && !frame.mediaChildren?.length,
};

export function sanitizeRich(html: string | undefined | null): string {
  if (!html) return '';
  return sanitizeHtml(html, options).trim();
}

/** Plain text (for search index and length checks). */
export function htmlToText(html: string | undefined | null): string {
  if (!html) return '';
  return sanitizeHtml(html.replace(/<\/(p|li|td|th|tr|h3|h4)>/gi, ' $&'), { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function escapeHtml(text: string | number | null | undefined): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
