import { count } from './format';

describe('count', () => {
  it('prints a finite number as is', () => {
    expect(count(0)).toBe('0');
    expect(count(12)).toBe('12');
  });

  it('prints a dash for anything that is not a figure', () => {
    expect(count(undefined)).toBe('—');
    expect(count(null)).toBe('—');
    expect(count(Number.NaN)).toBe('—');
    expect(count('3')).toBe('—');
  });
});
