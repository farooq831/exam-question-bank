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
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4 backdrop-blur-[2px]" role="dialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        <p className="mt-1.5 text-sm leading-6 text-slate-500">{message}</p>
        <div className="mt-6 flex justify-end gap-2">
          <button className="secondary" onClick={onCancel}>Cancel</button>
          <button className={danger ? 'danger' : 'primary'} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
