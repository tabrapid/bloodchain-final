import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { useOptionalTranslation } from '../../i18n';
import { cn } from '../cn';

/** What Tab can reach, shared by the two dialog surfaces. */
const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export function Drawer({ open, onClose, title, children, footer, className }: DrawerProps) {
  const titleId = useId();
  const { t } = useOptionalTranslation();
  const panelRef = useRef<HTMLDivElement>(null);

  // Same as Modal: without this the drawer cannot be dismissed from the
  // keyboard at all, and Tab walks straight out of it into the page behind.
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;

      const focusable = panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const focus = window.setTimeout(() => {
      if (panelRef.current?.contains(document.activeElement)) return;
      panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    }, 0);

    return () => {
      window.clearTimeout(focus);
      previous?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title ? undefined : t('common.panel')}
        aria-labelledby={title ? titleId : undefined}
        className={cn(
          'bc-glass-elevated bc-rise relative z-10 flex w-full max-w-md flex-col border-y-0 border-r-0 p-6',
          className,
        )}
      >
        <div className="flex items-center justify-between">
          {title && (
            <h2 id={titleId} className="text-lg font-semibold text-donor-text">
              {title}
            </h2>
          )}
          <button
            onClick={onClose}
            className="rounded-md p-1 text-donor-muted outline-none transition-colors hover:bg-donor-elevated hover:text-donor-text focus-visible:ring-2 focus-visible:ring-donor-primary/60"
            aria-label={t('common.close')}
          >
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-auto py-6">{children}</div>
        {footer && (
          <div className="flex justify-end gap-3 border-t border-donor-border/60 pt-5">{footer}</div>
        )}
      </div>
    </div>
  );
}
