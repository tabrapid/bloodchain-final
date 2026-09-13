import { ApiRequestError } from './client';

type Translate = (key: string, values?: Record<string, string | number>) => string;

/**
 * What the donor reads when the server refuses something.
 *
 * The API answers in English. Since Sprint 1B every refusal in the auth, OTP
 * and phone flows also carries a machine-readable `code`, and this turns that
 * code into a sentence in the language the app is actually being used in.
 *
 * Three deliberate fallbacks, in order:
 * - A code with no translation yet falls back by status rather than rendering
 *   `AUTH_SOMETHING_NEW` at a user. (`t` returns an unknown key unchanged,
 *   which is exactly how we detect one.)
 * - A network failure (`statusCode: 0`) keeps the client's own message: it is
 *   already written for a person and, in development, names the address that
 *   could not be reached.
 * - Anything else falls back by status, so every response outside these flows
 *   still says something sensible.
 */
export function apiErrorMessage(error: unknown, t: Translate): string {
  if (!(error instanceof ApiRequestError)) {
    return error instanceof Error && error.message ? error.message : t('common.error');
  }

  const { statusCode, code } = error.error;

  // Unreachable server: the client already phrased this one, and better than a
  // catalogue could -- it knows which address it tried.
  if (statusCode === 0) return error.error.message || t('common.offline');

  if (code) {
    const key = `apiErrors.${code}`;
    const translated = t(key);
    if (translated !== key) return translated;
  }

  switch (statusCode) {
    case 401:
      return t('apiErrors.AUTH_INVALID_CREDENTIALS');
    case 429:
      return t('apiErrors.RATE_LIMITED');
    default:
      // The server's own English is better than nothing for a code we have not
      // translated yet -- but only when there is one.
      return error.error.message || t('common.error');
  }
}

/** Machine-readable detail the server attached, when it attached any. */
export function apiErrorDetails<T extends Record<string, unknown>>(error: unknown): T | undefined {
  if (!(error instanceof ApiRequestError)) return undefined;
  return error.error.details as T | undefined;
}

/** The server's own code, for a screen that needs to branch on one. */
export function apiErrorCode(error: unknown): string | undefined {
  return error instanceof ApiRequestError ? error.error.code : undefined;
}
