import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/bootstrap';
import { PrismaService } from './../src/database/prisma.service';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({ logger: ['error'] });
    configureApp(app, app.get(ConfigService));
    await app.init();
  });

  afterAll(async () => {
    const prisma = app.get(PrismaService);
    await prisma.user.deleteMany({ where: { email: { contains: '@donor.local', startsWith: 'test.' } } });
    await app.close();
  });

  describe('Health', () => {
    it('/api/v1/health (GET)', () => {
      return request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toBeDefined();
          expect(res.body.data.timestamp).toBeDefined();
        });
    });
  });

  describe('Auth', () => {
    const testUser = {
      email: `test.${Date.now()}@donor.local`,
      password: 'SecurePassword123!',
      firstName: 'Test',
      lastName: 'User',
    };

    it('/api/v1/auth/register (POST) - creates account', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(testUser)
        .expect(201)
        .expect((res) => {
          expect(res.body.data).toBeDefined();
          expect(res.body.data.email).toBe(testUser.email);
          expect(res.body.data.status).toBe('PENDING_VERIFICATION');
        });
    });

    it('/api/v1/auth/register (POST) - rejects duplicate email', () => {
      return request(app.getHttpServer()).post('/api/v1/auth/register').send(testUser).expect(400);
    });

    it('activates the account (simulates clicking the email verification link, so the login tests below have a real ACTIVE user to log into)', async () => {
      const prisma = app.get(PrismaService);
      const updated = await prisma.user.update({
        where: { email: testUser.email },
        data: { emailVerified: true, status: 'ACTIVE' },
      });
      expect(updated.status).toBe('ACTIVE');
    });

    // Login is rate-limited (5 requests/60s in this app's real ThrottlerModule
    // config) — the tests below deliberately share one successful login's
    // tokens rather than each calling /auth/login independently, both to
    // avoid tripping that real limit and because it's the more realistic way
    // a client actually behaves (log in once, reuse the session).
    let accessToken: string;
    let refreshToken: string;

    it('/api/v1/auth/login (POST) - returns tokens for valid credentials', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: testUser.email, password: testUser.password })
        .expect(200);

      expect(res.body.data).toBeDefined();
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.email).toBe(testUser.email);

      accessToken = res.body.data.accessToken;
      refreshToken = res.body.data.refreshToken;
    });

    it('/api/v1/auth/login (POST) - rejects wrong password', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: testUser.email, password: 'WrongPassword123!' })
        .expect(401)
        .expect((res) => {
          expect(res.body.message).toBe('Email or password is incorrect.');
        });
    });

    it('/api/v1/auth/login (POST) - rejects non-existent email', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'nonexistent@donor.local', password: 'WrongPassword123!' })
        .expect(401);
    });

    it('/api/v1/auth/me (GET) - rejects unauthenticated request', () => {
      return request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
    });

    it('/api/v1/auth/me (GET) - returns user data with valid token', () => {
      return request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toBeDefined();
          expect(res.body.data.email).toBe(testUser.email);
          expect(res.body.data.roles).toBeDefined();
          expect(Array.isArray(res.body.data.roles)).toBe(true);
          expect(res.body.data.permissions).toBeDefined();
          expect(Array.isArray(res.body.data.permissions)).toBe(true);
        });
    });

    it('/api/v1/auth/refresh (POST) - rotates tokens', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(res.body.data).toBeDefined();
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();

      // The old refreshToken is now revoked; carry the rotated pair forward
      // for the logout test below.
      accessToken = res.body.data.accessToken;
      refreshToken = res.body.data.refreshToken;
    });

    it('/api/v1/auth/refresh (POST) - rejects expired token', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);
    });

    it('/api/v1/auth/logout (POST) - revokes session', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refreshToken })
        .expect(200);
    });
  });

  describe('Authorization', () => {
    it('/api/v1/users (GET) - rejects unauthenticated', () => {
      return request(app.getHttpServer()).get('/api/v1/users').expect(401);
    });

    it('/api/v1/organizations (GET) - rejects unauthenticated', () => {
      return request(app.getHttpServer()).get('/api/v1/organizations').expect(401);
    });
  });
});
