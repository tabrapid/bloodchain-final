import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Thin wrapper around nodemailer.
 *
 * When SMTP_HOST is not configured it falls back to a stream transport and
 * logs the message body instead of sending it, so registration and password
 * reset never break on a laptop with no mail credentials. That fallback is
 * right for development and was silently available in production, where it is
 * two failures at once:
 *
 *   * nothing is delivered, so account recovery is broken and nobody is told;
 *   * the whole message is written to the log, and the password-reset message
 *     contains a single-use reset link. Anyone who can read the application
 *     log can take over any account that has requested a reset.
 *
 * So the fallback is now refused in production at boot, and the body is never
 * logged there even if some future path reaches it. `assertProductionConfig`
 * catches the same misconfiguration earlier and with a better report; this is
 * the independent barrier for anything that builds the application without
 * going through `main.ts`.
 */
@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private transporter!: nodemailer.Transporter;
  private isConfigured = false;
  private fromAddress = 'BloodChain <no-reply@donor.local>';

  constructor(private readonly config: ConfigService) {}

  private get isProduction(): boolean {
    return (this.config.get<string>('NODE_ENV') ?? '').trim().toLowerCase() === 'production';
  }

  onModuleInit() {
    const host = this.config.get<string>('SMTP_HOST');
    this.fromAddress = this.config.get<string>('SMTP_FROM') || this.fromAddress;

    if (!host && this.isProduction) {
      throw new Error(
        'SMTP_HOST is not set and this is production. Outgoing email would be written to the ' +
          'log instead of delivered -- including password-reset links, which are single-use ' +
          'account access -- and account recovery would fail silently. Configure SMTP_HOST, ' +
          'SMTP_PORT, SMTP_USER, SMTP_PASSWORD and SMTP_FROM.',
      );
    }

    if (host) {
      const user = this.config.get<string>('SMTP_USER');
      this.transporter = nodemailer.createTransport({
        host,
        port: this.config.get<number>('SMTP_PORT', 587),
        secure: this.config.get<boolean>('SMTP_SECURE', false),
        auth: user ? { user, pass: this.config.get<string>('SMTP_PASSWORD') } : undefined,
      });
      this.isConfigured = true;
    } else {
      this.transporter = nodemailer.createTransport({
        streamTransport: true,
        newline: 'unix',
        buffer: true,
      });
      this.logger.warn(
        'SMTP_HOST is not set — outgoing emails will be logged only, not delivered. ' +
          'Set SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASSWORD/SMTP_FROM for real delivery.',
      );
    }
  }

  async send(input: SendEmailInput): Promise<void> {
    try {
      const info = await this.transporter.sendMail({
        from: this.fromAddress,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
      });

      if (this.isConfigured) {
        this.logger.log(`Email sent to ${input.to} (${info.messageId})`);
      } else if (this.isProduction) {
        // Unreachable while onModuleInit refuses to boot without SMTP in
        // production -- and written anyway, because "unreachable" is what
        // every logged secret was before somebody found the path.
        this.logger.error(
          `Email to ${input.to} was NOT delivered: no SMTP transport is configured. Subject: ${input.subject}`,
        );
      } else {
        this.logger.log(`[dev email — not delivered] To: ${input.to} | Subject: ${input.subject}\n${input.text}`);
      }
    } catch (error) {
      // Email delivery failures must never break the calling request (e.g. registration).
      this.logger.error(`Failed to send email to ${input.to}: ${(error as Error).message}`);
    }
  }

  async sendVerificationEmail(
    to: string,
    firstName: string,
    verifyUrl: string,
    deepLink: string,
  ): Promise<void> {
    const subject = 'Verify your DONOR account';
    const text =
      `Hi ${firstName},\n\nWelcome to DONOR. Verify your email to activate your account:\n${verifyUrl}\n\n` +
      `Or open it directly in the app: ${deepLink}\n\n` +
      `This link expires in 24 hours. If you did not create this account, you can ignore this email.`;
    const html = `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #1f2933;">
        <h2>Welcome to DONOR, ${escapeHtml(firstName)}.</h2>
        <p>Verify your email address to activate your account and start saving lives.</p>
        <p>
          <a href="${verifyUrl}" style="display:inline-block;padding:12px 24px;background:#DC2626;color:#fff;border-radius:8px;text-decoration:none;">
            Verify email
          </a>
        </p>
        <p>On your phone, you can also open the app directly: <a href="${deepLink}">${deepLink}</a></p>
        <p style="color:#888;font-size:12px;">This link expires in 24 hours. If you did not create this account, you can safely ignore this email.</p>
      </div>`;
    await this.send({ to, subject, html, text });
  }

  async sendPasswordResetEmail(
    to: string,
    firstName: string,
    resetUrl: string,
    deepLink: string,
    ttlDescription: string,
  ): Promise<void> {
    const subject = 'Reset your DONOR password';
    const text =
      `Hi ${firstName},\n\nSomeone asked to reset the password for your DONOR account.\n` +
      `If it was you, use this link:\n${resetUrl}\n\n` +
      `Or open it directly in the app: ${deepLink}\n\n` +
      `This link can be used once and expires in ${ttlDescription}.\n` +
      `If it was not you, ignore this email -- your password has not changed. ` +
      `Resetting it will also sign you out everywhere.`;
    const html = `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #1f2933;">
        <h2>Reset your password, ${escapeHtml(firstName)}.</h2>
        <p>Someone asked to reset the password for your DONOR account.</p>
        <p>
          <a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#DC2626;color:#fff;border-radius:8px;text-decoration:none;">
            Reset password
          </a>
        </p>
        <p>On your phone, you can also open the app directly: <a href="${deepLink}">${deepLink}</a></p>
        <p style="color:#888;font-size:12px;">
          This link can be used once and expires in ${escapeHtml(ttlDescription)}.
          If it was not you, you can ignore this email &mdash; your password has not changed.
          Resetting your password also signs you out on every device.
        </p>
      </div>`;
    await this.send({ to, subject, html, text });
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
