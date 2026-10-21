import { useEffect, useState } from 'react';
import type { DashboardDTO } from '@skans/shared';
import { Link } from 'react-router-dom';
import { Activity, BookOpen, CheckCircle2, ClipboardCheck, FilePlus2, FileText, PenLine, Plus, ScrollText, Send, Users, XCircle, type LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import { api } from './api';
import { useAuth } from './auth';

export const actionLabel = (action: string) => action.charAt(0) + action.slice(1).toLowerCase().replace(/_/g, ' ').replace('pdf', 'PDF');

function Stat({ label, value, tone, icon: Icon, to }: { label: string; value: number | undefined; tone: string; icon: LucideIcon; to?: string }) {
  const body = (
    <div className="card flex h-full items-center gap-4 p-5 transition hover:shadow-lg">
      <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${tone}`}><Icon size={20} /></div>
      <div className="min-w-0"><p className="text-2xl font-semibold text-ink">{value ?? '—'}</p><p className="truncate text-sm text-slate-500">{label}</p></div>
    </div>
  );
  return to ? <Link to={to} className="block">{body}</Link> : body;
}

function QuickAction({ to, label, icon: Icon }: { to: string; label: string; icon: LucideIcon }) {
  return <Link to={to} className="secondary !justify-start"><Icon size={17} />{label}</Link>;
}

export function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardDTO | null>(null);
  useEffect(() => { api<DashboardDTO>('/dashboard').then(setData).catch((e) => toast.error(e.message)); }, []);
  if (!user) return null;
  const t = data?.totals;
  const staff = user.role !== 'TEACHER';
  const admin = user.role === 'ADMIN';

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-navy to-[#315b87] p-6 text-white shadow-card sm:p-7">
        <p className="text-sm text-blue-100">Welcome</p>
        <h2 className="mt-1 text-2xl font-semibold sm:text-3xl">{user.fullName}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100">
          {admin ? 'School-wide overview of the question bank, reviews and papers.' : user.role === 'HOA' ? 'Your subjects: review submitted questions and build papers.' : 'Write questions for your subjects and submit them for review.'}
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {staff ? (
          <>
            <Stat label="Pending review" value={data?.pendingReview} tone="bg-amber-50 text-amber-700" icon={ClipboardCheck} to="/review" />
            <Stat label="Approved questions" value={t?.APPROVED} tone="bg-emerald-50 text-emerald-700" icon={CheckCircle2} to="/questions?status=APPROVED" />
            <Stat label="Rejected questions" value={t?.REJECTED} tone="bg-red-50 text-red-700" icon={XCircle} to="/questions?status=REJECTED" />
            <Stat label={admin ? 'Draft questions' : 'Drafts (yours)'} value={t?.DRAFT} tone="bg-slate-100 text-slate-600" icon={PenLine} to="/questions?status=DRAFT" />
          </>
        ) : (
          <>
            <Stat label="My drafts" value={t?.DRAFT} tone="bg-slate-100 text-slate-600" icon={PenLine} to="/questions?status=DRAFT&mine=1" />
            <Stat label="Awaiting review" value={t?.SUBMITTED} tone="bg-amber-50 text-amber-700" icon={Send} to="/questions?status=SUBMITTED&mine=1" />
            <Stat label="Approved in my subjects" value={t?.APPROVED} tone="bg-emerald-50 text-emerald-700" icon={CheckCircle2} to="/questions?status=APPROVED" />
            <Stat label="Sent back to me" value={data?.myRejected} tone="bg-red-50 text-red-700" icon={XCircle} to="/questions?status=REJECTED&mine=1" />
          </>
        )}
      </section>

      {admin && (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Papers" value={data?.stats.papers} tone="bg-blue-50 text-blue-700" icon={FileText} to="/papers" />
          <Stat label="Active users" value={data?.stats.users} tone="bg-blue-50 text-blue-700" icon={Users} to="/admin/users" />
          <Stat label="Subjects" value={data?.stats.subjects} tone="bg-blue-50 text-blue-700" icon={BookOpen} to="/admin/subjects" />
          <Stat label="Paper templates" value={data?.stats.templates} tone="bg-blue-50 text-blue-700" icon={FileText} to="/admin/templates" />
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <section className="card p-5">
          <h3 className="font-semibold">Quick actions</h3>
          <div className="mt-3 grid gap-2">
            {staff && <QuickAction to="/review" label="Open the review queue" icon={ClipboardCheck} />}
            {staff && <QuickAction to="/papers?paper=new" label="Build a new paper" icon={FilePlus2} />}
            {!admin && <QuickAction to="/questions?new=1" label="Write a new question" icon={Plus} />}
            {admin && <QuickAction to="/admin/users" label="Manage users" icon={Users} />}
            {admin && <QuickAction to="/admin/audit" label="View the audit log" icon={ScrollText} />}
          </div>
          {staff && data && data.recentPapers.length > 0 && (
            <>
              <h3 className="mt-6 font-semibold">Recent papers</h3>
              <ul className="mt-2 divide-y divide-slate-100">
                {data.recentPapers.map((p) => (
                  <li key={p.id}>
                    <Link to={`/papers?paper=${p.id}`} className="flex items-center justify-between gap-3 py-2.5 text-sm hover:text-navy">
                      <span className="min-w-0"><span className="block truncate font-medium">{p.title}</span><span className="text-xs text-slate-500">{p.subjectCode} · {p.status === 'FINAL' ? 'Final' : 'Draft'} · v{p.currentVersion}</span></span>
                      <span className={`shrink-0 text-xs font-semibold ${p.totalMarks === p.maxMarks ? 'text-emerald-700' : 'text-amber-700'}`}>{p.totalMarks}/{p.maxMarks}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className="card p-5">
          <h3 className="flex items-center gap-2 font-semibold"><Activity size={17} />{admin ? 'Recent activity' : 'Your recent activity'}</h3>
          {!data ? <p className="mt-3 text-sm text-slate-500">Loading…</p> : data.recentActivity.length === 0 ? <p className="mt-3 text-sm text-slate-500">No activity yet.</p> : (
            <ol className="mt-3 space-y-3">
              {data.recentActivity.map((a) => (
                <li key={a.id} className="flex gap-3 text-sm">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gold" />
                  <div className="min-w-0">
                    <p className="font-medium text-ink">{actionLabel(a.action)}{a.entityId ? <span className="font-normal text-slate-500"> · {a.entityType} #{a.entityId}</span> : null}</p>
                    <p className="text-xs text-slate-500">{a.username || 'system'} · {new Date(a.createdAt).toLocaleString()}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      {data && data.countsBySubject.length > 0 && (
        <section className="card p-5">
          <h3 className="font-semibold">Questions by subject</h3>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead><tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-400"><th className="py-2 pr-3">Subject</th><th className="px-3 text-right">Draft</th><th className="px-3 text-right">Awaiting review</th><th className="px-3 text-right">Approved</th><th className="pl-3 text-right">Rejected</th></tr></thead>
              <tbody>
                {data.countsBySubject.map((s) => (
                  <tr key={s.subjectId} className="border-b border-slate-50">
                    <td className="py-2.5 pr-3"><Link to={`/questions?subjectId=${s.subjectId}`} className="font-medium hover:text-navy">{s.code}</Link> <span className="text-slate-500">{s.name}</span></td>
                    <td className="px-3 text-right">{s.DRAFT}</td><td className="px-3 text-right text-amber-700">{s.SUBMITTED}</td><td className="px-3 text-right text-emerald-700">{s.APPROVED}</td><td className="pl-3 text-right text-red-700">{s.REJECTED}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
