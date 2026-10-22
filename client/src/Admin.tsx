import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  AUDIT_ACTIONS,
  cafGroup,
  DATE_FORMATS,
  FONT_KEYS,
  FONT_LABELS,
  LABEL_STYLE_LABELS,
  LABEL_STYLES,
  ROLE_LABELS,
  ROLES,
  type LabelStyle,
  type AuditLogDTO,
  type Paged,
  type Role,
  type SubjectDTO,
  type TemplateConfig,
  type TemplateDTO,
  type UserDTO,
} from '@skans/shared';
import { BookOpen, ChevronDown, Copy, KeyRound, Pencil, Plus, Power, ScrollText, Unlock, Users } from 'lucide-react';
import { toast } from 'sonner';
import { api } from './api';
import { useAuth } from './auth';
import { Confirm } from './components/Confirm';
import { Modal } from './components/Modal';
import { PasswordInput } from './components/PasswordInput';
import { Chips, EmptyState, IconButton, PageHeader, Pager, Pill, SearchBox } from './components/ui';
import { actionLabel, ago } from './Dashboard';

const errorText = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback);
const Field = ({ label, children, className = '', hint }: { label: string; children: ReactNode; className?: string; hint?: string }) => (
  <label className={`label ${className}`}>{label}{children}{hint && <span className="field-hint block">{hint}</span>}</label>
);

/** Random temporary password that satisfies the policy (letters + digits, 12 chars). Works without HTTPS. */
function temporaryPassword() {
  const letters = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  const all = letters + digits;
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const chars = Array.from(bytes, (b) => all[b % all.length]);
  chars[0] = letters[bytes[0] % letters.length];
  chars[11] = digits[bytes[11] % digits.length];
  return chars.join('');
}

// ------------------------------------------------------------------ Users

type UserForm = { id?: number; username: string; fullName: string; email: string; role: Role; password: string; subjectIds: number[]; isActive: boolean };
const ROLE_CHIPS = [{ value: '', label: 'All' }, { value: 'ADMIN', label: 'Admins' }, { value: 'TEACHER', label: 'Teachers' }, { value: 'RESEARCH_OFFICER', label: 'Research officers' }, { value: 'inactive', label: 'Inactive' }];

export function AdminUsers() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<UserDTO[]>([]);
  const [subjects, setSubjects] = useState<SubjectDTO[]>([]);
  const [form, setForm] = useState<UserForm | null>(null);
  const [reset, setReset] = useState<{ user: UserDTO; password: string } | null>(null);
  const [toggle, setToggle] = useState<UserDTO | null>(null);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [u, s] = await Promise.all([api<UserDTO[]>('/users'), api<SubjectDTO[]>('/subjects')]);
      setUsers(u);
      setSubjects(s);
    } catch (error) {
      toast.error(errorText(error, 'Unable to load users'));
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const code = (id: number) => subjects.find((s) => s.id === id)?.code ?? `#${id}`;
  const shown = users.filter((u) =>
    (!q || `${u.username} ${u.fullName} ${u.email ?? ''}`.toLowerCase().includes(q.toLowerCase())) &&
    (filter === '' || (filter === 'inactive' ? !u.isActive : u.role === filter && u.isActive)),
  );

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!form) return;
    setBusy(true);
    try {
      const body = { fullName: form.fullName, email: form.email, role: form.role, subjectIds: form.subjectIds, isActive: form.isActive };
      if (form.id) await api(`/users/${form.id}`, { method: 'PUT', body: JSON.stringify(body) });
      else await api('/users', { method: 'POST', body: JSON.stringify({ ...body, username: form.username, password: form.password }) });
      toast.success(form.id ? 'User updated' : 'User created');
      setForm(null);
      await load();
    } catch (error) {
      toast.error(errorText(error, 'Unable to save user'));
    } finally {
      setBusy(false);
    }
  }

  async function doReset() {
    if (!reset) return;
    try {
      await api(`/users/${reset.user.id}/reset-password`, { method: 'POST', body: JSON.stringify({ newPassword: reset.password }) });
      toast.success('Password reset');
      setReset(null);
      await load();
    } catch (error) {
      toast.error(errorText(error, 'Unable to reset password'));
    }
  }

  async function unlock(u: UserDTO) {
    try {
      await api(`/users/${u.id}/unlock`, { method: 'POST' });
      toast.success(`${u.username} unlocked`);
      await load();
    } catch (error) {
      toast.error(errorText(error, 'Unable to unlock'));
    }
  }

  async function setActive(u: UserDTO) {
    setToggle(null);
    try {
      await api(`/users/${u.id}`, { method: 'PUT', body: JSON.stringify({ fullName: u.fullName, email: u.email ?? '', role: u.role, subjectIds: u.subjectIds, isActive: !u.isActive }) });
      toast.success(u.isActive ? 'Deactivated' : 'Activated');
      await load();
    } catch (error) {
      toast.error(errorText(error, 'Unable to change status'));
    }
  }

  return (
    <div>
      <PageHeader title="Users" count={users.length} actions={<button className="primary" onClick={() => setForm({ username: '', fullName: '', email: '', role: 'TEACHER', password: temporaryPassword(), subjectIds: [], isActive: true })}><Plus size={16} />Add user</button>} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchBox className="min-w-[200px] flex-1" value={q} onChange={setQ} placeholder="Search users" />
        <Chips options={ROLE_CHIPS} value={filter} onChange={setFilter} />
      </div>
      <div className="card overflow-hidden">
        {shown.length === 0 && <EmptyState icon={Users} title="No users found" />}
        {shown.map((u) => (
          <div key={u.id} className={`list-row ${u.isActive ? '' : 'opacity-60'}`}>
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600">{u.fullName.slice(0, 1).toUpperCase()}</div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-ink">{u.fullName}{u.id === me?.id && <span className="ml-1.5 text-xs font-normal text-slate-400">you</span>}</p>
              <p className="truncate text-xs text-slate-400">
                {u.username} · {u.role === 'ADMIN' ? 'all subjects' : u.subjectIds.length ? u.subjectIds.map(code).join(', ') : <span className="text-amber-600">no subjects</span>} · {u.lastLoginAt ? `seen ${ago(u.lastLoginAt)}` : 'never signed in'}
              </p>
            </div>
            {u.lockedUntil && <Pill tone="red">Locked</Pill>}
            {!u.isActive && <Pill>Inactive</Pill>}
            <Pill tone={u.role === 'ADMIN' ? 'blue' : u.role === 'RESEARCH_OFFICER' ? 'amber' : 'slate'}>{ROLE_LABELS[u.role]}</Pill>
            <div className="flex shrink-0 items-center">
              <IconButton label="Edit" icon={Pencil} onClick={() => setForm({ id: u.id, username: u.username, fullName: u.fullName, email: u.email ?? '', role: u.role, password: '', subjectIds: u.subjectIds, isActive: u.isActive })} />
              <IconButton label="Reset password" icon={KeyRound} onClick={() => setReset({ user: u, password: temporaryPassword() })} />
              {u.lockedUntil && <IconButton label="Unlock" icon={Unlock} onClick={() => void unlock(u)} />}
              {u.id !== me?.id && <IconButton label={u.isActive ? 'Deactivate' : 'Activate'} icon={Power} tone={u.isActive ? 'danger' : 'success'} onClick={() => setToggle(u)} />}
            </div>
          </div>
        ))}
      </div>

      {form && (
        <Modal title={form.id ? 'Edit user' : 'Add user'} eyebrow={form.id ? form.username : undefined} onClose={() => setForm(null)} footer={<><button className="ghost" onClick={() => setForm(null)}>Cancel</button><button className="primary" form="user-form" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button></>}>
          <form id="user-form" onSubmit={save} className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name"><input className="field mt-1.5" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required minLength={2} autoFocus /></Field>
            <Field label="Username"><input className="field mt-1.5" value={form.username} disabled={!!form.id} autoCapitalize="none" pattern="[a-z0-9_.]{3,40}" title="3–40 lowercase letters, digits, dot or underscore" onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })} required /></Field>
            <Field label="Email (optional)"><input className="field mt-1.5" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="Role"><select className="field mt-1.5" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select></Field>
            {!form.id && (
              <Field label="Temporary password" className="sm:col-span-2" hint="They choose their own password at first sign-in.">
                <div className="mt-1.5 flex gap-2">
                  <PasswordInput initiallyVisible wrapperClassName="flex-1" autoComplete="new-password" className="field font-mono" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={10} />
                  <button type="button" className="secondary shrink-0" onClick={() => setForm({ ...form, password: temporaryPassword() })}>New</button>
                </div>
              </Field>
            )}
            {form.role !== 'ADMIN' && (
              <fieldset className="sm:col-span-2">
                <legend className="label">Subjects</legend>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {subjects.filter((s) => s.isActive || form.subjectIds.includes(s.id)).map((s) => (
                    <button key={s.id} type="button" className="chip" aria-pressed={form.subjectIds.includes(s.id)} title={s.name} onClick={() => setForm({ ...form, subjectIds: form.subjectIds.includes(s.id) ? form.subjectIds.filter((id) => id !== s.id) : [...form.subjectIds, s.id] })}>{s.code}</button>
                  ))}
                </div>
              </fieldset>
            )}
            {form.id && <label className="flex items-center gap-2 text-sm text-slate-600 sm:col-span-2"><input type="checkbox" className="h-4 w-4" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />Active</label>}
          </form>
        </Modal>
      )}
      {reset && (
        <Modal size="md" title="Reset password" eyebrow={reset.user.fullName} onClose={() => setReset(null)} footer={<><button className="ghost" onClick={() => setReset(null)}>Cancel</button><button className="primary" onClick={() => void doReset()} disabled={reset.password.length < 10}>Reset</button></>}>
          <Field label="Temporary password" hint="They are signed out and must choose a new password.">
            <div className="mt-1.5 flex gap-2">
              <PasswordInput initiallyVisible wrapperClassName="flex-1" autoComplete="new-password" className="field font-mono" value={reset.password} onChange={(e) => setReset({ ...reset, password: e.target.value })} />
              <IconButton label="Copy" icon={Copy} onClick={() => void navigator.clipboard?.writeText(reset.password).then(() => toast.success('Copied'))} />
            </div>
          </Field>
        </Modal>
      )}
      <Confirm open={!!toggle} danger={!!toggle?.isActive} title={toggle?.isActive ? `Deactivate ${toggle?.fullName}?` : `Activate ${toggle?.fullName}?`} message={toggle?.isActive ? 'They are signed out and cannot sign in. Their work is kept.' : 'They will be able to sign in again.'} confirmLabel={toggle?.isActive ? 'Deactivate' : 'Activate'} onConfirm={() => toggle && void setActive(toggle)} onCancel={() => setToggle(null)} />
    </div>
  );
}

// ------------------------------------------------------------------ Subjects

type SubjectForm = { id?: number; code: string; name: string; level: string; templateId: number | null; isActive: boolean };

export function AdminSubjects() {
  const [subjects, setSubjects] = useState<SubjectDTO[]>([]);
  const [templates, setTemplates] = useState<TemplateDTO[]>([]);
  const [form, setForm] = useState<SubjectForm | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const load = useCallback(async () => {
    try {
      const [s, t] = await Promise.all([api<SubjectDTO[]>('/subjects'), api<TemplateDTO[]>('/templates')]);
      setSubjects(s);
      setTemplates(t);
    } catch (error) {
      toast.error(errorText(error, 'Unable to load subjects'));
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function save(next: SubjectForm) {
    try {
      const body = JSON.stringify({ code: next.code.toUpperCase(), name: next.name, level: next.level, templateId: next.templateId, isActive: next.isActive });
      await api(next.id ? `/subjects/${next.id}` : '/subjects', { method: next.id ? 'PUT' : 'POST', body });
      toast.success('Saved');
      setForm(null);
      await load();
    } catch (error) {
      toast.error(errorText(error, 'Unable to save subject'));
    }
  }

  const active = subjects.filter((s) => s.isActive);
  const inactive = subjects.filter((s) => !s.isActive);
  const groups: [string, SubjectDTO[]][] = [
    ['Group A', active.filter((s) => cafGroup(s.level) === 'A')],
    ['Group B', active.filter((s) => cafGroup(s.level) === 'B')],
    ['Other', active.filter((s) => !cafGroup(s.level))],
  ];
  const row = (s: SubjectDTO) => (
    <div key={s.id} className="list-row">
      <span className="w-14 shrink-0 text-xs font-semibold text-slate-400">{s.level}</span>
      <div className="min-w-0 flex-1"><p className="truncate font-medium text-ink">{s.name}</p><p className="text-xs text-slate-400">{s.code}</p></div>
      <IconButton label="Edit" icon={Pencil} onClick={() => setForm({ id: s.id, code: s.code, name: s.name, level: s.level, templateId: s.templateId, isActive: s.isActive })} />
    </div>
  );

  return (
    <div>
      <PageHeader title="Subjects" count={active.length} actions={<button className="primary" onClick={() => setForm({ code: '', name: '', level: '', templateId: templates[0]?.id ?? null, isActive: true })}><Plus size={16} />Add subject</button>} />
      <div className="space-y-4">
        {groups.filter(([, list]) => list.length).map(([name, list]) => (
          <section key={name} className="card overflow-hidden">
            <h2 className="px-4 pt-3 text-xs font-semibold uppercase tracking-wider text-slate-400">{name}</h2>
            <div className="mt-1">{list.map(row)}</div>
          </section>
        ))}
        {active.length === 0 && <div className="card"><EmptyState icon={BookOpen} title="No subjects" /></div>}
        {inactive.length > 0 && (
          <div>
            <button className="ghost !px-2 text-sm" onClick={() => setShowInactive(!showInactive)}><ChevronDown size={15} className={showInactive ? 'rotate-180' : ''} />{inactive.length} inactive</button>
            {showInactive && <section className="card mt-2 overflow-hidden opacity-70">{inactive.map(row)}</section>}
          </div>
        )}
      </div>
      {form && (
        <Modal size="md" title={form.id ? 'Edit subject' : 'Add subject'} onClose={() => setForm(null)} footer={<><button className="ghost" onClick={() => setForm(null)}>Cancel</button><button className="primary" form="subject-form">Save</button></>}>
          <form id="subject-form" className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); void save(form); }}>
            <Field label="Name" className="sm:col-span-2"><input className="field mt-1.5" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength={2} autoFocus /></Field>
            <Field label="Code"><input className="field mt-1.5 uppercase" value={form.code} maxLength={12} pattern="[A-Za-z0-9]+" title="Letters and digits only" onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} required /></Field>
            <Field label="CAF number" hint="e.g. CAF 1"><input className="field mt-1.5" value={form.level} maxLength={20} onChange={(e) => setForm({ ...form, level: e.target.value })} /></Field>
            <label className="flex items-center gap-2 text-sm text-slate-600 sm:col-span-2"><input type="checkbox" className="h-4 w-4" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />Active</label>
          </form>
        </Modal>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ Paper formats (templates)

type TemplateDraft = { id?: number; code: string; name: string; description: string; isActive: boolean; config: TemplateConfig };

function Group({ title, children, open = false }: { title: string; children: ReactNode; open?: boolean }) {
  return (
    <details open={open} className="group rounded-xl border border-slate-200">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-4 text-sm font-semibold text-ink">{title}<ChevronDown size={16} className="text-slate-400 transition group-open:rotate-180" /></summary>
      <div className="grid gap-4 px-4 pb-4 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
    </details>
  );
}

function TemplateEditor({ initial, onClose, onSaved }: { initial: TemplateDraft; onClose(): void; onSaved(): void }) {
  const [d, setD] = useState(initial);
  const [json, setJson] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const cfg = d.config;
  const set = <K extends keyof TemplateConfig>(key: K, patch: Partial<TemplateConfig[K]>) => setD({ ...d, config: { ...cfg, [key]: { ...(cfg[key] as object), ...patch } } });
  const num = (v: string) => Number(v);
  const n = (label: string, value: number, onChange: (v: number) => void, step = 0.5) => (
    <Field label={label}><input className="field mt-1.5" type="number" step={step} min={0} value={value} onChange={(e) => onChange(num(e.target.value))} /></Field>
  );
  const ty = cfg.typography;
  const setTy = (patch: Partial<TemplateConfig['typography']>) => set('typography', patch);

  async function save() {
    let config = cfg;
    if (json !== null) {
      try { config = JSON.parse(json); } catch { return toast.error('The JSON is not valid.'); }
    }
    setBusy(true);
    try {
      const body = JSON.stringify({ code: d.code, name: d.name, description: d.description, isActive: d.isActive, config });
      await api(d.id ? `/templates/${d.id}` : '/templates', { method: d.id ? 'PUT' : 'POST', body });
      toast.success('Format saved');
      onSaved();
    } catch (error) {
      toast.error(errorText(error, 'Unable to save the format'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal size="xl" title={d.id ? d.name || 'Paper format' : 'New paper format'} eyebrow="Finalised papers keep the layout they were printed with" onClose={onClose} footer={
      <>
        <button className="ghost mr-auto" onClick={() => { if (json === null) setJson(JSON.stringify(cfg, null, 2)); else { try { setD({ ...d, config: JSON.parse(json) }); setJson(null); } catch { toast.error('Fix the JSON first.'); } } }}>{json === null ? 'Advanced (JSON)' : 'Back to form'}</button>
        <button className="ghost" onClick={onClose}>Cancel</button>
        <button className="primary" disabled={busy} onClick={() => void save()}>{busy ? 'Saving…' : 'Save'}</button>
      </>
    }>
      {json !== null ? (
        <textarea className="field min-h-[60vh] font-mono text-xs" value={json} onChange={(e) => setJson(e.target.value)} spellCheck={false} />
      ) : (
        <div className="space-y-3">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Name"><input className="field mt-1.5" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} /></Field>
            <Field label="Code"><input className="field mt-1.5" value={d.code} onChange={(e) => setD({ ...d, code: e.target.value.toUpperCase() })} /></Field>
            <label className="flex items-end gap-2 pb-3 text-sm text-slate-600"><input type="checkbox" className="h-4 w-4" checked={d.isActive} onChange={(e) => setD({ ...d, isActive: e.target.checked })} />Active</label>
          </div>
          <Group title="Fonts & sizes (pt)" open>
            <Field label="Body font"><select className="field mt-1.5" value={cfg.fonts.body} onChange={(e) => set('fonts', { body: e.target.value as TemplateConfig['fonts']['body'] })}>{FONT_KEYS.map((f) => <option key={f} value={f}>{FONT_LABELS[f]}</option>)}</select></Field>
            <Field label="Heading font"><select className="field mt-1.5" value={cfg.fonts.heading} onChange={(e) => set('fonts', { heading: e.target.value as TemplateConfig['fonts']['heading'] })}>{FONT_KEYS.map((f) => <option key={f} value={f}>{FONT_LABELS[f]}</option>)}</select></Field>
            <Field label="Header font"><select className="field mt-1.5" value={cfg.fonts.runningHeader} onChange={(e) => set('fonts', { runningHeader: e.target.value as TemplateConfig['fonts']['runningHeader'] })}>{FONT_KEYS.map((f) => <option key={f} value={f}>{FONT_LABELS[f]}</option>)}</select></Field>
            {n('Line height', cfg.fonts.lineHeight, (v) => set('fonts', { lineHeight: v }), 0.05)}
            {n('Exam title', ty.titleSizePt, (v) => setTy({ titleSizePt: v }))}
            {n('Paper name', ty.paperNameSizePt, (v) => setTy({ paperNameSizePt: v }))}
            {n('Date, marks, time', ty.metaSizePt, (v) => setTy({ metaSizePt: v }))}
            {n('Body text', cfg.fonts.sizePt, (v) => set('fonts', { sizePt: v }))}
            {n('Instructions', ty.instructionsSizePt, (v) => setTy({ instructionsSizePt: v }))}
            {n('SECTION bars', ty.sectionSizePt, (v) => setTy({ sectionSizePt: v }))}
            {n('QUESTION headings', ty.questionHeadingSizePt, (v) => setTy({ questionHeadingSizePt: v }))}
            {n('Running header', ty.runningHeaderSizePt, (v) => setTy({ runningHeaderSizePt: v }))}
          </Group>
          <Group title="Spacing (pt) & page margins (mm)">
            {n('Between paragraphs', ty.paragraphSpacingPt, (v) => setTy({ paragraphSpacingPt: v }))}
            {n('Between sub-parts', ty.partSpacingPt, (v) => setTy({ partSpacingPt: v }))}
            {n('Stem to options', ty.stemToOptionsPt, (v) => setTy({ stemToOptionsPt: v }))}
            {n('Between options', ty.optionSpacingPt, (v) => setTy({ optionSpacingPt: v }))}
            {n('QUESTION heading to text', ty.headingToTextPt, (v) => setTy({ headingToTextPt: v }))}
            {n('SECTION bar to question', ty.sectionToQuestionPt, (v) => setTy({ sectionToQuestionPt: v }))}
            {n('Gap between questions (mm)', cfg.questions.gapMm, (v) => set('questions', { gapMm: v }))}
            <label className="flex items-end gap-2 pb-3 text-sm text-slate-600"><input type="checkbox" className="h-4 w-4" checked={ty.justify} onChange={(e) => setTy({ justify: e.target.checked })} />Justify body text</label>
            {n('Top margin', cfg.page.marginTopMm, (v) => set('page', { marginTopMm: v }))}
            {n('Bottom margin', cfg.page.marginBottomMm, (v) => set('page', { marginBottomMm: v }))}
            {n('Left margin', cfg.page.marginLeftMm, (v) => set('page', { marginLeftMm: v }))}
            {n('Right margin', cfg.page.marginRightMm, (v) => set('page', { marginRightMm: v }))}
          </Group>
          <Group title="Header & instructions">
            <Field label="Exam title line" className="sm:col-span-2"><input className="field mt-1.5" value={cfg.header.instituteLine} onChange={(e) => set('header', { instituteLine: e.target.value })} /></Field>
            <Field label="Date format"><select className="field mt-1.5" value={cfg.header.dateFormat} onChange={(e) => set('header', { dateFormat: e.target.value as TemplateConfig['header']['dateFormat'] })}>{DATE_FORMATS.map((f) => <option key={f}>{f}</option>)}</select></Field>
            <Field label="Instructions title" className="sm:col-span-2"><input className="field mt-1.5" value={cfg.instructions.title} onChange={(e) => set('instructions', { title: e.target.value })} /></Field>
            <label className="flex items-end gap-2 pb-3 text-sm text-slate-600"><input type="checkbox" className="h-4 w-4" checked={cfg.instructions.boxed} onChange={(e) => set('instructions', { boxed: e.target.checked })} />Boxed</label>
            <Field label="Default instructions (one per line)" className="sm:col-span-2 lg:col-span-4"><textarea className="field mt-1.5" rows={3} value={cfg.instructions.lines.join('\n')} onChange={(e) => set('instructions', { lines: e.target.value.split('\n').slice(0, 20) })} /></Field>
          </Group>
          <Group title="Questions, marks & page header">
            <Field label="Question heading"><input className="field mt-1.5" value={cfg.questions.headingPattern} onChange={(e) => set('questions', { headingPattern: e.target.value })} /></Field>
            <Field label="Sub-question numbering"><select className="field mt-1.5" value={cfg.questions.partLabelStyle} onChange={(e) => set('questions', { partLabelStyle: e.target.value as LabelStyle })}>{LABEL_STYLES.map((s) => <option key={s} value={s}>{LABEL_STYLE_LABELS[s]}</option>)}</select></Field>
            <Field label="Parts inside a sub-question"><select className="field mt-1.5" value={cfg.questions.subPartLabelStyle} onChange={(e) => set('questions', { subPartLabelStyle: e.target.value as LabelStyle })}>{LABEL_STYLES.map((s) => <option key={s} value={s}>{LABEL_STYLE_LABELS[s]}</option>)}</select></Field>
            <Field label="Marks format"><input className="field mt-1.5" value={cfg.marks.pattern} onChange={(e) => set('marks', { pattern: e.target.value })} /></Field>
            <Field label="Marks format (1 mark)"><input className="field mt-1.5" value={cfg.marks.singularPattern} onChange={(e) => set('marks', { singularPattern: e.target.value })} /></Field>
            <Field label="Sections (one per line)"><textarea className="field mt-1.5" rows={2} value={cfg.sections.names.join('\n')} onChange={(e) => set('sections', { names: e.target.value.split('\n').filter((x) => x.trim()).slice(0, 6), enabled: e.target.value.trim().length > 0 })} /></Field>
            <Field label="Header left" className="sm:col-span-2" hint="{session}, {subject}, ┃ = bar"><input className="field mt-1.5" value={cfg.runningHeader.left} onChange={(e) => set('runningHeader', { left: e.target.value })} /></Field>
            <Field label="Header right" hint="{page} of {pages}"><input className="field mt-1.5" value={cfg.runningHeader.right} onChange={(e) => set('runningHeader', { right: e.target.value })} /></Field>
            <Field label="End text"><input className="field mt-1.5" value={cfg.endText} onChange={(e) => setD({ ...d, config: { ...cfg, endText: e.target.value } })} /></Field>
            <Field label="MCQ introduction" className="sm:col-span-2 lg:col-span-4"><input className="field mt-1.5" value={cfg.mcq.groupIntro} onChange={(e) => set('mcq', { groupIntro: e.target.value })} /></Field>
          </Group>
        </div>
      )}
    </Modal>
  );
}

export function AdminTemplates() {
  const [templates, setTemplates] = useState<TemplateDTO[]>([]);
  const [editing, setEditing] = useState<TemplateDraft | null>(null);
  const load = useCallback(async () => {
    try { setTemplates(await api<TemplateDTO[]>('/templates')); } catch (error) { toast.error(errorText(error, 'Unable to load formats')); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const draftOf = (t: TemplateDTO): TemplateDraft => ({ id: t.id, code: t.code, name: t.name, description: t.description, isActive: t.isActive, config: t.config });

  return (
    <div>
      <PageHeader title="Paper format" />
      <div className="card overflow-hidden">
        {templates.map((t) => (
          <div key={t.id} className={`list-row ${t.isActive ? '' : 'opacity-60'}`}>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-ink">{t.name}</p>
              <p className="truncate text-xs text-slate-400">{FONT_LABELS[t.config.fonts.body]} {t.config.fonts.sizePt} pt · {t.subjectCodes.length ? `${t.subjectCodes.length} subject${t.subjectCodes.length === 1 ? '' : 's'}` : 'no subjects'} · updated {ago(t.updatedAt)}</p>
            </div>
            {!t.isActive && <Pill>Inactive</Pill>}
            <IconButton label="Edit" icon={Pencil} onClick={() => setEditing(draftOf(t))} />
          </div>
        ))}
      </div>
      {editing && <TemplateEditor initial={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void load(); }} />}
    </div>
  );
}

// ------------------------------------------------------------------ Audit log

const ENTITY_TYPES = ['User', 'Question', 'Paper', 'Subject', 'PaperTemplate'];
const PAGE = 50;

export function AuditLog() {
  const [filters, setFilters] = useState({ action: '', username: '', entityType: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Paged<AuditLogDTO> | null>(null);
  const [open, setOpen] = useState<number | null>(null);

  const load = useCallback(async () => {
    const query = new URLSearchParams({ page: String(page), pageSize: String(PAGE) });
    Object.entries(filters).forEach(([k, v]) => v && query.set(k, v));
    try { setResult(await api<Paged<AuditLogDTO>>(`/audit?${query}`)); } catch (error) { toast.error(errorText(error, 'Unable to load the audit log')); }
  }, [filters, page]);
  useEffect(() => {
    const t = setTimeout(() => void load(), 250);
    return () => clearTimeout(t);
  }, [load]);
  const update = (patch: Partial<typeof filters>) => { setPage(1); setFilters({ ...filters, ...patch }); };
  const pages = result ? Math.max(1, Math.ceil(result.total / PAGE)) : 1;
  const pretty = (details: string) => { try { return JSON.stringify(JSON.parse(details), null, 2); } catch { return details; } };

  return (
    <div>
      <PageHeader title="Audit log" count={result?.total} />
      <div className="mb-4 flex flex-wrap gap-2">
        <SearchBox className="min-w-[160px] flex-1" value={filters.username} onChange={(v) => update({ username: v })} placeholder="User" />
        <select className="field !w-auto" value={filters.action} onChange={(e) => update({ action: e.target.value })} aria-label="Action"><option value="">All actions</option>{AUDIT_ACTIONS.map((a) => <option key={a} value={a}>{actionLabel(a)}</option>)}</select>
        <select className="field !w-auto" value={filters.entityType} onChange={(e) => update({ entityType: e.target.value })} aria-label="Record"><option value="">All records</option>{ENTITY_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
        <input className="field !w-auto" type="date" value={filters.from} onChange={(e) => update({ from: e.target.value })} aria-label="From" title="From" />
        <input className="field !w-auto" type="date" value={filters.to} onChange={(e) => update({ to: e.target.value })} aria-label="To" title="To" />
      </div>
      <div className="card overflow-hidden">
        {!result ? <p className="p-10 text-center text-sm text-slate-400">Loading…</p> : result.items.length === 0 ? <EmptyState icon={ScrollText} title="Nothing found" /> : result.items.map((a) => (
          <div key={a.id} className="border-b border-slate-100 last:border-0">
            <button className="list-row w-full !border-0 text-left" onClick={() => setOpen(open === a.id ? null : a.id)} aria-expanded={open === a.id}>
              <Pill tone={/FAILED|LOCKED|DELETE|PURGE/.test(a.action) ? 'red' : /DOWNLOAD/.test(a.action) ? 'blue' : /APPROVE|FINALIZE/.test(a.action) ? 'green' : 'slate'}>{actionLabel(a.action)}</Pill>
              <span className="min-w-0 flex-1 truncate text-sm text-slate-600">{a.username || 'system'}{a.entityId && <span className="text-slate-400"> · {a.entityType} #{a.entityId}</span>}</span>
              <span className="shrink-0 text-xs text-slate-400" title={new Date(a.createdAt).toLocaleString()}>{ago(a.createdAt)}</span>
            </button>
            {open === a.id && (a.details || a.ip) && <pre className="mx-4 mb-3 overflow-x-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs text-slate-600">{a.ip && `IP ${a.ip}\n`}{pretty(a.details)}</pre>}
          </div>
        ))}
      </div>
      <Pager page={page} pages={pages} onPage={setPage} />
    </div>
  );
}
