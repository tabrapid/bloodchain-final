import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const start = Date.now();
    const method = request.method;
    const path = request.url;
    const requestId = request['id'];

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse();
          const duration = Date.now() - start;
          request.log?.info?.(
            { requestId, method, path, statusCode: response.statusCode, durationMs: duration },
            `${method} ${path} ${response.statusCode} ${duration}ms`,
          );
        },
        error: (err) => {
          const duration = Date.now() - start;
          request.log?.warn?.(
            { requestId, method, path, statusCode: err.status ?? 500, durationMs: duration },
            `${method} ${path} ${err.status ?? 500} ${duration}ms`,
          );
        },
      }),
    );
  }
}
