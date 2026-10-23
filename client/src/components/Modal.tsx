import { useEffect, useState, type ReactNode } from 'react';
import { Copy, Minus, Square, X } from 'lucide-react';

interface ModalProps {
  title: ReactNode;
  eyebrow?: ReactNode;
  onClose(): void;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg' | 'xl';
}

const WIDTH = { md: 'max-w-lg', lg: 'max-w-3xl', xl: 'max-w-5xl' };
type WindowMode = 'normal' | 'max' | 'min';

/**
 * Dialog that becomes a full-height sheet on small screens; Escape closes it.
 * Larger dialogs get window buttons like a desktop app: minimise (work stays open in a bar at
 * the bottom while you use the page behind), maximise / restore, and close.
 */
export function Modal({ title, eyebrow, onClose, children, footer, size = 'lg' }: ModalProps) {
  const [mode, setMode] = useState<WindowMode>('normal');
  const controls = size !== 'md';
  const min = mode === 'min';
  const max = mode === 'max';

  useEffect(() => {
    if (min) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose, min]);

  const winBtn = 'icon-btn shrink-0';
  return (
    <>
      {/* Kept mounted while minimised so nothing typed is lost. */}
      <div className={min ? 'hidden' : `fixed inset-0 z-50 flex items-stretch justify-center bg-slate-900/40 backdrop-blur-[2px] ${max ? '' : 'sm:items-start sm:p-4 sm:pt-10'}`} role="dialog" aria-modal={!min} aria-hidden={min}>
        <div className={`flex max-h-full w-full flex-col overflow-hidden bg-white shadow-2xl ${max ? 'h-full' : `${WIDTH[size]} sm:max-h-[calc(100vh-5rem)] sm:rounded-2xl`}`}>
          <div className="flex items-center justify-between gap-4 px-5 pb-2 pt-4 sm:px-6">
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold text-ink">{title}</h2>
              {eyebrow && <p className="truncate text-xs text-slate-400">{eyebrow}</p>}
            </div>
            <div className="flex shrink-0 items-center">
              {controls && (
                <>
                  <button type="button" onClick={() => setMode('min')} className={winBtn} aria-label="Minimise" title="Minimise"><Minus size={18} /></button>
                  <button type="button" onClick={() => setMode(max ? 'normal' : 'max')} className={`${winBtn} hidden sm:inline-flex`} aria-label={max ? 'Restore down' : 'Maximise'} title={max ? 'Restore down' : 'Maximise'}>
                    {max ? <Copy size={15} className="-scale-x-100" /> : <Square size={14} />}
                  </button>
                </>
              )}
              <button type="button" onClick={onClose} className={`${winBtn} hover:bg-red-600! hover:text-white!`} aria-label="Close" title="Close"><X size={18} /></button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4 sm:px-6">{children}</div>
          {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 px-5 py-3 sm:px-6">{footer}</div>}
        </div>
      </div>
      {min && (
        <div className="fixed bottom-4 right-4 z-50 flex max-w-[calc(100vw-2rem)] items-center gap-1 rounded-xl bg-navy py-1 pl-4 pr-1 text-white shadow-2xl" role="region" aria-label="Minimised window">
          <button type="button" onClick={() => setMode('normal')} className="min-w-0 truncate py-2 pr-2 text-left text-sm font-semibold" title="Restore">{title}</button>
          <button type="button" onClick={() => setMode('normal')} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg hover:bg-white/10" aria-label="Restore" title="Restore"><Square size={14} /></button>
          <button type="button" onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg hover:bg-red-600" aria-label="Close" title="Close"><X size={18} /></button>
        </div>
      )}
    </>
  );
}
