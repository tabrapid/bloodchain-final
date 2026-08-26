import { describe, expect, it } from 'vitest';
import { clamp, isDefined, pagination, sleep, totalPages } from './index';

describe('totalPages', () => {
  it('rounds up to the nearest whole page', () => {
    expect(totalPages(41, 20)).toBe(3);
  });

  it('returns 0 pages for zero items', () => {
    expect(totalPages(0, 20)).toBe(0);
  });

  it('returns exactly the divided count when it divides evenly', () => {
    expect(totalPages(40, 20)).toBe(2);
  });

  it('returns 0 when limit is 0 or negative, instead of dividing by zero', () => {
    expect(totalPages(100, 0)).toBe(0);
    expect(totalPages(100, -5)).toBe(0);
  });
});

describe('pagination', () => {
  it('defaults to page 1, limit 20', () => {
    expect(pagination()).toEqual({ page: 1, limit: 20, skip: 0 });
  });

  it('computes skip from page and limit', () => {
    expect(pagination(3, 10)).toEqual({ page: 3, limit: 10, skip: 20 });
  });

  it('clamps page up to a minimum of 1', () => {
    expect(pagination(0, 20)).toEqual({ page: 1, limit: 20, skip: 0 });
    expect(pagination(-5, 20)).toEqual({ page: 1, limit: 20, skip: 0 });
  });

  it('clamps limit into [1, 100]', () => {
    expect(pagination(1, 0).limit).toBe(1);
    expect(pagination(1, -10).limit).toBe(1);
    expect(pagination(1, 500).limit).toBe(100);
  });

  it('computes skip using the clamped limit, not the raw input', () => {
    expect(pagination(2, 500)).toEqual({ page: 2, limit: 100, skip: 100 });
  });
});

describe('clamp', () => {
  it('returns the value unchanged when within range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it('clamps to the minimum when below range', () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });

  it('clamps to the maximum when above range', () => {
    expect(clamp(50, 0, 10)).toBe(10);
  });

  it('handles min === max by returning that fixed value', () => {
    expect(clamp(5, 3, 3)).toBe(3);
  });
});

describe('sleep', () => {
  it('resolves after roughly the given delay', async () => {
    const start = Date.now();
    await sleep(20);
    expect(Date.now() - start).toBeGreaterThanOrEqual(15);
  });
});

describe('isDefined', () => {
  it('returns false for null and undefined', () => {
    expect(isDefined(null)).toBe(false);
    expect(isDefined(undefined)).toBe(false);
  });

  it('returns true for falsy-but-defined values', () => {
    expect(isDefined(0)).toBe(true);
    expect(isDefined('')).toBe(true);
    expect(isDefined(false)).toBe(true);
  });

  it('returns true for any real value', () => {
    expect(isDefined('hello')).toBe(true);
    expect(isDefined({ a: 1 })).toBe(true);
  });

  it('narrows the type so a filtered array drops the null/undefined members', () => {
    const values: (string | null | undefined)[] = ['a', null, 'b', undefined];
    const filtered = values.filter(isDefined);
    const typeCheck: string[] = filtered;
    expect(typeCheck).toEqual(['a', 'b']);
  });
});
