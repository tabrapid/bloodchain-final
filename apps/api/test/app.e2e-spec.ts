import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({ logger: ['error'] });
    await app.init();
  });

  afterAll(async () => {
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

    it('/api/v1/auth/login (POST) - returns tokens for valid credentials', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: testUser.email, password: testUser.password })
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toBeDefined();
          expect(res.body.data.accessToken).toBeDefined();
          expect(res.body.data.refreshToken).toBeDefined();
          expect(res.body.data.user).toBeDefined();
          expect(res.body.data.user.email).toBe(testUser.email);
        });
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

    it('/api/v1/auth/me (GET) - returns user data with valid token', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: testUser.email, password: testUser.password });

      const { accessToken } = loginRes.body.data;

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
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: testUser.email, password: testUser.password });

      const { refreshToken } = loginRes.body.data;

      return request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toBeDefined();
          expect(res.body.data.accessToken).toBeDefined();
          expect(res.body.data.refreshToken).toBeDefined();
        });
    });

    it('/api/v1/auth/refresh (POST) - rejects expired token', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);
    });

    it('/api/v1/auth/logout (POST) - revokes session', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: testUser.email, password: testUser.password });

      const { refreshToken } = loginRes.body.data;

      return request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${loginRes.body.data.accessToken}`)
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
