/**
 * Machine-readable reasons an auth request was refused.
 *
 * The API answers in English. That was tolerable while every client was
 * English; it is not now that the donor app speaks Uzbek and Russian, because
 * the one place a user is most likely to be stuck -- a failed sign-in -- was the
 * one place the product reverted to a language they may not read.
 *
 * So every refusal in these flows carries a code. `ApiExceptionFilter` puts it
 * in the response body as `code`, and the client looks it up in
 * `@bloodchain/i18n` under `apiErrors.<code>`. The English `message` stays as a
 * fallback for clients that do not translate (the consoles, curl, logs) and as
 * the thing a developer reads in a stack trace.
 *
 * Scope is deliberate: auth, OTP and phone. Translating every response in the
 * repository is a larger job than this sprint, and a half-done version of it is
 * worse than an honest boundary.
 */
export const AuthErrorCode = {
  /** Wrong identifier or wrong password. Never says which. */
  INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  ACCOUNT_LOCKED: 'AUTH_ACCOUNT_LOCKED',
  ACCOUNT_SUSPENDED: 'AUTH_ACCOUNT_SUSPENDED',
  ACCOUNT_DEACTIVATED: 'AUTH_ACCOUNT_DEACTIVATED',
  /** Neither the email nor the phone on the account has been confirmed. */
  CONTACT_NOT_VERIFIED: 'AUTH_CONTACT_NOT_VERIFIED',
  MAINTENANCE_MODE: 'AUTH_MAINTENANCE_MODE',

  EMAIL_TAKEN: 'AUTH_EMAIL_TAKEN',
  PHONE_TAKEN: 'AUTH_PHONE_TAKEN',
  PHONE_INVALID: 'AUTH_PHONE_INVALID',

  /** Wrong code, or no code outstanding. One answer for both. */
  OTP_INVALID: 'AUTH_OTP_INVALID',
  OTP_EXPIRED: 'AUTH_OTP_EXPIRED',
  OTP_TOO_MANY_ATTEMPTS: 'AUTH_OTP_TOO_MANY_ATTEMPTS',
  /** Asked for another code before the cooldown ran out. */
  OTP_COOLDOWN: 'AUTH_OTP_COOLDOWN',
  /** Too many codes for this number in the last hour. */
  OTP_RATE_LIMITED: 'AUTH_OTP_RATE_LIMITED',
  /** The SMS could not be handed to the provider. */
  OTP_SEND_FAILED: 'AUTH_OTP_SEND_FAILED',

  /**
   * The proof-of-phone-ownership ticket is missing, forged, expired, or was
   * issued for a different number.
   */
  VERIFICATION_TICKET_INVALID: 'AUTH_VERIFICATION_TICKET_INVALID',

  RESET_TOKEN_INVALID: 'AUTH_RESET_TOKEN_INVALID',
} as const;

/**
 * The union of those codes.
 *
 * Sharing the name with the const above is declaration merging, not a mistake:
 * `AuthErrorCode.OTP_EXPIRED` is the value and `AuthErrorCode` is the type, the
 * way an enum reads -- without an enum's runtime object or its reverse mapping.
 */
// eslint-disable-next-line no-redeclare
export type AuthErrorCode = (typeof AuthErrorCode)[keyof typeof AuthErrorCode];

/**
 * The body shape `ApiExceptionFilter` reads a domain code out of.
 *
 * `details` carries only machine-usable facts -- how many seconds until a
 * resend is allowed, how many attempts remain -- never anything that would tell
 * a caller whether an account exists.
 */
export function authError(
  code: AuthErrorCode,
  message: string,
  details?: Record<string, unknown>,
): { code: AuthErrorCode; message: string; details?: Record<string, unknown> } {
  return details ? { code, message, details } : { code, message };
}
