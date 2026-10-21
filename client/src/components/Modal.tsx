import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  title: ReactNode;
  eyebrow?: ReactNode;
  onClose(): void;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg' | 'xl';
}

const WIDTH = { md: 'max-w-lg', lg: 'max-w-3xl', xl: 'max-w-5xl' };

/** Dialog that becomes a full-height sheet on small screens; Escape closes it. */
export function Modal({ title, eyebrow, onClose, children, footer, size = 'lg' }: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-ink/50 sm:items-start sm:p-4 sm:pt-10" role="dialog" aria-modal="true">
      <div className={`flex max-h-full w-full ${WIDTH[size]} flex-col overflow-hidden bg-white shadow-2xl sm:max-h-[calc(100vh-5rem)] sm:rounded-2xl`}>
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            {eyebrow && <p className="text-xs font-semibold uppercase tracking-wider text-gold">{eyebrow}</p>}
            <h2 className="mt-0.5 text-xl font-semibold text-ink">{title}</h2>
          </div>
          <button type="button" onClick={onClose} className="action shrink-0" aria-label="Close"><X /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3 sm:px-6">{footer}</div>}
      </div>
    </div>
  );
}
