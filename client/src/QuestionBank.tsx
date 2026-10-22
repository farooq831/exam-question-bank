import { useCallback, useEffect, useMemo, useState } from 'react';
import { QUESTION_TYPES, type Paged, type QuestionDTO, type SubjectDTO } from '@skans/shared';
import { useSearchParams } from 'react-router-dom';
import { ArchiveRestore, Check, Copy, Library, Pencil, Plus, Send, Trash2, Trash } from 'lucide-react';
import { toast } from 'sonner';
import { api } from './api';
import { useAuth } from './auth';
import { Confirm } from './components/Confirm';
import { Modal } from './components/Modal';
import { Chips, EmptyState, IconButton, PageHeader, Pager, SearchBox } from './components/ui';
import { draftFromQuestion, emptyDraft, questionActions, type QuestionDraft } from './questions/model';
import { QuestionContent, QuestionMeta, TYPE_SHORT } from './questions/QuestionPreview';
import { QuestionEditor } from './questions/QuestionEditor';
import { ReviewDialog } from './questions/ReviewDialog';
import { StatusBadge } from './questions/StatusBadge';

const PAGE_SIZE = 15;
const plain = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const STATUS_CHIPS = [
  { value: '', label: 'All' },
  { value: 'DRAFT', label: 'Drafts' },
  { value: 'SUBMITTED', label: 'In review' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Returned' },
];

export function QuestionBank() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [subjects, setSubjects] = useState<SubjectDTO[]>([]);
  const [result, setResult] = useState<Paged<QuestionDTO>>({ items: [], total: 0, page: 1, pageSize: PAGE_SIZE });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(params.get('q') ?? '');
  const [editor, setEditor] = useState<{ draft: QuestionDraft; canSubmit: boolean } | null>(null);
  const [preview, setPreview] = useState<QuestionDTO | null>(null);
  const [review, setReview] = useState<QuestionDTO | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<QuestionDTO | null>(null);
  const [confirmPurge, setConfirmPurge] = useState<QuestionDTO | null>(null);

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

  // Subjects the user may write questions in: all for the administrator, assigned ones for teachers.
  const ownSubjects = user ? subjects.filter((s) => user.role === 'ADMIN' || user.subjectIds.includes(s.id)) : [];

  // Dashboard quick action: /questions?new=1 opens a blank editor once subjects are known.
  useEffect(() => {
    if (params.get('new') !== '1' || !ownSubjects.length) return;
    const next = new URLSearchParams(params);
    next.delete('new');
    setParams(next, { replace: true });
    setEditor({ draft: emptyDraft(ownSubjects[0].id), canSubmit: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, ownSubjects.length]);

  if (!user) return null;
  const pages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));
  const inBin = filters.deleted === '1';

  async function openEditor(q?: QuestionDTO) {
    if (!q) {
      if (!ownSubjects.length) return toast.error('No subjects are assigned to you yet.');
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

  async function del(q: QuestionDTO, permanent: boolean) {
    setConfirmDelete(null);
    setConfirmPurge(null);
    try {
      await api(`/questions/${q.id}${permanent ? '/permanent' : ''}`, { method: 'DELETE' });
      toast.success(permanent ? 'Deleted permanently' : 'Moved to recycle bin');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to delete');
    }
  }

  return (
    <div>
      <PageHeader title="Questions" count={result.total} actions={<button onClick={() => void openEditor()} disabled={!ownSubjects.length} className="primary"><Plus size={16} />New question</button>} />

      <div className="mb-3 flex flex-wrap gap-2">
        <SearchBox className="min-w-[200px] flex-1" value={search} onChange={setSearch} placeholder="Search questions" />
        <select className="field !w-auto min-w-[140px]" value={filters.subjectId} onChange={(e) => setFilter('subjectId', e.target.value)} aria-label="Subject">
          <option value="">All subjects</option>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.code}</option>)}
        </select>
        <select className="field !w-auto min-w-[130px]" value={filters.type} onChange={(e) => setFilter('type', e.target.value)} aria-label="Type">
          <option value="">All types</option>
          {QUESTION_TYPES.map((t) => <option key={t} value={t}>{TYPE_SHORT[t]}</option>)}
        </select>
      </div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        {inBin ? <p className="text-sm font-medium text-slate-500">Recycle bin</p> : <Chips options={STATUS_CHIPS} value={filters.status} onChange={(v) => setFilter('status', v)} />}
        <div className="flex gap-1.5">
          {!inBin && <button className="chip" aria-pressed={filters.mine === '1'} onClick={() => setFilter('mine', filters.mine === '1' ? '' : '1')}>Mine</button>}
          <button className="chip" aria-pressed={inBin} onClick={() => setFilter('deleted', inBin ? '' : '1')} title="Recycle bin"><Trash size={14} />{inBin ? 'Back to questions' : 'Bin'}</button>
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading && result.items.length === 0 ? (
          <p className="p-10 text-center text-sm text-slate-400">Loading…</p>
        ) : result.items.length === 0 ? (
          <EmptyState icon={inBin ? Trash : Library} title={inBin ? 'The recycle bin is empty' : 'No questions found'} action={!inBin && ownSubjects.length ? <button className="secondary" onClick={() => void openEditor()}><Plus size={16} />New question</button> : undefined} />
        ) : (
          result.items.map((q) => {
            const can = questionActions(user, q);
            const title = q.topic || plain(q.body) || 'Untitled question';
            return (
              <div key={q.id} className="list-row">
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setPreview(q)}>
                  <p className="truncate font-medium text-ink">{title}</p>
                  <p className="mt-0.5 truncate text-xs text-slate-400">
                    {q.subjectCode} · {TYPE_SHORT[q.type]} · {q.marks} mark{q.marks === 1 ? '' : 's'} · {q.createdBy}
                  </p>
                  {q.status === 'REJECTED' && q.reviewComment && !inBin && <p className="mt-1 truncate text-xs text-red-600">↳ {q.reviewComment}</p>}
                </button>
                <div className="shrink-0"><StatusBadge status={q.status} /></div>
                <div className="flex shrink-0 items-center">
                  {inBin ? (
                    <>
                      {can.restore && <IconButton label="Restore" icon={ArchiveRestore} onClick={() => void post(q, '/restore', 'Restored')} />}
                      {can.purge && <IconButton label={q.usedInPapers ? 'Used in a paper — cannot delete permanently' : 'Delete permanently'} icon={Trash2} tone="danger" disabled={!!q.usedInPapers} onClick={() => setConfirmPurge(q)} />}
                    </>
                  ) : (
                    <>
                      {can.review && <IconButton label="Review" icon={Check} tone="success" onClick={() => setReview(q)} />}
                      {can.submit && <IconButton label="Submit for review" icon={Send} onClick={() => void post(q, '/submit', 'Submitted for review')} />}
                      {can.edit && <IconButton label="Edit" icon={Pencil} onClick={() => void openEditor(q)} />}
                      {can.duplicate && <IconButton label="Duplicate" icon={Copy} onClick={() => void post(q, '/duplicate', 'Copied as a new draft')} />}
                      {can.remove && <IconButton label="Move to recycle bin" icon={Trash2} tone="danger" onClick={() => setConfirmDelete(q)} />}
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
      <Pager page={filters.page} pages={pages} onPage={(p) => setFilter('page', String(p))} />

      {preview && (
        <Modal title={preview.topic || 'Question'} eyebrow={`#${preview.id} · ${preview.createdBy}${preview.reviewedBy ? ` · reviewed by ${preview.reviewedBy}` : ''}`} onClose={() => setPreview(null)}>
          <QuestionMeta question={preview} />
          <div className="mt-4"><QuestionContent question={preview} /></div>
        </Modal>
      )}
      {editor && (
        <QuestionEditor initial={editor.draft} canSubmit={editor.canSubmit} subjects={ownSubjects} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); void load(); }} />
      )}
      {review && <ReviewDialog question={review} onClose={() => setReview(null)} onDone={() => { setReview(null); void load(); }} />}
      <Confirm open={!!confirmPurge} danger title="Delete permanently?" message="This cannot be undone." confirmLabel="Delete" onConfirm={() => confirmPurge && void del(confirmPurge, true)} onCancel={() => setConfirmPurge(null)} />
      <Confirm open={!!confirmDelete} title="Move to recycle bin?" message="You can restore it from the bin later." confirmLabel="Move to bin" onConfirm={() => confirmDelete && void del(confirmDelete, false)} onCancel={() => setConfirmDelete(null)} />
    </div>
  );
}
