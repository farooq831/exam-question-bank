import { useEffect, useState } from 'react';
import type { DashboardDTO } from '@skans/shared';
import { Navigate, NavLink, Outlet, Route, Routes, useNavigate } from 'react-router-dom';
import { LayoutDashboard, LogOut, Menu, KeyRound, ShieldCheck, Library, FilePlus2, Users, ClipboardCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from './auth';
import { api } from './api';
import { QuestionBank } from './QuestionBank';
import { PaperBuilder } from './PaperBuilder';
import { Admin } from './Admin';
import { ReviewQueue } from './ReviewQueue';

function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/" replace />;
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await login(username, password);
      toast.success('Welcome back');
      navigate('/');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to sign in');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-navy via-[#23466f] to-[#0f1c2f] px-4 py-10">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl md:grid-cols-[1.05fr_.95fr]">
        <section className="hidden bg-navy p-10 text-white md:block">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-gold text-xl font-black">S</div>
            <div><p className="text-xl font-bold tracking-wide">SKANS</p><p className="text-xs uppercase tracking-[.28em] text-blue-100">Question Bank</p></div>
          </div>
          <div className="mt-28">
            <p className="text-sm font-semibold uppercase tracking-[.2em] text-gold">Academic operations</p>
            <h1 className="mt-4 text-4xl font-semibold leading-tight">Build better papers, together.</h1>
            <p className="mt-5 max-w-sm leading-7 text-blue-100">A focused workspace for trusted questions, academic review, and professional CAF examination papers.</p>
          </div>
        </section>
        <form onSubmit={submit} className="p-8 sm:p-12">
          <div className="md:hidden"><p className="text-xl font-bold text-navy">SKANS</p><p className="text-xs uppercase tracking-[.25em] text-slate-500">Question Bank</p></div>
          <h2 className="mt-10 text-2xl font-semibold text-ink md:mt-16">Sign in</h2>
          <p className="mt-2 text-sm text-slate-500">Use your school account to continue.</p>
          <label className="mt-8 block text-sm font-medium text-slate-700">Username<input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none ring-navy/20 focus:ring-4" required /></label>
          <label className="mt-5 block text-sm font-medium text-slate-700">Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none ring-navy/20 focus:ring-4" required /></label>
          <button disabled={busy} className="mt-8 w-full rounded-xl bg-navy px-4 py-3.5 font-semibold text-white transition hover:bg-navy/90 disabled:cursor-not-allowed disabled:opacity-60">{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
      </div>
    </main>
  );
}

function ChangePassword() {
  const { changePassword } = useAuth();
  const [values, setValues] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try { await changePassword(values.currentPassword, values.newPassword, values.confirmPassword); toast.success('Password changed'); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to change password'); }
    finally { setBusy(false); }
  }
  return <div className="max-w-xl rounded-2xl bg-white p-8 shadow-card"><div className="flex items-center gap-3"><KeyRound className="text-gold" /><h2 className="text-xl font-semibold text-ink">Change password</h2></div><p className="mt-2 text-sm text-slate-500">Use at least 10 characters containing a letter and a number.</p><form onSubmit={submit} className="mt-6 space-y-4">{(['currentPassword', 'newPassword', 'confirmPassword'] as const).map((key) => <label key={key} className="block text-sm font-medium text-slate-700">{key === 'currentPassword' ? 'Current password' : key === 'newPassword' ? 'New password' : 'Confirm new password'}<input type="password" value={values[key]} onChange={(e) => setValues({ ...values, [key]: e.target.value })} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5" required /></label>)}<button disabled={busy} className="rounded-lg bg-navy px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{busy ? 'Saving…' : 'Save password'}</button></form></div>;
}

function Shell() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  async function signOut() { await logout(); navigate('/login'); }
  return <div className="min-h-screen bg-mist text-ink"><aside className={`fixed inset-y-0 left-0 z-40 w-72 bg-navy p-6 text-white transition-transform md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-lg bg-gold font-black">S</div><div><p className="font-bold">SKANS</p><p className="text-[10px] uppercase tracking-[.2em] text-blue-100">Question Bank</p></div></div>          <nav className="mt-12 space-y-2"><NavLink to="/" onClick={() => setOpen(false)} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-4 py-3 text-sm ${isActive ? 'bg-white/15 font-semibold' : 'text-blue-100 hover:bg-white/10'}`}><LayoutDashboard size={18} />Dashboard</NavLink>{(user?.role === 'ADMIN' || user?.role === 'HOA' || user?.role === 'TEACHER') && <NavLink to="/questions" onClick={() => setOpen(false)} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-4 py-3 text-sm ${isActive ? 'bg-white/15 font-semibold' : 'text-blue-100 hover:bg-white/10'}`}><Library size={18} />Question bank</NavLink>}{(user?.role === 'HOA' || user?.role === 'ADMIN') && <NavLink to="/review" onClick={() => setOpen(false)} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-4 py-3 text-sm ${isActive ? 'bg-white/15 font-semibold' : 'text-blue-100 hover:bg-white/10'}`}><ClipboardCheck size={18} />Review queue</NavLink>}{(user?.role === 'HOA' || user?.role === 'ADMIN') && <NavLink to="/papers" onClick={() => setOpen(false)} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-4 py-3 text-sm ${isActive ? 'bg-white/15 font-semibold' : 'text-blue-100 hover:bg-white/10'}`}><FilePlus2 size={18} />Paper builder</NavLink>}{user?.role === 'ADMIN' && <NavLink to="/admin" onClick={() => setOpen(false)} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-4 py-3 text-sm ${isActive ? 'bg-white/15 font-semibold' : 'text-blue-100 hover:bg-white/10'}`}><Users size={18} />Administration</NavLink>}</nav><div className="absolute bottom-6 left-6 right-6 border-t border-white/10 pt-5"><div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-full bg-white/15 text-sm font-semibold">{user?.fullName.slice(0, 1)}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{user?.fullName}</p><p className="text-xs text-blue-200">{user?.role}</p></div><button onClick={signOut} title="Sign out" className="text-blue-200 hover:text-white"><LogOut size={18} /></button></div></div></aside><div className="md:pl-72"><header className="flex h-20 items-center justify-between border-b border-slate-200 bg-white px-5 sm:px-8"><button className="md:hidden" onClick={() => setOpen(!open)} aria-label="Open menu"><Menu /></button><div><p className="text-sm text-slate-500">Academic workspace</p><h1 className="text-lg font-semibold text-ink">{user?.role === 'ADMIN' ? 'Administration' : user?.role === 'HOA' ? 'Head of Academics' : 'Teaching workspace'}</h1></div><NavLink to="/change-password" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" title="Change password"><KeyRound size={19} /></NavLink></header><main className="p-5 sm:p-8"><Outlet /></main></div></div>;
}

function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardDTO | null>(null);
  useEffect(() => { void api<DashboardDTO>('/dashboard').then(setData).catch(() => undefined); }, []);
  return <div className="mx-auto max-w-6xl"><div className="rounded-2xl bg-gradient-to-r from-navy to-[#315b87] p-7 text-white shadow-card"><div className="flex items-start justify-between gap-5"><div><p className="text-sm text-blue-100">Good to see you</p><h2 className="mt-1 text-3xl font-semibold">{user?.fullName}</h2><p className="mt-3 max-w-xl text-sm leading-6 text-blue-100">Your question bank workspace is ready. Counts below reflect the server-enforced subject scope.</p></div><ShieldCheck className="hidden text-gold sm:block" size={42} /></div></div><div className="mt-7 grid gap-5 sm:grid-cols-4"><div className="rounded-2xl bg-white p-6 shadow-card"><p className="text-sm text-slate-500">Draft</p><p className="mt-2 text-2xl font-semibold text-ink">{data?.totals.DRAFT ?? '—'}</p></div><div className="rounded-2xl bg-white p-6 shadow-card"><p className="text-sm text-slate-500">Submitted</p><p className="mt-2 text-2xl font-semibold text-amber-700">{data?.totals.SUBMITTED ?? '—'}</p></div><div className="rounded-2xl bg-white p-6 shadow-card"><p className="text-sm text-slate-500">Approved</p><p className="mt-2 text-2xl font-semibold text-emerald-700">{data?.totals.APPROVED ?? '—'}</p></div><div className="rounded-2xl bg-white p-6 shadow-card"><p className="text-sm text-slate-500">{user?.role === 'HOA' ? 'Pending review' : 'Rejected'}</p><p className="mt-2 text-2xl font-semibold text-red-700">{user?.role === 'HOA' ? data?.pendingReview ?? '—' : data?.myRejected ?? '—'}</p></div></div></div>;
}

function ForcedPasswordChange() {
  const { logout } = useAuth();
  return <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-mist p-4"><div className="max-w-xl rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Your password was set by the administrator. Choose a new password to continue.</div><ChangePassword /><button onClick={() => void logout()} className="text-sm font-semibold text-slate-500 hover:text-ink">Sign out</button></main>;
}

function Protected() { const { user, loading } = useAuth(); if (loading) return <div className="grid min-h-screen place-items-center text-slate-500">Loading workspace…</div>; if (user?.mustChangePassword) return <ForcedPasswordChange />; return user ? <Routes><Route element={<Shell />}><Route path="/" element={<Dashboard />} /><Route path="/questions" element={<QuestionBank />} /><Route path="/review" element={user.role === 'HOA' || user.role === 'ADMIN' ? <ReviewQueue /> : <Navigate to="/" replace />} /><Route path="/papers" element={user.role === 'HOA' || user.role === 'ADMIN' ? <PaperBuilder /> : <Navigate to="/" replace />} /><Route path="/admin" element={user.role === 'ADMIN' ? <Admin /> : <Navigate to="/" replace />} /><Route path="/change-password" element={<ChangePassword />} /></Route></Routes> : <Navigate to="/login" replace />; }

export function App() { return <Routes><Route path="/login" element={<Login />} /><Route path="/*" element={<Protected />} /></Routes>; }
