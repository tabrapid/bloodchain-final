import { Controller, Get, Module, Req } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { Request } from 'express';
import request from 'supertest';
import { configureApp } from './bootstrap';

@Controller('client-ip')
class ClientIpController {
  @Get()
  get(@Req() req: Request) {
    return { ip: req.ip };
  }
}

@Module({ controllers: [ClientIpController] })
class ClientIpModule {}

describe('reverse proxy client IP', () => {
  it.each([0, 1])('trusts exactly %i proxy hops', async (hops) => {
    const app = await NestFactory.create(ClientIpModule, { logger: false });
    try {
      configureApp(app, new ConfigService({ TRUST_PROXY_HOPS: hops }));
      await app.listen(0, '127.0.0.1');
      const response = await request(app.getHttpServer())
        .get('/api/v1/client-ip')
        // nginx appends the actual client address after any client-supplied value.
        .set('X-Forwarded-For', '198.51.100.9, 203.0.113.7')
        .expect(200);
      expect(response.body.ip).toBe(hops === 1 ? '203.0.113.7' : '127.0.0.1');
    } finally {
      await app.close();
    }
  });
});
