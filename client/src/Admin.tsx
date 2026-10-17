import { useEffect, useState } from 'react';
import type { AuditLogDTO, SubjectDTO, UserDTO } from '@skans/shared';
import { Users, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { api } from './api';

export function Admin() {
  const [users, setUsers] = useState<UserDTO[]>([]);
  const [subjects, setSubjects] = useState<SubjectDTO[]>([]);
  const [audit, setAudit] = useState<AuditLogDTO[]>([]);
  async function load() {
    try {
      const [userRows, subjectRows, logs] = await Promise.all([
        api<UserDTO[]>('/users'),
        api<SubjectDTO[]>('/subjects'),
        api<{ items: AuditLogDTO[] }>('/audit?pageSize=20'),
      ]);
      setUsers(userRows); setSubjects(subjectRows); setAudit(logs.items);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to load administration data'); }
  }
  useEffect(() => { void load(); }, []);
  async function reset(user: UserDTO) {
    const password = window.prompt(`Temporary password for ${user.username}`, 'SkansTemp2026');
    if (!password) return;
    try { await api(`/users/${user.id}/reset-password`, { method: 'POST', body: JSON.stringify({ newPassword: password }) }); toast.success(`Password reset for ${user.username}`); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to reset password'); }
  }
  return <div className="mx-auto max-w-7xl"><p className="text-sm text-slate-500">System administration</p><h2 className="text-3xl font-semibold text-ink">Administration</h2><div className="mt-7 grid gap-5 lg:grid-cols-2"><section className="rounded-2xl bg-white p-5 shadow-card"><div className="flex items-center gap-3"><Users className="text-gold" /><h3 className="font-semibold">Users</h3></div><p className="mt-1 text-sm text-slate-500">{users.length} accounts · {subjects.length} subjects</p><div className="mt-4 divide-y divide-slate-100">{users.map((user) => <div key={user.id} className="flex items-center justify-between gap-3 py-3"><div><p className="text-sm font-semibold">{user.fullName}</p><p className="text-xs text-slate-500">{user.username} · {user.role} · {user.isActive ? 'Active' : 'Inactive'}</p></div><button onClick={() => void reset(user)} className="action" title="Reset password"><RotateCcw size={16} /></button></div>)}</div></section><section className="rounded-2xl bg-white p-5 shadow-card"><h3 className="font-semibold">Audit log</h3><div className="mt-4 divide-y divide-slate-100">{audit.map((entry) => <div key={entry.id} className="py-3"><p className="text-sm font-semibold">{entry.action}</p><p className="text-xs text-slate-500">{entry.username} · {entry.entityType} #{entry.entityId} · {new Date(entry.createdAt).toLocaleString()}</p></div>)}</div></section></div></div>;
}
