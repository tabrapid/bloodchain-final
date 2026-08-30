import { SlidersHorizontal } from 'lucide-react';
import { cn } from '../cn';

export interface FilterBarProps {
  children: React.ReactNode;
  className?: string;
}

export function FilterBar({ children, className }: FilterBarProps) {
  return (
    <div className={cn('bc-glass flex flex-wrap items-center gap-3 rounded-card p-3', className)}>
      <SlidersHorizontal size={16} className="text-donor-muted" />
      {children}
    </div>
  );
}
