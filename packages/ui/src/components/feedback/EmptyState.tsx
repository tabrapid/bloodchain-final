import { Inbox, type LucideIcon } from 'lucide-react';
import { useOptionalTranslation } from '../../i18n';
import { cn } from '../cn';

export interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  action,
  className,
}: EmptyStateProps) {
  // The defaults used to be English string literals in the signature, so every
  // console showed "Nothing here yet" in all three languages.
  const { t } = useOptionalTranslation();
  const heading = title ?? t('common.nothingHere');
  const body = description ?? t('common.nothingHereHint');

  return (
    <div className={cn('bc-glass bc-rise flex flex-col items-center justify-center rounded-card p-10 text-center', className)}>
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-donor-elevated text-donor-muted">
        <Icon size={24} />
      </div>
      <h3 className="text-base font-semibold text-donor-text">{heading}</h3>
      <p className="mt-1 max-w-xs text-sm text-donor-muted">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
