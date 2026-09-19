import { useEffect, useId } from 'react';
import { X } from 'lucide-react';
import { useOptionalTranslation } from '../../i18n';
import { cn } from '../cn';

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

  // Escape closes the dialog. The overlay click already did; the keyboard had
  // no way out at all, which traps anyone not using a mouse.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
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
