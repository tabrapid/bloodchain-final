import { formatClinicalValue } from './clinical';

/**
 * The five formats that shared one card on the Health screen, and what they
 * should have been. Kept as one block because the point is not any single case
 * -- it is that a lab report which cannot punctuate consistently invites the
 * question of what else it is careless about.
 */
describe('formatClinicalValue', () => {
  it('groups thousands so a platelet count can be read at a glance', () => {
    // Was: "250000 cells/mcL"
    expect(formatClinicalValue(250000, 'cells/mcL')).toBe('250 000 cells/mcL');
    expect(formatClinicalValue(7500, 'cells/mcL')).toBe('7500 cells/mcL');
  });

  it('closes the percent sign up against its number', () => {
    // Was: "42 %"
    expect(formatClinicalValue(42, '%')).toBe('42%');
    expect(formatClinicalValue(42, ' % ')).toBe('42%');
  });

  it('keeps a space before a clinical unit, where one belongs', () => {
    expect(formatClinicalValue(14.2, 'g/dL')).toBe('14.2 g/dL');
  });

  it('shows a missing result as missing, not as zero', () => {
    // These are different clinical claims and must never render the same.
    expect(formatClinicalValue(undefined, 'g/dL')).toBe('—');
    expect(formatClinicalValue(null, 'g/dL')).toBe('—');
    expect(formatClinicalValue('', 'g/dL')).toBe('—');
    expect(formatClinicalValue(0, 'g/dL')).toBe('0 g/dL');
  });

  it('works with no unit at all', () => {
    expect(formatClinicalValue(5.1)).toBe('5.1');
    expect(formatClinicalValue(12000)).toBe('12 000');
  });

  /**
   * A comma or a period would each be a decimal separator to some reader of
   * this app, which ships in English, Russian and Uzbek. U+202F is the SI
   * separator for exactly that reason and does not break across a line.
   */
  it('separates with a narrow no-break space rather than a comma', () => {
    const formatted = formatClinicalValue(250000, 'cells/mcL');
    expect(formatted).not.toContain(',');
    expect(formatted).not.toMatch(/\d\.\d{3}/);
    expect(formatted).toContain(' ');
  });

  it('passes a value through unchanged when it is not a number', () => {
    expect(formatClinicalValue('positive')).toBe('positive');
    expect(formatClinicalValue('A+', '')).toBe('A+');
  });

  it('handles a negative value without losing its sign', () => {
    expect(formatClinicalValue(-12000, 'mL')).toBe('-12 000 mL');
  });
});
