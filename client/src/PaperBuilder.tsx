import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  checkPaperMarks,
  effectiveItemMarks,
  hasStructuredMarks,
  QUESTION_TYPE_LABELS,
  type PaperDTO,
  type PaperHeader,
  type PaperSummaryDTO,
  type PaperVersionDTO,
  type QuestionDTO,
  type SubjectDTO,
  type TemplateDTO,
} from '@skans/shared';
import { useSearchParams } from 'react-router-dom';
import { ArrowDown, ArrowLeft, ArrowUp, CheckCircle2, Copy, Download, Eye, FilePlus2, FileText, GripVertical, History, Lock, Plus, Save, Search, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { api, apiText } from './api';
import { Confirm } from './components/Confirm';
import { Modal } from './components/Modal';
import { QuestionContent } from './questions/QuestionPreview';

interface BuilderItem { question: QuestionDTO; section: string; marksOverride: number | null; newPage: boolean }
type Step = 'setup' | 'details' | 'questions' | 'output';
const STEPS: { key: Step; label: string }[] = [
  { key: 'setup', label: '1. Subject & template' },
  { key: 'details', label: '2. Paper details' },
  { key: 'questions', label: '3. Questions' },
  { key: 'output', label: '4. Review & output' },
];

const today = () => new Date().toISOString().slice(0, 10);
const blankHeader = (): PaperHeader => ({ session: '', examDate: today(), durationMinutes: 180, readingMinutes: 15, maxMarks: 100, batchNo: '', teacherName: '', testNo: '', titleOverride: '', instructionsOverride: null });
const plain = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const itemMarks = (it: BuilderItem) => effectiveItemMarks(it.question, it.marksOverride);

function PaperLibrary({ onOpen, onNew }: { onOpen(id: number): void; onNew(): void }) {
  const [papers, setPapers] = useState<PaperSummaryDTO[]>([]);
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState<PaperSummaryDTO | null>(null);
  const [history, setHistory] = useState<PaperSummaryDTO | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (status) query.set('status', status);
      if (q.trim()) query.set('q', q.trim());
      setPapers(await api<PaperSummaryDTO[]>(`/papers?${query}`));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to load papers');
    } finally {
      setLoading(false);
    }
  }, [status, q]);
  useEffect(() => {
    const t = setTimeout(() => void load(), 250);
    return () => clearTimeout(t);
  }, [load]);

  async function duplicate(p: PaperSummaryDTO) {
    try {
      const copy = await api<PaperDTO>(`/papers/${p.id}/duplicate`, { method: 'POST' });
      toast.success('Copied as a new draft');
      onOpen(copy.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to duplicate');
    }
  }
  async function remove(p: PaperSummaryDTO) {
    setConfirm(null);
    try {
      await api(`/papers/${p.id}`, { method: 'DELETE' });
      toast.success('Paper deleted');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to delete');
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">Examinations</p>
          <h2 className="text-3xl font-semibold text-ink">Papers</h2>
          <p className="mt-1 text-sm text-slate-500">Saved papers, versions and downloads. Final papers print from their frozen version.</p>
        </div>
        <button className="primary" onClick={onNew}><FilePlus2 size={17} />New paper</button>
      </div>
      <div className="card mt-6 grid gap-3 p-4 sm:grid-cols-[1fr_200px]">
        <label className="relative"><Search className="absolute left-3 top-3 text-slate-400" size={17} /><input className="field !pl-10" placeholder="Search by title…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search papers" /></label>
        <select className="field" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status"><option value="">All statuses</option><option value="DRAFT">Draft</option><option value="FINAL">Final</option></select>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {loading && <div className="card p-8 text-center text-sm text-slate-500 md:col-span-2">Loading papers…</div>}
        {!loading && papers.length === 0 && <div className="card p-8 text-center text-sm text-slate-500 md:col-span-2">No papers yet. Start with “New paper”.</div>}
        {papers.map((p) => {
          const ok = p.totalMarks === p.maxMarks;
          return (
            <article key={p.id} className="card flex flex-col p-5">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="badge bg-slate-100 text-navy">{p.subjectCode}</span>
                <span className={`badge ${p.status === 'FINAL' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{p.status === 'FINAL' ? 'Final' : 'Draft'}</span>
                <span className="text-slate-500">{p.templateName}</span>
              </div>
              <button className="mt-2 text-left font-semibold text-ink hover:underline" onClick={() => onOpen(p.id)}>{p.title}</button>
              <p className="mt-1 text-sm text-slate-500">
                {p.questionCount} question{p.questionCount === 1 ? '' : 's'} · <span className={ok ? 'text-emerald-700' : 'font-semibold text-amber-700'}>{p.totalMarks}/{p.maxMarks} marks</span> · v{p.currentVersion} · {p.createdBy} · {new Date(p.updatedAt).toLocaleDateString()}
              </p>
              <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                <button className="primary !min-h-9" onClick={() => onOpen(p.id)}>Open</button>
                <a className="secondary !min-h-9" href={`/api/papers/${p.id}/pdf`} download><Download size={15} />Paper</a>
                <a className="secondary !min-h-9" href={`/api/papers/${p.id}/answer-key.pdf`} download><Download size={15} />Answer key</a>
                <button className="action" title="Version history" onClick={() => setHistory(p)}><History size={17} /></button>
                <button className="action" title="Duplicate as a new draft" onClick={() => void duplicate(p)}><Copy size={17} /></button>
                <button className="action text-red-600" title="Delete paper" onClick={() => setConfirm(p)}><Trash2 size={17} /></button>
              </div>
            </article>
          );
        })}
      </div>
      <Confirm open={!!confirm} title="Delete this paper?" message="The paper and its versions are removed from the list. Questions in the bank are not affected." confirmLabel="Delete paper" onConfirm={() => confirm && void remove(confirm)} onCancel={() => setConfirm(null)} />
      {history && <VersionHistory paper={history} onClose={() => setHistory(null)} onRestored={(id) => { setHistory(null); onOpen(id); }} />}
    </div>
  );
}

function VersionHistory({ paper, onClose, onRestored }: { paper: { id: number; title: string }; onClose(): void; onRestored(id: number): void }) {
  const [versions, setVersions] = useState<PaperVersionDTO[] | null>(null);
  const [confirm, setConfirm] = useState<number | null>(null);
  useEffect(() => { api<PaperVersionDTO[]>(`/papers/${paper.id}/versions`).then(setVersions).catch((e) => toast.error(e.message)); }, [paper.id]);
  async function restore(version: number) {
    setConfirm(null);
    try {
      const res = await api<{ skipped: number }>(`/papers/${paper.id}/versions/${version}/restore`, { method: 'POST' });
      toast.success(res.skipped ? `Restored as a new draft; ${res.skipped} question(s) no longer approved were left out` : 'Restored as a new draft version');
      onRestored(paper.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to restore');
    }
  }
  return (
    <Modal eyebrow="Version history" title={paper.title} size="md" onClose={onClose}>
      {!versions ? <p className="text-sm text-slate-500">Loading…</p> : (
        <ol className="space-y-2">
          {versions.map((v, i) => (
            <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 p-3">
              <div>
                <p className="text-sm font-semibold text-ink">Version {v.version} {i === 0 && <span className="badge ml-1 bg-blue-50 text-blue-700">Current</span>} <span className={`badge ml-1 ${v.status === 'FINAL' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{v.status === 'FINAL' ? 'Final' : 'Draft'}</span></p>
                <p className="text-xs text-slate-500">{v.note || 'Saved'} · {v.questionCount} questions · {v.totalMarks} marks · {v.createdBy} · {new Date(v.createdAt).toLocaleString()}</p>
              </div>
              {i > 0 && <button className="secondary !min-h-9" onClick={() => setConfirm(v.version)}>Restore</button>}
            </li>
          ))}
        </ol>
      )}
      <Confirm open={confirm !== null} title={`Restore version ${confirm}?`} message="The paper is replaced by this version and saved as a new draft version. Nothing is deleted: the current version stays in the history." confirmLabel="Restore" onConfirm={() => confirm !== null && void restore(confirm)} onCancel={() => setConfirm(null)} />
    </Modal>
  );
}

function Builder({ paperId, initialStep, onBack, onSavedNew }: { paperId: number | null; initialStep: Step | null; onBack(): void; onSavedNew(id: number): void }) {
  const [step, setStep] = useState<Step>(initialStep ?? 'setup');
  const [subjects, setSubjects] = useState<SubjectDTO[]>([]);
  const [templates, setTemplates] = useState<TemplateDTO[]>([]);
  const [subjectId, setSubjectId] = useState(0);
  const [templateId, setTemplateId] = useState(0);
  const [title, setTitle] = useState('');
  const [header, setHeader] = useState<PaperHeader>(blankHeader);
  const [items, setItems] = useState<BuilderItem[]>([]);
  const [status, setStatus] = useState<'DRAFT' | 'FINAL'>('DRAFT');
  const [version, setVersion] = useState(0);
  const [available, setAvailable] = useState<QuestionDTO[]>([]);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [preview, setPreview] = useState<{ mode: 'paper' | 'key'; html: string } | null>(null);
  const [peek, setPeek] = useState<QuestionDTO | null>(null);
  const [confirmReopen, setConfirmReopen] = useState(false);
  const [confirmSubject, setConfirmSubject] = useState<number | null>(null);
  const [watermark, setWatermark] = useState(false);
  const [history, setHistory] = useState(false);
  const [reload, setReload] = useState(0);

  // Initial load: lists, then the paper being edited.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [s, t] = await Promise.all([api<SubjectDTO[]>('/subjects'), api<TemplateDTO[]>('/templates')]);
        if (cancelled) return;
        const activeSubjects = s.filter((x) => x.isActive);
        setSubjects(activeSubjects);
        setTemplates(t);
        if (paperId) {
          const p = await api<PaperDTO>(`/papers/${paperId}`);
          if (cancelled) return;
          setSubjectId(p.subjectId);
          setTemplateId(p.templateId);
          setTitle(p.title);
          setHeader(p.header);
          setStatus(p.status);
          setVersion(p.currentVersion);
          setItems(p.items.map((i) => ({ question: i.question, section: i.section, marksOverride: i.marksOverride, newPage: i.newPage })));
          if (!initialStep) setStep('questions');
        } else if (activeSubjects[0]) {
          setSubjectId(activeSubjects[0].id);
          setTemplateId(activeSubjects[0].templateId ?? t.find((x) => x.isActive)?.id ?? 0);
          // Never overwrite a title the user already typed while the lists were loading.
          setTitle((current) => current || activeSubjects[0].name);
        }
        setDirty(false);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Unable to load the paper');
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paperId, reload]);

  useEffect(() => {
    if (!subjectId) return;
    api<{ items: QuestionDTO[] }>(`/questions?subjectId=${subjectId}&status=APPROVED&pageSize=100&sort=subject`)
      .then((r) => setAvailable(r.items))
      .catch((error) => toast.error(error.message));
  }, [subjectId]);

  const template = templates.find((t) => t.id === templateId);
  const sectionNames = template?.config.sections.enabled ? template.config.sections.names : [];
  const marks = useMemo(() => checkPaperMarks(items.map(itemMarks), header.maxMarks), [items, header.maxMarks]);
  const filtered = available.filter((q) => !items.some((i) => i.question.id === q.id) && `${q.topic} ${q.source} ${plain(q.body)} ${q.type}`.toLowerCase().includes(search.toLowerCase()));
  const isFinal = status === 'FINAL';

  const change = <T,>(fn: (v: T) => void) => (v: T) => { fn(v); setDirty(true); };
  const setH = <K extends keyof PaperHeader>(key: K, value: PaperHeader[K]) => { setHeader((h) => ({ ...h, [key]: value })); setDirty(true); };
  const setItemsDirty = (next: BuilderItem[]) => { setItems(next); setDirty(true); };
  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return;
    const next = [...items];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    setItemsDirty(next);
  };
  const add = (q: QuestionDTO) => setItemsDirty([...items, { question: q, section: sectionNames[0] ?? '', marksOverride: null, newPage: false }]);

  function chooseSubject(id: number) {
    if (items.length) return setConfirmSubject(id);
    applySubject(id);
  }
  function applySubject(id: number) {
    const s = subjects.find((x) => x.id === id);
    setSubjectId(id);
    setItems([]);
    if (s?.templateId) setTemplateId(s.templateId);
    if (!title || subjects.some((x) => x.name === title)) setTitle(s?.name ?? '');
    setDirty(true);
    setConfirmSubject(null);
  }

  const payloadItems = () => items.map((i) => ({ questionId: i.question.id, section: i.section, marksOverride: hasStructuredMarks(i.question.type, i.question.content) ? null : i.marksOverride, newPage: i.newPage }));

  async function showPreview(mode: 'paper' | 'key') {
    try {
      const html = await apiText('/papers/preview?format=html', { method: 'POST', body: JSON.stringify({ title, subjectId, templateId, header, items: payloadItems(), mode }) });
      setPreview({ mode, html });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to render the preview');
    }
  }

  async function save(nextStatus: 'DRAFT' | 'FINAL') {
    if (!title.trim()) { setStep('setup'); return toast.error('Enter a paper title first.'); }
    if (!items.length) { setStep('questions'); return toast.error('Add at least one approved question.'); }
    if (nextStatus === 'FINAL' && marks.status !== 'match') return toast.error(marks.message);
    setBusy(true);
    try {
      const note = nextStatus === 'FINAL' ? 'Finalised' : isFinal ? 'Reopened as draft' : 'Saved';
      const body = JSON.stringify({ title, subjectId, templateId, status: nextStatus, header, items: payloadItems(), versionNote: note, acknowledgeMarksMismatch: false });
      const saved = await api<PaperDTO>(paperId ? `/papers/${paperId}` : '/papers', { method: paperId ? 'PUT' : 'POST', body });
      setStatus(saved.status);
      setVersion(saved.currentVersion);
      setDirty(false);
      toast.success(nextStatus === 'FINAL' ? `Paper finalised (version ${saved.currentVersion})` : `Draft saved (version ${saved.currentVersion})`);
      if (!paperId) onSavedNew(saved.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save the paper');
    } finally {
      setBusy(false);
      setConfirmReopen(false);
    }
  }

  const stepIndex = STEPS.findIndex((s) => s.key === step);
  const marksTone = marks.status === 'match' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-amber-800 bg-amber-50 border-amber-200';

  return (
    <div className="mx-auto max-w-7xl">
      <button className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-ink" onClick={onBack}><ArrowLeft size={16} />All papers</button>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-slate-500">{paperId ? `Paper #${paperId} · version ${version}` : 'New paper'}{dirty && ' · unsaved changes'}</p>
          <h2 className="truncate text-2xl font-semibold text-ink sm:text-3xl">{title || 'Untitled paper'}</h2>
        </div>
        <div className={`rounded-xl border px-4 py-2 text-sm font-semibold ${marksTone}`} role="status">{marks.status === 'empty' ? 'No questions yet' : marks.message}</div>
      </div>

      {isFinal && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <Lock size={18} /><span className="flex-1">This paper is <strong>final</strong>. Downloads print the frozen version {version}. Saving changes reopens it as a draft (the final version stays in the history).</span>
        </div>
      )}

      <nav className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Paper builder steps">
        {STEPS.map((s, i) => (
          <button key={s.key} onClick={() => setStep(s.key)} aria-current={step === s.key ? 'step' : undefined} className={`min-h-11 rounded-xl px-3 text-left text-sm font-semibold ${step === s.key ? 'bg-navy text-white' : i < stepIndex ? 'bg-white text-navy shadow-card' : 'bg-white text-slate-500 shadow-card'}`}>{s.label}</button>
        ))}
      </nav>

      {step === 'setup' && (
        <section className="card mt-5 grid gap-4 p-5 sm:grid-cols-2">
          <label className="label sm:col-span-2">Paper title (printed as the main heading)<input className="field mt-1" value={title} maxLength={200} onChange={(e) => change(setTitle)(e.target.value)} placeholder="e.g. Financial Accounting and Reporting" /></label>
          <label className="label">Subject (CAF)
            <select className="field mt-1" value={subjectId} onChange={(e) => chooseSubject(Number(e.target.value))}>{subjects.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}</select>
          </label>
          <label className="label">Paper format
            <select className="field mt-1" value={templateId} onChange={(e) => change(setTemplateId)(Number(e.target.value))}>{templates.filter((t) => t.isActive || t.id === templateId).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
          </label>
          {template && <p className="text-xs text-slate-500 sm:col-span-2">{template.description}</p>}
          <div className="flex justify-end sm:col-span-2"><button className="primary" onClick={() => setStep('details')}>Next: paper details</button></div>
        </section>
      )}

      {step === 'details' && (
        <section className="card mt-5 p-5">
          <div className="mb-4 rounded-xl bg-blue-50 p-3 text-xs leading-5 text-blue-900">These values are printed in the paper header. Batch, teacher and test number are printed by formats that show them (SKANS Internal Test).</div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="label">Session<input className="field mt-1" value={header.session} maxLength={60} onChange={(e) => setH('session', e.target.value)} placeholder="e.g. Spring 2026" /></label>
            <label className="label">Exam date<input className="field mt-1" type="date" value={header.examDate} onChange={(e) => setH('examDate', e.target.value)} /></label>
            <label className="label">Maximum marks<input className="field mt-1" type="number" min={0} max={500} value={header.maxMarks} onChange={(e) => setH('maxMarks', Number(e.target.value))} /></label>
            <label className="label">Duration (minutes)<input className="field mt-1" type="number" min={0} max={600} value={header.durationMinutes} onChange={(e) => setH('durationMinutes', Number(e.target.value))} /></label>
            <label className="label">Reading time (minutes)<input className="field mt-1" type="number" min={0} max={120} value={header.readingMinutes} onChange={(e) => setH('readingMinutes', Number(e.target.value))} /></label>
            <label className="label">Heading override<input className="field mt-1" value={header.titleOverride} maxLength={200} onChange={(e) => setH('titleOverride', e.target.value)} placeholder="Optional; replaces the title" /></label>
            <label className="label">Batch number<input className="field mt-1" value={header.batchNo} maxLength={40} onChange={(e) => setH('batchNo', e.target.value)} /></label>
            <label className="label">Teacher name<input className="field mt-1" value={header.teacherName} maxLength={120} onChange={(e) => setH('teacherName', e.target.value)} /></label>
            <label className="label">Test number<input className="field mt-1" value={header.testNo} maxLength={40} onChange={(e) => setH('testNo', e.target.value)} /></label>
          </div>
          <div className="mt-5">
            <label className="label flex flex-wrap items-center gap-3">
              <input type="checkbox" className="h-4 w-4" checked={header.instructionsOverride !== null} onChange={(e) => setH('instructionsOverride', e.target.checked ? [...(template?.config.instructions.lines ?? [])] : null)} />
              Use custom instructions for this paper
            </label>
            {header.instructionsOverride === null ? (
              <div className="mt-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                <p className="text-xs font-semibold uppercase text-slate-400">Format default instructions</p>
                <ol className="mt-1 list-[lower-roman] pl-6">{(template?.config.instructions.lines ?? []).map((l) => <li key={l}>{l.replace(/\*\*/g, '')}</li>)}</ol>
              </div>
            ) : (
              <>
                <textarea className="field mt-2" rows={5} value={header.instructionsOverride.join('\n')} onChange={(e) => setH('instructionsOverride', e.target.value.split('\n').slice(0, 20))} />
                <p className="mt-1 text-xs text-slate-500">One instruction per line (max 20). Use **double asterisks** for bold, {'{count}'} / {'{countWord}'} for the number of questions.</p>
              </>
            )}
          </div>
          <div className="mt-5 flex justify-end"><button className="primary" onClick={() => setStep('questions')}>Next: questions</button></div>
        </section>
      )}

      {step === 'questions' && (
        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <section className="card p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><h3 className="font-semibold">Approved questions</h3><p className="text-xs text-slate-500">Only approved questions of this subject can be added.</p></div>
              <label className="relative w-full sm:w-56"><Search className="absolute left-3 top-3 text-slate-400" size={16} /><input className="field !pl-9" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search approved questions" /></label>
            </div>
            <div className="mt-3 max-h-[60vh] space-y-2 overflow-y-auto pr-1">
              {filtered.length === 0 && <p className="rounded-lg bg-slate-50 p-4 text-center text-sm text-slate-500">{available.length ? 'All matching questions are already in the paper.' : 'No approved questions for this subject yet.'}</p>}
              {filtered.map((q) => (
                <div key={q.id} className="flex items-start gap-2 rounded-xl border border-slate-200 p-3">
                  <button className="min-w-0 flex-1 text-left" onClick={() => setPeek(q)}>
                    <p className="text-sm font-semibold text-ink">{q.topic || 'Untitled'}</p>
                    <p className="text-xs text-slate-500">{QUESTION_TYPE_LABELS[q.type]} · {q.marks} marks{q.usedInPapers ? ` · used in ${q.usedInPapers} paper(s)` : ''}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-500">{plain(q.body)}</p>
                  </button>
                  <button className="secondary !min-h-10 shrink-0" onClick={() => add(q)} aria-label={`Add ${q.topic}`}><Plus size={16} />Add</button>
                </div>
              ))}
            </div>
          </section>

          <section className="card p-4 sm:p-5">
            <h3 className="font-semibold">Paper order</h3>
            <p className="text-xs text-slate-500">Use the arrows (or drag on a desktop) to reorder. Consecutive MCQs and true/false items print as one numbered question.</p>
            <div className="mt-3 space-y-2">
              {items.length === 0 && <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">Add approved questions from the list.</div>}
              {items.map((it, index) => {
                const structured = hasStructuredMarks(it.question.type, it.question.content);
                return (
                  <div
                    key={it.question.id}
                    draggable
                    onDragStart={() => setDragIndex(index)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => { if (dragIndex !== null) move(dragIndex, index); setDragIndex(null); }}
                    className="rounded-xl border border-slate-200 bg-white p-3"
                  >
                    <div className="flex items-start gap-2">
                      <GripVertical className="mt-1 hidden shrink-0 cursor-grab text-slate-300 lg:block" size={17} />
                      <button className="min-w-0 flex-1 text-left" onClick={() => setPeek(it.question)}>
                        <p className="text-sm font-semibold">{index + 1}. {it.question.topic || QUESTION_TYPE_LABELS[it.question.type]}</p>
                        <p className="text-xs text-slate-500">{QUESTION_TYPE_LABELS[it.question.type]} · #{it.question.id}</p>
                      </button>
                      <div className="flex shrink-0">
                        <button onClick={() => move(index, index - 1)} disabled={index === 0} className="action disabled:opacity-30" title="Move up"><ArrowUp size={16} /></button>
                        <button onClick={() => move(index, index + 1)} disabled={index === items.length - 1} className="action disabled:opacity-30" title="Move down"><ArrowDown size={16} /></button>
                        <button onClick={() => setItemsDirty(items.filter((_, i) => i !== index))} className="action text-red-600" title="Remove from paper"><X size={16} /></button>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap items-end gap-3 pl-0 lg:pl-6">
                      {sectionNames.length > 0 && (
                        <label className="label text-xs">Section
                          <select className="field mt-1 !min-h-10 !py-1.5 text-sm" value={it.section} onChange={(e) => setItemsDirty(items.map((x, i) => (i === index ? { ...x, section: e.target.value } : x)))}>
                            <option value="">No section</option>{sectionNames.map((n) => <option key={n}>{n}</option>)}
                          </select>
                        </label>
                      )}
                      <label className="label text-xs">Marks
                        <input
                          className="field mt-1 w-24 !py-1.5 text-sm"
                          type="number" min={0} max={200} step={0.5}
                          value={itemMarks(it)}
                          disabled={structured}
                          title={structured ? 'Marks come from the question parts / MCQ items' : 'Override the marks for this paper only'}
                          onChange={(e) => setItemsDirty(items.map((x, i) => (i === index ? { ...x, marksOverride: e.target.value === '' ? null : Number(e.target.value) } : x)))}
                        />
                      </label>
                      {it.marksOverride !== null && !structured && it.marksOverride !== it.question.marks && (
                        <button className="mb-2 text-xs font-semibold text-slate-500 underline" onClick={() => setItemsDirty(items.map((x, i) => (i === index ? { ...x, marksOverride: null } : x)))}>Reset to {it.question.marks}</button>
                      )}
                      <label className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-600"><input type="checkbox" className="h-4 w-4" checked={it.newPage} onChange={(e) => setItemsDirty(items.map((x, i) => (i === index ? { ...x, newPage: e.target.checked } : x)))} />Start on a new page</label>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex justify-end"><button className="primary" onClick={() => setStep('output')}>Next: review & output</button></div>
          </section>
        </div>
      )}

      {step === 'output' && (
        <section className="card mt-5 p-5">
          <div className="grid gap-4 md:grid-cols-3">
            <div className={`rounded-xl border p-4 ${marksTone}`}>
              <p className="text-xs font-bold uppercase">Marks check</p>
              <p className="mt-1 text-2xl font-semibold">{marks.total} / {header.maxMarks}</p>
              <p className="mt-1 text-xs">{marks.status === 'match' ? 'Ready to finalise.' : marks.status === 'empty' ? 'Add questions first.' : `${marks.message} Adjust marks or maximum marks before finalising.`}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4 text-sm text-slate-600">
              <p className="text-xs font-bold uppercase text-slate-400">What is printed</p>
              <ul className="mt-1 space-y-1">
                <li><strong>Question paper:</strong> questions, options, marks, header and instructions.</li>
                <li><strong>Answer key:</strong> correct options, model answers and examiner advice.</li>
                <li><strong>Never printed:</strong> internal comments, sources and review comments.</li>
              </ul>
            </div>
            <div className="rounded-xl border border-slate-200 p-4 text-sm text-slate-600">
              <p className="text-xs font-bold uppercase text-slate-400">Status</p>
              <p className="mt-1 font-semibold text-ink">{isFinal ? `Final — version ${version}` : paperId ? `Draft — version ${version}` : 'Not saved yet'}</p>
              {dirty && <p className="mt-1 text-xs text-amber-700">You have unsaved changes. Downloads use the last saved version.</p>}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button className="secondary" onClick={() => void showPreview('paper')} disabled={!items.length}><Eye size={16} />Preview paper</button>
            <button className="secondary" onClick={() => void showPreview('key')} disabled={!items.length}><Eye size={16} />Preview answer key</button>
            <span className="hidden flex-1 sm:block" />
            <button className="secondary" disabled={busy} onClick={() => (isFinal ? setConfirmReopen(true) : void save('DRAFT'))}><Save size={16} />{isFinal ? 'Reopen as draft' : 'Save draft'}</button>
            <button className="success" disabled={busy || marks.status !== 'match'} title={marks.status !== 'match' ? marks.message : undefined} onClick={() => void save('FINAL')}><CheckCircle2 size={16} />{isFinal ? 'Save final version' : 'Finalise paper'}</button>
          </div>

          <div className="mt-6 border-t border-slate-100 pt-5">
            <h3 className="font-semibold">Downloads</h3>
            {!paperId ? <p className="mt-1 text-sm text-slate-500">Save the paper to enable PDF downloads.</p> : (
              <>
                <label className="mt-2 flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" className="h-4 w-4" checked={watermark} onChange={(e) => setWatermark(e.target.checked)} />Add a CONFIDENTIAL watermark with my username and the time</label>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a className="primary" href={`/api/papers/${paperId}/pdf?watermark=${watermark ? 1 : 0}`} download><FileText size={16} />Question paper PDF</a>
                  <a className="primary" href={`/api/papers/${paperId}/answer-key.pdf?watermark=${watermark ? 1 : 0}`} download><FileText size={16} />Answer key PDF</a>
                  <button className="secondary" onClick={() => setHistory(true)}><History size={16} />Version history</button>
                </div>
                <p className="mt-2 text-xs text-slate-500">Every download is recorded in the audit log.</p>
              </>
            )}
          </div>
        </section>
      )}

      {preview && (
        <Modal size="xl" eyebrow="Live preview — same renderer as the PDF" title={preview.mode === 'paper' ? 'Question paper' : 'Answer key'} onClose={() => setPreview(null)} footer={<>
          <button className="secondary" onClick={() => void showPreview(preview.mode === 'paper' ? 'key' : 'paper')}>Show {preview.mode === 'paper' ? 'answer key' : 'question paper'}</button>
          <button className="primary" onClick={() => setPreview(null)}>Close</button>
        </>}>
          <p className="mb-3 text-xs text-slate-500">Page breaks, running headers and “Page X of Y” appear in the PDF only.</p>
          <iframe title="Paper preview" srcDoc={preview.html} sandbox="" className="h-[70vh] w-full rounded-lg border border-slate-200 bg-white" />
        </Modal>
      )}
      {peek && (
        <Modal eyebrow={`Question #${peek.id}`} title={peek.topic || 'Untitled'} onClose={() => setPeek(null)} footer={<button className="primary" onClick={() => setPeek(null)}>Close</button>}>
          <QuestionContent question={peek} showPrivate={false} />
        </Modal>
      )}
      {history && paperId && <VersionHistory paper={{ id: paperId, title }} onClose={() => setHistory(false)} onRestored={() => { setHistory(false); setReload((n) => n + 1); }} />}
      <Confirm open={confirmReopen} title="Reopen the final paper as a draft?" message="The paper becomes a draft again and the final version stays in the version history. Finalise again when you are done." confirmLabel="Reopen as draft" onConfirm={() => void save('DRAFT')} onCancel={() => setConfirmReopen(false)} />
      <Confirm open={confirmSubject !== null} title="Change subject?" message="Questions belong to one subject, so the questions already in this paper will be removed." confirmLabel="Change subject" onConfirm={() => confirmSubject !== null && applySubject(confirmSubject)} onCancel={() => setConfirmSubject(null)} />
    </div>
  );
}

/** Paper library and builder. The selected paper lives in the URL so tablets can go back and forth. */
export function PaperBuilder() {
  const [params, setParams] = useSearchParams();
  const view = params.get('paper');
  const open = (id: number | 'new' | null) => setParams(id === null ? {} : { paper: String(id) });
  if (view === null) return <PaperLibrary onOpen={(id) => open(id)} onNew={() => open('new')} />;
  const paperId = view === 'new' ? null : Number(view);
  const step = STEPS.find((s) => s.key === params.get('step'))?.key ?? null;
  return <Builder key={view} paperId={paperId} initialStep={step} onBack={() => open(null)} onSavedNew={(id) => setParams({ paper: String(id), step: 'output' }, { replace: true })} />;
}
