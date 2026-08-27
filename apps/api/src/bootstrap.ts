import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { ApiExceptionFilter } from './common/filters/api-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import {
  RequestIdInterceptor,
  REQUEST_ID_HEADER,
} from './common/interceptors/request-id.interceptor';

/**
 * Applies the same CORS/security headers, global prefix, pipes, filters, and
 * interceptors that a real request goes through in production. Shared by
 * main.ts's bootstrap() and the e2e test harness so the two can never drift
 * apart the way they did before (the e2e app was missing all of this).
 */
export function configureApp(app: INestApplication, config: ConfigService): void {
  app.enableCors({
    origin: (config.get<string>('WEB_URL') ?? 'http://localhost:3000')
      .split(',')
      .map((origin) => origin.trim()),
    credentials: true,
    exposedHeaders: [REQUEST_ID_HEADER],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', REQUEST_ID_HEADER],
  });

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));

  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalInterceptors(new RequestIdInterceptor(), new LoggingInterceptor());
}
