import { Inbox, type LucideIcon } from 'lucide-react';
import { cn } from '../cn';

export interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  title = 'Nothing here yet',
  description = 'When data is available, it will appear here.',
  icon: Icon = Inbox,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn('bc-glass bc-rise flex flex-col items-center justify-center rounded-card p-10 text-center', className)}>
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-donor-elevated text-donor-muted">
        <Icon size={24} />
      </div>
      <h3 className="text-base font-semibold text-donor-text">{title}</h3>
      <p className="mt-1 max-w-xs text-sm text-donor-muted">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
