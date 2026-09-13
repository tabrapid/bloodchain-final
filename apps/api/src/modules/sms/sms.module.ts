import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConsoleSmsProvider } from './providers/console-sms.provider';
import { SMS_PROVIDER, type SmsProvider } from './providers/sms-provider.interface';
import { SmsService } from './sms.service';

/**
 * Which SMS provider this deployment uses, decided once at boot.
 *
 * `SMS_PROVIDER=console` is the only implemented adapter today and the default
 * for local work. Adding a vendor is one file implementing `SmsProvider` and one
 * case here; nothing in the auth domain moves, which is the point of the port.
 *
 * An unknown value is a hard failure rather than a silent fall back to the
 * console adapter: a typo in a production environment file would otherwise turn
 * SMS delivery off and leave one-time codes in a log.
 */
function createSmsProvider(config: ConfigService): SmsProvider {
  const configured = (config.get<string>('SMS_PROVIDER') ?? 'console').trim().toLowerCase();

  switch (configured) {
    case 'console':
      return new ConsoleSmsProvider(config.get<string>('SMS_DEV_LOG_FILE') || undefined);
    default:
      throw new Error(
        `Unknown SMS_PROVIDER "${configured}". Implement providers/${configured}-sms.provider.ts ` +
          'and register it here, or set SMS_PROVIDER=console for local development.',
      );
  }
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
