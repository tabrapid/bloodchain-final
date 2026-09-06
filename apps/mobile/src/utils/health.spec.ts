import { formatUpdated, isWithinReferenceRange } from './health';
import type { TrendData } from '../api/health-trends';

function trend(overrides: Partial<TrendData>): TrendData {
  return {
    parameterCode: 'HEMATOCRIT',
    parameterName: 'Hematocrit',
    latestValue: 42,
    trend: 'STABLE',
    points: [],
    hasReferenceRange: false,
    ...overrides,
  };
}

function point(value: number, flag?: string) {
  return { date: '2026-09-01T00:00:00.000Z', value, flag };
}

/**
 * "Within healthy range" is a clinical claim. The screen may only make it when
 * something in the data actually supports it -- the laboratory's own flag
 * first, a reference range second, and otherwise nothing at all.
 */
describe('isWithinReferenceRange', () => {
  it('takes the laboratory flag over anything else', () => {
    expect(
      isWithinReferenceRange(trend({ points: [point(42, 'NORMAL')] })),
    ).toBe(true);
    expect(isWithinReferenceRange(trend({ points: [point(42, 'HIGH')] }))).toBe(false);
  });

  it('lets the flag overrule a range that disagrees with it', () => {
    // A value inside the printed range that the lab still flagged: the flag is
    // the one that knows about age, sex and the donor's own history.
    const flagged = trend({
      points: [point(42, 'LOW')],
      hasReferenceRange: true,
      referenceMin: 40,
      referenceMax: 50,
    });

    expect(isWithinReferenceRange(flagged)).toBe(false);
  });

  it('falls back to the reference range when there is no flag', () => {
    const withRange = { hasReferenceRange: true, referenceMin: 40, referenceMax: 50 };

    expect(isWithinReferenceRange(trend({ ...withRange, latestValue: 42, points: [point(42)] }))).toBe(true);
    expect(isWithinReferenceRange(trend({ ...withRange, latestValue: 52, points: [point(52)] }))).toBe(false);
    expect(isWithinReferenceRange(trend({ ...withRange, latestValue: 40, points: [point(40)] }))).toBe(true);
    expect(isWithinReferenceRange(trend({ ...withRange, latestValue: 50, points: [point(50)] }))).toBe(true);
  });

  it('says nothing when it has neither a flag nor a range', () => {
    expect(isWithinReferenceRange(trend({ points: [point(42)] }))).toBeNull();
    expect(isWithinReferenceRange(undefined)).toBeNull();
  });

  it('reads the newest point, not the oldest', () => {
    const rising = trend({ points: [point(38, 'LOW'), point(42, 'NORMAL')] });

    expect(isWithinReferenceRange(rising)).toBe(true);
  });
});

describe('formatUpdated', () => {
  const now = new Date('2026-09-06T12:00:00.000Z');

  it('describes recent dates in days, not calendar dates', () => {
    expect(formatUpdated('2026-09-06T08:00:00.000Z', now)).toBe('Updated today');
    expect(formatUpdated('2026-09-05T08:00:00.000Z', now)).toBe('Updated yesterday');
    expect(formatUpdated('2026-09-03T08:00:00.000Z', now)).toBe('Updated 3 days ago');
  });

  it('falls back to a calendar date past a week', () => {
    expect(formatUpdated('2026-08-20T08:00:00.000Z', now)).toMatch(/^Updated Aug \d+$/);
  });

  it('returns nothing for a missing or unparseable date', () => {
    expect(formatUpdated(undefined, now)).toBeNull();
    expect(formatUpdated('not-a-date', now)).toBeNull();
  });
});
