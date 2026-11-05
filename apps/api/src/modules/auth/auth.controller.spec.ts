import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { configureApp } from '../../bootstrap';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('browser email confirmation and client IP', () => {
  let app: INestApplication;
  const auth = {
    confirmEmail: jest.fn().mockResolvedValue('user-1'),
    verifyEmail: jest.fn().mockResolvedValue({ data: { accessToken: 'mobile-session' } }),
    register: jest.fn().mockResolvedValue({ data: { id: 'user-1' } }),
  };
  const token = 'a'.repeat(64);

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: auth }],
    }).compile();
    app = module.createNestApplication();
    configureApp(app, new ConfigService({ TRUST_PROXY_HOPS: 1 }));
    await app.listen(0, '127.0.0.1');
  });
  beforeEach(() => jest.clearAllMocks());
  afterAll(async () => { await app.close(); });

  it('lets link scanners fetch a confirmation form without consuming the token', async () => {
    for (let i = 0; i < 2; i++) {
      const response = await request(app.getHttpServer())
        .get('/api/v1/auth/verify-email').query({ token }).expect(200);
      expect(response.text).toContain('method="post"');
      expect(response.text).toContain('action="/api/v1/auth/verify-email-link"');
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.headers['referrer-policy']).toBe('no-referrer');
    }
    expect(auth.confirmEmail).not.toHaveBeenCalled();
    expect(auth.verifyEmail).not.toHaveBeenCalled();
  });

  it('confirms a browser form without issuing or exposing a session', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/verify-email-link').type('form').send({ token }).expect(200);
    expect(response.text).toContain('Email verified');
    expect(auth.confirmEmail).toHaveBeenCalledWith(token, '127.0.0.1');
    expect(auth.verifyEmail).not.toHaveBeenCalled();
    expect(response.text).not.toContain('accessToken');
  });

  it('escapes tokens in the confirmation form', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/auth/verify-email').query({ token: '"><script>alert(1)</script>' }).expect(200);
    expect(response.text).not.toContain('<script>');
    expect(response.text).toContain('&quot;&gt;&lt;script&gt;');
  });

  it('keeps the mobile JSON verification endpoint', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/verify-email').send({ token }).expect(200);
    expect(auth.verifyEmail).toHaveBeenCalledWith(token, '127.0.0.1');
    expect(response.body.data.accessToken).toBe('mobile-session');
  });

  it('uses the trusted proxy client address instead of a spoofed header prefix', async () => {
    await request(app.getHttpServer()).post('/api/v1/auth/register')
      .set('X-Forwarded-For', '198.51.100.9, 203.0.113.7')
      .send({ email: 'qa@example.com', password: 'TestingPassword!2026', firstName: 'QA', lastName: 'User' })
      .expect(201);
    expect(auth.register).toHaveBeenCalledWith(expect.any(Object), '203.0.113.7');
  });
});
