import { useEffect, useState } from 'react';
import { Navigate, NavLink, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { BookOpen, ClipboardCheck, FileText, KeyRound, LayoutGrid, Library, LogOut, Menu, PanelLeftClose, PanelLeftOpen, ScrollText, Settings2, Users, X, type LucideIcon } from 'lucide-react';
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
      await login(username, password);
      navigate('/');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to sign in');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f7f9] px-4 py-10">
      <form onSubmit={submit} className="card w-full max-w-sm p-8 shadow-sm">
        <img src="/branding/skans-logo.png" alt="SKANS School of Accountancy" className="mx-auto w-56" />
        <h1 className="mt-6 text-center text-lg font-semibold text-ink">Sign in to Question Bank</h1>
        <label className="label mt-6">Username
          <input className="field mt-1.5" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} autoFocus required />
        </label>
        <label className="label mt-4">Password
          <PasswordInput wrapperClassName="mt-1.5" className="field" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </label>
        <button disabled={busy} className="primary mt-6 w-full !min-h-11">{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
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
  const narrow = collapsed && !open; // icon-only rail on large screens

  const link = ({ to, label, icon: Icon }: NavItem) => (
    <NavLink key={to} to={to} end={to === '/'} title={narrow ? label : undefined} className={({ isActive }) => `flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm transition ${narrow ? 'lg:justify-center lg:px-0' : ''} ${isActive ? 'bg-white/15 font-semibold text-white' : 'text-blue-100/80 hover:bg-white/5 hover:text-white'}`}>
      <Icon size={18} /><span className={narrow ? 'lg:sr-only' : ''}>{label}</span>
    </NavLink>
  );
  const adminItems = ADMIN_NAV.filter((n) => n.roles.includes(user.role));

  return (
    <div className="min-h-screen text-ink">
      {open && <button className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden" aria-label="Close menu" onClick={() => setOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-navy text-white transition-all duration-200 ${narrow ? 'lg:w-[4.5rem]' : 'lg:w-60'} ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`} aria-label="Main navigation">
        <div className={`flex h-16 items-center px-4 ${narrow ? 'lg:justify-center lg:px-0' : ''}`}>
          {narrow
            ? <span className="hidden h-9 w-9 place-items-center rounded-lg bg-white/10 text-sm font-bold lg:grid">S</span>
            : <img src="/branding/skans-logo-dark.png" alt="SKANS School of Accountancy" className="w-40" />}
          <button className="icon-btn ml-auto !text-blue-100 hover:!bg-white/10 lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu"><X size={18} /></button>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pt-2">
          {MAIN_NAV.filter((n) => n.roles.includes(user.role)).map(link)}
          {adminItems.length > 0 && <div className={`mx-3 my-3 border-t border-white/10 ${narrow ? 'lg:mx-2' : ''}`} />}
          {adminItems.map(link)}
        </nav>
        <div className="border-t border-white/10 p-3">
          <div className={`flex items-center gap-2.5 ${narrow ? 'lg:flex-col' : ''}`}>
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/15 text-xs font-semibold" title={user.fullName}>{user.fullName.slice(0, 1).toUpperCase()}</div>
            <div className={`min-w-0 flex-1 ${narrow ? 'lg:hidden' : ''}`}><p className="truncate text-sm font-medium">{user.fullName}</p><p className="text-xs text-blue-200/70">{ROLE_LABELS[user.role]}</p></div>
            <NavLink to="/change-password" title="Change password" aria-label="Change password" className="icon-btn !h-8 !w-8 !text-blue-200 hover:!bg-white/10 hover:!text-white"><KeyRound size={16} /></NavLink>
            <button onClick={() => void signOut()} title="Sign out" aria-label="Sign out" className="icon-btn !h-8 !w-8 !text-blue-200 hover:!bg-white/10 hover:!text-white"><LogOut size={16} /></button>
          </div>
          <button onClick={() => setCollapsed(!collapsed)} className="mt-2 hidden w-full items-center justify-center rounded-lg p-1.5 text-blue-200/70 hover:bg-white/10 hover:text-white lg:flex" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>
      </aside>
      <div className={`transition-all duration-200 ${narrow ? 'lg:pl-[4.5rem]' : 'lg:pl-60'}`}>
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
