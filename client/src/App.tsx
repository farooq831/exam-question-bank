import { useEffect, useState } from 'react';
import { Navigate, NavLink, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { BookOpen, ClipboardCheck, FilePlus2, FileText, KeyRound, LayoutDashboard, Library, LogOut, Menu, PanelLeftClose, PanelLeftOpen, ScrollText, ShieldCheck, Users, X, type LucideIcon } from 'lucide-react';
import { ROLE_LABELS, type Role } from '@skans/shared';
import { toast } from 'sonner';
import { useAuth } from './auth';
import { PasswordInput } from './components/PasswordInput';
import { QuestionBank } from './QuestionBank';
import { PaperBuilder } from './PaperBuilder';
import { AdminSubjects, AdminTemplates, AdminUsers, AuditLog } from './Admin';
import { ReviewQueue } from './ReviewQueue';
import { Dashboard } from './Dashboard';

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
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-navy via-[#27406b] to-[#0f1c2f] px-4 py-10">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl md:grid-cols-[1.05fr_.95fr]">
        <section className="hidden bg-navy p-10 text-white md:block">
          <img src="/branding/skans-logo-dark.png" alt="SKANS School of Accountancy" className="w-56 rounded-lg" />
          <p className="mt-3 text-xs uppercase tracking-[.28em] text-blue-100">Question Bank</p>
          <div className="mt-28">
            <p className="text-sm font-semibold uppercase tracking-[.2em] text-gold">Academic operations</p>
            <h1 className="mt-4 text-4xl font-semibold leading-tight">Build better papers, together.</h1>
            <p className="mt-5 max-w-sm leading-7 text-blue-100">A focused workspace for trusted questions, academic review, and professional CAF examination papers.</p>
          </div>
        </section>
        <form onSubmit={submit} className="p-8 sm:p-12">
          <div className="md:hidden"><img src="/branding/skans-logo.png" alt="SKANS School of Accountancy" className="w-44" /><p className="mt-1 text-xs uppercase tracking-[.25em] text-slate-500">Question Bank</p></div>
          <h2 className="mt-10 text-2xl font-semibold text-ink md:mt-16">Sign in</h2>
          <p className="mt-2 text-sm text-slate-500">Use your school account to continue.</p>
          <label className="mt-8 block text-sm font-medium text-slate-700">Username<input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none ring-navy/20 focus:ring-4" required /></label>
          <label className="mt-5 block text-sm font-medium text-slate-700">Password<PasswordInput wrapperClassName="mt-2" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none ring-navy/20 focus:ring-4" required /></label>
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
    try {
      await changePassword(values.currentPassword, values.newPassword, values.confirmPassword);
      toast.success('Password changed');
      setValues({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to change password');
    } finally {
      setBusy(false);
    }
  }
  const labels = { currentPassword: 'Current password', newPassword: 'New password', confirmPassword: 'Confirm new password' } as const;
  const auto = { currentPassword: 'current-password', newPassword: 'new-password', confirmPassword: 'new-password' } as const;
  return (
    <div className="card w-full max-w-xl p-6 sm:p-8">
      <div className="flex items-center gap-3"><KeyRound className="text-gold" /><h2 className="text-xl font-semibold text-ink">Change password</h2></div>
      <p className="mt-2 text-sm text-slate-500">Use at least 10 characters containing a letter and a number. Other devices are signed out.</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        {(Object.keys(labels) as (keyof typeof labels)[]).map((key) => (
          <label key={key} className="label">{labels[key]}<PasswordInput wrapperClassName="mt-1" autoComplete={auto[key]} value={values[key]} onChange={(e) => setValues({ ...values, [key]: e.target.value })} className="field" required /></label>
        ))}
        <button disabled={busy} className="primary">{busy ? 'Saving…' : 'Save password'}</button>
      </form>
    </div>
  );
}

function ForcedPasswordChange() {
  const { logout } = useAuth();
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-mist p-4">
      <div className="w-full max-w-xl rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Your password was set by the administrator. Choose a new password to continue.</div>
      <ChangePassword />
      <button onClick={() => void logout()} className="text-sm font-semibold text-slate-500 hover:text-ink">Sign out</button>
    </main>
  );
}

interface NavItem { to: string; label: string; icon: LucideIcon; roles: Role[] }
const NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'TEACHER'] },
  { to: '/review', label: 'Review queue', icon: ClipboardCheck, roles: ['ADMIN'] },
  { to: '/questions', label: 'Question bank', icon: Library, roles: ['ADMIN', 'TEACHER'] },
  { to: '/papers', label: 'Paper builder', icon: FilePlus2, roles: ['ADMIN'] },
  { to: '/admin/users', label: 'Users', icon: Users, roles: ['ADMIN'] },
  { to: '/admin/subjects', label: 'Subjects', icon: BookOpen, roles: ['ADMIN'] },
  { to: '/admin/templates', label: 'Templates', icon: FileText, roles: ['ADMIN'] },
  { to: '/admin/audit', label: 'Audit log', icon: ScrollText, roles: ['ADMIN'] },
];

const COLLAPSE_KEY = 'skans.sidebarCollapsed';
const readCollapsed = () => {
  try { return localStorage.getItem(COLLAPSE_KEY) === '1'; } catch { return false; }
};

function Shell() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    try { localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0'); } catch { /* storage unavailable */ }
  }, [collapsed]);
  if (!user) return null;
  async function signOut() { await logout(); navigate('/login'); }
  const items = NAV.filter((n) => n.roles.includes(user.role));
  const narrow = collapsed && !open; // icon-only rail on large screens

  return (
    <div className="min-h-screen bg-mist text-ink">
      {open && <button className="fixed inset-0 z-30 bg-ink/40 lg:hidden" aria-label="Close menu" onClick={() => setOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col bg-navy text-white transition-all duration-200 ${narrow ? 'lg:w-20' : 'lg:w-64'} ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`} aria-label="Main navigation">
        <div className={`flex items-center gap-3 p-5 ${narrow ? 'lg:justify-center lg:px-0' : ''}`}>
          <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-gold font-black ${narrow ? 'hidden lg:grid' : 'hidden'}`}>S</div>
          <div className={narrow ? 'lg:hidden' : ''}><img src="/branding/skans-logo-dark.png" alt="SKANS School of Accountancy" className="w-40 rounded-md" /><p className="mt-1.5 text-[10px] uppercase tracking-[.2em] text-blue-100">Question Bank</p></div>
          <button className="ml-auto rounded-lg p-2 text-blue-100 hover:bg-white/10 lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu"><X size={20} /></button>
        </div>
        <nav className="mt-4 flex-1 space-y-1 overflow-y-auto px-3">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} title={narrow ? label : undefined} className={({ isActive }) => `flex min-h-11 items-center gap-3 rounded-xl px-4 text-sm ${narrow ? 'lg:justify-center lg:px-0' : ''} ${isActive ? 'bg-white/15 font-semibold' : 'text-blue-100 hover:bg-white/10'}`}>
              <Icon size={19} /><span className={narrow ? 'lg:sr-only' : ''}>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-white/10 p-4">
          <div className={`flex items-center gap-3 ${narrow ? 'lg:flex-col' : ''}`}>
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/15 text-sm font-semibold" title={user.fullName}>{user.fullName.slice(0, 1)}</div>
            <div className={`min-w-0 flex-1 ${narrow ? 'lg:hidden' : ''}`}><p className="truncate text-sm font-medium">{user.fullName}</p><p className="text-xs text-blue-200">{ROLE_LABELS[user.role]}</p></div>
            <button onClick={() => void signOut()} title="Sign out" aria-label="Sign out" className="rounded-lg p-2 text-blue-200 hover:bg-white/10 hover:text-white"><LogOut size={18} /></button>
          </div>
          <button onClick={() => setCollapsed(!collapsed)} className="mt-3 hidden w-full items-center justify-center gap-2 rounded-lg p-2 text-xs text-blue-200 hover:bg-white/10 lg:flex" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            {collapsed ? <PanelLeftOpen size={17} /> : <><PanelLeftClose size={17} />Collapse</>}
          </button>
        </div>
      </aside>
      <div className={`transition-all duration-200 ${narrow ? 'lg:pl-20' : 'lg:pl-64'}`}>
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6">
          <button className="rounded-lg p-2 hover:bg-slate-100 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu /></button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-slate-500">SKANS School of Accountancy · CAF</p>
            <h1 className="truncate text-base font-semibold text-ink">{user.role === 'ADMIN' ? 'Administration' : 'Teaching workspace'}</h1>
          </div>
          <NavLink to="/change-password" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" title="Change password" aria-label="Change password"><KeyRound size={19} /></NavLink>
        </header>
        <main className="p-4 sm:p-6 lg:p-8"><Outlet /></main>
      </div>
    </div>
  );
}

function Protected() {
  const { user, loading } = useAuth();
  if (loading) return <div className="grid min-h-screen place-items-center text-slate-500">Loading workspace…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.mustChangePassword) return <ForcedPasswordChange />;
  const admin = user.role === 'ADMIN';
  const home = <Navigate to="/" replace />;
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/questions" element={<QuestionBank />} />
        <Route path="/review" element={admin ? <ReviewQueue /> : home} />
        <Route path="/papers" element={admin ? <PaperBuilder /> : home} />
        <Route path="/admin" element={<Navigate to={admin ? '/admin/users' : '/'} replace />} />
        <Route path="/admin/users" element={admin ? <AdminUsers /> : home} />
        <Route path="/admin/subjects" element={admin ? <AdminSubjects /> : home} />
        <Route path="/admin/templates" element={admin ? <AdminTemplates /> : home} />
        <Route path="/admin/audit" element={admin ? <AuditLog /> : home} />
        <Route path="/change-password" element={<div className="flex justify-center"><ChangePassword /></div>} />
        <Route path="*" element={<div className="card mx-auto max-w-lg p-8 text-center"><ShieldCheck className="mx-auto text-slate-300" size={36} /><p className="mt-3 font-semibold">Page not found</p><NavLink to="/" className="primary mt-4">Go to dashboard</NavLink></div>} />
      </Route>
    </Routes>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/*" element={<Protected />} />
    </Routes>
  );
}
