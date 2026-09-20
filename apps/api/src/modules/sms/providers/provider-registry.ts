import { ConfigService } from '@nestjs/config';

import { ConsoleSmsProvider } from './console-sms.provider';
import type { SmsProvider } from './sms-provider.interface';

/**
 * Which adapters exist, and how each one is built from configuration.
 *
 * Adding a vendor is one file implementing `SmsProvider` and one entry here.
 * Nothing in the auth domain moves — that is what the port is for, and it is
 * why this registry is a table of factories rather than a switch that grows a
 * branch of vendor-specific logic each time.
 *
 * **No vendor adapter ships in this repository, and this file does not invent
 * one.** Uzbekistan's SMS market is a handful of local aggregators (Eskiz, Play
 * Mobile, SMS.uz and others), each with its own authentication scheme — one
 * issues a JWT that expires and must be refreshed, another wants a static key,
 * a third requires message templates to be pre-registered with the operator.
 * Writing an adapter against a guessed API shape would produce code that looks
 * finished, passes its own tests, and fails the first time it meets the real
 * endpoint. Worse, it would make MS-01 look closed.
 *
 * What Sprint 8 provides instead is everything around the adapter: the
 * registry, the configuration surface, two independent production barriers, and
 * the tests. `docs/sms-provider-integration.md` says exactly what the operator
 * must supply and exactly what an adapter must implement.
 */
export type SmsProviderFactory = (config: ConfigService) => SmsProvider;

export const SMS_PROVIDER_REGISTRY: Record<string, SmsProviderFactory> = {
  console: (config) => new ConsoleSmsProvider(config.get<string>('SMS_DEV_LOG_FILE') || undefined),

  // ---------------------------------------------------------------------
  // Production adapters go here, one line each:
  //
  //   eskiz: (config) => new EskizSmsProvider({
  //     baseUrl: config.getOrThrow<string>('SMS_API_BASE_URL'),
  //     email:   config.getOrThrow<string>('SMS_API_USER'),
  //     secret:  config.getOrThrow<string>('SMS_API_SECRET'),
  //     sender:  config.getOrThrow<string>('SMS_SENDER_ID'),
  //   }),
  //
  // `getOrThrow` rather than `get`, so a half-configured vendor fails at boot
  // with the name of the variable it wants, instead of at 3am with a donor
  // waiting for a code.
  // ---------------------------------------------------------------------
};

/** The adapter names this build knows about, for error messages. */
export function knownSmsProviders(): string[] {
  return Object.keys(SMS_PROVIDER_REGISTRY).sort();
}

/** The adapter names that actually deliver. Empty until a vendor is chosen. */
export function productionSmsProviders(config: ConfigService): string[] {
  return knownSmsProviders().filter((name) => {
    try {
      return !SMS_PROVIDER_REGISTRY[name]!(config).isDevelopmentOnly;
    } catch {
      // An adapter that cannot be built from this configuration is not a
      // production option *here*, whatever it is elsewhere.
      return false;
    }
  });
}
