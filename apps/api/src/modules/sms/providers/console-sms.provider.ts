import { Injectable, Logger } from '@nestjs/common';
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { SmsDeliveryResult, SmsMessage, SmsProvider } from './sms-provider.interface';

/**
 * The development provider: it prints the message instead of sending it.
 *
 * Local work on phone sign-up is impossible without this. There is no SMS
 * vendor yet, and even once there is, spending real money and waiting on a real
 * network to test a form is the wrong loop. So the code goes to the terminal
 * the API is already running in, framed so it is impossible to miss in a wall
 * of request logs.
 *
 * It also appends to a file when `SMS_DEV_LOG_FILE` is set, which is how the
 * verification script reads codes back without scraping stdout.
 *
 * `isDevelopmentOnly` is true, and SmsService refuses to boot with it in
 * production. That refusal is the whole safety story: a provider that prints
 * one-time codes where anyone with log access can read them is not a fallback,
 * it is an open door.
 */
@Injectable()
export class ConsoleSmsProvider implements SmsProvider {
  readonly name = 'console';
  readonly isDevelopmentOnly = true;

  private readonly logger = new Logger('SMS');

  constructor(private readonly logFile?: string) {}

  async send(message: SmsMessage): Promise<SmsDeliveryResult> {
    const id = `dev-${Date.now().toString(36)}`;

    // Boxed, because the thing a developer needs from this line is to find it
    // instantly among a few hundred other log lines.
    this.logger.log(
      [
        '',
        '┌──────────────────────── SMS (development) ────────────────────────',
        `│ to:   ${message.to}`,
        `│ kind: ${message.kind}`,
        `│ text: ${message.body}`,
        '└───────────────────────────────────────────────────────────────────',
      ].join('\n'),
    );

    if (this.logFile) {
      try {
        mkdirSync(dirname(this.logFile), { recursive: true });
        appendFileSync(
          this.logFile,
          `${JSON.stringify({ at: new Date().toISOString(), id, ...message })}\n`,
          'utf8',
        );
      } catch (error) {
        // A log file that cannot be written is a broken convenience, not a
        // broken send: the message is already on the terminal.
        this.logger.warn(`Could not write SMS_DEV_LOG_FILE: ${(error as Error).message}`);
      }
    }

    return { accepted: true, providerMessageId: id };
  }
}
