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
  // Default is the plain glass surface; the other variants tint that same
  // surface with the muted brand color so a card reads as "this stat is
  // good/bad" without dropping to a flat, non-glass block.
  const variants = {
    default: 'bc-glass',
    success: 'bc-glass bg-donor-successMuted',
    warning: 'bc-glass bg-donor-warningMuted',
    danger: 'bc-glass bg-donor-dangerMuted',
    info: 'bc-glass bg-donor-secondaryMuted',
  };
  const iconColor = {
    default: 'text-donor-muted',
    success: 'text-donor-onSuccessMuted',
    warning: 'text-donor-onWarningMuted',
    danger: 'text-donor-onDangerMuted',
    info: 'text-donor-onSecondaryMuted',
  };

  return (
    <div className={cn('bc-rise rounded-card p-5', variants[variant], className)}>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-donor-muted">
          {label}
        </span>
        {Icon && <Icon size={18} className={iconColor[variant]} />}
      </div>
      <p className="text-3xl font-bold tracking-tight text-donor-text">{value}</p>
      {note && <p className="mt-1 text-xs text-donor-muted">{note}</p>}
    </div>
  );
}
