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
 * Thin wrapper around nodemailer. When SMTP_HOST is not configured (local
 * dev / test), falls back to a stream transport and logs the message body
 * instead of sending it, so registration never breaks in environments
 * without email credentials.
 */
@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private transporter!: nodemailer.Transporter;
  private isConfigured = false;
  private fromAddress = 'DONOR <no-reply@donor.local>';

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const host = this.config.get<string>('SMTP_HOST');
    this.fromAddress = this.config.get<string>('SMTP_FROM') || this.fromAddress;

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
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
