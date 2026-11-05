import { percentAsFraction } from './progress';

describe('percentAsFraction', () => {
  it('turns the gamification API percentage into the fraction a bar draws', () => {
    // The defect this exists for: 36 meant 36%, the bar clamped it to 1, and a
    // donor a third of the way through their level saw a full bar.
    expect(percentAsFraction(36)).toBeCloseTo(0.36);
    expect(percentAsFraction(0)).toBe(0);
    expect(percentAsFraction(100)).toBe(1);
  });

  it('clamps, so a server that sends 140 does not draw past the track', () => {
    expect(percentAsFraction(140)).toBe(1);
    expect(percentAsFraction(-5)).toBe(0);
  });

  it('is 0 when the API sends nothing at all', () => {
    expect(percentAsFraction(undefined)).toBe(0);
    expect(percentAsFraction(null)).toBe(0);
    expect(percentAsFraction(Number.NaN)).toBe(0);
  });
});
