import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SMS_PROVIDER, type SmsDeliveryResult, type SmsMessage, type SmsProvider } from './providers/sms-provider.interface';

/**
 * Sending an SMS, without the domain knowing who sends it.
 *
 * Two jobs beyond delegating. One: refuse to run a development provider in
 * production -- a one-time code printed to a log is an authentication bypass,
 * and the failure mode it prevents (deploying with `SMS_PROVIDER` unset) is the
 * likely one, not an exotic one. Two: never throw. A failed send is reported to
 * the caller as `accepted: false` so the OTP service can decide what the user
 * sees, rather than a 500 that says more about our vendor than about them.
 */
@Injectable()
export class SmsService implements OnModuleInit {
  private readonly logger = new Logger(SmsService.name);

  constructor(
    @Inject(SMS_PROVIDER) private readonly provider: SmsProvider,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    const isProduction = this.config.get<string>('NODE_ENV') === 'production';

    if (isProduction && this.provider.isDevelopmentOnly) {
      throw new Error(
        `SMS provider "${this.provider.name}" only prints messages and must never run in production. ` +
          'Set SMS_PROVIDER to a real provider before deploying.',
      );
    }

    if (this.provider.isDevelopmentOnly) {
      this.logger.warn(
        `SMS provider "${this.provider.name}": messages are printed, not delivered. ` +
          'Phone verification works locally; no SMS reaches a real handset.',
      );
    } else {
      this.logger.log(`SMS provider "${this.provider.name}" ready.`);
    }
  }

  /** The provider's name, for the audit trail. */
  get providerName(): string {
    return this.provider.name;
  }

  /** True when messages are printed rather than delivered. */
  get isDevelopmentProvider(): boolean {
    return this.provider.isDevelopmentOnly;
  }

  async send(message: SmsMessage): Promise<SmsDeliveryResult> {
    try {
      const result = await this.provider.send(message);
      if (!result.accepted) {
        this.logger.error(`SMS to ${message.to} refused by ${this.provider.name}: ${result.error}`);
      }
      return result;
    } catch (error) {
      this.logger.error(`SMS to ${message.to} failed: ${(error as Error).message}`);
      return { accepted: false, error: (error as Error).message };
    }
  }
}
