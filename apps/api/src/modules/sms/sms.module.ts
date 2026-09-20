import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SMS_PROVIDER_REGISTRY, knownSmsProviders } from './providers/provider-registry';
import { SMS_PROVIDER, type SmsProvider } from './providers/sms-provider.interface';
import { SmsService } from './sms.service';

/**
 * Which SMS provider this deployment uses, decided once at boot.
 *
 * Three refusals, and they are deliberately not one:
 *
 * 1. **An unknown name is fatal.** A typo in a production environment file
 *    would otherwise fall back to the console adapter and leave one-time codes
 *    in a log.
 * 2. **A development adapter in production is fatal, here.** `SmsService` also
 *    refuses one — this is the second, independent barrier, and it fires first,
 *    before the adapter is even constructed. Two barriers because the cost of
 *    both failing is that every OTP in the system is printed to a log that
 *    operations staff, a log aggregator and anyone with a shell can read.
 * 3. **An unset `SMS_PROVIDER` in production is fatal.** This is the case a
 *    single barrier handled worst: `SMS_PROVIDER` defaults to `console`, so
 *    "nobody configured SMS" and "somebody chose the development adapter" used
 *    to be indistinguishable by the time anything checked. They are different
 *    mistakes and they get different messages.
 *
 * `assertProductionConfig` in `main.ts` catches all three earlier still, with a
 * fuller report. It is bypassed by anything that builds the application without
 * going through `main.ts` — the e2e harness, a script, a future worker entry
 * point — which is exactly why these live here too.
 */
export function createSmsProvider(config: ConfigService): SmsProvider {
  const isProduction = (config.get<string>('NODE_ENV') ?? '').trim().toLowerCase() === 'production';
  const raw = config.get<string>('SMS_PROVIDER');
  const configured = (raw ?? 'console').trim().toLowerCase();

  if (isProduction && (raw ?? '').trim() === '') {
    throw new Error(
      'SMS_PROVIDER is not set and this is production. It would fall back to the development ' +
        'adapter, which prints one-time codes instead of sending them. Set SMS_PROVIDER to a ' +
        'production adapter — see docs/sms-provider-integration.md.',
    );
  }

  const factory = SMS_PROVIDER_REGISTRY[configured];
  if (!factory) {
    throw new Error(
      `Unknown SMS_PROVIDER "${configured}". Known adapters: ${knownSmsProviders().join(', ')}. ` +
        'Implement providers/<name>-sms.provider.ts, register it in provider-registry.ts, and ' +
        'set SMS_PROVIDER to its name — or set SMS_PROVIDER=console for local development.',
    );
  }

  const provider = factory(config);

  if (isProduction && provider.isDevelopmentOnly) {
    throw new Error(
      `SMS_PROVIDER is "${configured}", which prints messages rather than delivering them, and ` +
        'this is production. A one-time code in a log is an authentication bypass, not a ' +
        'degraded mode. Set SMS_PROVIDER to a production adapter.',
    );
  }

  return provider;
}

@Global()
@Module({
  providers: [
    {
      provide: SMS_PROVIDER,
      inject: [ConfigService],
      useFactory: createSmsProvider,
    },
    SmsService,
  ],
  exports: [SmsService],
})
export class SmsModule {}
