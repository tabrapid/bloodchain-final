import { AlertTriangle, ArrowLeft, RotateCcw, type LucideIcon } from 'lucide-react';
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
  title = 'Something went wrong',
  description = 'We could not load the requested information. Please try again or contact support if the problem persists.',
  icon: Icon = AlertTriangle,
  onRetry,
  onBack,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        'bc-glass bc-rise flex flex-col items-center justify-center rounded-card border-donor-danger/30 bg-donor-dangerMuted p-10 text-center',
        className,
      )}
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-donor-danger/20 text-donor-onDangerMuted">
        <Icon size={24} />
      </div>
      <h3 className="text-base font-semibold text-donor-text">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-donor-muted">{description}</p>
      <div className="mt-6 flex gap-3">
        {onBack && (
          <button
            onClick={onBack}
            className="bc-solid flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-donor-text transition-colors hover:bg-donor-elevated"
          >
            <ArrowLeft size={16} /> Back
          </button>
        )}
        {onRetry && (
          <button
            onClick={onRetry}
            className="flex items-center gap-2 rounded-lg bg-donor-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-donor-primary/85"
          >
            <RotateCcw size={16} /> Retry
          </button>
        )}
      </div>
    </div>
  );
}
