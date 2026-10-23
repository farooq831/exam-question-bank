import { useCallback, useEffect, useState } from 'react';
import type { Paged, QuestionDTO, SubjectDTO } from '@skans/shared';
import { Check, ChevronDown, CircleCheckBig, X } from 'lucide-react';
import { toast } from 'sonner';
import { api } from './api';
import { EmptyState, IconButton, PageHeader } from './components/ui';
import { ago } from './Dashboard';
import { QuestionContent, TYPE_SHORT, questionTitle } from './questions/QuestionPreview';
import { ReviewDialog } from './questions/ReviewDialog';

/** Submitted questions waiting for the administrator's decision, oldest first. */
export function ReviewQueue() {
  const [subjects, setSubjects] = useState<SubjectDTO[]>([]);
  const [subjectId, setSubjectId] = useState('');
  const [rows, setRows] = useState<QuestionDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<number | null>(null);
  const [review, setReview] = useState<{ question: QuestionDTO; decision: 'APPROVE' | 'REJECT' } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({ status: 'SUBMITTED', pageSize: '100', sort: 'created' });
      if (subjectId) query.set('subjectId', subjectId);
      const [s, page] = await Promise.all([api<SubjectDTO[]>('/subjects'), api<Paged<QuestionDTO>>(`/questions?${query}`)]);
      setSubjects(s);
      setRows([...page.items].reverse());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to load the review queue');
    } finally {
      setLoading(false);
    }
  }, [subjectId]);
  useEffect(() => { void load(); }, [load]);

  return (
    <div>
      <PageHeader
        title="Review"
        count={loading ? undefined : rows.length}
        actions={
          <select className="field w-auto! min-w-[150px]" value={subjectId} onChange={(e) => setSubjectId(e.target.value)} aria-label="Subject">
            <option value="">All subjects</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.code}</option>)}
          </select>
        }
      />
      <div className="card overflow-hidden">
        {!loading && rows.length === 0 && <EmptyState icon={CircleCheckBig} title="All caught up — nothing to review" />}
        {loading && rows.length === 0 && <p className="p-10 text-center text-sm text-slate-400">Loading…</p>}
        {rows.map((q) => (
          <div key={q.id} className="border-b border-slate-100 last:border-0">
            <div className="list-row border-0!">
              <button className="min-w-0 flex-1 text-left" onClick={() => setOpen(open === q.id ? null : q.id)} aria-expanded={open === q.id}>
                <p className="flex items-center gap-1.5 truncate font-medium text-ink">
                  <ChevronDown size={16} className={`shrink-0 text-slate-400 transition ${open === q.id ? 'rotate-180' : ''}`} />
                  <span className="truncate">{questionTitle(q)}</span>
                </p>
                <p className="mt-0.5 truncate pl-[22px] text-xs text-slate-400">{q.subjectCode} · {TYPE_SHORT[q.type]} · {q.marks} marks · {q.createdBy} · {ago(q.updatedAt)}</p>
              </button>
              <div className="flex shrink-0 gap-1">
                <IconButton label="Approve" icon={Check} tone="success" onClick={() => setReview({ question: q, decision: 'APPROVE' })} />
                <IconButton label="Return to author" icon={X} tone="danger" onClick={() => setReview({ question: q, decision: 'REJECT' })} />
              </div>
            </div>
            {open === q.id && <div className="bg-slate-50/60 px-5 pb-5 pt-2 sm:pl-10"><QuestionContent question={q} /></div>}
          </div>
        ))}
      </div>
      {review && <ReviewDialog question={review.question} initialDecision={review.decision} onClose={() => setReview(null)} onDone={() => { setReview(null); void load(); }} />}
    </div>
  );
}
