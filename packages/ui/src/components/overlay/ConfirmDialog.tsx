'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useOptionalTranslation } from '../../i18n';
import { cn } from '../cn';
import { Modal } from './Modal';

export interface ConfirmDialogReason {
  /** The action cannot be confirmed until a value is typed. */
  required?: boolean;
  label: string;
  placeholder?: string;
  /** `number` for a quantity the operator types, such as a collected volume. */
  type?: 'text' | 'number';
  /** Prefilled on open -- the usual answer, still editable. */
  defaultValue?: string;
  min?: number;
}

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  title: string;
  /** What will happen, in the operator's own terms. */
  body?: React.ReactNode;
  /** The row, unit or person being acted on, so the operator can check it. */
  context?: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** `danger` marks an action that cannot be undone. */
  tone?: 'default' | 'danger';
  reason?: ConfirmDialogReason;
  loading?: boolean;
  /** A refusal from the server, shown in the dialog rather than a toast. */
  error?: string | null;
}

/**
 * The one confirmation dialog the consoles use for an action that changes
 * something irreversibly.
 *
 * These were `window.confirm()` and `window.prompt()`: an operating-system box
 * with no styling, no translation, no room to show *which* unit is about to be
 * discarded, and -- for the prompts -- no way to tell a typed reason from a
 * cancelled dialog, so pressing Escape and pressing OK on an empty field were
 * the same event. Chrome also lets a site suppress them after a few in a row,
 * which is a confirmation that silently stops appearing.
 *
 * This shows the context, requires the reason where the domain requires one,
 * says plainly when an action cannot be undone, and reports the server's
 * refusal in the same place the operator is already looking.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  body,
  context,
  confirmLabel,
  cancelLabel,
  tone = 'default',
  reason,
  loading = false,
  error = null,
}: ConfirmDialogProps) {
  const { t } = useOptionalTranslation();
  const [value, setValue] = useState('');
  const reasonRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  // A dialog reopened for a different row must not carry the previous row's
  // reason, and focus has to land inside it or the keyboard is left behind on
  // the page underneath.
  useEffect(() => {
    if (!open) return;
    setValue(reason?.defaultValue ?? '');
    const focus = window.setTimeout(() => {
      (reasonRef.current ?? confirmRef.current)?.focus();
    }, 0);
    return () => window.clearTimeout(focus);
  }, [open, reason?.defaultValue]);

  const trimmed = value.trim();
  const blocked = loading || (reason?.required === true && trimmed.length === 0);

  return (
    <Modal open={open} onClose={onClose} title={title} className="max-w-md">
      <div className="space-y-4">
        {tone === 'danger' && (
          <div className="flex items-start gap-3 rounded-lg border border-donor-danger/30 bg-donor-dangerMuted p-3">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-donor-onDangerMuted" />
            <p className="text-sm text-donor-onDangerMuted">{t('actions.cannotBeUndone')}</p>
          </div>
        )}

        {body && <div className="text-sm text-donor-text">{body}</div>}

        {context && (
          <div className="rounded-lg bc-solid p-3 text-sm text-donor-muted">{context}</div>
        )}

        {reason && (
          <div>
            <label
              htmlFor="confirm-dialog-reason"
              className="mb-1 block text-xs font-semibold text-donor-muted"
            >
              {reason.label}
            </label>
            <input
              id="confirm-dialog-reason"
              ref={reasonRef}
              type={reason.type ?? 'text'}
              min={reason.min}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder={reason.placeholder}
              required={reason.required}
              aria-required={reason.required}
              className="w-full rounded-lg border border-donor-border bc-solid px-3 py-2 text-sm text-donor-text placeholder:text-donor-muted focus:border-donor-secondary focus:outline-none focus:ring-2 focus:ring-donor-secondary/30"
            />
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-donor-onDangerMuted">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-lg bc-solid px-4 py-2 text-sm font-medium text-donor-text transition-colors hover:bg-donor-elevated disabled:opacity-50"
          >
            {cancelLabel ?? t('actions.cancel')}
          </button>
          <button
            type="button"
            ref={confirmRef}
            onClick={() => onConfirm(trimmed)}
            disabled={blocked}
            className={cn(
              'rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-50',
              tone === 'danger'
                ? 'bg-donor-danger hover:bg-donor-danger/85'
                : 'bg-donor-primary hover:bg-donor-primary/85',
            )}
          >
            {loading ? t('ops.common.working') : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
