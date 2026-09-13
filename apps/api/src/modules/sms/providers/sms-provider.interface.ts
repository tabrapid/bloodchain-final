/**
 * The seam between "send this person a code" and whichever company delivers it.
 *
 * Uzbekistan's SMS market is a handful of local aggregators (Eskiz, Play Mobile,
 * SMS.uz and others), each with its own auth scheme, its own body format and its
 * own idea of what a delivery receipt looks like. Which one this product buys is
 * a commercial decision that has not been made. What the domain needs from all
 * of them is this: take a number and a message, try to deliver it, say whether
 * it left.
 *
 * Anything vendor-shaped -- templates that must be pre-registered with the
 * operator, sender IDs, per-message pricing, delivery callbacks -- belongs
 * inside an adapter, not in this interface and not in the OTP service. When the
 * vendor is chosen, one new file implements this and one config value points at
 * it; nothing in auth changes.
 */
export interface SmsMessage {
  /** E.164, canonical. Adapters must not have to normalise. */
  to: string;
  /** The text as the recipient will read it, already localised. */
  body: string;
  /**
   * What this message is for. Vendors that require pre-registered templates key
   * them by something like this, and it keeps logs readable.
   */
  kind: 'otp' | 'notice';
}

export interface SmsDeliveryResult {
  /** Whether the provider accepted the message for delivery. */
  accepted: boolean;
  /** The provider's own identifier, when it gives one. For support tickets. */
  providerMessageId?: string;
  /** Populated when `accepted` is false. Never shown to a user. */
  error?: string;
}

export interface SmsProvider {
  /** A short name for logs and the boot banner. */
  readonly name: string;
  /**
   * True for adapters that do not actually send anything. The SMS service
   * refuses to start with one of these in production: an OTP that is printed to
   * a log instead of delivered is an authentication bypass, not a degraded
   * mode.
   */
  readonly isDevelopmentOnly: boolean;

  send(message: SmsMessage): Promise<SmsDeliveryResult>;
}

/** Nest injection token for the configured provider. */
export const SMS_PROVIDER = Symbol('SMS_PROVIDER');
