import type { ReactNode } from 'react';
import { Search, type LucideIcon } from 'lucide-react';

/** Page title with an optional count and actions on the right. One line, no subtitles. */
export function PageHeader({ title, count, actions }: { title: string; count?: number; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <h1 className="flex items-center gap-2.5 text-2xl font-semibold tracking-tight text-ink">
        {title}
        {count !== undefined && <span className="rounded-full bg-slate-200/70 px-2.5 py-0.5 text-sm font-semibold text-slate-600">{count}</span>}
      </h1>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Icon-only button. The label is shown as a tooltip and read by screen readers. */
export function IconButton({ label, icon: Icon, onClick, tone, disabled, href, download }: { label: string; icon: LucideIcon; onClick?(): void; tone?: 'danger' | 'success'; disabled?: boolean; href?: string; download?: boolean }) {
  const cls = `icon-btn ${tone ? `tone-${tone}` : ''}`;
  if (href) return <a className={cls} href={href} download={download} title={label} aria-label={label}><Icon size={17} /></a>;
  return <button type="button" className={cls} onClick={onClick} disabled={disabled} title={label} aria-label={label}><Icon size={17} /></button>;
}

export function EmptyState({ icon: Icon, title, action }: { icon: LucideIcon; title: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-400"><Icon size={22} /></div>
      <p className="text-sm text-slate-500">{title}</p>
      {action}
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder = 'Search', className = '' }: { value: string; onChange(v: string): void; placeholder?: string; className?: string }) {
  return (
    <label className={`relative block ${className}`}>
      <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
      <input className="field !pl-9" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} aria-label={placeholder} />
    </label>
  );
}

/** Row of toggle chips, used for quick filters. */
export function Chips<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange(v: T): void }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group">
      {options.map((o) => (
        <button key={o.value} type="button" className="chip" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

export type Tone = 'slate' | 'amber' | 'green' | 'red' | 'blue';
const TONES: Record<Tone, string> = {
  slate: 'bg-slate-100 text-slate-600',
  amber: 'bg-amber-50 text-amber-700',
  green: 'bg-emerald-50 text-emerald-700',
  red: 'bg-red-50 text-red-700',
  blue: 'bg-blue-50 text-blue-700',
};
export function Pill({ tone = 'slate', dot = false, children }: { tone?: Tone; dot?: boolean; children: ReactNode }) {
  return <span className={`pill ${dot ? 'pill-dot' : ''} ${TONES[tone]}`}>{children}</span>;
}

export function Pager({ page, pages, onPage }: { page: number; pages: number; onPage(p: number): void }) {
  if (pages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-end gap-2 text-sm text-slate-500">
      <button className="secondary !min-h-9" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
      <span className="px-1">{page} / {pages}</span>
      <button className="secondary !min-h-9" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button>
    </div>
  );
}
