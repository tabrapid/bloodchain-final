import { isUzbekPhone, isValidPhone, maskPhone, normalizePhone } from './phone.util';

/**
 * Sprint 1B: the phone number is an identity now.
 *
 * `User.phone` is unique and is what a donor signs in with, so every spelling
 * of one number has to land on one string. The cases below are the spellings
 * people in Uzbekistan actually use -- off a poster, out of a contacts list,
 * dictated over the phone, or with the trunk prefix that is still muscle
 * memory -- plus the ones that must be refused rather than stored as typed.
 */
describe('normalizePhone', () => {
  describe('Uzbek numbers, however they are written', () => {
    it.each([
      ['+998901234567', 'already canonical'],
      ['+998 90 123 45 67', 'spaced the way it is printed'],
      ['+998-90-123-45-67', 'hyphenated'],
      ['+998 (90) 123-45-67', 'with brackets around the operator code'],
      ['998901234567', 'country code, no plus'],
      ['00998901234567', 'dialled internationally'],
      ['901234567', 'the nine national digits alone'],
      ['90 123 45 67', 'national, spaced'],
      ['8901234567', 'with the old domestic trunk prefix'],
      ['8 90 123 45 67', 'trunk prefix, spaced'],
      ['  +998901234567  ', 'padded with whitespace'],
    ])('reads %s (%s) as the same number', (input) => {
      expect(normalizePhone(input)).toBe('+998901234567');
    });

    it('gives one answer for every spelling, which is what makes the column unique', () => {
      const spellings = [
        '+998901234567',
        '+998 90 123 45 67',
        '998901234567',
        '901234567',
        '8901234567',
      ];
      expect(new Set(spellings.map(normalizePhone)).size).toBe(1);
    });
  });

  describe('numbers it refuses', () => {
    it.each([
      ['', 'empty'],
      ['   ', 'whitespace'],
      ['abc', 'letters'],
      ['+998', 'country code alone'],
      ['+99890123', 'too short for Uzbekistan'],
      ['+9989012345678', 'too long for Uzbekistan'],
      ['+998012345678', 'a leading zero, which no subscriber number has'],
      ['012345678', 'national, leading zero'],
      ['12345', 'far too short'],
      ['+0123456789', 'country code starting with zero'],
      ['+998 90 123 45 6a', 'a letter hiding among the digits'],
    ])('refuses %s (%s)', (input) => {
      expect(normalizePhone(input)).toBeNull();
    });

    it('refuses null and undefined without throwing', () => {
      expect(normalizePhone(null)).toBeNull();
      expect(normalizePhone(undefined)).toBeNull();
    });
  });

  describe('numbers from elsewhere', () => {
    /**
     * Staff, partners and visiting clinicians exist. Silently rewriting a
     * foreign number into an Uzbek one would be worse than refusing it: the
     * account would be created against a number nobody holds.
     */
    it('keeps an explicit country code as written', () => {
      expect(normalizePhone('+1 415 555 0123')).toBe('+14155550123');
      expect(normalizePhone('+44 20 7946 0958')).toBe('+442079460958');
    });

    it('does not treat a foreign number as Uzbek', () => {
      expect(isUzbekPhone('+14155550123')).toBe(false);
      expect(isUzbekPhone('+998901234567')).toBe(true);
    });

    it('reads bare digits as Uzbek, because that is who types them', () => {
      // Nine bare digits on a poster in Tashkent is an Uzbek number. Anyone
      // entering a foreign one types the plus.
      expect(normalizePhone('901234567')).toBe('+998901234567');
    });
  });

  describe('isValidPhone', () => {
    it('agrees with normalizePhone', () => {
      expect(isValidPhone('90 123 45 67')).toBe(true);
      expect(isValidPhone('nope')).toBe(false);
    });
  });

  describe('maskPhone', () => {
    it('keeps the country code and the last two digits, and nothing else', () => {
      expect(maskPhone('+998901234567')).toBe('+998*******67');
    });

    it('masks whatever spelling it is given, because logs get the raw input', () => {
      expect(maskPhone('90 123 45 67')).toBe('+998*******67');
    });

    it('hides the operator code, which is half of a guess', () => {
      expect(maskPhone('+998901234567')).not.toContain('90');
    });

    it('returns an empty string rather than leaking an unparsable value', () => {
      expect(maskPhone('not-a-number')).toBe('');
      expect(maskPhone(null)).toBe('');
    });
  });
});
