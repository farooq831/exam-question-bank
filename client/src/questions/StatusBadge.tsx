import type { QuestionStatus } from '@skans/shared';
import { Pill, type Tone } from '../components/ui';

export const STATUS_TEXT: Record<QuestionStatus, string> = { DRAFT: 'Draft', SUBMITTED: 'In review', APPROVED: 'Approved', REJECTED: 'Returned' };
const TONE: Record<QuestionStatus, Tone> = { DRAFT: 'slate', SUBMITTED: 'amber', APPROVED: 'green', REJECTED: 'red' };

export function StatusBadge({ status }: { status: QuestionStatus }) {
  return <Pill tone={TONE[status]} dot>{STATUS_TEXT[status]}</Pill>;
}
