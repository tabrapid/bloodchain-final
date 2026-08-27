import { useEffect, useId } from 'react';
import { X } from 'lucide-react';
import { cn } from '../cn';

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

  // Same as Modal: without this the drawer cannot be dismissed from the
  // keyboard at all.
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
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title ? undefined : 'Panel'}
        aria-labelledby={title ? titleId : undefined}
        className={cn(
          'relative z-10 flex w-full max-w-md flex-col border-l border-[#253442] bg-[#111A24] p-6 shadow-2xl',
          className,
        )}
      >
        <div className="flex items-center justify-between">
          {title && (
            <h2 id={titleId} className="text-lg font-semibold text-[#F2F5F7]">
              {title}
            </h2>
          )}
          <button
            onClick={onClose}
            className="rounded-md p-1 text-[#8495A3] transition-colors hover:bg-[#182431] hover:text-[#F2F5F7]"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-auto py-6">{children}</div>
        {footer && (
          <div className="flex justify-end gap-3 border-t border-[#253442] pt-5">{footer}</div>
        )}
      </div>
    </div>
  );
}
