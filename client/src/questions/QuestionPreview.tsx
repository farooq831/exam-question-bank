import { partLabel, type LabelStyle, type QuestionDTO, type QuestionType } from '@skans/shared';
import { KeyRound, Lock } from 'lucide-react';
import { StatusBadge } from './StatusBadge';

/** Short type names for lists and headers. */
/** Text of rich HTML without tags, for titles and search. */
export const plainText = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

/** Title shown in lists: the author's title (topic), otherwise the start of the question text. */
export function questionTitle(q: Pick<QuestionDTO, 'topic' | 'body' | 'type'>): string {
  const text = plainText(q.body.replace(/<table[\s\S]*?<\/table>/g, ' '));
  return q.topic || (text.length > 110 ? `${text.slice(0, 110)}…` : text) || `${TYPE_SHORT[q.type]} question`;
}

export const TYPE_SHORT: Record<QuestionType, string> = { MCQ: 'MCQ', MCQ_GROUP: 'MCQ group', TRUE_FALSE: 'True / False', SHORT: 'Short', LONG: 'Long', CASE_STUDY: 'Case study' };

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
  const style = (c.partLabelStyle as LabelStyle | null) ?? 'alpha';
  const subStyle = style === 'roman' ? 'alpha' : 'roman';
  return (
    <div className="space-y-4">
      <section>
        <Html html={question.body} />
        {question.type === 'MCQ' && <Options options={(c.options as Opt[]) ?? []} showAnswers={showAnswers} />}
        {question.type === 'TRUE_FALSE' && <p className="mt-2 text-sm italic text-slate-500">(True / False){showAnswers && <strong className="ml-2 not-italic text-emerald-700">Answer: {c.correct ? 'True' : 'False'}</strong>}</p>}
        {question.type === 'MCQ_GROUP' && (
          <div className="mt-3 space-y-3">
            {((c.items as { stem: string; options: Opt[]; marks: number }[]) ?? []).map((it, i) => (
              <div key={i} className="rounded-xl bg-slate-50 p-3">
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
              <div key={i} className="rounded-xl bg-slate-50 p-3">
                <div className="flex justify-between gap-3 text-xs font-semibold text-slate-500"><span>{partLabel(i + 1, style)}</span>{!p.parts?.length && <span>{p.marks} marks</span>}</div>
                <Html html={p.html} />
                {showAnswers && p.answer && <div className="mt-2 rounded-lg bg-emerald-50 p-2"><Html html={p.answer} /></div>}
                {(p.parts ?? []).map((s, j) => (
                  <div key={j} className="ml-4 mt-2 border-l-2 border-slate-200 pl-3">
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
        <section className="rounded-xl bg-emerald-50/70 p-4">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-800" title="Printed only in the answer key"><KeyRound size={13} />Answer key</p>
          {question.answer && <Html html={question.answer} />}
          {question.advice && <><p className="mt-3 text-xs font-semibold italic text-slate-600">Examiner&apos;s advice</p><Html html={question.advice} /></>}
        </section>
      )}
      {showPrivate && (question.comments || question.source || question.reviewComment) && (
        <section className="space-y-1 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-500" title="Never printed"><Lock size={13} />Private notes</p>
          {question.source && <p><span className="text-slate-400">Source</span> · {question.source}</p>}
          {question.comments && <p className="whitespace-pre-wrap"><span className="text-slate-400">Comment</span> · {question.comments}</p>}
          {question.reviewComment && <p className="whitespace-pre-wrap"><span className="text-slate-400">Reviewer{question.reviewedBy ? ` (${question.reviewedBy})` : ''}</span> · {question.reviewComment}</p>}
        </section>
      )}
    </div>
  );
}

export function QuestionMeta({ question }: { question: QuestionDTO }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
      <StatusBadge status={question.status} />
      <span>{question.subjectCode} · {TYPE_SHORT[question.type]} · {question.marks} mark{question.marks === 1 ? '' : 's'}</span>
    </div>
  );
}
