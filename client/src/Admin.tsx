import { useEffect, useState } from 'react';
import type { AuditLogDTO, Role, SubjectDTO, TemplateDTO, UserDTO } from '@skans/shared';
import { ClipboardList, FileText, Pencil, Plus, RotateCcw, ShieldCheck, Users } from 'lucide-react';
import { toast } from 'sonner';
import { api } from './api';

type Tab = 'users' | 'subjects' | 'templates' | 'audit';
type UserForm = { id?: number; username: string; fullName: string; email: string; role: Role; password: string; subjectIds: number[]; isActive: boolean };
type SubjectForm = { id?: number; code: string; name: string; level: string; templateId: number | null; isActive: boolean };

const emptyUser: UserForm = { username: '', fullName: '', email: '', role: 'TEACHER', password: 'SkansDemo2026', subjectIds: [], isActive: true };
const emptySubject: SubjectForm = { code: '', name: '', level: '', templateId: null, isActive: true };

export function Admin() {
  const [tab, setTab] = useState<Tab>('users');
  const [users, setUsers] = useState<UserDTO[]>([]);
  const [subjects, setSubjects] = useState<SubjectDTO[]>([]);
  const [templates, setTemplates] = useState<TemplateDTO[]>([]);
  const [audit, setAudit] = useState<AuditLogDTO[]>([]);
  const [userForm, setUserForm] = useState<UserForm | null>(null);
  const [subjectForm, setSubjectForm] = useState<SubjectForm | null>(null);
  const [templateForm, setTemplateForm] = useState<TemplateDTO | null>(null);
  const [templateJson, setTemplateJson] = useState('');
  const [auditFilters, setAuditFilters] = useState({ username: '', action: '', entityType: '' });

  async function load() {
    try {
      const [userRows, subjectRows, templateRows] = await Promise.all([
        api<UserDTO[]>('/users'),
        api<SubjectDTO[]>('/subjects'),
        api<TemplateDTO[]>('/templates'),
      ]);
      setUsers(userRows);
      setSubjects(subjectRows);
      setTemplates(templateRows);
      await loadAudit(auditFilters);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to load administration data');
    }
  }

  async function loadAudit(filters = auditFilters) {
    const query = new URLSearchParams({ pageSize: '50' });
    Object.entries(filters).forEach(([key, value]) => { if (value) query.set(key, value); });
    const result = await api<{ items: AuditLogDTO[] }>(`/audit?${query}`);
    setAudit(result.items);
  }

  useEffect(() => { void load(); }, []);

  async function saveUser(event: React.FormEvent) {
    event.preventDefault();
    if (!userForm) return;
    try {
      if (userForm.id) {
        await api(`/users/${userForm.id}`, { method: 'PUT', body: JSON.stringify({ fullName: userForm.fullName, email: userForm.email, role: userForm.role, subjectIds: userForm.subjectIds, isActive: userForm.isActive }) });
      } else {
        await api('/users', { method: 'POST', body: JSON.stringify(userForm) });
      }
      toast.success(userForm.id ? 'User updated' : 'User created');
      setUserForm(null);
      await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to save user'); }
  }

  async function saveSubject(event: React.FormEvent) {
    event.preventDefault();
    if (!subjectForm) return;
    try {
      const body = JSON.stringify({ code: subjectForm.code.toUpperCase(), name: subjectForm.name, level: subjectForm.level, templateId: subjectForm.templateId, isActive: subjectForm.isActive });
      await api(subjectForm.id ? `/subjects/${subjectForm.id}` : '/subjects', { method: subjectForm.id ? 'PUT' : 'POST', body });
      toast.success(subjectForm.id ? 'Subject updated' : 'Subject created');
      setSubjectForm(null);
      await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to save subject'); }
  }

  async function saveTemplate(event: React.FormEvent) {
    event.preventDefault();
    if (!templateForm) return;
    try {
      const config = JSON.parse(templateJson);
      await api(`/templates/${templateForm.id}`, { method: 'PUT', body: JSON.stringify({ code: templateForm.code, name: templateForm.name, description: templateForm.description, isActive: templateForm.isActive, config }) });
      toast.success('Template updated');
      setTemplateForm(null);
      await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to save template'); }
  }

  async function reset(user: UserDTO) {
    const password = window.prompt(`Temporary password for ${user.username}`, 'SkansTemp2026');
    if (!password) return;
    try {
      await api(`/users/${user.id}/reset-password`, { method: 'POST', body: JSON.stringify({ newPassword: password }) });
      toast.success(`Password reset for ${user.username}`);
      await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to reset password'); }
  }

  async function unlock(user: UserDTO) {
    try {
      await api(`/users/${user.id}/unlock`, { method: 'POST' });
      toast.success(`${user.username} unlocked`);
      await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to unlock user'); }
  }

  const tabs: { key: Tab; label: string; icon: typeof Users }[] = [
    { key: 'users', label: 'Users', icon: Users },
    { key: 'subjects', label: 'Subjects', icon: ClipboardList },
    { key: 'templates', label: 'Templates', icon: FileText },
    { key: 'audit', label: 'Audit log', icon: ShieldCheck },
  ];

  return <div className="mx-auto max-w-7xl">
    <p className="text-sm text-slate-500">System administration</p>
    <div className="flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-3xl font-semibold text-ink">Administration</h2><p className="mt-1 text-sm text-slate-500">Manage access, academic subjects, paper formats, and system activity.</p></div>{tab === 'users' && <button className="primary" onClick={() => setUserForm(emptyUser)}><Plus size={16} />Add user</button>}{tab === 'subjects' && <button className="primary" onClick={() => setSubjectForm(emptySubject)}><Plus size={16} />Add subject</button>}</div>
    <div className="mt-7 flex flex-wrap gap-2 rounded-2xl bg-white p-2 shadow-card">{tabs.map(({ key, label, icon: Icon }) => <button key={key} onClick={() => setTab(key)} className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium ${tab === key ? 'bg-navy text-white' : 'text-slate-600 hover:bg-slate-100'}`}><Icon size={16} />{label}</button>)}</div>

    {tab === 'users' && <section className="mt-5 rounded-2xl bg-white p-5 shadow-card"><div className="divide-y divide-slate-100">{users.map((user) => <div key={user.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p className="font-semibold">{user.fullName}</p><p className="text-xs text-slate-500">{user.username} · {user.role} · {user.isActive ? 'Active' : 'Inactive'}{user.lockedUntil ? ' · Locked' : ''}</p><p className="text-xs text-slate-400">{user.subjectIds.length} assigned subjects</p></div><div className="flex gap-2"><button className="action" title="Edit user" onClick={() => setUserForm({ id: user.id, username: user.username, fullName: user.fullName, email: user.email ?? '', role: user.role, password: '', subjectIds: user.subjectIds, isActive: user.isActive })}><Pencil size={16} /></button><button className="action" title="Reset password" onClick={() => void reset(user)}><RotateCcw size={16} /></button>{user.lockedUntil && <button className="action" title="Unlock user" onClick={() => void unlock(user)}>Unlock</button>}</div></div>)}</div></section>}
    {tab === 'subjects' && <section className="mt-5 rounded-2xl bg-white p-5 shadow-card"><div className="divide-y divide-slate-100">{subjects.map((subject) => <div key={subject.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p className="font-semibold">{subject.code} <span className="font-normal text-slate-600">· {subject.name}</span></p><p className="text-xs text-slate-500">{subject.level || 'No level'} · {subject.isActive ? 'Active' : 'Inactive'} · Template: {subject.templateName ?? 'Not assigned'}</p></div><button className="action" title="Edit subject" onClick={() => setSubjectForm({ id: subject.id, code: subject.code, name: subject.name, level: subject.level, templateId: subject.templateId, isActive: subject.isActive })}><Pencil size={16} /></button></div>)}</div></section>}
    {tab === 'templates' && <section className="mt-5 grid gap-5 lg:grid-cols-2">{templates.map((template) => <div key={template.id} className="rounded-2xl bg-white p-5 shadow-card"><div className="flex items-start justify-between gap-4"><div><p className="font-semibold">{template.name}</p><p className="mt-1 text-xs text-slate-500">{template.code} · Used by {template.subjectCodes.length} subjects</p><p className="mt-3 text-sm text-slate-600">{template.description}</p></div><button className="action" title="Edit template" onClick={() => { setTemplateForm(template); setTemplateJson(JSON.stringify(template.config, null, 2)); }}><Pencil size={16} /></button></div></div>)}</section>}
    {tab === 'audit' && <section className="mt-5 rounded-2xl bg-white p-5 shadow-card"><form className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]" onSubmit={(event) => { event.preventDefault(); void loadAudit(); }}><input className="field" placeholder="Username" value={auditFilters.username} onChange={(event) => setAuditFilters({ ...auditFilters, username: event.target.value })} /><input className="field" placeholder="Action, e.g. USER_UPDATE" value={auditFilters.action} onChange={(event) => setAuditFilters({ ...auditFilters, action: event.target.value })} /><input className="field" placeholder="Entity, e.g. User" value={auditFilters.entityType} onChange={(event) => setAuditFilters({ ...auditFilters, entityType: event.target.value })} /><button className="primary" type="submit">Filter</button></form><div className="mt-5 divide-y divide-slate-100">{audit.map((entry) => <div key={entry.id} className="py-3"><p className="text-sm font-semibold">{entry.action}</p><p className="text-xs text-slate-500">{entry.username} · {entry.entityType} #{entry.entityId} · {new Date(entry.createdAt).toLocaleString()}</p></div>)}</div></section>}

    {userForm && <form className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4" onSubmit={saveUser}><div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-6 shadow-2xl"><h3 className="text-xl font-semibold">{userForm.id ? 'Edit user' : 'Add user'}</h3><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="label">Username<input className="field mt-1 bg-slate-100" value={userForm.username} disabled={Boolean(userForm.id)} onChange={(event) => setUserForm({ ...userForm, username: event.target.value })} required /></label><label className="label">Full name<input className="field mt-1" value={userForm.fullName} onChange={(event) => setUserForm({ ...userForm, fullName: event.target.value })} required /></label><label className="label">Email<input className="field mt-1" type="email" value={userForm.email} onChange={(event) => setUserForm({ ...userForm, email: event.target.value })} /></label><label className="label">Role<select className="field mt-1" value={userForm.role} onChange={(event) => setUserForm({ ...userForm, role: event.target.value as Role })}><option value="TEACHER">Teacher</option><option value="HOA">HOA</option><option value="ADMIN">Admin</option></select></label>{!userForm.id && <label className="label sm:col-span-2">Temporary password<input className="field mt-1" value={userForm.password} onChange={(event) => setUserForm({ ...userForm, password: event.target.value })} required /></label>}<label className="label flex items-center gap-2"><input type="checkbox" checked={userForm.isActive} onChange={(event) => setUserForm({ ...userForm, isActive: event.target.checked })} />Active account</label></div><p className="mt-5 text-sm font-semibold">Assigned subjects</p><div className="mt-2 grid max-h-40 grid-cols-2 gap-2 overflow-auto rounded-lg border border-slate-200 p-3 sm:grid-cols-4">{subjects.map((subject) => <label key={subject.id} className="text-sm"><input type="checkbox" checked={userForm.subjectIds.includes(subject.id)} onChange={(event) => setUserForm({ ...userForm, subjectIds: event.target.checked ? [...userForm.subjectIds, subject.id] : userForm.subjectIds.filter((id) => id !== subject.id) })} /> <span className="ml-1">{subject.code}</span></label>)}</div><div className="mt-6 flex justify-end gap-2"><button type="button" className="secondary" onClick={() => setUserForm(null)}>Cancel</button><button className="primary" type="submit">Save user</button></div></div></form>}
    {subjectForm && <form className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4" onSubmit={saveSubject}><div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl"><h3 className="text-xl font-semibold">{subjectForm.id ? 'Edit subject' : 'Add subject'}</h3><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="label">Code<input className="field mt-1" value={subjectForm.code} onChange={(event) => setSubjectForm({ ...subjectForm, code: event.target.value })} required /></label><label className="label">Level<input className="field mt-1" value={subjectForm.level} onChange={(event) => setSubjectForm({ ...subjectForm, level: event.target.value })} /></label><label className="label sm:col-span-2">Name<input className="field mt-1" value={subjectForm.name} onChange={(event) => setSubjectForm({ ...subjectForm, name: event.target.value })} required /></label><label className="label sm:col-span-2">Paper template<select className="field mt-1" value={subjectForm.templateId ?? ''} onChange={(event) => setSubjectForm({ ...subjectForm, templateId: event.target.value ? Number(event.target.value) : null })}><option value="">Not assigned</option>{templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label><label className="label flex items-center gap-2"><input type="checkbox" checked={subjectForm.isActive} onChange={(event) => setSubjectForm({ ...subjectForm, isActive: event.target.checked })} />Active subject</label></div><div className="mt-6 flex justify-end gap-2"><button type="button" className="secondary" onClick={() => setSubjectForm(null)}>Cancel</button><button className="primary" type="submit">Save subject</button></div></div></form>}
    {templateForm && <form className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4" onSubmit={saveTemplate}><div className="max-h-[90vh] w-full max-w-4xl overflow-auto rounded-2xl bg-white p-6 shadow-2xl"><h3 className="text-xl font-semibold">Edit paper template</h3><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="label">Code<input className="field mt-1" value={templateForm.code} onChange={(event) => setTemplateForm({ ...templateForm, code: event.target.value })} required /></label><label className="label">Name<input className="field mt-1" value={templateForm.name} onChange={(event) => setTemplateForm({ ...templateForm, name: event.target.value })} required /></label><label className="label sm:col-span-2">Description<input className="field mt-1" value={templateForm.description} onChange={(event) => setTemplateForm({ ...templateForm, description: event.target.value })} /></label></div><label className="label mt-4 block">Configuration JSON<textarea className="field mt-1 min-h-[420px] font-mono text-xs" value={templateJson} onChange={(event) => setTemplateJson(event.target.value)} /></label><p className="mt-2 text-xs text-slate-500">The server validates this configuration before saving. If JSON is incomplete while editing, finish it before submitting.</p><div className="mt-6 flex justify-end gap-2"><button type="button" className="secondary" onClick={() => setTemplateForm(null)}>Cancel</button><button className="primary" type="submit">Save template</button></div></div></form>}
  </div>;
}
