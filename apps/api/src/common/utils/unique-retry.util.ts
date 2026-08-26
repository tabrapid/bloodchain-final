import { Prisma } from '@prisma/client';

const DEFAULT_MAX_ATTEMPTS = 5;

/**
 * Retries `operation` when it fails with a Prisma unique-constraint
 * violation (P2002) on one of `uniqueFields`, up to `maxAttempts` times.
 *
 * Several places in this codebase generate a short random-looking
 * reference number (donation/unit/emergency/shipment/appointment
 * reference) and write it inside a single `$transaction`. A collision is
 * low-probability but real, and previously surfaced as a raw, unhandled
 * Prisma constraint-violation error. `operation` should be the whole
 * `$transaction` call (not just the inner `create`), and the reference
 * number must be generated *inside* that transaction body so each retry
 * computes a fresh candidate — a transaction that fails rolls back
 * atomically, so re-running the closure from scratch never produces
 * duplicate side effects.
 *
 * Any other error, or a P2002 on a field not in `uniqueFields`, is
 * rethrown immediately without retrying.
 */
export async function withUniqueRetry<T>(
  operation: () => Promise<T>,
  options: { uniqueFields: string[]; maxAttempts?: number },
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxAttempts || !isRetryableUniqueViolation(error, options.uniqueFields)) {
        throw error;
      }
    }
  }

  // Unreachable: the loop above always either returns or throws.
  throw new Error('withUniqueRetry: exhausted attempts without a result');
}

function isRetryableUniqueViolation(error: unknown, uniqueFields: string[]): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
    return false;
  }

  const target = (error.meta as { target?: string[] | string } | undefined)?.target;
  if (Array.isArray(target)) {
    return target.some((field) => uniqueFields.includes(field));
  }
  if (typeof target === 'string') {
    return uniqueFields.some((field) => target.includes(field));
  }
  return false;
}
