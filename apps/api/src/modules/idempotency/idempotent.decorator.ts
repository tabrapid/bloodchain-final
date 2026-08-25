import { SetMetadata } from '@nestjs/common';

export const IDEMPOTENCY_OPERATION_KEY = 'idempotency:operation';

/**
 * Marks a mutating endpoint as idempotency-key aware. When the caller sends
 * an `Idempotency-Key` header, `IdempotencyInterceptor` replays the stored
 * result of an earlier request with the same (user, operation, key) instead
 * of re-running the handler — protecting against duplicate side effects from
 * client retries (timeouts, flaky mobile connections, etc.).
 *
 * `operation` should be a short, stable identifier unique to this endpoint
 * (e.g. 'donation.complete') so keys from different endpoints never collide.
 */
export const Idempotent = (operation: string) => SetMetadata(IDEMPOTENCY_OPERATION_KEY, operation);
