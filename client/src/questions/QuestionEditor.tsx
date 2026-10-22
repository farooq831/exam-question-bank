import { useState, type ReactNode } from 'react';
import { DIFFICULTIES, DIFFICULTY_LABELS, partLabel, QUESTION_TYPE_LABELS, QUESTION_TYPES, type LabelStyle, type McqLayout, type QuestionDTO, type SubjectDTO } from '@skans/shared';
import { ChevronDown, KeyRound, ListTree, Lock, Plus, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../api';
import { Modal } from '../components/Modal';
import { RichEditor } from '../components/RichEditor';
import { IconButton } from '../components/ui';
import { draftMarks, draftPayload, marksAreStructured, newGroupItem, newOption, newPart, newSubPart, validateDraft, type Option, type Part, type QuestionDraft, type SubPart } from './model';

const LAYOUTS: { value: McqLayout; label: string }[] = [
  { value: 'auto', label: 'Auto layout' },
  { value: '1', label: '1 per line' },
  { value: '2', label: '2 columns' },
  { value: '4', label: '4 columns' },
];

const Heading = ({ children, aside }: { children: ReactNode; aside?: ReactNode }) => (
  <div className="mb-2 flex items-center justify-between gap-3"><h3 className="text-sm font-semibold text-ink">{children}</h3>{aside}</div>
);

/** Folding section used for the answer key and private notes. */
function Fold({ title, icon, open, children, tone = 'slate' }: { title: string; icon: ReactNode; open?: boolean; children: ReactNode; tone?: 'slate' | 'green' }) {
  return (
    <details open={open} className={`group rounded-xl ${tone === 'green' ? 'bg-emerald-50/60' : 'bg-slate-50'}`}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-4 text-sm font-semibold text-ink">
        {icon}{title}<ChevronDown size={16} className="ml-auto text-slate-400 transition group-open:rotate-180" />
      </summary>
      <div className="space-y-4 px-4 pb-4">{children}</div>
    </details>
  );
}

function MarksInput({ value, onChange, disabled = false, label = 'Marks' }: { value: number; onChange(v: number): void; disabled?: boolean; label?: string }) {
  return <input className="field !w-20 text-center" type="number" min={0} max={200} step={0.5} value={value} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))} aria-label={label} title={disabled ? 'Sum of the parts' : label} />;
}

function OptionsEditor({ options, onChange, layout, onLayout }: { options: Option[]; onChange(o: Option[]): void; layout: McqLayout; onLayout(l: McqLayout): void }) {
  const update = (i: number, patch: Partial<Option>) => onChange(options.map((o, j) => (j === i ? { ...o, ...patch } : o)));
  return (
    <div className="space-y-2">
      {options.map((o, i) => (
        <div key={o.uid} className={`flex items-start gap-2 rounded-xl border p-1.5 ${o.correct ? 'border-emerald-300 bg-emerald-50/50' : 'border-slate-200'}`}>
          <label className="flex min-h-10 shrink-0 cursor-pointer items-center gap-1.5 pl-1.5 text-sm font-semibold text-slate-600" title="Correct answer">
            <input type="radio" className="h-4 w-4 accent-emerald-600" checked={o.correct} onChange={() => onChange(options.map((x, j) => ({ ...x, correct: j === i })))} />
            {String.fromCharCode(97 + i)}
          </label>
          <div className="min-w-0 flex-1"><RichEditor compact value={o.html} onChange={(html) => update(i, { html })} label={`Option ${String.fromCharCode(97 + i)}`} /></div>
          <IconButton label="Remove option" icon={Trash2} tone="danger" disabled={options.length <= 2} onClick={() => onChange(options.filter((_, j) => j !== i))} />
        </div>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" className="ghost !px-2" disabled={options.length >= 6} onClick={() => onChange([...options, newOption(options.length)])}><Plus size={15} />Option</button>
        <select className="field !w-auto !py-1.5 text-sm" value={layout} onChange={(e) => onLayout(e.target.value as McqLayout)} aria-label="Print layout">{LAYOUTS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}</select>
      </div>
    </div>
  );
}

function PartEditor({ value, label, onChange, onRemove, marksDisabled = false, children }: { value: SubPart; label: string; onChange(v: SubPart): void; onRemove(): void; marksDisabled?: boolean; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-sm font-semibold text-ink">{label}</span>
        <div className="ml-auto flex items-center gap-1">
          <MarksInput value={value.marks} disabled={marksDisabled} onChange={(marks) => onChange({ ...value, marks })} />
          <IconButton label={`Remove ${label}`} icon={Trash2} tone="danger" onClick={onRemove} />
        </div>
      </div>
      <RichEditor value={value.html} onChange={(html) => onChange({ ...value, html })} label={`${label} text`} />
      <details className="group mt-2" open={!!value.answer}>
        <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-xs font-semibold text-emerald-700"><KeyRound size={12} />Answer<ChevronDown size={13} className="transition group-open:rotate-180" /></summary>
        <div className="mt-2"><RichEditor value={value.answer} onChange={(answer) => onChange({ ...value, answer })} label={`${label} answer`} /></div>
      </details>
      {children}
    </div>
  );
}

interface QuestionEditorProps {
  initial: QuestionDraft;
  subjects: SubjectDTO[];
  /** Whether the current user may submit this question for review (author of a new, draft or rejected question). */
  canSubmit: boolean;
  onClose(): void;
  onSaved(q: QuestionDTO): void;
}

export function QuestionEditor({ initial, subjects, canSubmit, onClose, onSaved }: QuestionEditorProps) {
  const [d, setD] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const set = <K extends keyof QuestionDraft>(key: K, value: QuestionDraft[K]) => setD((cur) => ({ ...cur, [key]: value }));
  const structured = marksAreStructured(d);
  // Same default as the SKANS paper formats: sub-questions (a), (b)…, parts inside them (i), (ii)…
  const style: LabelStyle = d.partLabelStyle ?? 'alpha';
  const subStyle: LabelStyle = style === 'roman' ? 'alpha' : 'roman';
  const isNew = !d.id;

  async function save(submit: boolean) {
    const problems = validateDraft(d);
    setErrors(problems);
    if (problems.length) return;
    setBusy(true);
    try {
      const path = d.id ? `/questions/${d.id}` : '/questions';
      const saved = await api<QuestionDTO>(`${path}${submit ? '?submit=1' : ''}`, { method: d.id ? 'PUT' : 'POST', body: JSON.stringify(draftPayload(d)) });
      toast.success(submit ? 'Submitted for review' : 'Saved');
      onSaved(saved);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save question');
    } finally {
      setBusy(false);
    }
  }

  const updatePart = (i: number, p: Part) => set('parts', d.parts.map((x, j) => (j === i ? p : x)));
  const groupSet = (i: number, patch: Partial<QuestionDraft['groupItems'][number]>) => set('groupItems', d.groupItems.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  return (
    <Modal
      size="xl"
      title={isNew ? 'New question' : 'Edit question'}
      eyebrow={isNew ? undefined : `#${d.id}`}
      onClose={onClose}
      footer={
        <>
          <span className="mr-auto text-sm text-slate-500"><strong className="text-ink">{draftMarks(d)}</strong> marks</span>
          <button type="button" className="ghost" onClick={onClose}>Cancel</button>
          <button type="button" className={canSubmit ? 'secondary' : 'primary'} disabled={busy} onClick={() => void save(false)}>{busy ? 'Saving…' : canSubmit ? 'Save draft' : 'Save'}</button>
          {canSubmit && <button type="button" className="primary" disabled={busy} onClick={() => void save(true)}><Send size={15} />Submit</button>}
        </>
      }
    >
      <div className="space-y-5">
        {d.status === 'REJECTED' && d.reviewComment && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800"><span className="font-semibold">Returned:</span> {d.reviewComment}</p>
        )}
        {errors.length > 0 && (
          <ul className="list-disc rounded-xl bg-red-50 py-3 pl-8 pr-4 text-sm text-red-800">{errors.map((e) => <li key={e}>{e}</li>)}</ul>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <label className="label lg:col-span-2">Subject
            <select className="field mt-1.5" value={d.subjectId} onChange={(e) => set('subjectId', Number(e.target.value))}>{subjects.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}</select>
          </label>
          <label className="label lg:col-span-2">Type
            <select className="field mt-1.5" value={d.type} onChange={(e) => set('type', e.target.value as QuestionDraft['type'])}>{QUESTION_TYPES.map((t) => <option key={t} value={t}>{QUESTION_TYPE_LABELS[t]}</option>)}</select>
          </label>
          <label className="label">Difficulty
            <select className="field mt-1.5" value={d.difficulty} onChange={(e) => set('difficulty', e.target.value as QuestionDraft['difficulty'])}>{DIFFICULTIES.map((x) => <option key={x} value={x}>{DIFFICULTY_LABELS[x]}</option>)}</select>
          </label>
          <label className="label">Marks
            <input className="field mt-1.5" type="number" min={0} max={200} step={0.5} value={structured ? draftMarks(d) : d.marks} disabled={structured} title={structured ? 'Sum of the parts' : undefined} onChange={(e) => set('marks', Number(e.target.value))} />
          </label>
          <label className="label sm:col-span-2 lg:col-span-6">Topic
            <input className="field mt-1.5" value={d.topic} maxLength={120} onChange={(e) => set('topic', e.target.value)} placeholder="e.g. Revenue recognition" />
          </label>
        </div>

        <div>
          <Heading>Question</Heading>
          <RichEditor value={d.body} onChange={(v) => set('body', v)} label="Question text" />
        </div>

        {d.type === 'SHORT' && (
          <button type="button" className="ghost !px-2" onClick={() => setD((cur) => ({ ...cur, type: 'LONG', parts: [{ ...newPart(), marks: cur.marks || 2 }, newPart()] }))}><ListTree size={16} />Add sub-questions</button>
        )}

        {d.type === 'MCQ' && (
          <div><Heading>Options</Heading><OptionsEditor options={d.options} onChange={(o) => set('options', o)} layout={d.mcqLayout} onLayout={(l) => set('mcqLayout', l)} /></div>
        )}

        {d.type === 'TRUE_FALSE' && (
          <div>
            <Heading>Correct answer</Heading>
            <div className="inline-flex rounded-xl bg-slate-100 p-1">
              {[true, false].map((v) => (
                <button key={String(v)} type="button" onClick={() => set('tfCorrect', v)} aria-pressed={d.tfCorrect === v} className={`min-h-9 rounded-lg px-5 text-sm font-semibold ${d.tfCorrect === v ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}>{v ? 'True' : 'False'}</button>
              ))}
            </div>
          </div>
        )}

        {d.type === 'MCQ_GROUP' && (
          <div className="space-y-3">
            <Heading>MCQs</Heading>
            {d.groupItems.map((it, i) => (
              <div key={it.id} className="rounded-xl border border-slate-200 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-sm font-semibold">{partLabel(i + 1, 'roman')}</span>
                  <div className="ml-auto flex items-center gap-1">
                    <MarksInput value={it.marks} onChange={(marks) => groupSet(i, { marks })} />
                    <IconButton label="Remove MCQ" icon={Trash2} tone="danger" disabled={d.groupItems.length <= 1} onClick={() => set('groupItems', d.groupItems.filter((_, j) => j !== i))} />
                  </div>
                </div>
                <RichEditor value={it.stem} onChange={(stem) => groupSet(i, { stem })} label={`MCQ ${i + 1} text`} />
                <div className="mt-3"><OptionsEditor options={it.options} onChange={(options) => groupSet(i, { options })} layout={it.layout} onLayout={(layout) => groupSet(i, { layout })} /></div>
              </div>
            ))}
            <button type="button" className="ghost !px-2" disabled={d.groupItems.length >= 40} onClick={() => set('groupItems', [...d.groupItems, newGroupItem()])}><Plus size={15} />MCQ</button>
          </div>
        )}

        {(d.type === 'LONG' || d.type === 'CASE_STUDY') && (
          <div className="space-y-3">
            <Heading aside={
              <select className="field !w-auto !py-1.5 text-sm" value={d.partLabelStyle ?? ''} onChange={(e) => set('partLabelStyle', (e.target.value || null) as LabelStyle | null)} aria-label="Numbering">
                <option value="">Default (a), (b), (c)</option>
                <option value="roman">(i), (ii), (iii)</option>
                <option value="alpha">(a), (b), (c)</option>
                <option value="number">(1), (2), (3)</option>
              </select>
            }>Sub-questions</Heading>
            {d.parts.map((p, i) => (
              <PartEditor key={p.id} value={p} label={partLabel(i + 1, style)} marksDisabled={p.parts.length > 0} onChange={(v) => updatePart(i, { ...p, ...v })} onRemove={() => set('parts', d.parts.filter((_, j) => j !== i))}>
                <div className="mt-3 space-y-3 border-l-2 border-slate-100 pl-3">
                  {p.parts.map((s, j) => (
                    <PartEditor key={s.id} value={s} label={`${partLabel(i + 1, style)}${partLabel(j + 1, subStyle)}`} onChange={(v) => updatePart(i, { ...p, parts: p.parts.map((x, k) => (k === j ? v : x)) })} onRemove={() => updatePart(i, { ...p, parts: p.parts.filter((_, k) => k !== j) })} />
                  ))}
                  <button type="button" className="ghost !min-h-8 !px-2 text-xs" disabled={p.parts.length >= 12} onClick={() => updatePart(i, { ...p, parts: [...p.parts, newSubPart()] })}><Plus size={14} />Part {partLabel(i + 1, style)}{partLabel(p.parts.length + 1, subStyle)}</button>
                </div>
              </PartEditor>
            ))}
            <button type="button" className="ghost !px-2" disabled={d.parts.length >= 12} onClick={() => set('parts', [...d.parts, newPart()])}><Plus size={15} />Sub-question</button>
          </div>
        )}

        <Fold title="Answer key" icon={<KeyRound size={15} className="text-emerald-700" />} tone="green" open={isNew || !!d.answer || !!d.advice}>
          <div><p className="label">Model answer</p><div className="mt-1.5"><RichEditor value={d.answer} onChange={(v) => set('answer', v)} label="Model answer" /></div></div>
          <div><p className="label">Examiner&apos;s advice</p><div className="mt-1.5"><RichEditor value={d.advice} onChange={(v) => set('advice', v)} label="Examiner's advice" /></div></div>
        </Fold>

        <Fold title="Private notes" icon={<Lock size={15} className="text-slate-500" />} open={!!d.source || !!d.comments}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="label">Source<input className="field mt-1.5" value={d.source} maxLength={120} onChange={(e) => set('source', e.target.value)} placeholder="e.g. Spring 2025 mock, Q3" /></label>
            <label className="label">Comment<textarea className="field mt-1.5" rows={1} maxLength={5000} value={d.comments} onChange={(e) => set('comments', e.target.value)} /></label>
          </div>
        </Fold>
      </div>
    </Modal>
  );
}
