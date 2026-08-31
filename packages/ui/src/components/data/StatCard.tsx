import { cn } from '../cn';
import { TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react';

export interface StatCardProps {
  label: string;
  value: string;
  note?: string;
  icon?: LucideIcon;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  className?: string;
  /**
   * Signed percentage change, rendered as an up/down arrow next to `note`.
   * Purely additive -- omit it and the card looks exactly as it did before.
   * Positive isn't hardcoded to "good": `trendIsPositive` decides whether an
   * *increase* is the good direction for this particular metric (more
   * available units is good, more pending requests is not).
   */
  trend?: number;
  trendIsPositive?: boolean;
}

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
  // Default is the plain glass surface; the other variants tint that same
  // surface with the muted brand color so a card reads as "this stat is
  // good/bad" without dropping to a flat, non-glass block.
  const variants = {
    default: 'bc-glass border-donor-border/60',
    success: 'bc-glass bg-donor-successMuted border-donor-success/25',
    warning: 'bc-glass bg-donor-warningMuted border-donor-warning/25',
    danger: 'bc-glass bg-donor-dangerMuted border-donor-danger/30',
    info: 'bc-glass bg-donor-secondaryMuted border-donor-secondary/25',
  };
  const iconColor = {
    default: 'text-donor-muted',
    success: 'text-donor-onSuccessMuted',
    warning: 'text-donor-onWarningMuted',
    danger: 'text-donor-onDangerMuted',
    info: 'text-donor-onSecondaryMuted',
  };
  const iconChip = {
    default: 'bg-donor-elevated',
    success: 'bg-donor-successMuted',
    warning: 'bg-donor-warningMuted',
    danger: 'bg-donor-dangerMuted',
    info: 'bg-donor-secondaryMuted',
  };

  const trendGood = trend != null && (trendIsPositive ? trend >= 0 : trend <= 0);

  return (
    <div
      className={cn('bc-rise relative overflow-hidden rounded-card border p-5', variants[variant], className)}
    >
      {/* Left accent bar: a second, color-independent signal for urgency so
          "critical" doesn't rely on the tint alone. */}
      {variant === 'danger' && <span className="absolute inset-y-0 left-0 w-1 bg-donor-danger" />}
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-donor-muted">
          {label}
        </span>
        {Icon && (
          <span
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-lg',
              iconChip[variant],
              variant === 'danger' && 'animate-pulse',
            )}
          >
            <Icon size={16} className={iconColor[variant]} />
          </span>
        )}
      </div>
      <p className="text-[32px] font-bold leading-none tracking-tight text-donor-text">{value}</p>
      {(note || trend != null) && (
        <div className="mt-2 flex items-center gap-1.5">
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
  );
}
