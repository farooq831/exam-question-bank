import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { FontKey } from '@skans/shared';
import { paths } from '../config';

const require = createRequire(import.meta.url);

/**
 * Fonts are embedded into every paper so the PDF looks the same on any server.
 *  - Open metric-compatible fonts ship with the app: Tinos = Times New Roman, Arimo = Arial,
 *    Carlito = Calibri.
 *  - Calisto MT (the approved CAF paper font) is a licensed Microsoft/Monotype font and is NOT in
 *    the repository. It is read from the server's installed fonts (it ships with Microsoft Office)
 *    or from a `fonts` folder inside the branding folder. If it is missing, Tinos is used and a
 *    warning is logged once.
 */
const FONT_PACKAGES: Record<Exclude<FontKey, 'Calisto'>, { pkg: string; family: string; fallback: string }> = {
  Times: { pkg: 'tinos', family: 'Tinos', fallback: "'Times New Roman', Times, serif" },
  Arial: { pkg: 'arimo', family: 'Arimo', fallback: 'Arial, Helvetica, sans-serif' },
  Calibri: { pkg: 'carlito', family: 'Carlito', fallback: 'Calibri, Arial, sans-serif' },
};

const CALISTO_FILES: { file: string; weight: number; style: 'normal' | 'italic' }[] = [
  { file: 'CALIST.TTF', weight: 400, style: 'normal' },
  { file: 'CALISTB.TTF', weight: 700, style: 'normal' },
  { file: 'CALISTI.TTF', weight: 400, style: 'italic' },
  { file: 'CALISTBI.TTF', weight: 700, style: 'italic' },
];

function systemFontDirs(): string[] {
  const dirs = [path.join(paths.branding, 'fonts')];
  if (process.env.WINDIR) dirs.push(path.join(process.env.WINDIR, 'Fonts'));
  dirs.push('C:\\Windows\\Fonts');
  if (process.env.LOCALAPPDATA) dirs.push(path.join(process.env.LOCALAPPDATA, 'Microsoft', 'Windows', 'Fonts'));
  dirs.push('/usr/share/fonts/truetype/msttcorefonts', '/usr/share/fonts/truetype', '/usr/share/fonts', '/Library/Fonts');
  if (process.env.HOME) dirs.push(path.join(process.env.HOME, '.fonts'), path.join(process.env.HOME, '.local', 'share', 'fonts'));
  return dirs;
}

/** Finds a font file case-insensitively in the known font folders. */
function findFontFile(name: string): string | null {
  for (const dir of systemFontDirs()) {
    try {
      if (!existsSync(dir)) continue;
      const hit = readdirSync(dir).find((f) => f.toLowerCase() === name.toLowerCase());
      if (hit) return path.join(dir, hit);
    } catch {
      /* unreadable folder */
    }
  }
  return null;
}

let calistoCss: string | null = null;
/** @font-face rules for Calisto MT, or '' when the font is not installed. */
function calistoFaceCss(): string {
  if (calistoCss !== null) return calistoCss;
  let css = '';
  for (const f of CALISTO_FILES) {
    const file = findFontFile(f.file);
    if (!file) continue;
    const b64 = readFileSync(file).toString('base64');
    css += `@font-face{font-family:'Calisto MT';font-style:${f.style};font-weight:${f.weight};font-display:block;src:url(data:font/ttf;base64,${b64}) format('truetype');}
`;
  }
  if (!css) console.warn('[render] Calisto MT is not installed on this server; papers use Tinos (Times-compatible) instead. Install Calisto MT or copy CALIST*.TTF into the branding/fonts folder.');
  // Only remember a successful lookup, so installing the font later works without a restart.
  if (css) calistoCss = css;
  return css;
}

/** Which Calisto MT styles this server can embed (regular, bold, italic, bold italic). */
export function calistoStatus(): { installed: boolean; styles: string[] } {
  const names: Record<string, string> = { 'CALIST.TTF': 'regular', 'CALISTB.TTF': 'bold', 'CALISTI.TTF': 'italic', 'CALISTBI.TTF': 'bold italic' };
  const styles = CALISTO_FILES.filter((f) => findFontFile(f.file)).map((f) => names[f.file]);
  return { installed: styles.includes('regular'), styles };
}

export function calistoAvailable(): boolean {
  return calistoFaceCss() !== '';
}

export function fontStack(key: FontKey): string {
  if (key === 'Calisto') return "'Calisto MT', 'Tinos', 'Times New Roman', serif";
  const f = FONT_PACKAGES[key];
  return `'${f.family}', ${f.fallback}`;
}

const fontCssCache = new Map<FontKey, string>();

function fontFaceCss(key: FontKey): string {
  const cached = fontCssCache.get(key);
  if (cached !== undefined) return cached;
  // Calisto falls back to Tinos, so Tinos is embedded as well when Calisto is missing.
  if (key === 'Calisto') {
    const css = calistoFaceCss() || fontFaceCss('Times');
    fontCssCache.set(key, css);
    return css;
  }
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

/** Font family names for the Chromium header template (system fonts; web fonts are not loaded there). */
export function systemFontStack(key: FontKey): string {
  return { Calisto: "'Calisto MT', 'Times New Roman', serif", Times: "'Times New Roman', Tinos, serif", Arial: 'Arial, Arimo, sans-serif', Calibri: 'Calibri, Carlito, Arial, sans-serif' }[key];
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
