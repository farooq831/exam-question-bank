import { useState } from 'react';
import type { QuestionDTO } from '@skans/shared';
import { Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../api';
import { Modal } from '../components/Modal';
import { QuestionContent, QuestionMeta } from './QuestionPreview';

interface ReviewDialogProps {
  question: QuestionDTO;
  initialDecision?: 'APPROVE' | 'REJECT';
  onClose(): void;
  onDone(updated: QuestionDTO): void;
}

/** The question on top, the decision below. Returning a question requires a note for the author. */
export function ReviewDialog({ question, initialDecision = 'APPROVE', onClose, onDone }: ReviewDialogProps) {
  const [decision, setDecision] = useState(initialDecision);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const reject = decision === 'REJECT';
  const needsComment = reject && !comment.trim();

  async function submit() {
    if (needsComment) return;
    setBusy(true);
    try {
      const updated = await api<QuestionDTO>(`/questions/${question.id}/review`, { method: 'POST', body: JSON.stringify({ decision, comment }) });
      toast.success(reject ? 'Returned to the author' : 'Approved');
      onDone(updated);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Review failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={question.topic || 'Review question'}
      eyebrow={`by ${question.createdBy}`}
      onClose={onClose}
      footer={
        <>
          <div className="mr-auto flex rounded-xl bg-slate-100 p-1" role="group" aria-label="Decision">
            <button type="button" onClick={() => setDecision('APPROVE')} aria-pressed={!reject} className={`flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold ${!reject ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-500'}`}><Check size={15} />Approve</button>
            <button type="button" onClick={() => setDecision('REJECT')} aria-pressed={reject} className={`flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold ${reject ? 'bg-white text-red-700 shadow-xs' : 'text-slate-500'}`}><X size={15} />Return</button>
          </div>
          <button type="button" className="secondary" onClick={onClose}>Cancel</button>
          <button type="button" className={reject ? 'danger' : 'success'} disabled={busy || needsComment} onClick={() => void submit()}>{reject ? 'Return to author' : 'Approve'}</button>
        </>
      }
    >
      <QuestionMeta question={question} />
      <div className="mt-4"><QuestionContent question={question} /></div>
      <label className="label mt-5">
        {reject ? 'What should the author change?' : 'Note for the author (optional)'}
        <textarea className="field mt-1.5" rows={2} maxLength={2000} value={comment} onChange={(e) => setComment(e.target.value)} autoFocus={reject} />
      </label>
    </Modal>
  );
}
