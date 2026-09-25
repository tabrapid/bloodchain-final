/**
 * The one place that turns a percentage into a bar.
 *
 * The gamification API reports progress as a percentage -- `progress: 36` for a
 * donor 36% of the way through their level -- and the `Progress` component
 * draws a fraction between 0 and 1, clamping anything above 1. Handing it 36
 * therefore drew a *full* bar for a donor a third of the way, on Home, on
 * Profile and on the recognition hub, each of which sat beside a caption that
 * said otherwise. Both units are defensible; having two of them was the defect.
 *
 * This converts, clamps, and survives the API sending nothing at all. It is
 * deliberately not a method on the component: a component that accepted either
 * unit would have to guess, and 1 is a legitimate value in both.
 */
export function percentAsFraction(percent: number | null | undefined): number {
  if (typeof percent !== 'number' || !Number.isFinite(percent)) return 0;
  return Math.max(0, Math.min(1, percent / 100));
}
