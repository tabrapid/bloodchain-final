/**
 * A count for a statistic tile.
 *
 * A number the API did not send is drawn as an em dash, not as "undefined"
 * or "NaN" -- which is what `String(stats.total)` printed on the donation
 * history and education screens the day a stub answered with the wrong
 * shape. A dash says "no figure"; the alternatives say "the app is broken".
 */
export function count(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : '—';
}
