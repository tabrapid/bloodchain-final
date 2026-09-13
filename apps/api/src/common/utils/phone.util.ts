/**
 * Uzbekistan phone numbers, in one canonical form.
 *
 * A phone number is an identity here: it is what a donor signs in with and what
 * an SMS is sent to, and `User.phone` is unique. Uniqueness is only real if
 * every spelling of the same number lands on the same string -- otherwise
 * `+998 90 123 45 67` and `901234567` are two accounts for one person, and the
 * second one never receives the emergency that was matched to the first.
 *
 * Canonical form is E.164: `+998` followed by the nine national digits, no
 * spaces and no punctuation. Input is generous, storage is not.
 *
 * No operator prefix list. Uzbekistan's mobile codes change when a licence is
 * issued, and a list baked into a release rejects real customers of a new
 * operator months before anyone can ship a fix. The shape of the number is
 * checked; who issued it is not.
 *
 * This file is duplicated, deliberately, in packages/validation for the
 * clients: the API compiles with classic module resolution and cannot import a
 * workspace package. `phone-normalization-parity.spec.ts` fails if the two
 * drift.
 */

/** Uzbekistan's country calling code, without the plus. */
const UZ_COUNTRY_CODE = '998';

/** How many digits an Uzbek number has after the country code. */
const UZ_NATIONAL_DIGITS = 9;

/**
 * Anything a person might type between the digits: spaces (including the
 * non-breaking space a copied number often carries), dashes of several kinds,
 * brackets and dots.
 */
const SEPARATORS = /[\s\u00a0\u202f\-\u2013\u2014().]/g;

/**
 * The canonical form of a number, or null if it is not one.
 *
 * Accepts, for Uzbekistan:
 * - `+998 90 123 45 67`, `998901234567`, `00998901234567`
 * - `90 123 45 67` -- nine national digits, which is how a number is written
 *   on a poster, said out loud, and stored in a phone's contacts
 * - `8 90 123 45 67` -- the old domestic trunk prefix, still in muscle memory
 *
 * A number typed with an explicit `+<country code>` for somewhere else is kept
 * as written: staff and partners abroad exist, and silently rewriting their
 * number to Uzbekistan would be worse than refusing it.
 */
export function normalizePhone(input: string | null | undefined): string | null {
  if (input == null) return null;

  let value = input.trim().replace(SEPARATORS, '');
  if (value === '') return null;

  // 00 is the international prefix dialled from most of the world; treat it as
  // the plus the caller meant.
  if (value.startsWith('00')) value = `+${value.slice(2)}`;

  if (value.startsWith('+')) {
    const digits = value.slice(1);
    if (!/^[1-9]\d{7,14}$/.test(digits)) return null;
    return digits.startsWith(UZ_COUNTRY_CODE)
      ? canonicalUzbek(digits.slice(UZ_COUNTRY_CODE.length))
      : `+${digits}`;
  }

  if (!/^\d+$/.test(value)) return null;

  // No plus: an Uzbek number, written one of the three ways people write it.
  if (value.startsWith(UZ_COUNTRY_CODE) && value.length === UZ_COUNTRY_CODE.length + UZ_NATIONAL_DIGITS) {
    return canonicalUzbek(value.slice(UZ_COUNTRY_CODE.length));
  }
  if (value.length === UZ_NATIONAL_DIGITS) {
    return canonicalUzbek(value);
  }
  if (value.length === UZ_NATIONAL_DIGITS + 1 && value.startsWith('8')) {
    return canonicalUzbek(value.slice(1));
  }

  return null;
}

/** `+998XXXXXXXXX`, or null if those nine digits are not a national number. */
function canonicalUzbek(national: string): string | null {
  // A leading zero is not part of any E.164 subscriber number; it is a trunk
  // digit that came along by accident.
  if (!/^[1-9]\d{8}$/.test(national)) return null;
  return `+${UZ_COUNTRY_CODE}${national}`;
}

/** Whether `input` is a number this product can store. */
export function isValidPhone(input: string | null | undefined): boolean {
  return normalizePhone(input) !== null;
}

/** True for numbers that belong to Uzbekistan. */
export function isUzbekPhone(input: string | null | undefined): boolean {
  const normalized = normalizePhone(input);
  return normalized !== null && normalized.startsWith(`+${UZ_COUNTRY_CODE}`);
}

/**
 * A number with the middle hidden: `+998*******67`.
 *
 * The country code stays so the reader can tell it is their own number, and
 * the last two digits are the part people actually remember. For anything a
 * third party might read -- an audit entry, a log line, and the "we sent a code
 * to …" line on the OTP screen, which is on a screen someone else may be
 * looking at.
 */
export function maskPhone(input: string | null | undefined): string {
  const normalized = normalizePhone(input);
  if (!normalized) return '';
  if (normalized.length <= 6) return normalized;
  const prefix = normalized.slice(0, 4);
  const suffix = normalized.slice(-2);
  return `${prefix}${'*'.repeat(normalized.length - prefix.length - suffix.length)}${suffix}`;
}
