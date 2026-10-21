import { useState, type ReactNode } from 'react';
import {
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  partLabel,
  QUESTION_TYPE_LABELS,
  QUESTION_TYPES,
  type LabelStyle,
  type McqLayout,
  type QuestionDTO,
  type SubjectDTO,
} from '@skans/shared';
import { AlertTriangle, Lock, Plus, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../api';
import { Modal } from '../components/Modal';
import { RichEditor } from '../components/RichEditor';
import {
  draftMarks,
  draftPayload,
  marksAreStructured,
  newGroupItem,
  newOption,
  newPart,
  newSubPart,
  validateDraft,
  type Option,
  type Part,
  type QuestionDraft,
  type SubPart,
} from './model';

const LAYOUTS: { value: McqLayout; label: string }[] = [
  { value: 'auto', label: 'Automatic' },
  { value: '1', label: 'One per line' },
  { value: '2', label: 'Two columns' },
  { value: '4', label: 'Four columns' },
];

function Section({ title, hint, children, tone = 'default' }: { title: ReactNode; hint?: ReactNode; children: ReactNode; tone?: 'default' | 'key' | 'private' }) {
  const toneClass = tone === 'key' ? 'border-emerald-200 bg-emerald-50/40' : tone === 'private' ? 'border-slate-200 bg-slate-50' : 'border-slate-200';
  return (
    <section className={`rounded-xl border p-4 ${toneClass}`}>
      <h3 className="font-semibold text-ink">{title}</h3>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function MarksInput({ value, onChange, label = 'Marks', disabled = false }: { value: number; onChange(v: number): void; label?: string; disabled?: boolean }) {
  return (
    <label className="label">
      {label}
      <input className="field mt-1 w-28" type="number" min={0} max={200} step={0.5} value={value} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

function OptionsEditor({ options, onChange, layout, onLayout }: { options: Option[]; onChange(o: Option[]): void; layout: McqLayout; onLayout(l: McqLayout): void }) {
  const update = (i: number, patch: Partial<Option>) => onChange(options.map((o, j) => (j === i ? { ...o, ...patch } : o)));
  return (
    <div className="space-y-2">
      {options.map((o, i) => (
        <div key={o.uid} className={`flex items-start gap-2 rounded-lg border p-2 ${o.correct ? 'border-emerald-300 bg-emerald-50/50' : 'border-slate-200'}`}>
          <label className="flex min-h-11 shrink-0 cursor-pointer items-center gap-2 pl-1 text-sm font-semibold" title="Mark as the correct answer">
            <input type="radio" className="h-5 w-5" checked={o.correct} onChange={() => onChange(options.map((x, j) => ({ ...x, correct: j === i })))} />
            ({String.fromCharCode(97 + i)})
          </label>
          <div className="min-w-0 flex-1"><RichEditor compact value={o.html} onChange={(html) => update(i, { html })} label={`Option ${String.fromCharCode(97 + i)}`} /></div>
          <button type="button" className="action text-slate-400 hover:text-red-600" disabled={options.length <= 2} title="Remove option" onClick={() => onChange(options.filter((_, j) => j !== i))}><Trash2 size={16} /></button>
        </div>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <button type="button" className="secondary" disabled={options.length >= 6} onClick={() => onChange([...options, newOption(options.length)])}><Plus size={15} />Add option</button>
        <label className="label flex items-center gap-2">Print layout
          <select className="field w-40" value={layout} onChange={(e) => onLayout(e.target.value as McqLayout)}>{LAYOUTS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}</select>
        </label>
      </div>
      <p className="text-xs text-slate-500">Select the radio button next to the correct answer. The correct answer appears only in the answer key.</p>
    </div>
  );
}

function SubPartEditor({ value, label, onChange, onRemove, marksDisabled = false, children }: { value: SubPart; label: string; onChange(v: SubPart): void; onRemove(): void; marksDisabled?: boolean; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="mb-2 flex flex-wrap items-end justify-between gap-3">
        <span className="font-semibold text-ink">{label}</span>
        <div className="flex items-end gap-2">
          <MarksInput value={value.marks} disabled={marksDisabled} label={marksDisabled ? 'Marks (sum of parts)' : 'Marks'} onChange={(marks) => onChange({ ...value, marks })} />
          <button type="button" className="action text-slate-400 hover:text-red-600" title={`Remove ${label}`} onClick={onRemove}><Trash2 size={16} /></button>
        </div>
      </div>
      <RichEditor value={value.html} onChange={(html) => onChange({ ...value, html })} label={`${label} text`} />
      <details className="mt-2 rounded-lg bg-emerald-50/60 p-2" open={!!value.answer}>
        <summary className="cursor-pointer text-xs font-semibold text-emerald-800">Model answer for {label.toLowerCase()} (answer key only)</summary>
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
  const style: LabelStyle = d.partLabelStyle ?? 'roman';
  const subStyle: LabelStyle = style === 'roman' ? 'alpha' : 'roman';
  const isNew = !d.id;

  async function save(submit: boolean) {
    const problems = validateDraft(d);
    setErrors(problems);
    if (problems.length) {
      toast.error('Please fix the highlighted problems first.');
      return;
    }
    setBusy(true);
    try {
      const path = d.id ? `/questions/${d.id}` : '/questions';
      const saved = await api<QuestionDTO>(`${path}${submit ? '?submit=1' : ''}`, { method: d.id ? 'PUT' : 'POST', body: JSON.stringify(draftPayload(d)) });
      toast.success(submit ? 'Saved and submitted for review' : isNew ? 'Question saved as draft' : 'Question saved');
      onSaved(saved);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save question');
    } finally {
      setBusy(false);
    }
  }

  const updatePart = (i: number, p: Part) => set('parts', d.parts.map((x, j) => (j === i ? p : x)));

  return (
    <Modal
      size="xl"
      eyebrow={isNew ? 'New question' : `Edit question #${d.id}`}
      title={d.topic || 'Question details'}
      onClose={onClose}
      footer={
        <>
          <span className="mr-auto self-center text-sm text-slate-500">Total: <strong className="text-ink">{draftMarks(d)} marks</strong></span>
          <button type="button" className="secondary" onClick={onClose}>Cancel</button>
          <button type="button" className={canSubmit ? 'secondary' : 'primary'} disabled={busy} onClick={() => void save(false)}>{busy ? 'Saving…' : canSubmit ? 'Save draft' : 'Save changes'}</button>
          {canSubmit && <button type="button" className="primary" disabled={busy} onClick={() => void save(true)}><Send size={15} />Save &amp; submit for review</button>}
        </>
      }
    >
      <div className="space-y-5">
        {d.status === 'REJECTED' && d.reviewComment && (
          <div className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"><AlertTriangle className="shrink-0" size={18} /><div><p className="font-semibold">Sent back by the reviewer</p><p className="mt-1 whitespace-pre-wrap">{d.reviewComment}</p></div></div>
        )}
        {d.status === 'APPROVED' && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">This question is approved. Changes apply to future papers; finalised papers keep their frozen copy.</div>
        )}
        {errors.length > 0 && (
          <ul className="list-disc rounded-xl border border-red-200 bg-red-50 py-3 pl-8 pr-4 text-sm text-red-800">{errors.map((e) => <li key={e}>{e}</li>)}</ul>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="label sm:col-span-2">Subject
            <select className="field mt-1" value={d.subjectId} onChange={(e) => set('subjectId', Number(e.target.value))}>{subjects.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}</select>
          </label>
          <label className="label">Question type
            <select className="field mt-1" value={d.type} onChange={(e) => set('type', e.target.value as QuestionDraft['type'])}>{QUESTION_TYPES.map((t) => <option key={t} value={t}>{QUESTION_TYPE_LABELS[t]}</option>)}</select>
          </label>
          <label className="label">Difficulty
            <select className="field mt-1" value={d.difficulty} onChange={(e) => set('difficulty', e.target.value as QuestionDraft['difficulty'])}>{DIFFICULTIES.map((x) => <option key={x} value={x}>{DIFFICULTY_LABELS[x]}</option>)}</select>
          </label>
          <label className="label sm:col-span-2">Topic
            <input className="field mt-1" value={d.topic} maxLength={120} onChange={(e) => set('topic', e.target.value)} placeholder="e.g. Revenue recognition" />
          </label>
          {structured ? (
            <div className="label">Marks<p className="mt-1 flex min-h-11 items-center rounded-lg bg-slate-100 px-3 font-semibold text-ink">{draftMarks(d)} <span className="ml-1 text-xs font-normal text-slate-500">(sum of {d.type === 'MCQ_GROUP' ? 'MCQs' : 'parts'})</span></p></div>
          ) : (
            <MarksInput value={d.marks} onChange={(v) => set('marks', v)} />
          )}
        </div>

        <Section title="Question text" hint="Printed on the question paper. Use the table button for financial data.">
          <RichEditor value={d.body} onChange={(v) => set('body', v)} label="Question text" />
        </Section>

        {d.type === 'MCQ' && (
          <Section title="Answer options">
            <OptionsEditor options={d.options} onChange={(o) => set('options', o)} layout={d.mcqLayout} onLayout={(l) => set('mcqLayout', l)} />
          </Section>
        )}

        {d.type === 'SHORT' && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-slate-300 p-4">
            <div>
              <p className="font-semibold text-ink">Sub-questions</p>
              <p className="text-xs text-slate-500">Split this question into (a), (b), (c)… each with its own text, marks and model answer.</p>
            </div>
            <button type="button" className="secondary" onClick={() => setD((cur) => ({ ...cur, type: 'LONG', parts: [{ ...newPart(), marks: cur.marks || 2 }, newPart()] }))}><Plus size={15} />Add sub-questions</button>
          </div>
        )}

        {d.type === 'TRUE_FALSE' && (
          <Section title="Correct answer" hint="Printed only in the answer key.">
            <div className="grid max-w-sm grid-cols-2 gap-2">
              {[true, false].map((v) => (
                <button key={String(v)} type="button" onClick={() => set('tfCorrect', v)} className={`min-h-11 rounded-lg border text-sm font-semibold ${d.tfCorrect === v ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'border-slate-200 text-slate-600'}`}>{v ? 'True' : 'False'}</button>
              ))}
            </div>
          </Section>
        )}

        {d.type === 'MCQ_GROUP' && (
          <Section title="MCQs in this group" hint="The question text above is the shared introduction; each MCQ below is numbered (i), (ii)… on the paper.">
            <div className="space-y-4">
              {d.groupItems.map((it, i) => (
                <div key={it.id} className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="mb-2 flex flex-wrap items-end justify-between gap-3">
                    <span className="font-semibold">MCQ {partLabel(i + 1, 'roman')}</span>
                    <div className="flex items-end gap-2">
                      <MarksInput value={it.marks} onChange={(marks) => set('groupItems', d.groupItems.map((x, j) => (j === i ? { ...x, marks } : x)))} />
                      <button type="button" className="action text-slate-400 hover:text-red-600" disabled={d.groupItems.length <= 1} title="Remove MCQ" onClick={() => set('groupItems', d.groupItems.filter((_, j) => j !== i))}><Trash2 size={16} /></button>
                    </div>
                  </div>
                  <RichEditor value={it.stem} onChange={(stem) => set('groupItems', d.groupItems.map((x, j) => (j === i ? { ...x, stem } : x)))} label={`MCQ ${i + 1} text`} />
                  <div className="mt-3">
                    <OptionsEditor
                      options={it.options}
                      onChange={(options) => set('groupItems', d.groupItems.map((x, j) => (j === i ? { ...x, options } : x)))}
                      layout={it.layout}
                      onLayout={(layout) => set('groupItems', d.groupItems.map((x, j) => (j === i ? { ...x, layout } : x)))}
                    />
                  </div>
                </div>
              ))}
              <button type="button" className="secondary" disabled={d.groupItems.length >= 40} onClick={() => set('groupItems', [...d.groupItems, newGroupItem()])}><Plus size={15} />Add MCQ</button>
            </div>
          </Section>
        )}

        {(d.type === 'LONG' || d.type === 'CASE_STUDY') && (
          <Section title="Sub-questions" hint="Each sub-question has its own text, marks and model answer. A sub-question can be split further into parts; its marks are then the sum of those parts. Remove all sub-questions for a single-requirement question.">
            <label className="label mb-3 flex flex-wrap items-center gap-2">Numbering
              <select className="field w-56" value={d.partLabelStyle ?? ''} onChange={(e) => set('partLabelStyle', (e.target.value || null) as LabelStyle | null)}>
                <option value="">Template default</option>
                <option value="roman">(i), (ii), (iii)</option>
                <option value="alpha">(a), (b), (c)</option>
                <option value="number">(1), (2), (3)</option>
              </select>
            </label>
            <div className="space-y-3">
              {d.parts.map((p, i) => (
                <SubPartEditor key={p.id} value={p} label={`Sub-question ${partLabel(i + 1, style)}`} marksDisabled={p.parts.length > 0} onChange={(v) => updatePart(i, { ...p, ...v })} onRemove={() => set('parts', d.parts.filter((_, j) => j !== i))}>
                  <div className="ml-2 mt-3 space-y-3 border-l-2 border-slate-100 pl-3 sm:ml-4">
                    {p.parts.map((s, j) => (
                      <SubPartEditor key={s.id} value={s} label={`Part ${partLabel(i + 1, style)}${partLabel(j + 1, subStyle)}`} onChange={(v) => updatePart(i, { ...p, parts: p.parts.map((x, k) => (k === j ? v : x)) })} onRemove={() => updatePart(i, { ...p, parts: p.parts.filter((_, k) => k !== j) })} />
                    ))}
                    <button type="button" className="secondary" disabled={p.parts.length >= 12} onClick={() => updatePart(i, { ...p, parts: [...p.parts, newSubPart()] })}><Plus size={15} />Add part {partLabel(i + 1, style)}{partLabel(p.parts.length + 1, subStyle)}</button>
                  </div>
                </SubPartEditor>
              ))}
              <button type="button" className="secondary" disabled={d.parts.length >= 12} onClick={() => set('parts', [...d.parts, newPart()])}><Plus size={15} />Add sub-question</button>
            </div>
          </Section>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <Section tone="key" title="Model answer" hint="Answer key only — never printed on the question paper.">
            <RichEditor value={d.answer} onChange={(v) => set('answer', v)} label="Model answer" />
          </Section>
          <Section tone="key" title="Examiner's advice" hint="Answer key only — guidance for markers.">
            <RichEditor value={d.advice} onChange={(v) => set('advice', v)} label="Examiner's advice" />
          </Section>
        </div>

        <Section tone="private" title={<span className="flex items-center gap-1.5"><Lock size={15} />Private notes</span>} hint="Visible to staff only. Never printed on papers or answer keys.">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="label">Source / reference
              <input className="field mt-1" value={d.source} maxLength={120} onChange={(e) => set('source', e.target.value)} placeholder="e.g. Spring 2025 mock, Q3" />
            </label>
            <label className="label">Internal comments
              <textarea className="field mt-1" rows={2} maxLength={5000} value={d.comments} onChange={(e) => set('comments', e.target.value)} />
            </label>
          </div>
        </Section>
      </div>
    </Modal>
  );
}
