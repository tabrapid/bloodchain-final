import { createLocalization } from '@bloodchain/i18n';
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

  // The helper used to build these phrases in English and format the fallback
  // date as `en-US`, so a donor reading the app in Uzbek saw "Updated 3 days
  // ago" under an Uzbek heading. It takes the screen's own translator now, and
  // the assertions read the catalogue rather than restating English.
  const en = createLocalization('en');
  const formatters = { t: en.t, formatDate: en.formatDate };

  it('describes recent dates in days, not calendar dates', () => {
    expect(formatUpdated('2026-09-06T08:00:00.000Z', formatters, now)).toBe(
      en.t('health.updatedToday'),
    );
    expect(formatUpdated('2026-09-05T08:00:00.000Z', formatters, now)).toBe(
      en.t('health.updatedYesterday'),
    );
    expect(formatUpdated('2026-09-03T08:00:00.000Z', formatters, now)).toBe(
      en.t('health.updatedDaysAgo', { count: 3 }),
    );
  });

  it('falls back to a calendar date past a week', () => {
    expect(formatUpdated('2026-08-20T08:00:00.000Z', formatters, now)).toBe(
      en.t('health.updatedOn', { date: en.formatDate('2026-08-20T08:00:00.000Z', 'medium') }),
    );
  });

  it('speaks the donor’s language, not the developer’s', () => {
    const uz = createLocalization('uz');
    expect(
      formatUpdated('2026-09-06T08:00:00.000Z', { t: uz.t, formatDate: uz.formatDate }, now),
    ).toBe(uz.t('health.updatedToday'));
  });

  it('returns nothing for a missing or unparseable date', () => {
    expect(formatUpdated(undefined, formatters, now)).toBeNull();
    expect(formatUpdated('not-a-date', formatters, now)).toBeNull();
  });
});
