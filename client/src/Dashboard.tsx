import { useEffect, useState } from 'react';
import type { DashboardDTO } from '@skans/shared';
import { Link } from 'react-router-dom';
import { Activity, FilePlus2, FileText, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { api } from './api';
import { useAuth } from './auth';
import { EmptyState, Pill } from './components/ui';

export const actionLabel = (action: string) => action.charAt(0) + action.slice(1).toLowerCase().replace(/_/g, ' ').replace('pdf', 'PDF');

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

function Stat({ label, value, to, accent }: { label: string; value: number | undefined; to: string; accent?: string }) {
  return (
    <Link to={to} className="card group block p-5 transition hover:border-slate-300">
      <p className={`text-3xl font-semibold tracking-tight ${accent ?? 'text-ink'}`}>{value ?? '–'}</p>
      <p className="mt-1 text-sm text-slate-500 group-hover:text-ink">{label}</p>
    </Link>
  );
}

export const ago = (iso: string) => {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  if (mins < 1440) return `${Math.round(mins / 60)} h ago`;
  return new Date(iso).toLocaleDateString();
};

export function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardDTO | null>(null);
  useEffect(() => { api<DashboardDTO>('/dashboard').then(setData).catch((e) => toast.error(e.message)); }, []);
  if (!user) return null;
  const t = data?.totals;
  const admin = user.role === 'ADMIN';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{greeting()}, {user.fullName.split(' ')[0]}</h1>
        <div className="flex flex-wrap gap-2">
          <Link to="/questions?new=1" className="secondary"><Plus size={16} />New question</Link>
          {admin && <Link to="/papers?paper=new" className="primary"><FilePlus2 size={16} />New paper</Link>}
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {admin ? (
          <>
            <Stat label="Waiting for review" value={data?.pendingReview} to="/review" accent={data?.pendingReview ? 'text-amber-600' : undefined} />
            <Stat label="Approved questions" value={t?.APPROVED} to="/questions?status=APPROVED" />
            <Stat label="Drafts" value={t?.DRAFT} to="/questions?status=DRAFT" />
            <Stat label="Papers" value={data?.stats.papers} to="/papers" />
          </>
        ) : (
          <>
            <Stat label="My drafts" value={t?.DRAFT} to="/questions?status=DRAFT&mine=1" />
            <Stat label="In review" value={t?.SUBMITTED} to="/questions?status=SUBMITTED&mine=1" />
            <Stat label="Returned to me" value={data?.myRejected} to="/questions?status=REJECTED&mine=1" accent={data?.myRejected ? 'text-red-600' : undefined} />
            <Stat label="Approved" value={t?.APPROVED} to="/questions?status=APPROVED" />
          </>
        )}
      </section>

      <div className={`grid gap-6 ${admin ? 'lg:grid-cols-2' : ''}`}>
        {admin && (
          <section className="card">
            <div className="flex items-center justify-between px-5 pt-4"><h2 className="font-semibold">Recent papers</h2><Link to="/papers" className="text-sm font-medium text-slate-500 hover:text-ink">View all</Link></div>
            {data && data.recentPapers.length === 0 ? <EmptyState icon={FileText} title="No papers yet" /> : (
              <div className="mt-2 pb-2">
                {data?.recentPapers.map((p) => (
                  <Link key={p.id} to={`/papers?paper=${p.id}`} className="list-row">
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{p.title}</p><p className="text-xs text-slate-400">{p.subjectCode} · {ago(p.updatedAt)}</p></div>
                    <Pill tone={p.status === 'FINAL' ? 'green' : 'slate'}>{p.status === 'FINAL' ? 'Final' : 'Draft'}</Pill>
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}

        <section className="card">
          <div className="px-5 pt-4"><h2 className="font-semibold">Recent activity</h2></div>
          {data && data.recentActivity.length === 0 ? <EmptyState icon={Activity} title="Nothing yet" /> : (
            <ol className="mt-2 pb-2">
              {data?.recentActivity.slice(0, 6).map((a) => (
                <li key={a.id} className="list-row">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                  <p className="min-w-0 flex-1 truncate text-sm">{actionLabel(a.action)}{admin && a.username ? <span className="text-slate-400"> · {a.username}</span> : null}</p>
                  <span className="shrink-0 text-xs text-slate-400">{ago(a.createdAt)}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      {data && data.countsBySubject.length > 0 && (
        <section className="card">
          <h2 className="px-5 pt-4 font-semibold">By subject</h2>
          <div className="mt-2 overflow-x-auto pb-2">
            <table className="w-full min-w-[480px] text-sm">
              <thead><tr className="text-left text-xs text-slate-400"><th className="px-5 py-2 font-medium">Subject</th><th className="px-3 text-right font-medium">Draft</th><th className="px-3 text-right font-medium">In review</th><th className="px-3 text-right font-medium">Approved</th><th className="px-5 text-right font-medium">Returned</th></tr></thead>
              <tbody>
                {data.countsBySubject.map((s) => (
                  <tr key={s.subjectId} className="border-t border-slate-100 hover:bg-slate-50/60">
                    <td className="px-5 py-2.5"><Link to={`/questions?subjectId=${s.subjectId}`} className="font-medium hover:underline" title={s.name}>{s.code}</Link></td>
                    <td className="px-3 text-right text-slate-500">{s.DRAFT || '–'}</td>
                    <td className="px-3 text-right text-slate-500">{s.SUBMITTED || '–'}</td>
                    <td className="px-3 text-right text-slate-500">{s.APPROVED || '–'}</td>
                    <td className="px-5 text-right text-slate-500">{s.REJECTED || '–'}</td>
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
