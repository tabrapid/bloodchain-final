import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { createHash } from 'node:crypto';

@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);
  private readonly keyPrefix = 'idempotency:';
  private readonly defaultTTL = 24 * 60 * 60 * 1000;

  constructor(private readonly db: PrismaService) {}

  async checkAndSet(
    userId: string,
    operation: string,
    idempotencyKey: string,
    ttl: number = this.defaultTTL,
  ): Promise<{ isDuplicate: boolean; existingResult?: unknown }> {
    if (!idempotencyKey) {
      return { isDuplicate: false };
    }

    const key = this.generateKey(userId, operation, idempotencyKey);

    const existing = await this.db.$queryRaw<{ key: string; result: unknown; createdAt: Date }[]>`
      SELECT key, result, "createdAt" FROM "IdempotencyRecord"
      WHERE key = ${key}
      AND "createdAt" > ${new Date(Date.now() - ttl)}
    `;

    if (existing.length > 0 && existing[0]) {
      this.logger.debug(`Duplicate idempotency key detected: ${key}`);
      return { isDuplicate: true, existingResult: existing[0].result };
    }

    return { isDuplicate: false };
  }

  async storeResult(
    userId: string,
    operation: string,
    idempotencyKey: string,
    result: unknown,
    ttl: number = this.defaultTTL,
  ): Promise<void> {
    if (!idempotencyKey) {
      return;
    }

    const key = this.generateKey(userId, operation, idempotencyKey);
    const resultJson = JSON.stringify(result);

    // ttl must stay outside any quoted SQL literal: Postgres only substitutes
    // bind parameters ($n) in expression position, never inside a string
    // literal, so `INTERVAL '${ttl} milliseconds'` would send the literal
    // text "$n milliseconds" and fail. Multiplying a 1ms interval keeps ttl
    // in expression position instead.
    await this.db.$executeRaw`
      INSERT INTO "IdempotencyRecord" (key, result, "createdAt", "expiresAt")
      VALUES (${key}, ${resultJson}::jsonb, NOW(), NOW() + (${ttl} * INTERVAL '1 millisecond'))
      ON CONFLICT (key) DO NOTHING
    `;
  }

  async cleanupExpired(): Promise<number> {
    const result = await this.db.$executeRaw`
      DELETE FROM "IdempotencyRecord"
      WHERE "expiresAt" < NOW()
    `;
    return result;
  }

  private generateKey(userId: string, operation: string, idempotencyKey: string): string {
    return createHash('sha256')
      .update(`${this.keyPrefix}${userId}:${operation}:${idempotencyKey}`)
      .digest('hex');
  }
}
