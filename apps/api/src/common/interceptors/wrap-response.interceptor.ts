import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';

/**
 * Wraps controller return values as { data: <value> }, matching the envelope
 * used by the rest of the API. Apply only to controllers whose services
 * return raw payloads (e.g. AdminController) - do not apply globally, since
 * most services already return { data: ... } themselves.
 */
@Injectable()
export class WrapResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((value) => ({ data: value })));
  }
}
