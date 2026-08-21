import { cn } from '../cn';

export type StatusVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

export interface StatusBadgeProps {
  children: React.ReactNode;
  variant?: StatusVariant;
  className?: string;
}

export function StatusBadge({ children, variant = 'default', className }: StatusBadgeProps) {
  const variants: Record<StatusVariant, string> = {
    default: 'border-[#253442] bg-[#182431] text-[#8495A3]',
    success: 'border-[#28413B] bg-[#10221F] text-[#63C29B]',
    warning: 'border-[#4A3B22] bg-[#1F1A12] text-[#E5B86D]',
    danger: 'border-[#5B3038] bg-[#26191F] text-[#D85360]',
    info: 'border-[#29404D] bg-[#10202A] text-[#68B7D1]',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
