import { Loader2 } from 'lucide-react';
import { cn } from '../cn';

export interface LoadingStateProps {
  message?: string;
  className?: string;
}

export function LoadingState({ message = 'Loading...', className }: LoadingStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center p-10 text-center', className)}>
      <Loader2 size={28} className="animate-spin text-[#68B7D1]" />
      <p className="mt-3 text-sm text-[#8495A3]">{message}</p>
    </div>
  );
}
