import { useEffect, useState } from 'react';
import { Navigate, NavLink, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, ClipboardCheck, FileText, KeyRound, LayoutGrid, Library, Loader2, LockKeyhole, LogOut, Menu, ScrollText, Settings2, UserRound, Users, X, type LucideIcon } from 'lucide-react';
import { ROLE_LABELS, type Role } from '@skans/shared';
import { toast } from 'sonner';
import { useAuth } from './auth';
import { PasswordInput } from './components/PasswordInput';
import { EmptyState } from './components/ui';
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
      const me = await login(username, password);
      toast.success(`Welcome, ${me.fullName}`, { description: `Signed in as ${me.username} · ${ROLE_LABELS[me.role]}` });
      navigate('/');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to sign in');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="grid min-h-screen bg-white lg:grid-cols-[1.1fr_1fr]">
      {/* Brand panel */}
      <section className="relative hidden overflow-hidden bg-navy lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute -bottom-40 -left-24 h-[28rem] w-[28rem] rounded-full bg-gold/10" />
        <img src="/branding/skans-logo-dark.png" alt="SKANS School of Accountancy" className="relative w-64" />
        <div className="relative max-w-md">
          <div className="mb-6 h-1 w-14 rounded-full bg-gold" />
          <h1 className="text-4xl font-semibold leading-tight text-white">Question Bank</h1>
          <p className="mt-3 text-lg text-blue-100/80">Write, review and publish CAF examination papers.</p>
        </div>
        <p className="relative text-xs text-blue-200/50">© {new Date().getFullYear()} SKANS School of Accountancy</p>
      </section>

      {/* Sign-in form */}
      <section className="flex items-center justify-center px-6 py-12 sm:px-12">
        <form onSubmit={submit} className="w-full max-w-sm">
          <img src="/branding/skans-logo.png" alt="SKANS School of Accountancy" className="mb-10 w-52 lg:hidden" />
          <h2 className="text-3xl font-semibold tracking-tight text-ink">Welcome back</h2>
          <p className="mt-2 text-slate-500">Sign in to your account to continue.</p>

          <label className="label mt-9">Username
            <span className="relative mt-2 block">
              <UserRound size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className="field !rounded-xl !py-3 !pl-11" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} autoFocus required placeholder="Your username" />
            </span>
          </label>
          <label className="label mt-5">Password
            <span className="relative mt-2 block">
              <LockKeyhole size={18} className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-slate-400" />
              <PasswordInput className="field !rounded-xl !py-3 !pl-11" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required placeholder="Your password" />
            </span>
          </label>

          <button disabled={busy} className="primary mt-8 w-full !min-h-12 !rounded-xl text-base shadow-sm">
            {busy ? <><Loader2 size={18} className="animate-spin" />Signing in…</> : <>Sign in<ArrowRight size={18} /></>}
          </button>
          <p className="mt-6 text-center text-xs text-slate-400">Forgot your password? Ask the administrator to reset it.</p>
        </form>
      </section>
    </main>
  );
}

function ChangePassword({ onDone }: { onDone?(): void }) {
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
      onDone?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to change password');
    } finally {
      setBusy(false);
    }
  }
  const fields = [
    ['currentPassword', 'Current password', 'current-password'],
    ['newPassword', 'New password', 'new-password'],
    ['confirmPassword', 'Confirm new password', 'new-password'],
  ] as const;
  return (
    <form onSubmit={submit} className="card w-full max-w-sm space-y-4 p-6 sm:p-8">
      <h1 className="text-lg font-semibold text-ink">Change password</h1>
      {fields.map(([key, label, auto]) => (
        <label key={key} className="label">{label}
          <PasswordInput wrapperClassName="mt-1.5" className="field" autoComplete={auto} value={values[key]} onChange={(e) => setValues({ ...values, [key]: e.target.value })} required />
        </label>
      ))}
      <p className="field-hint">At least 10 characters, with a letter and a number.</p>
      <button disabled={busy} className="primary w-full">{busy ? 'Saving…' : 'Save password'}</button>
    </form>
  );
}

function ForcedPasswordChange() {
  const { logout } = useAuth();
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#f6f7f9] p-4">
      <img src="/branding/skans-logo.png" alt="SKANS School of Accountancy" className="w-48" />
      <p className="text-sm text-slate-500">Choose your own password to continue.</p>
      <ChangePassword />
      <button onClick={() => void logout()} className="ghost">Sign out</button>
    </main>
  );
}

interface NavItem { to: string; label: string; icon: LucideIcon; roles: Role[] }
const MAIN_NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutGrid, roles: ['ADMIN', 'TEACHER', 'RESEARCH_OFFICER'] },
  { to: '/review', label: 'Review', icon: ClipboardCheck, roles: ['ADMIN'] },
  { to: '/questions', label: 'Questions', icon: Library, roles: ['ADMIN', 'TEACHER', 'RESEARCH_OFFICER'] },
  { to: '/papers', label: 'Papers', icon: FileText, roles: ['ADMIN'] },
];
const ADMIN_NAV: NavItem[] = [
  { to: '/admin/users', label: 'Users', icon: Users, roles: ['ADMIN'] },
  { to: '/admin/subjects', label: 'Subjects', icon: BookOpen, roles: ['ADMIN'] },
  { to: '/admin/templates', label: 'Paper format', icon: Settings2, roles: ['ADMIN'] },
  { to: '/admin/audit', label: 'Audit log', icon: ScrollText, roles: ['ADMIN'] },
];

function Shell() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);
  if (!user) return null;
  async function signOut() { await logout(); navigate('/login'); }

  const link = ({ to, label, icon: Icon }: NavItem) => (
    <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm transition ${isActive ? 'bg-white/15 font-semibold text-white' : 'text-blue-100/80 hover:bg-white/5 hover:text-white'}`}>
      <Icon size={18} /><span>{label}</span>
    </NavLink>
  );
  const adminItems = ADMIN_NAV.filter((n) => n.roles.includes(user.role));

  return (
    <div className="min-h-screen text-ink">
      {open && <button className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden" aria-label="Close menu" onClick={() => setOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-navy text-white transition-all duration-200 lg:w-60 ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`} aria-label="Main navigation">
        <div className={`flex h-16 items-center px-4`}>
          <img src="/branding/skans-logo-dark.png" alt="SKANS School of Accountancy" className="w-40" />
          <button className="icon-btn ml-auto !text-blue-100 hover:!bg-white/10 lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu"><X size={18} /></button>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pt-2">
          {MAIN_NAV.filter((n) => n.roles.includes(user.role)).map(link)}
          {adminItems.length > 0 && <div className="mx-3 my-3 border-t border-white/10" />}
          {adminItems.map(link)}
        </nav>
        <div className="border-t border-white/10 p-3">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/15 text-xs font-semibold" title={user.fullName}>{user.fullName.slice(0, 1).toUpperCase()}</div>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{user.fullName}</p><p className="text-xs text-blue-200/70">{ROLE_LABELS[user.role]}</p></div>
            <NavLink to="/change-password" title="Change password" aria-label="Change password" className="icon-btn !h-8 !w-8 !text-blue-200 hover:!bg-white/10 hover:!text-white"><KeyRound size={16} /></NavLink>
            <button onClick={() => void signOut()} title="Sign out" aria-label="Sign out" className="icon-btn !h-8 !w-8 !text-blue-200 hover:!bg-white/10 hover:!text-white"><LogOut size={16} /></button>
          </div>
        </div>
      </aside>
      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200/70 bg-white/90 px-4 backdrop-blur lg:hidden">
          <button className="icon-btn" onClick={() => setOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
          <img src="/branding/skans-logo.png" alt="SKANS School of Accountancy" className="h-8" />
        </header>
        <main className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8"><Outlet /></main>
      </div>
    </div>
  );
}

function Protected() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  if (loading) return <div className="grid min-h-screen place-items-center text-sm text-slate-400">Loading…</div>;
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
        <Route path="/change-password" element={<div className="flex justify-center pt-6"><ChangePassword onDone={() => navigate('/')} /></div>} />
        <Route path="*" element={<div className="card"><EmptyState icon={X} title="Page not found" action={<NavLink to="/" className="primary">Go to dashboard</NavLink>} /></div>} />
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
