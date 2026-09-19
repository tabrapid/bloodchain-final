import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { useOptionalTranslation } from '../../i18n';
import { cn } from '../cn';

/** What Tab can reach inside a dialog. */
const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
}: ModalProps) {
  const titleId = useId();
  const { t } = useOptionalTranslation();
  const panelRef = useRef<HTMLDivElement>(null);

  // Escape closes the dialog. The overlay click already did; the keyboard had
  // no way out at all, which traps anyone not using a mouse.
  //
  // Tab is handled here too. `aria-modal` tells a screen reader the rest of the
  // page is inert, but it does not stop the browser tabbing into it, so
  // pressing Tab from the last field in a dialog landed on the page behind it --
  // still visible, still clickable, and no longer obviously not the dialog.
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

  // Focus moves into the dialog on open and back to whatever opened it on
  // close, so a keyboard user is not returned to the top of the document.
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title ? undefined : t('common.dialog')}
        aria-labelledby={title ? titleId : undefined}
        className={cn(
          'bc-glass-elevated bc-rise relative z-10 w-full max-w-lg overflow-hidden rounded-panel p-6',
          className,
        )}
      >
        <div className="flex items-start justify-between">
          <div>
            {title && (
              <h2 id={titleId} className="text-lg font-semibold text-donor-text">
                {title}
              </h2>
            )}
            {description && <p className="mt-1 text-sm text-donor-muted">{description}</p>}
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-donor-muted outline-none transition-colors hover:bg-donor-elevated hover:text-donor-text focus-visible:ring-2 focus-visible:ring-donor-primary/60"
            aria-label={t('common.close')}
          >
            <X size={18} />
          </button>
        </div>
        <div className="mt-4">{children}</div>
        {footer && <div className="mt-6 flex justify-end gap-3">{footer}</div>}
      </div>
    </div>
  );
}
