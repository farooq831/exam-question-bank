import { QUESTION_STATUS_LABELS, type QuestionStatus } from '@skans/shared';

const STYLES: Record<QuestionStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-600',
  SUBMITTED: 'bg-amber-50 text-amber-700',
  APPROVED: 'bg-emerald-50 text-emerald-700',
  REJECTED: 'bg-red-50 text-red-700',
};

export function StatusBadge({ status }: { status: QuestionStatus }) {
  return <span className={`badge ${STYLES[status]}`}>{status === 'SUBMITTED' ? 'Awaiting review' : QUESTION_STATUS_LABELS[status]}</span>;
}
