import { useCallback, useEffect, useMemo, useState } from 'react';
import { QUESTION_STATUS_LABELS, QUESTION_STATUSES, QUESTION_TYPE_LABELS, QUESTION_TYPES, type Paged, type QuestionDTO, type SubjectDTO } from '@skans/shared';
import { useSearchParams } from 'react-router-dom';
import { ArchiveRestore, Check, Copy, Eye, Pencil, Plus, Search, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from './api';
import { useAuth } from './auth';
import { Confirm } from './components/Confirm';
import { Modal } from './components/Modal';
import { draftFromQuestion, emptyDraft, questionActions, type QuestionDraft } from './questions/model';
import { QuestionContent, QuestionMeta } from './questions/QuestionPreview';
import { QuestionEditor } from './questions/QuestionEditor';
import { ReviewDialog } from './questions/ReviewDialog';

const PAGE_SIZE = 12;
const plain = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

export function QuestionBank() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [subjects, setSubjects] = useState<SubjectDTO[]>([]);
  const [result, setResult] = useState<Paged<QuestionDTO>>({ items: [], total: 0, page: 1, pageSize: PAGE_SIZE });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(params.get('q') ?? '');
  const [editor, setEditor] = useState<{ draft: QuestionDraft; canSubmit: boolean } | null>(null);
  const [preview, setPreview] = useState<QuestionDTO | null>(null);
  const [review, setReview] = useState<{ question: QuestionDTO; decision: 'APPROVE' | 'REJECT' } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<QuestionDTO | null>(null);

  const filters = useMemo(
    () => ({
      q: params.get('q') ?? '',
      subjectId: params.get('subjectId') ?? '',
      type: params.get('type') ?? '',
      status: params.get('status') ?? '',
      mine: params.get('mine') ?? '',
      deleted: params.get('deleted') ?? '',
      page: Number(params.get('page') ?? 1),
    }),
    [params],
  );
  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };

  // Debounce the free-text search so typing does not fire a request per key.
  useEffect(() => {
    const t = setTimeout(() => search !== filters.q && setFilter('q', search), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({ page: String(filters.page), pageSize: String(PAGE_SIZE) });
      for (const key of ['q', 'subjectId', 'type', 'status', 'mine', 'deleted'] as const) if (filters[key]) query.set(key, filters[key]);
      const [subjectRows, page] = await Promise.all([api<SubjectDTO[]>('/subjects'), api<Paged<QuestionDTO>>(`/questions?${query}`)]);
      setSubjects(subjectRows.filter((s) => s.isActive));
      setResult(page);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to load questions');
    } finally {
      setLoading(false);
    }
  }, [filters]);
  useEffect(() => { void load(); }, [load]);

  if (!user) return null;
  const pages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));
  const ownSubjects = subjects.filter((s) => user.subjectIds.includes(s.id));

  async function openEditor(q?: QuestionDTO) {
    if (!q) {
      if (!ownSubjects.length) return toast.error('No subjects are assigned to you yet. Ask the administrator.');
      const subjectId = Number(filters.subjectId) || ownSubjects[0].id;
      setEditor({ draft: emptyDraft(ownSubjects.some((s) => s.id === subjectId) ? subjectId : ownSubjects[0].id), canSubmit: true });
      return;
    }
    try {
      const full = await api<QuestionDTO & { permissions: { edit: boolean; submit: boolean } }>(`/questions/${q.id}`);
      if (!full.permissions.edit) return toast.error('You cannot edit this question.');
      setEditor({ draft: draftFromQuestion(full), canSubmit: full.permissions.submit });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to open question');
    }
  }

  async function post(q: QuestionDTO, path: string, message: string) {
    try {
      await api(`/questions/${q.id}${path}`, { method: 'POST' });
      toast.success(message);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Action failed');
    }
  }

  async function remove(q: QuestionDTO) {
    setConfirmDelete(null);
    try {
      await api(`/questions/${q.id}`, { method: 'DELETE' });
      toast.success('Question moved to the recycle bin');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to delete question');
    }
  }

  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">Content library</p>
          <h2 className="text-3xl font-semibold text-ink">Question bank</h2>
          <p className="mt-1 text-sm text-slate-500">
            {user.role === 'TEACHER' ? 'Your questions and the approved questions of your subjects.' : user.role === 'HOA' ? 'Questions of your assigned subjects.' : 'All questions across the school.'}
          </p>
        </div>
        {user.role !== 'ADMIN' && <button onClick={() => void openEditor()} disabled={!ownSubjects.length} className="primary"><Plus size={17} />New question</button>}
      </div>

      <div className="card mt-6 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6">
        <label className="relative sm:col-span-2">
          <Search className="absolute left-3 top-3 text-slate-400" size={17} />
          <input className="field !pl-10" placeholder="Search text, topic, source…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search questions" />
        </label>
        <select className="field" value={filters.subjectId} onChange={(e) => setFilter('subjectId', e.target.value)} aria-label="Subject"><option value="">All subjects</option>{subjects.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}</select>
        <select className="field" value={filters.type} onChange={(e) => setFilter('type', e.target.value)} aria-label="Type"><option value="">All types</option>{QUESTION_TYPES.map((t) => <option key={t} value={t}>{QUESTION_TYPE_LABELS[t]}</option>)}</select>
        <select className="field" value={filters.status} onChange={(e) => setFilter('status', e.target.value)} aria-label="Status"><option value="">All statuses</option>{QUESTION_STATUSES.map((s) => <option key={s} value={s}>{QUESTION_STATUS_LABELS[s]}</option>)}</select>
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
          <label className="flex min-h-11 items-center gap-2"><input type="checkbox" className="h-4 w-4" checked={filters.mine === '1'} onChange={(e) => setFilter('mine', e.target.checked ? '1' : '')} />Mine</label>
          <label className="flex min-h-11 items-center gap-2"><input type="checkbox" className="h-4 w-4" checked={filters.deleted === '1'} onChange={(e) => setFilter('deleted', e.target.checked ? '1' : '')} />Recycle bin</label>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {loading ? (
          <div className="card p-10 text-center text-sm text-slate-500">Loading questions…</div>
        ) : result.items.length === 0 ? (
          <div className="card p-10 text-center text-sm text-slate-500">No questions match these filters.</div>
        ) : (
          result.items.map((q) => {
            const can = questionActions(user, q);
            return (
              <article key={q.id} className="card p-4 sm:p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-start">
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setPreview(q)}>
                    <QuestionMeta question={q} />
                    <h3 className="mt-2 font-semibold text-ink">{q.topic || 'Untitled question'}</h3>
                    <p className="mt-1 line-clamp-2 text-sm text-slate-500">{plain(q.body)}</p>
                    <p className="mt-2 text-xs text-slate-400">#{q.id} · by {q.createdBy} · updated {new Date(q.updatedAt).toLocaleDateString()}{q.usedInPapers ? ` · used in ${q.usedInPapers} paper${q.usedInPapers === 1 ? '' : 's'}` : ''}</p>
                    {q.status === 'REJECTED' && q.reviewComment && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800"><strong>Reviewer:</strong> {q.reviewComment}</p>}
                  </button>
                  <div className="flex flex-wrap items-center gap-1 md:justify-end">
                    <button title="Preview" onClick={() => setPreview(q)} className="action"><Eye size={17} /></button>
                    {q.deletedAt ? (
                      can.restore && <button title="Restore" onClick={() => void post(q, '/restore', 'Question restored')} className="action"><ArchiveRestore size={17} /></button>
                    ) : (
                      <>
                        {can.edit && <button title="Edit" onClick={() => void openEditor(q)} className="action"><Pencil size={17} /></button>}
                        {can.submit && <button title="Submit for review" onClick={() => void post(q, '/submit', 'Submitted for review')} className="action text-amber-700"><Send size={17} /></button>}
                        {can.review && <button title="Review" onClick={() => setReview({ question: q, decision: 'APPROVE' })} className="secondary !min-h-9 !px-3 text-emerald-700"><Check size={16} />Review</button>}
                        {can.duplicate && user.role !== 'ADMIN' && <button title="Duplicate as a new draft" onClick={() => void post(q, '/duplicate', 'Copied as a new draft')} className="action"><Copy size={17} /></button>}
                        {can.remove && <button title="Move to recycle bin" onClick={() => setConfirmDelete(q)} className="action text-red-600"><Trash2 size={17} /></button>}
                      </>
                    )}
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
        <span>{result.total} question{result.total === 1 ? '' : 's'}</span>
        <div className="flex items-center gap-2">
          <button disabled={filters.page <= 1} onClick={() => setFilter('page', String(filters.page - 1))} className="secondary">Previous</button>
          <span>Page {filters.page} of {pages}</span>
          <button disabled={filters.page >= pages} onClick={() => setFilter('page', String(filters.page + 1))} className="secondary">Next</button>
        </div>
      </div>

      {preview && (
        <Modal eyebrow={`Question #${preview.id}`} title={preview.topic || 'Untitled question'} onClose={() => setPreview(null)} footer={<button className="primary" onClick={() => setPreview(null)}>Close</button>}>
          <QuestionMeta question={preview} />
          <p className="mt-1 text-xs text-slate-500">Written by {preview.createdBy}{preview.reviewedBy ? ` · reviewed by ${preview.reviewedBy}` : ''}</p>
          <div className="mt-4"><QuestionContent question={preview} /></div>
        </Modal>
      )}
      {editor && (
        <QuestionEditor
          initial={editor.draft}
          canSubmit={editor.canSubmit}
          subjects={ownSubjects}
          onClose={() => setEditor(null)}
          onSaved={() => { setEditor(null); void load(); }}
        />
      )}
      {review && <ReviewDialog question={review.question} initialDecision={review.decision} onClose={() => setReview(null)} onDone={() => { setReview(null); void load(); }} />}
      <Confirm
        open={!!confirmDelete}
        title="Move to recycle bin?"
        message="The question is hidden from the bank and cannot be added to new papers. It can be restored from the recycle bin. Papers that already use it are not changed."
        confirmLabel="Move to recycle bin"
        onConfirm={() => confirmDelete && void remove(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
