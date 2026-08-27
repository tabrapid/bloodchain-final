import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';

/**
 * Wraps controller return values as { data: <value> } — the envelope every
 * client in this repo unwraps with `return json.data as T`, and the one
 * docs/api.md documents.
 *
 * Apply it to any controller whose services return raw payloads. It is not
 * registered globally because a number of services hand-write
 * `return { data: ... }` themselves and would double-wrap; the split is
 * historical rather than principled. Getting it wrong is silent on the client
 * (an undefined payload renders as an empty screen, not an error), which is how
 * seven controllers shipped without it — see P0-10 — so
 * test/response-envelope.e2e-spec.ts asserts every GET route is enveloped.
 */
@Injectable()
export class WrapResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((value) => ({ data: value })));
  }
}
