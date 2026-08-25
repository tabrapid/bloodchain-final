import { Test, TestingModule } from '@nestjs/testing';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../database/prisma.service';
import { IdempotencyService } from './idempotency.service';

function expectedKey(userId: string, operation: string, idempotencyKey: string): string {
  return createHash('sha256').update(`idempotency:${userId}:${operation}:${idempotencyKey}`).digest('hex');
}

describe('IdempotencyService', () => {
  let service: IdempotencyService;
  let prisma: { $queryRaw: jest.Mock; $executeRaw: jest.Mock };

  beforeEach(async () => {
    prisma = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      $executeRaw: jest.fn().mockResolvedValue(1),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [IdempotencyService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<IdempotencyService>(IdempotencyService);
  });

  describe('checkAndSet', () => {
    it('skips the lookup entirely when no idempotency key is given', async () => {
      const result = await service.checkAndSet('user-1', 'donation.complete', '');

      expect(result).toEqual({ isDuplicate: false });
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('reports no duplicate when no prior record matches', async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      const result = await service.checkAndSet('user-1', 'donation.complete', 'key-abc');

      expect(result).toEqual({ isDuplicate: false });
    });

    it('reports a duplicate and returns the stored result when a prior record matches', async () => {
      prisma.$queryRaw.mockResolvedValue([
        { key: 'irrelevant', result: { donationId: 'don-1' }, createdAt: new Date() },
      ]);

      const result = await service.checkAndSet('user-1', 'donation.complete', 'key-abc');

      expect(result).toEqual({ isDuplicate: true, existingResult: { donationId: 'don-1' } });
    });

    it('hashes (userId, operation, key) into the lookup so different users/operations never collide', async () => {
      await service.checkAndSet('user-1', 'donation.complete', 'key-abc');

      const call = prisma.$queryRaw.mock.calls[0];
      const [, keyArg] = call as [unknown, string];
      expect(keyArg).toBe(expectedKey('user-1', 'donation.complete', 'key-abc'));
    });
  });

  describe('storeResult', () => {
    it('skips storing entirely when no idempotency key is given', async () => {
      await service.storeResult('user-1', 'donation.complete', '', { ok: true });

      expect(prisma.$executeRaw).not.toHaveBeenCalled();
    });

    it('stores the hashed key, JSON result, and TTL as separate bind values (not inside a quoted SQL literal)', async () => {
      await service.storeResult('user-1', 'donation.complete', 'key-abc', { ok: true }, 60_000);

      const call = prisma.$executeRaw.mock.calls[0];
      const [strings, keyArg, resultArg, ttlArg] = call as [TemplateStringsArray, string, string, number];

      expect(keyArg).toBe(expectedKey('user-1', 'donation.complete', 'key-abc'));
      expect(resultArg).toBe(JSON.stringify({ ok: true }));
      // The TTL must be its own template placeholder, not text baked into a
      // surrounding string fragment like `INTERVAL '${ttl} milliseconds'` -
      // that pattern sends the placeholder marker literally inside quotes,
      // which Postgres does not substitute.
      expect(ttlArg).toBe(60_000);
      expect(strings.some((fragment) => fragment.includes('milliseconds'))).toBe(false);
    });
  });

  describe('cleanupExpired', () => {
    it('deletes expired records and returns the count removed', async () => {
      prisma.$executeRaw.mockResolvedValue(3);

      const result = await service.cleanupExpired();

      expect(result).toBe(3);
      expect(prisma.$executeRaw).toHaveBeenCalled();
    });
  });
});
