import { cn } from '../cn';

export type StatusVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

export interface StatusBadgeProps {
  children: React.ReactNode;
  variant?: StatusVariant;
  className?: string;
}

export function StatusBadge({ children, variant = 'default', className }: StatusBadgeProps) {
  // Text reads from the theme-shifted onXMuted token, not the raw brand
  // accent, so small badge text keeps 4.5:1 contrast against its own tint in
  // both light and dark mode.
  const variants: Record<StatusVariant, string> = {
    default: 'border-donor-border/60 bg-donor-surface text-donor-muted',
    success: 'border-transparent bg-donor-successMuted text-donor-onSuccessMuted',
    warning: 'border-transparent bg-donor-warningMuted text-donor-onWarningMuted',
    danger: 'border-transparent bg-donor-dangerMuted text-donor-onDangerMuted',
    info: 'border-transparent bg-donor-secondaryMuted text-donor-onSecondaryMuted',
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
