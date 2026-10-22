import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  cafGroup,
  checkPaperMarks,
  effectiveItemMarks,
  hasStructuredMarks,
  type PaperDTO,
  type PaperHeader,
  type PaperSummaryDTO,
  type PaperVersionDTO,
  type QuestionDTO,
  type SubjectDTO,
  type TemplateDTO,
} from '@skans/shared';
import { useSearchParams } from 'react-router-dom';
import { ArrowDown, ArrowLeft, ArrowUp, CheckCircle2, Copy, Download, Eye, FilePlus2, FileText, History, KeyRound, Plus, Save, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { api, apiText } from './api';
import { Confirm } from './components/Confirm';
import { Modal } from './components/Modal';
import { Chips, EmptyState, IconButton, PageHeader, Pill, SearchBox } from './components/ui';
import { ago } from './Dashboard';
import { QuestionContent, TYPE_SHORT } from './questions/QuestionPreview';

interface BuilderItem { question: QuestionDTO; section: string; marksOverride: number | null; newPage: boolean }
type Tab = 'details' | 'questions' | 'download';

const today = () => new Date().toISOString().slice(0, 10);
const blankHeader = (): PaperHeader => ({ session: '', examDate: today(), durationMinutes: 180, readingMinutes: 15, maxMarks: 100, batchNo: '', teacherName: '', researchOfficers: '', adminName: '', testNo: '', titleOverride: '', instructionsOverride: null });
const plain = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const itemMarks = (it: BuilderItem) => effectiveItemMarks(it.question, it.marksOverride);
const subjectLabel = (s: SubjectDTO) => `${s.level && s.level !== 'CAF' ? `${s.level} · ` : ''}${s.code} — ${s.name}`;

/** Subject picker grouped into CAF Group A (CAF 1-4) and Group B (CAF 5-8). */
function SubjectSelect({ subjects, value, onChange }: { subjects: SubjectDTO[]; value: number; onChange(id: number): void }) {
  const groups: [string, SubjectDTO[]][] = [
    ['Group A', subjects.filter((s) => cafGroup(s.level) === 'A')],
    ['Group B', subjects.filter((s) => cafGroup(s.level) === 'B')],
    ['Other', subjects.filter((s) => !cafGroup(s.level))],
  ];
  return (
    <select className="field mt-1.5" value={value} onChange={(e) => onChange(Number(e.target.value))}>
      {groups.filter(([, list]) => list.length).map(([name, list]) => (
        <optgroup key={name} label={name}>{list.map((s) => <option key={s.id} value={s.id}>{subjectLabel(s)}</option>)}</optgroup>
      ))}
    </select>
  );
}

const STATUS_CHIPS = [{ value: '', label: 'All' }, { value: 'DRAFT', label: 'Drafts' }, { value: 'FINAL', label: 'Final' }];

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
    <div>
      <PageHeader title="Papers" count={loading ? undefined : papers.length} actions={<button className="primary" onClick={onNew}><FilePlus2 size={16} />New paper</button>} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchBox className="min-w-[200px] flex-1" value={q} onChange={setQ} placeholder="Search papers" />
        <Chips options={STATUS_CHIPS} value={status} onChange={setStatus} />
      </div>
      <div className="card overflow-hidden">
        {loading && papers.length === 0 && <p className="p-10 text-center text-sm text-slate-400">Loading…</p>}
        {!loading && papers.length === 0 && <EmptyState icon={FileText} title="No papers yet" action={<button className="secondary" onClick={onNew}><FilePlus2 size={16} />New paper</button>} />}
        {papers.map((p) => (
          <div key={p.id} className="list-row">
            <button className="min-w-0 flex-1 text-left" onClick={() => onOpen(p.id)}>
              <p className="truncate font-medium text-ink">{p.title}</p>
              <p className="mt-0.5 truncate text-xs text-slate-400">{p.subjectCode} · {p.templateName} · {p.questionCount} question{p.questionCount === 1 ? '' : 's'} · {ago(p.updatedAt)}</p>
            </button>
            <span className={`hidden text-sm font-semibold sm:inline ${p.totalMarks === p.maxMarks ? 'text-emerald-700' : 'text-amber-600'}`} title="Total / maximum marks">{p.totalMarks}/{p.maxMarks}</span>
            <Pill tone={p.status === 'FINAL' ? 'green' : 'slate'} dot>{p.status === 'FINAL' ? 'Final' : 'Draft'}</Pill>
            <div className="flex shrink-0 items-center">
              <IconButton label="Download question paper" icon={Download} href={`/api/papers/${p.id}/pdf`} download />
              <IconButton label="Download answer key" icon={KeyRound} href={`/api/papers/${p.id}/answer-key.pdf`} download />
              <IconButton label="Version history" icon={History} onClick={() => setHistory(p)} />
              <IconButton label="Duplicate" icon={Copy} onClick={() => void duplicate(p)} />
              <IconButton label="Delete" icon={Trash2} tone="danger" onClick={() => setConfirm(p)} />
            </div>
          </div>
        ))}
      </div>
      <Confirm open={!!confirm} danger title="Delete this paper?" message="The paper and its versions are removed. Questions are not affected." confirmLabel="Delete" onConfirm={() => confirm && void remove(confirm)} onCancel={() => setConfirm(null)} />
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
      toast.success(res.skipped ? `Restored; ${res.skipped} question(s) no longer approved were left out` : 'Restored as a new draft');
      onRestored(paper.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to restore');
    }
  }
  return (
    <Modal title="Version history" eyebrow={paper.title} size="md" onClose={onClose}>
      {!versions ? <p className="text-sm text-slate-400">Loading…</p> : (
        <ol className="-mx-1">
          {versions.map((v, i) => (
            <li key={v.id} className="list-row !px-1">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink">Version {v.version}{i === 0 && <span className="ml-2 text-xs font-normal text-slate-400">current</span>}</p>
                <p className="truncate text-xs text-slate-400">{v.note || 'Saved'} · {v.totalMarks} marks · {v.createdBy} · {ago(v.createdAt)}</p>
              </div>
              <Pill tone={v.status === 'FINAL' ? 'green' : 'slate'}>{v.status === 'FINAL' ? 'Final' : 'Draft'}</Pill>
              {i > 0 && <button className="ghost !min-h-8 !px-2 text-sm" onClick={() => setConfirm(v.version)}>Restore</button>}
            </li>
          ))}
        </ol>
      )}
      <Confirm open={confirm !== null} title={`Restore version ${confirm}?`} message="It is saved as a new draft version; nothing is deleted." confirmLabel="Restore" onConfirm={() => confirm !== null && void restore(confirm)} onCancel={() => setConfirm(null)} />
    </Modal>
  );
}

const Field = ({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) => <label className={`label ${className}`}>{label}{children}</label>;

function Builder({ paperId, initialTab, onBack, onSavedNew }: { paperId: number | null; initialTab: Tab | null; onBack(): void; onSavedNew(id: number): void }) {
  const [tab, setTab] = useState<Tab>(initialTab ?? 'details');
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
          setHeader({ ...blankHeader(), ...p.header });
          setStatus(p.status);
          setVersion(p.currentVersion);
          setItems(p.items.map((i) => ({ question: i.question, section: i.section, marksOverride: i.marksOverride, newPage: i.newPage })));
          if (!initialTab) setTab('questions');
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
  const fmt = template?.config;
  const sectionNames = fmt?.sections.enabled ? fmt.sections.names : [];
  const marks = useMemo(() => checkPaperMarks(items.map(itemMarks), header.maxMarks), [items, header.maxMarks]);
  const filtered = available.filter((q) => !items.some((i) => i.question.id === q.id) && `${q.topic} ${q.source} ${plain(q.body)} ${q.type}`.toLowerCase().includes(search.toLowerCase()));
  const isFinal = status === 'FINAL';

  const setH = <K extends keyof PaperHeader>(key: K, value: PaperHeader[K]) => { setHeader((h) => ({ ...h, [key]: value })); setDirty(true); };
  const setItemsDirty = (next: BuilderItem[]) => { setItems(next); setDirty(true); };
  const patchItem = (index: number, patch: Partial<BuilderItem>) => setItemsDirty(items.map((x, i) => (i === index ? { ...x, ...patch } : x)));
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
    if (!title.trim()) { setTab('details'); return toast.error('Enter a paper title first.'); }
    if (!items.length) { setTab('questions'); return toast.error('Add at least one approved question.'); }
    if (nextStatus === 'FINAL' && marks.status !== 'match') return toast.error(marks.message);
    setBusy(true);
    try {
      const note = nextStatus === 'FINAL' ? 'Finalised' : isFinal ? 'Reopened as draft' : 'Saved';
      const body = JSON.stringify({ title, subjectId, templateId, status: nextStatus, header, items: payloadItems(), versionNote: note, acknowledgeMarksMismatch: false });
      const saved = await api<PaperDTO>(paperId ? `/papers/${paperId}` : '/papers', { method: paperId ? 'PUT' : 'POST', body });
      setStatus(saved.status);
      setVersion(saved.currentVersion);
      setDirty(false);
      toast.success(nextStatus === 'FINAL' ? 'Paper finalised' : 'Draft saved');
      if (!paperId) onSavedNew(saved.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save the paper');
    } finally {
      setBusy(false);
      setConfirmReopen(false);
    }
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'details', label: 'Details' },
    { key: 'questions', label: `Questions${items.length ? ` (${items.length})` : ''}` },
    { key: 'download', label: 'Download' },
  ];

  return (
    <div>
      {/* Top bar: always shows status, marks and the main actions */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <IconButton label="All papers" icon={ArrowLeft} onClick={onBack} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold tracking-tight text-ink">{title || 'Untitled paper'}</h1>
          <p className="text-xs text-slate-400">{paperId ? `Version ${version}` : 'Not saved yet'}{dirty && ' · unsaved changes'}</p>
        </div>
        <Pill tone={isFinal ? 'green' : 'slate'} dot>{isFinal ? 'Final' : 'Draft'}</Pill>
        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${marks.status === 'match' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`} title={marks.message}>{marks.total} / {header.maxMarks} marks</span>
      </div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200">
        <nav className="-mb-px flex gap-1" aria-label="Paper sections">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} aria-current={tab === t.key ? 'page' : undefined} className={`min-h-11 border-b-2 px-3 text-sm font-semibold ${tab === t.key ? 'border-navy text-navy' : 'border-transparent text-slate-500 hover:text-ink'}`}>{t.label}</button>
          ))}
        </nav>
        <div className="flex flex-wrap gap-2 pb-2">
          <button className="ghost" onClick={() => void showPreview('paper')} disabled={!items.length}><Eye size={16} />Preview</button>
          <button className="secondary" disabled={busy} onClick={() => (isFinal ? setConfirmReopen(true) : void save('DRAFT'))}><Save size={16} />{isFinal ? 'Reopen' : 'Save'}</button>
          <button className="primary" disabled={busy || marks.status !== 'match'} title={marks.status !== 'match' ? marks.message : undefined} onClick={() => void save('FINAL')}><CheckCircle2 size={16} />Finalise</button>
        </div>
      </div>

      {tab === 'details' && (
        <div className="space-y-4">
          <section className="card grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Title" className="sm:col-span-2 lg:col-span-3"><input className="field mt-1.5" value={title} maxLength={200} onChange={(e) => { setTitle(e.target.value); setDirty(true); }} /></Field>
            <Field label="Subject" className="lg:col-span-2"><SubjectSelect subjects={subjects} value={subjectId} onChange={chooseSubject} /></Field>
            <Field label="Format">
              <select className="field mt-1.5" value={templateId} onChange={(e) => { setTemplateId(Number(e.target.value)); setDirty(true); }}>{templates.filter((t) => t.isActive || t.id === templateId).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
            </Field>
            <Field label="Session"><input className="field mt-1.5" value={header.session} maxLength={60} onChange={(e) => setH('session', e.target.value)} placeholder="Spring 2026" /></Field>
            <Field label="Exam date"><input className="field mt-1.5" type="date" value={header.examDate} onChange={(e) => setH('examDate', e.target.value)} /></Field>
            <Field label="Maximum marks"><input className="field mt-1.5" type="number" min={0} max={500} value={header.maxMarks} onChange={(e) => setH('maxMarks', Number(e.target.value))} /></Field>
            <Field label="Duration (min)"><input className="field mt-1.5" type="number" min={0} max={600} value={header.durationMinutes} onChange={(e) => setH('durationMinutes', Number(e.target.value))} /></Field>
            <Field label="Reading time (min)"><input className="field mt-1.5" type="number" min={0} max={120} value={header.readingMinutes} onChange={(e) => setH('readingMinutes', Number(e.target.value))} /></Field>
            {fmt?.header.showBatch && <Field label="Batch"><input className="field mt-1.5" value={header.batchNo} maxLength={40} onChange={(e) => setH('batchNo', e.target.value)} /></Field>}
            {fmt?.header.showTest && <Field label="Test number"><input className="field mt-1.5" value={header.testNo} maxLength={40} onChange={(e) => setH('testNo', e.target.value)} /></Field>}
          </section>

          <section className="card p-5">
            <h2 className="text-sm font-semibold text-ink">Prepared by</h2>
            <p className="field-hint !mt-0.5">Shown on the answer key{fmt?.header.showTeacher ? ' (the teacher also appears on this format’s paper header)' : ', never on the question paper'}.</p>
            <div className="mt-3 grid gap-4 sm:grid-cols-3">
              <Field label="Teacher"><input className="field mt-1.5" value={header.teacherName} maxLength={120} onChange={(e) => setH('teacherName', e.target.value)} /></Field>
              <Field label="Research Officer(s)"><input className="field mt-1.5" value={header.researchOfficers} maxLength={200} onChange={(e) => setH('researchOfficers', e.target.value)} placeholder="Separate names with commas" /></Field>
              <Field label="Admin"><input className="field mt-1.5" value={header.adminName} maxLength={120} onChange={(e) => setH('adminName', e.target.value)} /></Field>
            </div>
          </section>

          <section className="card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-ink">Instructions</h2>
              <button className="chip" aria-pressed={header.instructionsOverride !== null} onClick={() => setH('instructionsOverride', header.instructionsOverride === null ? [...(fmt?.instructions.lines ?? [])] : null)}>Custom for this paper</button>
            </div>
            {header.instructionsOverride === null ? (
              <ol className="mt-2 list-[lower-roman] space-y-0.5 pl-6 text-sm text-slate-600">{(fmt?.instructions.lines ?? []).map((l) => <li key={l}>{l.replace(/\*\*/g, '').replace(/\{countWord\}|\{count\}/g, '[number of questions]')}</li>)}</ol>
            ) : (
              <>
                <textarea className="field mt-3" rows={4} value={header.instructionsOverride.join('\n')} onChange={(e) => setH('instructionsOverride', e.target.value.split('\n').slice(0, 20))} />
                <p className="field-hint">One per line. **bold**, {'{countWord}'} = number of questions in words.</p>
              </>
            )}
            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-semibold text-slate-500">Heading override</summary>
              <input className="field mt-2" value={header.titleOverride} maxLength={200} onChange={(e) => setH('titleOverride', e.target.value)} placeholder="Replaces the paper name in the header (optional)" />
            </details>
          </section>
        </div>
      )}

      {tab === 'questions' && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
          <section className="card flex max-h-[75vh] flex-col overflow-hidden">
            <div className="flex items-center justify-between gap-2 p-4 pb-2">
              <h2 className="text-sm font-semibold text-ink">Approved questions</h2>
              <span className="text-xs text-slate-400">{filtered.length}</span>
            </div>
            <div className="px-4 pb-2"><SearchBox value={search} onChange={setSearch} placeholder="Search approved questions" /></div>
            <div className="flex-1 overflow-y-auto">
              {filtered.length === 0 && <p className="px-4 py-10 text-center text-sm text-slate-400">{available.length ? 'All added' : 'No approved questions for this subject yet'}</p>}
              {filtered.map((q) => (
                <div key={q.id} className="list-row">
                  <button className="min-w-0 flex-1 text-left" onClick={() => setPeek(q)}>
                    <p className="truncate text-sm font-medium text-ink">{q.topic || plain(q.body) || 'Untitled'}</p>
                    <p className="truncate text-xs text-slate-400">{TYPE_SHORT[q.type]} · {q.marks} marks{q.usedInPapers ? ` · used ${q.usedInPapers}×` : ''}</p>
                  </button>
                  <IconButton label="Add to paper" icon={Plus} tone="success" onClick={() => add(q)} />
                </div>
              ))}
            </div>
          </section>

          <section className="card overflow-hidden">
            <h2 className="p-4 pb-2 text-sm font-semibold text-ink">In this paper</h2>
            {items.length === 0 ? <EmptyState icon={FileText} title="Add approved questions from the list" /> : items.map((it, index) => {
              const structured = hasStructuredMarks(it.question.type, it.question.content);
              return (
                <div key={it.question.id} className="list-row flex-wrap">
                  <span className="w-6 shrink-0 text-sm font-semibold text-slate-400">{index + 1}</span>
                  <button className="min-w-0 flex-1 text-left" onClick={() => setPeek(it.question)}>
                    <p className="truncate text-sm font-medium text-ink">{it.question.topic || plain(it.question.body) || 'Untitled'}</p>
                    <p className="truncate text-xs text-slate-400">{TYPE_SHORT[it.question.type]}{it.section ? ` · ${it.section}` : ''}{it.newPage ? ' · new page' : ''}</p>
                  </button>
                  <div className="flex w-full items-center gap-1.5 pl-8 sm:w-auto sm:pl-0">
                    {sectionNames.length > 0 && (
                      <select className="field !w-auto !py-1.5 text-sm" value={it.section} onChange={(e) => patchItem(index, { section: e.target.value })} aria-label="Section">
                        <option value="">No section</option>{sectionNames.map((n) => <option key={n} value={n}>{n.replace('SECTION ', 'Sec. ')}</option>)}
                      </select>
                    )}
                    <input className="field !w-16 !py-1.5 text-center text-sm" type="number" min={0} max={200} step={0.5} value={itemMarks(it)} disabled={structured} aria-label="Marks" title={structured ? 'Marks come from the parts' : 'Marks for this paper'} onChange={(e) => patchItem(index, { marksOverride: e.target.value === '' ? null : Number(e.target.value) })} />
                    <button className="chip !min-h-8 !px-2.5 text-xs" aria-pressed={it.newPage} title="Start this question on a new page" onClick={() => patchItem(index, { newPage: !it.newPage })}>New page</button>
                    <IconButton label="Move up" icon={ArrowUp} disabled={index === 0} onClick={() => move(index, index - 1)} />
                    <IconButton label="Move down" icon={ArrowDown} disabled={index === items.length - 1} onClick={() => move(index, index + 1)} />
                    <IconButton label="Remove" icon={X} tone="danger" onClick={() => setItemsDirty(items.filter((_, i) => i !== index))} />
                  </div>
                </div>
              );
            })}
          </section>
        </div>
      )}

      {tab === 'download' && (
        <section className="card p-5">
          {!paperId ? <EmptyState icon={Download} title="Save the paper to download PDFs" action={<button className="primary" disabled={busy} onClick={() => void save('DRAFT')}><Save size={16} />Save draft</button>} /> : (
            <div className="space-y-4">
              {!isFinal && <p className="rounded-xl bg-amber-50 px-4 py-2.5 text-sm text-amber-800">Draft downloads carry a <strong>DRAFT – FOR REVIEW</strong> watermark. Finalise to print clean copies.</p>}
              {dirty && <p className="rounded-xl bg-slate-50 px-4 py-2.5 text-sm text-slate-600">You have unsaved changes — downloads use the last saved version.</p>}
              <div className="grid gap-3 sm:grid-cols-2">
                <a className="card flex items-center gap-3 p-4 transition hover:border-slate-300" href={`/api/papers/${paperId}/pdf?watermark=${watermark ? 1 : 0}`} download>
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-navy/5 text-navy"><FileText size={20} /></span>
                  <span><span className="block font-semibold text-ink">Question paper</span><span className="text-xs text-slate-400">PDF</span></span>
                </a>
                <a className="card flex items-center gap-3 p-4 transition hover:border-slate-300" href={`/api/papers/${paperId}/answer-key.pdf?watermark=${watermark ? 1 : 0}`} download>
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><KeyRound size={20} /></span>
                  <span><span className="block font-semibold text-ink">Answer key</span><span className="text-xs text-slate-400">PDF · includes names</span></span>
                </a>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" className="h-4 w-4" checked={watermark} onChange={(e) => setWatermark(e.target.checked)} />Add my name and time as a watermark</label>
                <div className="flex gap-2">
                  <button className="ghost" onClick={() => void showPreview('key')} disabled={!items.length}><Eye size={16} />Preview key</button>
                  <button className="ghost" onClick={() => setHistory(true)}><History size={16} />History</button>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {preview && (
        <Modal size="xl" title={preview.mode === 'paper' ? 'Question paper' : 'Answer key'} eyebrow="Preview — headers and page numbers appear in the PDF" onClose={() => setPreview(null)} footer={
          <button className="secondary" onClick={() => void showPreview(preview.mode === 'paper' ? 'key' : 'paper')}>Show {preview.mode === 'paper' ? 'answer key' : 'question paper'}</button>
        }>
          <iframe title="Paper preview" srcDoc={preview.html} sandbox="" className="h-[72vh] w-full rounded-lg border border-slate-200 bg-white" />
        </Modal>
      )}
      {peek && (
        <Modal title={peek.topic || 'Question'} eyebrow={`#${peek.id}`} onClose={() => setPeek(null)}>
          <QuestionContent question={peek} showPrivate={false} />
        </Modal>
      )}
      {history && paperId && <VersionHistory paper={{ id: paperId, title }} onClose={() => setHistory(false)} onRestored={() => { setHistory(false); setReload((n) => n + 1); }} />}
      <Confirm open={confirmReopen} title="Reopen as draft?" message="The final version stays in the history." confirmLabel="Reopen" onConfirm={() => void save('DRAFT')} onCancel={() => setConfirmReopen(false)} />
      <Confirm open={confirmSubject !== null} title="Change subject?" message="Questions already in this paper will be removed." confirmLabel="Change" onConfirm={() => confirmSubject !== null && applySubject(confirmSubject)} onCancel={() => setConfirmSubject(null)} />
    </div>
  );
}

/** Paper library and builder. The open paper and tab live in the URL so tablets can go back and forth. */
export function PaperBuilder() {
  const [params, setParams] = useSearchParams();
  const view = params.get('paper');
  const open = (id: number | 'new' | null) => setParams(id === null ? {} : { paper: String(id) });
  if (view === null) return <PaperLibrary onOpen={(id) => open(id)} onNew={() => open('new')} />;
  const paperId = view === 'new' ? null : Number(view);
  const tab = (['details', 'questions', 'download'] as Tab[]).find((t) => t === params.get('tab')) ?? null;
  return <Builder key={view} paperId={paperId} initialTab={tab} onBack={() => open(null)} onSavedNew={(id) => setParams({ paper: String(id), tab: 'download' }, { replace: true })} />;
}
