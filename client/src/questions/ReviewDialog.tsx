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

/** Shows the full question next to the decision; rejecting requires a comment for the author. */
export function ReviewDialog({ question, initialDecision = 'APPROVE', onClose, onDone }: ReviewDialogProps) {
  const [decision, setDecision] = useState(initialDecision);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const needsComment = decision === 'REJECT' && !comment.trim();

  async function submit() {
    if (needsComment) return;
    setBusy(true);
    try {
      const updated = await api<QuestionDTO>(`/questions/${question.id}/review`, { method: 'POST', body: JSON.stringify({ decision, comment }) });
      toast.success(decision === 'APPROVE' ? 'Question approved — it can now be used in papers' : 'Question sent back to the author');
      onDone(updated);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Review failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      eyebrow="Review question"
      title={question.topic || 'Untitled question'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="secondary" onClick={onClose}>Cancel</button>
          <button type="button" className={decision === 'APPROVE' ? 'success' : 'danger'} disabled={busy || needsComment} onClick={() => void submit()}>
            {decision === 'APPROVE' ? <><Check size={16} />Approve question</> : <><X size={16} />Reject and send back</>}
          </button>
        </>
      }
    >
      <QuestionMeta question={question} />
      <p className="mt-1 text-xs text-slate-500">Written by {question.createdBy} · last updated {new Date(question.updatedAt).toLocaleString()}</p>
      <div className="mt-4"><QuestionContent question={question} /></div>
      <div className="mt-6 rounded-xl border border-slate-200 p-4">
        <p className="label">Decision</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {(['APPROVE', 'REJECT'] as const).map((d) => (
            <button key={d} type="button" onClick={() => setDecision(d)} className={`min-h-11 rounded-lg border px-3 text-sm font-semibold ${decision === d ? (d === 'APPROVE' ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'border-red-600 bg-red-50 text-red-800') : 'border-slate-200 text-slate-600'}`}>
              {d === 'APPROVE' ? 'Approve' : 'Reject'}
            </button>
          ))}
        </div>
        <label className="label mt-4">
          Review comment {decision === 'REJECT' ? <span className="text-red-600">(required)</span> : <span className="font-normal text-slate-400">(optional)</span>}
          <textarea className="field mt-1" rows={3} maxLength={2000} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={decision === 'REJECT' ? 'Explain what the author must change before resubmitting.' : 'Optional note for the author.'} />
        </label>
        {needsComment && <p className="mt-1 text-xs text-red-600">A comment is required when rejecting, so the author knows what to fix.</p>}
        <p className="mt-2 text-xs text-slate-500">Review comments are private: they are shown to staff but never printed on papers or answer keys.</p>
      </div>
    </Modal>
  );
}
