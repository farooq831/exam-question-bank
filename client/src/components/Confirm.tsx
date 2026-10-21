interface ConfirmProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  /** Red confirm button for irreversible actions. */
  danger?: boolean;
  onConfirm(): void;
  onCancel(): void;
}

export function Confirm({ open, title, message, confirmLabel = 'Confirm', danger = false, onConfirm, onCancel }: ConfirmProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{message}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50" onClick={onCancel}>Cancel</button>
          <button className={`rounded-lg px-4 py-2 text-sm font-medium text-white ${danger ? 'bg-red-700 hover:bg-red-800' : 'bg-navy hover:bg-navy/90'}`} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
