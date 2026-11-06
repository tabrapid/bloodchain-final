import { cn } from '../cn';
import { TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react';

export interface StatCardProps {
  label: string;
  value: string;
  note?: string;
  icon?: LucideIcon;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  className?: string;
  trend?: number;
  trendIsPositive?: boolean;
}

/** A compact clinical metric; status belongs to the icon, never the whole surface. */
export function StatCard({
  label,
  value,
  note,
  icon: Icon,
  variant = 'default',
  className,
  trend,
  trendIsPositive = true,
}: StatCardProps) {
  const iconStyle = {
    default: 'bg-donor-elevated text-donor-muted',
    success: 'bg-donor-successMuted text-donor-onSuccessMuted',
    warning: 'bg-donor-warningMuted text-donor-onWarningMuted',
    danger: 'bg-donor-dangerMuted text-donor-onDangerMuted',
    info: 'bg-donor-secondaryMuted text-donor-onSecondaryMuted',
  };
  const trendGood = trend != null && (trendIsPositive ? trend >= 0 : trend <= 0);
  return (
    <div className={cn('bc-stat bc-glass bc-rise relative rounded-card p-6', className)}>
      {variant === 'danger' && (
        <span
          aria-hidden="true"
          className="absolute inset-y-4 left-0 w-[3px] rounded-r bg-donor-danger"
        />
      )}
      {Icon && (
        <span aria-hidden="true" className={cn('bc-stat-icon', iconStyle[variant])}>
          <Icon size={32} strokeWidth={1.5} />
        </span>
      )}
      <div className={cn('min-w-0 flex-1', Icon && 'text-right')}>
        <p className="bc-stat-value text-donor-text">{value}</p>
        <span className="bc-stat-label block">{label}</span>
        {(note || trend != null) && (
          <div className={cn('mt-2 flex flex-wrap items-center gap-1.5', Icon && 'justify-end')}>
            {trend != null && (
              <span
                className={cn(
                  'inline-flex items-center gap-0.5 text-xs font-semibold',
                  trendGood ? 'text-donor-onSuccessMuted' : 'text-donor-onDangerMuted',
                )}
              >
                {trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {Math.abs(trend)}%
              </span>
            )}
            {note && <p className="text-xs text-donor-muted">{note}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
