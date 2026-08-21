import { SlidersHorizontal } from 'lucide-react';
import { cn } from '../cn';

export interface FilterBarProps {
  children: React.ReactNode;
  className?: string;
}

export function FilterBar({ children, className }: FilterBarProps) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-3 rounded-2xl border border-[#253442] bg-[#111A24] p-3',
        className,
      )}
    >
      <SlidersHorizontal size={16} className="text-[#8495A3]" />
      {children}
    </div>
  );
}
