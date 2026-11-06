import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { EmailService } from './email.service';

jest.mock('nodemailer');

describe('EmailService', () => {
  let service: EmailService;
  let config: { get: jest.Mock };
  let sendMail: jest.Mock;
  let createTransport: jest.Mock;

  beforeEach(async () => {
    sendMail = jest.fn().mockResolvedValue({ messageId: 'msg-1' });
    createTransport = (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail });

    config = { get: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [EmailService, { provide: ConfigService, useValue: config }],
    }).compile();

    service = module.get<EmailService>(EmailService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('onModuleInit', () => {
    it('falls back to a stream transport when SMTP_HOST is not configured', () => {
      config.get.mockImplementation((key: string) => (key === 'SMTP_HOST' ? undefined : undefined));

      service.onModuleInit();

      expect(createTransport).toHaveBeenCalledWith(
        expect.objectContaining({ streamTransport: true }),
      );
    });

    it('configures a real SMTP transport when SMTP_HOST is set', () => {
      config.get.mockImplementation((key: string, fallback?: unknown) => {
        if (key === 'SMTP_HOST') return 'smtp.example.com';
        if (key === 'SMTP_PORT') return 465;
        if (key === 'SMTP_SECURE') return true;
        if (key === 'SMTP_USER') return 'apikey';
        if (key === 'SMTP_PASSWORD') return 'secret';
        if (key === 'SMTP_FROM') return 'BloodChain <hello@donor.app>';
        return fallback;
      });

      service.onModuleInit();

      expect(createTransport).toHaveBeenCalledWith({
        host: 'smtp.example.com',
        port: 465,
        secure: true,
        auth: { user: 'apikey', pass: 'secret' },
      });
    });

    it('omits auth entirely when SMTP_HOST is set but no SMTP_USER is provided', () => {
      config.get.mockImplementation((key: string, fallback?: unknown) => {
        if (key === 'SMTP_HOST') return 'smtp.example.com';
        if (key === 'SMTP_USER') return undefined;
        return fallback;
      });

      service.onModuleInit();

      expect(createTransport).toHaveBeenCalledWith(
        expect.objectContaining({ auth: undefined }),
      );
    });
  });

  describe('send', () => {
    beforeEach(() => {
      config.get.mockReturnValue(undefined);
      service.onModuleInit();
    });

    it('sends the email with the configured from address', async () => {
      await service.send({ to: 'donor@example.com', subject: 'Hi', html: '<p>hi</p>', text: 'hi' });

      expect(sendMail).toHaveBeenCalledWith({
        from: 'BloodChain <no-reply@donor.local>',
        to: 'donor@example.com',
        subject: 'Hi',
        html: '<p>hi</p>',
        text: 'hi',
      });
    });

    it('uses the configured SMTP_FROM address when set', async () => {
      config.get.mockImplementation((key: string) =>
        key === 'SMTP_FROM' ? 'BloodChain <hello@donor.app>' : undefined,
      );
      service.onModuleInit();

      await service.send({ to: 'donor@example.com', subject: 'Hi', html: '<p>hi</p>', text: 'hi' });

      expect(sendMail).toHaveBeenCalledWith(
        expect.objectContaining({ from: 'BloodChain <hello@donor.app>' }),
      );
    });

    it('swallows a transport failure instead of throwing', async () => {
      sendMail.mockRejectedValue(new Error('connection refused'));

      await expect(
        service.send({ to: 'donor@example.com', subject: 'Hi', html: '<p>hi</p>', text: 'hi' }),
      ).resolves.toBeUndefined();
    });
  });

  it('keeps recipients and provider error content out of configured SMTP logs', async () => {
    config.get.mockImplementation((key: string) => key === 'SMTP_HOST' ? 'smtp.example.com' : undefined);
    service.onModuleInit();
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    try {
      const input = { to: 'private@example.com', subject: 'private-subject', html: 'private-content', text: 'private-token' };
      await service.send(input);
      sendMail.mockRejectedValueOnce(new Error('private@example.com private-token smtp-secret'));
      await service.send(input);
      const output = JSON.stringify([log.mock.calls, error.mock.calls]);
      for (const secret of ['private@example.com', 'private-subject', 'private-content', 'private-token', 'smtp-secret']) {
        expect(output).not.toContain(secret);
      }
      expect(error).toHaveBeenCalled();
    } finally {
      log.mockRestore();
      error.mockRestore();
    }
  });

  describe('sendVerificationEmail', () => {
    beforeEach(() => {
      config.get.mockReturnValue(undefined);
      service.onModuleInit();
    });

    it('sends a verification email with the verify link and deep link', async () => {
      await service.sendVerificationEmail(
        'donor@example.com',
        'Aziz',
        'https://donor.app/verify?token=abc',
        'donor://verify?token=abc',
      );

      expect(sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'donor@example.com',
          subject: 'Verify your DONOR account',
          text: expect.stringContaining('https://donor.app/verify?token=abc'),
          html: expect.stringContaining('https://donor.app/verify?token=abc'),
        }),
      );
    });

    it('HTML-escapes the recipient first name to prevent markup injection', async () => {
      await service.sendVerificationEmail(
        'donor@example.com',
        '<script>alert(1)</script>',
        'https://donor.app/verify?token=abc',
        'donor://verify?token=abc',
      );

      const call = sendMail.mock.calls[0][0];
      expect(call.html).not.toContain('<script>alert(1)</script>');
      expect(call.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    });
  });
});
