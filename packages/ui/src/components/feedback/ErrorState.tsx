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
        'flex flex-col items-center justify-center rounded-2xl border border-[#5B3038] bg-[#26191F] p-10 text-center',
        className,
      )}
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#5B3038] text-[#D85360]">
        <Icon size={24} />
      </div>
      <h3 className="text-base font-semibold text-[#F2F5F7]">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-[#8495A3]">{description}</p>
      <div className="mt-6 flex gap-3">
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-2 rounded-lg border border-[#253442] bg-[#111A24] px-4 py-2 text-sm font-medium text-[#F2F5F7] transition-colors hover:bg-[#182431]"
          >
            <ArrowLeft size={16} /> Back
          </button>
        )}
        {onRetry && (
          <button
            onClick={onRetry}
            className="flex items-center gap-2 rounded-lg bg-[#D85360] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#B03F4B]"
          >
            <RotateCcw size={16} /> Retry
          </button>
        )}
      </div>
    </div>
  );
}
