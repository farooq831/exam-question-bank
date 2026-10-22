import { existsSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { FontKey } from '@skans/shared';
import { paths } from '../config';

const require = createRequire(import.meta.url);

/**
 * Fonts are embedded into every paper so the PDF looks the same on any server. Only free,
 * open-licence fonts bundled with the app are used (no licensed or system fonts):
 * Tinos = Times New Roman style, Arimo = Arial style, Carlito = Calibri style.
 */
const FONT_PACKAGES: Record<FontKey, { pkg: string; family: string; fallback: string }> = {
  Times: { pkg: 'tinos', family: 'Tinos', fallback: "'Times New Roman', Times, serif" },
  Arial: { pkg: 'arimo', family: 'Arimo', fallback: 'Arial, Helvetica, sans-serif' },
  Calibri: { pkg: 'carlito', family: 'Carlito', fallback: 'Calibri, Arial, sans-serif' },
};

export function fontStack(key: FontKey): string {
  const f = FONT_PACKAGES[key];
  return `'${f.family}', ${f.fallback}`;
}

const fontCssCache = new Map<FontKey, string>();

function fontFaceCss(key: FontKey): string {
  const cached = fontCssCache.get(key);
  if (cached !== undefined) return cached;
  const { pkg, family } = FONT_PACKAGES[key];
  let css = '';
  try {
    const dir = path.join(path.dirname(require.resolve(`@fontsource/${pkg}/package.json`)), 'files');
    for (const weight of [400, 700]) {
      for (const style of ['normal', 'italic']) {
        for (const subset of ['latin', 'latin-ext']) {
          const file = path.join(dir, `${pkg}-${subset}-${weight}-${style}.woff2`);
          if (!existsSync(file)) continue;
          const b64 = readFileSync(file).toString('base64');
          const range =
            subset === 'latin'
              ? 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD'
              : 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF';
          css += `@font-face{font-family:'${family}';font-style:${style};font-weight:${weight};font-display:block;src:url(data:font/woff2;base64,${b64}) format('woff2');unicode-range:${range};}
`;
        }
      }
    }
  } catch (e) {
    console.warn(`[render] font package @fontsource/${pkg} not found, falling back to system fonts`, e);
  }
  fontCssCache.set(key, css);
  return css;
}

export function fontFacesFor(keys: FontKey[]): string {
  return [...new Set(keys)].map(fontFaceCss).join('');
}

/**
 * Font names for the one-line running header. Chromium draws that header outside the page and
 * cannot use the embedded fonts there, so it uses the computer's own font of that style
 * (installed with Windows; on other systems the nearest available one). Nothing is shipped.
 */
export function systemFontStack(key: FontKey): string {
  return { Times: "'Times New Roman', Tinos, 'Liberation Serif', serif", Arial: "Arial, Arimo, 'Liberation Sans', sans-serif", Calibri: "Calibri, Carlito, Arial, 'Liberation Sans', sans-serif" }[key];
}


// ---------- Logos (replaceable files in client/public/branding) ----------

const MIME: Record<string, string> = { '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };

/**
 * Looks for <name>.png, .jpg, .jpeg then .svg in the branding folder, so the school can drop in
 * its real logo without touching code. Cached per file modification time.
 */
const logoCache = new Map<string, { mtime: number; uri: string }>();

export function logoDataUri(name: 'skans-logo'): string | null {
  for (const ext of ['.png', '.jpg', '.jpeg', '.svg']) {
    const file = path.join(paths.branding, name + ext);
    if (!existsSync(file)) continue;
    try {
      const mtime = statSync(file).mtimeMs;
      const hit = logoCache.get(file);
      if (hit && hit.mtime === mtime) return hit.uri;
      const uri = `data:${MIME[ext]};base64,${readFileSync(file).toString('base64')}`;
      logoCache.set(file, { mtime, uri });
      return uri;
    } catch {
      return null;
    }
  }
  return null;
}
