import { INestApplication, ValidationPipe, type ValidationPipeOptions } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { ApiExceptionFilter } from './common/filters/api-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import {
  RequestIdInterceptor,
  REQUEST_ID_HEADER,
} from './common/interceptors/request-id.interceptor';

/**
 * How every request body and query string is validated.
 *
 * Exported so tests can validate a DTO the way the running server does rather
 * than the way a test would set it up if left to itself. `enableImplicitConversion`
 * in particular changes what reaches a DTO -- it coerces every property to its
 * declared type, and for a boolean that is `Boolean(value)`, under which every
 * non-empty string is true. A boolean test that omitted this option would pass
 * on values the server turns into their opposite.
 */
export const VALIDATION_PIPE_OPTIONS: ValidationPipeOptions = {
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: true },
};

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

  app.useGlobalPipes(new ValidationPipe(VALIDATION_PIPE_OPTIONS));
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalInterceptors(new RequestIdInterceptor(), new LoggingInterceptor());
}
