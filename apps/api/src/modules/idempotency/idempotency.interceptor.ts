import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, from, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { IdempotencyService } from './idempotency.service';
import { IDEMPOTENCY_OPERATION_KEY } from './idempotent.decorator';

export const IDEMPOTENCY_KEY_HEADER = 'idempotency-key';

/**
 * Applies the replay-on-duplicate behavior for handlers annotated with
 * `@Idempotent(operation)`. Purely additive: a request with no
 * Idempotency-Key header (or on a handler without the decorator) runs
 * exactly as before. The feature only activates when a caller opts in by
 * sending the header, so it can be rolled out without any client changes.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);

  constructor(
    private readonly idempotency: IdempotencyService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const operation = this.reflector.get<string | undefined>(
      IDEMPOTENCY_OPERATION_KEY,
      context.getHandler(),
    );

    if (!operation) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const idempotencyKey = request.headers?.[IDEMPOTENCY_KEY_HEADER];
    const userId = request.user?.sub;

    if (!idempotencyKey || typeof idempotencyKey !== 'string' || !userId) {
      return next.handle();
    }

    return from(this.idempotency.checkAndSet(userId, operation, idempotencyKey)).pipe(
      switchMap((check) => {
        if (check.isDuplicate) {
          this.logger.debug(`Replaying stored result for ${operation} (key: ${idempotencyKey})`);
          return of(check.existingResult);
        }

        return next.handle().pipe(
          switchMap((result) =>
            from(this.idempotency.storeResult(userId, operation, idempotencyKey, result)).pipe(
              map(() => result),
            ),
          ),
        );
      }),
    );
  }
}
