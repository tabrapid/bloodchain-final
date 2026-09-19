import { Loader2 } from 'lucide-react';
import { useOptionalTranslation } from '../../i18n';
import { cn } from '../cn';

export interface LoadingStateProps {
  message?: string;
  className?: string;
}

export function LoadingState({ message, className }: LoadingStateProps) {
  const { t } = useOptionalTranslation();

  return (
    <div className={cn('flex flex-col items-center justify-center p-10 text-center', className)}>
      <Loader2 size={28} className="animate-spin text-donor-secondary" />
      <p className="mt-3 text-sm text-donor-muted">{message ?? t('common.loading')}</p>
    </div>
  );
}
