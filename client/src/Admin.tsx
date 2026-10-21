import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  AUDIT_ACTIONS,
  DATE_FORMATS,
  FONT_KEYS,
  FONT_LABELS,
  ROLE_LABELS,
  ROLES,
  type AuditLogDTO,
  type Paged,
  type Role,
  type SubjectDTO,
  type TemplateConfig,
  type TemplateDTO,
  type UserDTO,
} from '@skans/shared';
import { ChevronDown, ChevronUp, Copy, KeyRound, Lock, Pencil, Plus, Power, Search, Unlock } from 'lucide-react';
import { toast } from 'sonner';
import { api } from './api';
import { useAuth } from './auth';
import { Confirm } from './components/Confirm';
import { Modal } from './components/Modal';
import { actionLabel } from './Dashboard';

const errorText = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback);

function PageHeader({ eyebrow, title, intro, action }: { eyebrow: string; title: string; intro: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-sm text-slate-500">{eyebrow}</p><h2 className="text-3xl font-semibold text-ink">{title}</h2><p className="mt-1 text-sm text-slate-500">{intro}</p></div>
      {action}
    </div>
  );
}

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

export function AdminUsers() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<UserDTO[]>([]);
  const [subjects, setSubjects] = useState<SubjectDTO[]>([]);
  const [form, setForm] = useState<UserForm | null>(null);
  const [reset, setReset] = useState<{ user: UserDTO; password: string } | null>(null);
  const [toggle, setToggle] = useState<UserDTO | null>(null);
  const [filter, setFilter] = useState({ q: '', role: '', status: '' });
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
    (!filter.q || `${u.username} ${u.fullName} ${u.email ?? ''}`.toLowerCase().includes(filter.q.toLowerCase())) &&
    (!filter.role || u.role === filter.role) &&
    (!filter.status || (filter.status === 'active' ? u.isActive : filter.status === 'inactive' ? !u.isActive : !!u.lockedUntil)),
  );

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!form) return;
    setBusy(true);
    try {
      const body = { fullName: form.fullName, email: form.email, role: form.role, subjectIds: form.subjectIds, isActive: form.isActive };
      if (form.id) await api(`/users/${form.id}`, { method: 'PUT', body: JSON.stringify(body) });
      else await api('/users', { method: 'POST', body: JSON.stringify({ ...body, username: form.username, password: form.password }) });
      toast.success(form.id ? 'User updated' : `User created. Give ${form.username} the temporary password; they must change it at first sign-in.`);
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
      toast.success(`Password reset for ${reset.user.username}. They have been signed out and must choose a new password.`);
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
      toast.success(u.isActive ? `${u.username} deactivated and signed out` : `${u.username} reactivated`);
      await load();
    } catch (error) {
      toast.error(errorText(error, 'Unable to change status'));
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader eyebrow="Administration" title="Users" intro="Accounts, roles and subject assignments. Teachers see only their assigned subjects; administrators see everything." action={<button className="primary" onClick={() => setForm({ username: '', fullName: '', email: '', role: 'TEACHER', password: temporaryPassword(), subjectIds: [], isActive: true })}><Plus size={16} />Add user</button>} />
      <div className="card mt-6 grid gap-3 p-4 sm:grid-cols-[1fr_180px_180px]">
        <label className="relative"><Search className="absolute left-3 top-3 text-slate-400" size={17} /><input className="field !pl-10" placeholder="Search name, username or email…" value={filter.q} onChange={(e) => setFilter({ ...filter, q: e.target.value })} aria-label="Search users" /></label>
        <select className="field" value={filter.role} onChange={(e) => setFilter({ ...filter, role: e.target.value })} aria-label="Role"><option value="">All roles</option>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select>
        <select className="field" value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })} aria-label="Status"><option value="">Any status</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="locked">Locked</option></select>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {shown.map((u) => (
          <article key={u.id} className={`card p-5 ${u.isActive ? '' : 'opacity-75'}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-ink">{u.fullName}{u.id === me?.id && <span className="ml-2 text-xs font-normal text-slate-400">(you)</span>}</p>
                <p className="text-sm text-slate-500">{u.username}{u.email ? ` · ${u.email}` : ''}</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <span className="badge bg-blue-50 text-navy">{ROLE_LABELS[u.role]}</span>
                {!u.isActive && <span className="badge bg-slate-100 text-slate-600">Inactive</span>}
                {u.lockedUntil && <span className="badge bg-red-50 text-red-700"><Lock size={11} className="mr-1" />Locked</span>}
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-500">Last sign-in: {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'never'}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {u.role === 'ADMIN' ? <span className="text-xs text-slate-500">All subjects (administrator)</span> : u.subjectIds.length ? u.subjectIds.map((id) => <span key={id} className="badge bg-slate-100 text-slate-600">{code(id)}</span>) : <span className="text-xs text-amber-700">No subjects assigned</span>}
            </div>
            <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
              <button className="secondary !min-h-9" onClick={() => setForm({ id: u.id, username: u.username, fullName: u.fullName, email: u.email ?? '', role: u.role, password: '', subjectIds: u.subjectIds, isActive: u.isActive })}><Pencil size={15} />Edit</button>
              <button className="secondary !min-h-9" onClick={() => setReset({ user: u, password: temporaryPassword() })}><KeyRound size={15} />Reset password</button>
              {u.lockedUntil && <button className="secondary !min-h-9" onClick={() => void unlock(u)}><Unlock size={15} />Unlock</button>}
              {u.id !== me?.id && <button className={`secondary !min-h-9 ${u.isActive ? 'text-red-700' : 'text-emerald-700'}`} onClick={() => setToggle(u)}><Power size={15} />{u.isActive ? 'Deactivate' : 'Activate'}</button>}
            </div>
          </article>
        ))}
        {shown.length === 0 && <div className="card p-8 text-center text-sm text-slate-500 md:col-span-2">No users match these filters.</div>}
      </div>

      {form && (
        <Modal eyebrow={form.id ? 'Edit user' : 'Add user'} title={form.id ? form.username : 'New account'} onClose={() => setForm(null)} footer={<><button className="secondary" onClick={() => setForm(null)}>Cancel</button><button className="primary" form="user-form" disabled={busy}>{busy ? 'Saving…' : 'Save user'}</button></>}>
          <form id="user-form" onSubmit={save} className="grid gap-4 sm:grid-cols-2">
            <label className="label">Username<input className="field mt-1 disabled:bg-slate-100" value={form.username} disabled={!!form.id} autoCapitalize="none" pattern="[a-z0-9_.]{3,40}" title="3–40 lowercase letters, digits, dot or underscore" onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })} required /></label>
            <label className="label">Full name<input className="field mt-1" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required minLength={2} /></label>
            <label className="label">Email (optional)<input className="field mt-1" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
            <label className="label">Role<select className="field mt-1" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select></label>
            {!form.id && (
              <label className="label sm:col-span-2">Temporary password
                <div className="mt-1 flex gap-2"><input className="field font-mono" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={10} /><button type="button" className="secondary shrink-0" onClick={() => setForm({ ...form, password: temporaryPassword() })}>Generate</button></div>
                <span className="mt-1 block text-xs font-normal text-slate-500">At least 10 characters with a letter and a digit. The user must change it at first sign-in.</span>
              </label>
            )}
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-600 sm:col-span-2"><input type="checkbox" className="h-4 w-4" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />Active account</label>
            <fieldset className="sm:col-span-2">
              <legend className="label">Assigned subjects</legend>
              {form.role === 'ADMIN' && <p className="mt-1 text-xs text-slate-500">Administrators can access every subject; assignments are optional.</p>}
              <div className="mt-2 grid max-h-56 grid-cols-2 gap-1 overflow-auto rounded-xl border border-slate-200 p-2 sm:grid-cols-3">
                {subjects.map((s) => (
                  <label key={s.id} className="flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm hover:bg-slate-50">
                    <input type="checkbox" className="h-4 w-4" checked={form.subjectIds.includes(s.id)} onChange={(e) => setForm({ ...form, subjectIds: e.target.checked ? [...form.subjectIds, s.id] : form.subjectIds.filter((id) => id !== s.id) })} />
                    <span><strong>{s.code}</strong>{!s.isActive && <span className="text-xs text-slate-400"> (inactive)</span>}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </form>
        </Modal>
      )}
      {reset && (
        <Modal size="md" eyebrow="Reset password" title={reset.user.fullName} onClose={() => setReset(null)} footer={<><button className="secondary" onClick={() => setReset(null)}>Cancel</button><button className="primary" onClick={() => void doReset()} disabled={reset.password.length < 10}>Reset password</button></>}>
          <p className="text-sm text-slate-600">The account is unlocked, all its sessions are signed out, and the user must choose a new password at next sign-in.</p>
          <label className="label mt-4">Temporary password
            <div className="mt-1 flex gap-2"><input className="field font-mono" value={reset.password} onChange={(e) => setReset({ ...reset, password: e.target.value })} /><button type="button" className="secondary shrink-0" onClick={() => void navigator.clipboard?.writeText(reset.password).then(() => toast.success('Copied'))} title="Copy"><Copy size={15} /></button></div>
          </label>
          <p className="mt-2 text-xs text-slate-500">Share it with the user privately (in person or by phone).</p>
        </Modal>
      )}
      <Confirm open={!!toggle} title={toggle?.isActive ? `Deactivate ${toggle?.username}?` : `Activate ${toggle?.username}?`} message={toggle?.isActive ? 'The user is signed out immediately and cannot sign in. Their questions and papers are kept.' : 'The user will be able to sign in again.'} confirmLabel={toggle?.isActive ? 'Deactivate' : 'Activate'} onConfirm={() => toggle && void setActive(toggle)} onCancel={() => setToggle(null)} />
    </div>
  );
}

// ------------------------------------------------------------------ Subjects

type SubjectForm = { id?: number; code: string; name: string; level: string; templateId: number | null; isActive: boolean };

export function AdminSubjects() {
  const [subjects, setSubjects] = useState<SubjectDTO[]>([]);
  const [templates, setTemplates] = useState<TemplateDTO[]>([]);
  const [form, setForm] = useState<SubjectForm | null>(null);
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
      toast.success(next.id ? 'Subject updated' : 'Subject created');
      setForm(null);
      await load();
    } catch (error) {
      toast.error(errorText(error, 'Unable to save subject'));
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader eyebrow="Administration" title="Subjects" intro="CAF subjects and the paper format each one uses by default." action={<button className="primary" onClick={() => setForm({ code: '', name: '', level: 'CAF', templateId: templates[0]?.id ?? null, isActive: true })}><Plus size={16} />Add subject</button>} />
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {subjects.map((s) => (
          <article key={s.id} className={`card flex flex-col p-5 ${s.isActive ? '' : 'opacity-70'}`}>
            <div className="flex items-start justify-between gap-2">
              <div><p className="text-lg font-semibold text-ink">{s.code}</p><p className="text-sm text-slate-600">{s.name}</p></div>
              <div className="flex flex-col items-end gap-1"><span className="badge bg-slate-100 text-slate-600">{s.level || '—'}</span>{!s.isActive && <span className="badge bg-slate-100 text-slate-500">Inactive</span>}</div>
            </div>
            <label className="label mt-4 text-xs">Default paper format
              <select className="field mt-1" value={s.templateId ?? ''} onChange={(e) => void save({ ...s, templateId: e.target.value ? Number(e.target.value) : null })}>
                <option value="">Not assigned</option>
                {templates.map((t) => <option key={t.id} value={t.id}>{t.name}{t.isActive ? '' : ' (inactive)'}</option>)}
              </select>
            </label>
            <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3"><button className="secondary !min-h-9" onClick={() => setForm({ id: s.id, code: s.code, name: s.name, level: s.level, templateId: s.templateId, isActive: s.isActive })}><Pencil size={15} />Edit</button></div>
          </article>
        ))}
      </div>
      {form && (
        <Modal size="md" eyebrow={form.id ? 'Edit subject' : 'Add subject'} title={form.code || 'New subject'} onClose={() => setForm(null)} footer={<><button className="secondary" onClick={() => setForm(null)}>Cancel</button><button className="primary" form="subject-form">Save subject</button></>}>
          <form id="subject-form" className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); void save(form); }}>
            <label className="label">Code<input className="field mt-1 uppercase" value={form.code} maxLength={12} pattern="[A-Za-z0-9]+" title="Letters and digits only" onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} required /></label>
            <label className="label">Level<input className="field mt-1" value={form.level} maxLength={20} onChange={(e) => setForm({ ...form, level: e.target.value })} /></label>
            <label className="label sm:col-span-2">Name<input className="field mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength={2} /></label>
            <label className="label sm:col-span-2">Default paper format<select className="field mt-1" value={form.templateId ?? ''} onChange={(e) => setForm({ ...form, templateId: e.target.value ? Number(e.target.value) : null })}><option value="">Not assigned</option>{templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-600"><input type="checkbox" className="h-4 w-4" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />Active (inactive subjects are hidden from new questions and papers)</label>
          </form>
        </Modal>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ Templates

type TemplateDraft = { id?: number; code: string; name: string; description: string; isActive: boolean; config: TemplateConfig };

function Field({ label, children, hint, wide = false }: { label: string; children: ReactNode; hint?: string; wide?: boolean }) {
  return <label className={`label ${wide ? 'sm:col-span-2' : ''}`}>{label}{children}{hint && <span className="mt-1 block text-xs font-normal text-slate-500">{hint}</span>}</label>;
}

function TemplateEditor({ initial, onClose, onSaved }: { initial: TemplateDraft; onClose(): void; onSaved(): void }) {
  const [d, setD] = useState(initial);
  const [tab, setTab] = useState<'basic' | 'json'>('basic');
  const [json, setJson] = useState(JSON.stringify(initial.config, null, 2));
  const [busy, setBusy] = useState(false);
  const cfg = d.config;
  const set = <K extends keyof TemplateConfig>(key: K, patch: Partial<TemplateConfig[K]>) => setD({ ...d, config: { ...cfg, [key]: { ...(cfg[key] as object), ...patch } } });
  const num = (v: string) => Number(v);

  function switchTab(next: 'basic' | 'json') {
    if (next === 'basic' && tab === 'json') {
      try { setD({ ...d, config: JSON.parse(json) }); } catch { return toast.error('The JSON is not valid yet. Fix it before switching back.'); }
    }
    if (next === 'json') setJson(JSON.stringify(cfg, null, 2));
    setTab(next);
  }

  async function save() {
    let config = cfg;
    if (tab === 'json') {
      try { config = JSON.parse(json); } catch { return toast.error('The JSON is not valid.'); }
    }
    setBusy(true);
    try {
      const body = JSON.stringify({ code: d.code, name: d.name, description: d.description, isActive: d.isActive, config });
      await api(d.id ? `/templates/${d.id}` : '/templates', { method: d.id ? 'PUT' : 'POST', body });
      toast.success(d.id ? 'Template saved. New previews and downloads use it; finalised papers keep their frozen layout.' : 'Template created');
      onSaved();
    } catch (error) {
      toast.error(errorText(error, 'Unable to save template'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal size="xl" eyebrow={d.id ? 'Paper template' : 'New paper template'} title={d.name || 'Template'} onClose={onClose} footer={<><button className="secondary" onClick={onClose}>Cancel</button><button className="primary" disabled={busy} onClick={() => void save()}>{busy ? 'Saving…' : 'Save template'}</button></>}>
      <p className="mb-4 rounded-xl bg-blue-50 p-3 text-xs leading-5 text-blue-900">Values here are provisional until the administration supplies the approved specification (fonts, sizes, margins, header/footer, marks format, numbering). Set them from the approved sample and check the result with a paper preview.</p>
      <fieldset className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name"><input className="field mt-1" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} /></Field>
          <Field label="Code" hint="Capital letters, digits, - or _"><input className="field mt-1" value={d.code} onChange={(e) => setD({ ...d, code: e.target.value.toUpperCase() })} /></Field>
          <Field label="Description" wide><input className="field mt-1" value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} /></Field>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-600"><input type="checkbox" className="h-4 w-4" checked={d.isActive} onChange={(e) => setD({ ...d, isActive: e.target.checked })} />Active (offered in the paper builder)</label>
        </div>
        <div className="flex gap-2 border-b border-slate-200">
          {(['basic', 'json'] as const).map((t) => <button key={t} type="button" onClick={() => switchTab(t)} className={`-mb-px min-h-11 border-b-2 px-4 text-sm font-semibold ${tab === t ? 'border-navy text-navy' : 'border-transparent text-slate-500'}`}>{t === 'basic' ? 'Common settings' : 'Advanced (JSON)'}</button>)}
        </div>
        {tab === 'json' ? (
          <div>
            <textarea className="field min-h-[420px] font-mono text-xs" value={json} onChange={(e) => setJson(e.target.value)} spellCheck={false} />
            <p className="mt-1 text-xs text-slate-500">All settings, validated by the server on save. Tokens: {'{n}'} question number, {'{session}'}, {'{subject}'}, {'{code}'}, {'{page}'}/{'{pages}'}, {'{batch}'}, {'{test}'}, {'{date}'}; marks {'{n}'} / {'{nn}'} (zero-padded).</p>
          </div>
        ) : (
          <div className="space-y-5">
            <section><h3 className="font-semibold">Fonts & page</h3><div className="mt-2 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Body font"><select className="field mt-1" value={cfg.fonts.body} onChange={(e) => set('fonts', { body: e.target.value as TemplateConfig['fonts']['body'] })}>{FONT_KEYS.map((f) => <option key={f} value={f}>{FONT_LABELS[f]}</option>)}</select></Field>
              <Field label="Heading font"><select className="field mt-1" value={cfg.fonts.heading} onChange={(e) => set('fonts', { heading: e.target.value as TemplateConfig['fonts']['heading'] })}>{FONT_KEYS.map((f) => <option key={f} value={f}>{FONT_LABELS[f]}</option>)}</select></Field>
              <Field label="Font size (pt)"><input className="field mt-1" type="number" step={0.5} min={8} max={14} value={cfg.fonts.sizePt} onChange={(e) => set('fonts', { sizePt: num(e.target.value) })} /></Field>
              <Field label="Line height"><input className="field mt-1" type="number" step={0.05} min={1} max={2} value={cfg.fonts.lineHeight} onChange={(e) => set('fonts', { lineHeight: num(e.target.value) })} /></Field>
              {(['marginTopMm', 'marginBottomMm', 'marginLeftMm', 'marginRightMm'] as const).map((k) => (
                <Field key={k} label={`${k.replace('margin', '').replace('Mm', '')} margin (mm)`}><input className="field mt-1" type="number" min={5} max={50} value={cfg.page[k]} onChange={(e) => set('page', { [k]: num(e.target.value) })} /></Field>
              ))}
            </div></section>
            <section><h3 className="font-semibold">Header</h3><div className="mt-2 grid gap-4 sm:grid-cols-2">
              <Field label="Institute / level line" wide><input className="field mt-1" value={cfg.header.instituteLine} onChange={(e) => set('header', { instituteLine: e.target.value })} /></Field>
              <Field label="Logo" hint="Uses the SKANS logo file in the branding folder (skans-logo.jpg)."><select className="field mt-1" value={cfg.header.logo} onChange={(e) => set('header', { logo: e.target.value as TemplateConfig['header']['logo'] })}><option value="skans">SKANS logo</option><option value="none">No logo</option></select></Field>
              <Field label="Date format"><select className="field mt-1" value={cfg.header.dateFormat} onChange={(e) => set('header', { dateFormat: e.target.value as TemplateConfig['header']['dateFormat'] })}>{DATE_FORMATS.map((f) => <option key={f}>{f}</option>)}</select></Field>
              <div className="flex flex-wrap gap-4 sm:col-span-2">{(['showBatch', 'showTeacher', 'showTest'] as const).map((k) => <label key={k} className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" className="h-4 w-4" checked={cfg.header[k]} onChange={(e) => set('header', { [k]: e.target.checked })} />Print {k.replace('show', '').toLowerCase()}</label>)}</div>
            </div></section>
            <section><h3 className="font-semibold">Instructions</h3><div className="mt-2 grid gap-4 sm:grid-cols-2">
              <Field label="Title"><input className="field mt-1" value={cfg.instructions.title} onChange={(e) => set('instructions', { title: e.target.value })} /></Field>
              <Field label="Numbering"><select className="field mt-1" value={cfg.instructions.numbering} onChange={(e) => set('instructions', { numbering: e.target.value as TemplateConfig['instructions']['numbering'] })}><option value="roman">(i), (ii)…</option><option value="number">1., 2.…</option><option value="none">None</option></select></Field>
              <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" className="h-4 w-4" checked={cfg.instructions.boxed} onChange={(e) => set('instructions', { boxed: e.target.checked })} />Draw a box around the instructions</label>
              <Field label="Default instructions (one per line)" wide hint="**bold**, {count} and {countWord} are supported."><textarea className="field mt-1" rows={4} value={cfg.instructions.lines.join('\n')} onChange={(e) => set('instructions', { lines: e.target.value.split('\n').slice(0, 20) })} /></Field>
            </div></section>
            <section><h3 className="font-semibold">Questions, sections & marks</h3><div className="mt-2 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Question heading" hint="e.g. QUESTION {n} or Q {n}."><input className="field mt-1" value={cfg.questions.headingPattern} onChange={(e) => set('questions', { headingPattern: e.target.value })} /></Field>
              <Field label="Heading style"><select className="field mt-1" value={cfg.questions.style} onChange={(e) => set('questions', { style: e.target.value as TemplateConfig['questions']['style'] })}><option value="block">Heading above the question</option><option value="hanging">Number beside the question</option></select></Field>
              <Field label="Gap between questions (mm)"><input className="field mt-1" type="number" min={0} max={30} value={cfg.questions.gapMm} onChange={(e) => set('questions', { gapMm: num(e.target.value) })} /></Field>
              <Field label="Marks format" hint="({nn} marks) prints (08 marks)."><input className="field mt-1" value={cfg.marks.pattern} onChange={(e) => set('marks', { pattern: e.target.value })} /></Field>
              <Field label="Marks format for 1 mark"><input className="field mt-1" value={cfg.marks.singularPattern} onChange={(e) => set('marks', { singularPattern: e.target.value })} /></Field>
              <Field label="Marks position"><select className="field mt-1" value={cfg.marks.position} onChange={(e) => set('marks', { position: e.target.value as TemplateConfig['marks']['position'] })}><option value="right">Right margin</option><option value="inline">After the text</option></select></Field>
              <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" className="h-4 w-4" checked={cfg.sections.enabled} onChange={(e) => set('sections', { enabled: e.target.checked })} />Use sections</label>
              <Field label="Section names (one per line)" wide><textarea className="field mt-1" rows={2} value={cfg.sections.names.join('\n')} onChange={(e) => set('sections', { names: e.target.value.split('\n').filter((x) => x.trim()).slice(0, 6) })} /></Field>
            </div></section>
            <section><h3 className="font-semibold">Running header / footer & page numbers</h3><div className="mt-2 grid gap-4 sm:grid-cols-3">
              <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" className="h-4 w-4" checked={cfg.runningHeader.enabled} onChange={(e) => set('runningHeader', { enabled: e.target.checked })} />Enabled</label>
              <Field label="Position"><select className="field mt-1" value={cfg.runningHeader.position} onChange={(e) => set('runningHeader', { position: e.target.value as 'top' | 'bottom' })}><option value="top">Top of page</option><option value="bottom">Bottom of page</option></select></Field>
              <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" className="h-4 w-4" checked={cfg.runningHeader.skipFirstPage} onChange={(e) => set('runningHeader', { skipFirstPage: e.target.checked })} />Not on page 1</label>
              {(['left', 'center', 'right'] as const).map((k) => <Field key={k} label={`${k[0].toUpperCase()}${k.slice(1)} text`}><input className="field mt-1" value={cfg.runningHeader[k]} onChange={(e) => set('runningHeader', { [k]: e.target.value })} /></Field>)}
              <Field label="End text" hint="e.g. (THE END); leave empty for none."><input className="field mt-1" value={cfg.endText} onChange={(e) => setD({ ...d, config: { ...cfg, endText: e.target.value } })} /></Field>
            </div></section>
          </div>
        )}
      </fieldset>
    </Modal>
  );
}

export function AdminTemplates() {
  const [templates, setTemplates] = useState<TemplateDTO[]>([]);
  const [editing, setEditing] = useState<TemplateDraft | null>(null);
  const load = useCallback(async () => {
    try { setTemplates(await api<TemplateDTO[]>('/templates')); } catch (error) { toast.error(errorText(error, 'Unable to load templates')); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const draftOf = (t: TemplateDTO): TemplateDraft => ({ id: t.id, code: t.code, name: t.name, description: t.description, isActive: t.isActive, config: t.config });

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader eyebrow="Paper formats" title="Templates" intro="Layout, fonts, header, instructions, marks and page numbering of each paper format." />
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {templates.map((t) => (
          <article key={t.id} className="card flex flex-col p-5">
            <div className="flex flex-wrap items-center gap-2"><p className="text-lg font-semibold text-ink">{t.name}</p>{!t.isActive && <span className="badge bg-slate-100 text-slate-500">Inactive</span>}</div>
            <p className="text-xs text-slate-500">{t.code} · {FONT_LABELS[t.config.fonts.body]} {t.config.fonts.sizePt} pt · updated {new Date(t.updatedAt).toLocaleDateString()}</p>
            <p className="mt-2 flex-1 text-sm text-slate-600">{t.description}</p>
            <p className="mt-2 text-xs text-slate-500">Used by: {t.subjectCodes.length ? t.subjectCodes.join(', ') : 'no subjects'}</p>
            <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
              <button className="secondary !min-h-9" onClick={() => setEditing(draftOf(t))}><Pencil size={15} />Edit</button>
              <button className="secondary !min-h-9" onClick={() => setEditing({ ...draftOf(t), id: undefined, code: `${t.code}_COPY`.slice(0, 40), name: `${t.name} (copy)` })}><Copy size={15} />Duplicate</button>
            </div>
          </article>
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
    <div className="mx-auto max-w-6xl">
      <PageHeader eyebrow="Administration" title="Audit log" intro="Sign-ins, changes, reviews, finalisation and every PDF download." />
      <div className="card mt-6 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
        <select className="field" value={filters.action} onChange={(e) => update({ action: e.target.value })} aria-label="Action"><option value="">All actions</option>{AUDIT_ACTIONS.map((a) => <option key={a} value={a}>{actionLabel(a)}</option>)}</select>
        <input className="field" placeholder="Username contains…" value={filters.username} onChange={(e) => update({ username: e.target.value })} aria-label="Username" />
        <select className="field" value={filters.entityType} onChange={(e) => update({ entityType: e.target.value })} aria-label="Entity"><option value="">All records</option>{ENTITY_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
        <input className="field" type="date" value={filters.from} onChange={(e) => update({ from: e.target.value })} aria-label="From date" />
        <input className="field" type="date" value={filters.to} onChange={(e) => update({ to: e.target.value })} aria-label="To date" />
      </div>
      <div className="card mt-4 divide-y divide-slate-100">
        {!result ? <p className="p-6 text-sm text-slate-500">Loading…</p> : result.items.length === 0 ? <p className="p-6 text-sm text-slate-500">No entries match these filters.</p> : result.items.map((a) => (
          <div key={a.id} className="p-4">
            <button className="flex w-full flex-wrap items-center justify-between gap-2 text-left" onClick={() => setOpen(open === a.id ? null : a.id)} aria-expanded={open === a.id}>
              <span className="min-w-0">
                <span className={`badge mr-2 ${/FAILED|LOCKED/.test(a.action) ? 'bg-red-50 text-red-700' : /DOWNLOAD/.test(a.action) ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-700'}`}>{actionLabel(a.action)}</span>
                <span className="text-sm text-slate-600">{a.username || 'system'}{a.entityId && ` · ${a.entityType} #${a.entityId}`}</span>
              </span>
              <span className="flex items-center gap-2 text-xs text-slate-500">{new Date(a.createdAt).toLocaleString()}{a.details && (open === a.id ? <ChevronUp size={15} /> : <ChevronDown size={15} />)}</span>
            </button>
            {open === a.id && (a.details || a.ip) && <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs text-slate-700">{a.ip && `IP: ${a.ip}\n`}{pretty(a.details)}</pre>}
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
        <span>{result?.total ?? 0} entries</span>
        <div className="flex items-center gap-2"><button className="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page} of {pages}</span><button className="secondary" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button></div>
      </div>
    </div>
  );
}
