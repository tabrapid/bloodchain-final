import type { TrendData } from '../api/health-trends';

/**
 * Whether the headline figure sits inside its reference range.
 *
 * The latest point's own flag is the laboratory's answer and wins outright.
 * The range comparison is the fallback for a result that carries a range but
 * no flag. With neither, this returns `null` and the caller says nothing --
 * "within healthy range" is a clinical claim, and the screen does not make one
 * it cannot support.
 */
export function isWithinReferenceRange(trend: TrendData | undefined): boolean | null {
  if (!trend) return null;

  const latestFlag = trend.points[trend.points.length - 1]?.flag;
  if (latestFlag) {
    return latestFlag === 'NORMAL';
  }

  if (
    trend.hasReferenceRange &&
    trend.referenceMin !== undefined &&
    trend.referenceMax !== undefined
  ) {
    return trend.latestValue >= trend.referenceMin && trend.latestValue <= trend.referenceMax;
  }

  return null;
}

/** "Updated today" / "Updated yesterday" / "Updated 3 days ago" / "Updated 12 Mar". */
export function formatUpdated(iso: string | undefined, now: Date = new Date()): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  const days = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
  if (days <= 0) return 'Updated today';
  if (days === 1) return 'Updated yesterday';
  if (days < 7) return `Updated ${days} days ago`;
  return `Updated ${date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}`;
}
