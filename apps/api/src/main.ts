import 'reflect-metadata';
import { networkInterfaces } from 'node:os';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';
import { assertProductionConfig } from './config/production-config';

/** Every non-internal IPv4 address this machine answers on. */
function reachableUrls(port: number): string[] {
  const urls = [`http://localhost:${port}`];
  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family === 'IPv4' && !address.internal) {
        urls.push(`http://${address.address}:${port}`);
      }
    }
  }
  return urls;
}

async function bootstrap() {
  // Before anything is constructed.
  //
  // Deliberately ahead of NestFactory.create: a deployment whose configuration
  // is unsafe should not get as far as opening a database connection, starting
  // a cron, or binding a port. It should print what is wrong and stop.
  //
  // It reads process.env rather than ConfigService because Joi's defaults
  // erase the distinction this guard cares about -- an unset SMS_PROVIDER and
  // a deliberately-chosen `console` are the same value once defaults are
  // applied, and they are different mistakes.
  assertProductionConfig(process.env);

  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);
  const logger = app.get(Logger);
  app.useLogger(logger);

  configureApp(app, config);

  if (config.get<string>('NODE_ENV') !== 'production') {
    const swagger = new DocumentBuilder()
      .setTitle('BloodChain API')
      .setDescription('Foundation API for the BloodChain healthcare platform')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swagger));
  }

  const port = config.get<number>('PORT', 3001);
  // Bind every interface explicitly. This is already Node's default, but a
  // phone that cannot reach the API is the single most common way a demo
  // fails, and "which interface is it on" should not be something anyone has
  // to infer from a default.
  await app.listen(port, '0.0.0.0');
  logger.log(`BloodChain API listening on port ${port}`);

  // The addresses a phone or emulator can actually use. Metro prints its own;
  // without the matching line here, the only way to find out whether the API is
  // reachable from another device is to try it and wait for a timeout.
  if (config.get<string>('NODE_ENV') !== 'production') {
    for (const url of reachableUrls(port)) {
      logger.log(`  reachable at ${url}/api/v1`);
    }
  }
}
bootstrap();
