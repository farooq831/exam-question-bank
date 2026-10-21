import { partLabel, QUESTION_TYPE_LABELS, type QuestionDTO } from '@skans/shared';
import { EyeOff, Lock } from 'lucide-react';
import { StatusBadge } from './StatusBadge';

type Opt = { html: string; correct: boolean };
type Sub = { html: string; marks: number; answer?: string };
type Part = Sub & { parts?: Sub[] };

const Html = ({ html, className = '' }: { html: string; className?: string }) => (
  // Content is sanitised by the server (sanitize-html whitelist) before it is stored.
  <div className={`prose max-w-none text-sm leading-6 ${className}`} dangerouslySetInnerHTML={{ __html: html }} />
);

function Options({ options, showAnswers }: { options: Opt[]; showAnswers: boolean }) {
  return (
    <ol className="mt-2 grid gap-1.5 sm:grid-cols-2">
      {options.map((o, i) => (
        <li key={i} className={`flex gap-2 rounded-lg border px-3 py-2 text-sm ${showAnswers && o.correct ? 'border-emerald-300 bg-emerald-50 font-semibold' : 'border-slate-200'}`}>
          <span>({String.fromCharCode(97 + i)})</span>
          <Html html={o.html} className="[&_p]:m-0" />
        </li>
      ))}
    </ol>
  );
}

/** Student-facing content first; answer-key content and private notes are visually separated. */
export function QuestionContent({ question, showAnswers = true, showPrivate = true }: { question: QuestionDTO; showAnswers?: boolean; showPrivate?: boolean }) {
  const c = question.content as Record<string, unknown>;
  const parts = (c.parts as Part[] | undefined) ?? [];
  const style = (c.partLabelStyle as 'roman' | 'alpha' | 'number' | null) ?? 'roman';
  const subStyle = style === 'roman' ? 'alpha' : 'roman';
  return (
    <div className="space-y-4">
      <section>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">Question paper (student-facing)</p>
        <Html html={question.body} />
        {question.type === 'MCQ' && <Options options={(c.options as Opt[]) ?? []} showAnswers={showAnswers} />}
        {question.type === 'TRUE_FALSE' && <p className="mt-2 text-sm italic text-slate-500">(True / False){showAnswers && <strong className="ml-2 not-italic text-emerald-700">Answer: {c.correct ? 'True' : 'False'}</strong>}</p>}
        {question.type === 'MCQ_GROUP' && (
          <div className="mt-3 space-y-3">
            {((c.items as { stem: string; options: Opt[]; marks: number }[]) ?? []).map((it, i) => (
              <div key={i} className="rounded-xl border border-slate-100 p-3">
                <div className="flex justify-between gap-3 text-xs font-semibold text-slate-500"><span>{partLabel(i + 1, 'roman')}</span><span>{it.marks} mark{it.marks === 1 ? '' : 's'}</span></div>
                <Html html={it.stem} />
                <Options options={it.options} showAnswers={showAnswers} />
              </div>
            ))}
          </div>
        )}
        {parts.length > 0 && (
          <div className="mt-3 space-y-3">
            {parts.map((p, i) => (
              <div key={i} className="rounded-xl border border-slate-100 p-3">
                <div className="flex justify-between gap-3 text-xs font-semibold text-slate-500"><span>Part {partLabel(i + 1, style)}</span>{!p.parts?.length && <span>{p.marks} marks</span>}</div>
                <Html html={p.html} />
                {showAnswers && p.answer && <div className="mt-2 rounded-lg bg-emerald-50 p-2"><p className="text-[11px] font-bold uppercase text-emerald-700">Model answer</p><Html html={p.answer} /></div>}
                {(p.parts ?? []).map((s, j) => (
                  <div key={j} className="ml-4 mt-2 border-l-2 border-slate-100 pl-3">
                    <div className="flex justify-between gap-3 text-xs font-semibold text-slate-500"><span>{partLabel(j + 1, subStyle)}</span><span>{s.marks} marks</span></div>
                    <Html html={s.html} />
                    {showAnswers && s.answer && <div className="mt-1 rounded-lg bg-emerald-50 p-2"><Html html={s.answer} /></div>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </section>
      {showAnswers && (question.answer || question.advice) && (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-700"><EyeOff size={13} />Answer key only — never printed on the question paper</p>
          {question.answer && <Html html={question.answer} />}
          {question.advice && <><p className="mt-3 text-xs font-semibold italic text-slate-600">Examiner&apos;s advice</p><Html html={question.advice} /></>}
        </section>
      )}
      {showPrivate && (question.comments || question.source || question.reviewComment) && (
        <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500"><Lock size={13} />Private — never printed</p>
          {question.source && <p><span className="font-semibold">Source:</span> {question.source}</p>}
          {question.comments && <p className="whitespace-pre-wrap"><span className="font-semibold">Internal comments:</span> {question.comments}</p>}
          {question.reviewComment && <p className="whitespace-pre-wrap"><span className="font-semibold">Review comment{question.reviewedBy ? ` (${question.reviewedBy})` : ''}:</span> {question.reviewComment}</p>}
        </section>
      )}
    </div>
  );
}

export function QuestionMeta({ question }: { question: QuestionDTO }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
      <span className="badge bg-slate-100 text-navy">{question.subjectCode}</span>
      <StatusBadge status={question.status} />
      <span>{QUESTION_TYPE_LABELS[question.type]}</span>
      <span>·</span>
      <span className="font-semibold text-ink">{question.marks} mark{question.marks === 1 ? '' : 's'}</span>
      <span>·</span>
      <span>{question.difficulty.toLowerCase()}</span>
    </div>
  );
}
