import { cn } from '../cn';
import { type LucideIcon } from 'lucide-react';

export interface StatCardProps {
  label: string;
  value: string;
  note?: string;
  icon?: LucideIcon;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  className?: string;
}

export function StatCard({
  label,
  value,
  note,
  icon: Icon,
  variant = 'default',
  className,
}: StatCardProps) {
  const variants = {
    default: 'border-[#253442] bg-[#111A24]',
    success: 'border-[#28413B] bg-[#10221F] text-[#B7D3CA]',
    warning: 'border-[#4A3B22] bg-[#1F1A12]',
    danger: 'border-[#5B3038] bg-[#26191F]',
    info: 'border-[#29404D] bg-[#10202A]',
  };

  return (
    <div className={cn('rounded-2xl border p-5', variants[variant], className)}>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#8495A3]">
          {label}
        </span>
        {Icon && <Icon size={18} className="text-[#8495A3]" />}
      </div>
      <p className="text-3xl font-bold tracking-tight text-[#F2F5F7]">{value}</p>
      {note && <p className="mt-1 text-xs text-[#8495A3]">{note}</p>}
    </div>
  );
}
