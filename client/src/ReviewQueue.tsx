import { useCallback, useEffect, useState } from 'react';
import { QUESTION_TYPE_LABELS, type Paged, type QuestionDTO, type SubjectDTO } from '@skans/shared';
import { Check, ChevronDown, ChevronUp, Inbox, X } from 'lucide-react';
import { toast } from 'sonner';
import { api } from './api';
import { QuestionContent } from './questions/QuestionPreview';
import { ReviewDialog } from './questions/ReviewDialog';

/** Submitted questions waiting for an ADMIN/HOA decision (the server limits HOA to assigned subjects). */
export function ReviewQueue() {
  const [subjects, setSubjects] = useState<SubjectDTO[]>([]);
  const [subjectId, setSubjectId] = useState('');
  const [rows, setRows] = useState<QuestionDTO[]>([]);
  const [total, setTotal] = useState(0);
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
      // Oldest submissions first, so nothing waits forever.
      setRows([...page.items].reverse());
      setTotal(page.total);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to load the review queue');
    } finally {
      setLoading(false);
    }
  }, [subjectId]);
  useEffect(() => { void load(); }, [load]);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">Academic review</p>
          <h2 className="text-3xl font-semibold text-ink">Review queue</h2>
          <p className="mt-1 text-sm text-slate-500">Approve questions for paper building, or send them back with a comment for the author.</p>
        </div>
        <select className="field w-full sm:w-64" value={subjectId} onChange={(e) => setSubjectId(e.target.value)} aria-label="Filter by subject">
          <option value="">All subjects</option>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
        </select>
      </div>

      <p className="mt-5 text-sm font-semibold text-slate-600">{loading ? 'Loading…' : `${total} question${total === 1 ? '' : 's'} awaiting review`}</p>

      <div className="mt-3 space-y-3">
        {!loading && rows.length === 0 && (
          <div className="card flex flex-col items-center gap-2 p-12 text-center text-sm text-slate-500"><Inbox className="text-slate-300" size={36} />Nothing is waiting for review.</div>
        )}
        {rows.map((q) => (
          <article key={q.id} className="card overflow-hidden">
            <div className="grid gap-3 p-4 sm:p-5 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="badge bg-slate-100 text-navy">{q.subjectCode}</span>
                  <span className="text-slate-500">{QUESTION_TYPE_LABELS[q.type]}</span>
                  <span className="font-semibold text-ink">{q.marks} marks</span>
                </div>
                <h3 className="mt-1.5 font-semibold text-ink">{q.topic || 'Untitled question'}</h3>
                <dl className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  <div><dt className="inline">Created by </dt><dd className="inline font-medium text-slate-700">{q.createdBy}</dd></div>
                  <div><dt className="inline">Submitted </dt><dd className="inline font-medium text-slate-700">{new Date(q.updatedAt).toLocaleString()}</dd></div>
                  <div><dt className="inline">#</dt><dd className="inline">{q.id}</dd></div>
                </dl>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="secondary" onClick={() => setOpen(open === q.id ? null : q.id)} aria-expanded={open === q.id}>{open === q.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}Preview</button>
                <button className="success" onClick={() => setReview({ question: q, decision: 'APPROVE' })}><Check size={16} />Approve</button>
                <button className="danger" onClick={() => setReview({ question: q, decision: 'REJECT' })}><X size={16} />Reject</button>
              </div>
            </div>
            {open === q.id && <div className="border-t border-slate-100 bg-slate-50/50 p-4 sm:p-5"><QuestionContent question={q} /></div>}
          </article>
        ))}
      </div>
      {review && <ReviewDialog question={review.question} initialDecision={review.decision} onClose={() => setReview(null)} onDone={() => { setReview(null); void load(); }} />}
    </div>
  );
}
