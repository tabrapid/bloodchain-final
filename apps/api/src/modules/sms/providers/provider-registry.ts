import { ConfigService } from '@nestjs/config';

import { ConsoleSmsProvider } from './console-sms.provider';
import { EskizSmsProvider } from './eskiz-sms.provider';
import type { SmsProvider } from './sms-provider.interface';

/**
 * Which adapters exist, and how each one is built from configuration.
 *
 * Adding a vendor is one file implementing `SmsProvider` and one entry here.
 * Nothing in the auth domain moves — that is what the port is for, and it is
 * why this registry is a table of factories rather than a switch that grows a
 * branch of vendor-specific logic each time.
 *
 * The optional Eskiz adapter follows its published multipart contract.
 * It is not enabled or commercially contracted by adding it to the registry.
 * Account credentials, sender/template approval and live delivery validation
 * remain deployment requirements. See docs/sms-provider-integration.md.
 */
export type SmsProviderFactory = (config: ConfigService) => SmsProvider;

export const SMS_PROVIDER_REGISTRY: Record<string, SmsProviderFactory> = {
  console: (config) => new ConsoleSmsProvider(config.get<string>('SMS_DEV_LOG_FILE') || undefined),
  eskiz: (config) => new EskizSmsProvider({
    email: config.get<string>('SMS_API_USER') ?? '',
    password: config.get<string>('SMS_API_SECRET') ?? '',
    sender: config.get<string>('SMS_SENDER_ID') ?? '',
  }),

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

/** Non-development adapters constructible with the supplied configuration. */
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
