import { AlertTriangle, ArrowLeft, RotateCcw, type LucideIcon } from 'lucide-react';
import { useOptionalTranslation } from '../../i18n';
import { cn } from '../cn';

export interface ErrorStateProps {
  title?: string;
  description?: string;
  icon?: LucideIcon;
  onRetry?: () => void;
  onBack?: () => void;
  className?: string;
}

export function ErrorState({
  title,
  description,
  icon: Icon = AlertTriangle,
  onRetry,
  onBack,
  className,
}: ErrorStateProps) {
  const { t } = useOptionalTranslation();
  const heading = title ?? t('common.errorTitle');
  const body = description ?? t('common.errorBody');

  return (
    <div
      className={cn(
        'bc-glass bc-rise flex flex-col items-center justify-center rounded-card border-donor-danger/30 bg-donor-dangerMuted p-10 text-center',
        className,
      )}
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-donor-dangerMuted text-donor-onDangerMuted">
        <Icon size={24} />
      </div>
      <h3 className="text-base font-semibold text-donor-text">{heading}</h3>
      <p className="mt-1 max-w-sm text-sm text-donor-muted">{body}</p>
      <div className="mt-6 flex gap-3">
        {onBack && (
          <button
            onClick={onBack}
            className="bc-solid flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-donor-text transition-colors hover:bg-donor-elevated"
          >
            <ArrowLeft size={16} /> {t('common.back')}
          </button>
        )}
        {onRetry && (
          <button
            onClick={onRetry}
            className="flex items-center gap-2 rounded-lg bg-donor-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-donor-primary/85"
          >
            <RotateCcw size={16} /> {t('common.retry')}
          </button>
        )}
      </div>
    </div>
  );
}
