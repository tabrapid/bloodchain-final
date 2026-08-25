import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../database/prisma.service';
import { IdempotencyModule } from './idempotency.module';
import { IdempotencyInterceptor } from './idempotency.interceptor';
import { IdempotencyService } from './idempotency.service';

/**
 * Verifies IdempotencyModule's own DI graph resolves end to end -
 * IdempotencyInterceptor pulling in both IdempotencyService and Nest's
 * global Reflector - the way every consumer (DonationsModule,
 * AppointmentsModule, ShipmentsModule, InventoryModule) wires it in via
 * `imports: [IdempotencyModule]` + `@UseInterceptors(IdempotencyInterceptor)`.
 * A unit spec that mocks PrismaService per-class would never catch a
 * mistake at this module-wiring level.
 */
describe('IdempotencyModule wiring', () => {
  it('resolves IdempotencyInterceptor with its IdempotencyService and Reflector dependencies', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [IdempotencyModule],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();

    const interceptor = moduleRef.get(IdempotencyInterceptor);
    expect(interceptor).toBeInstanceOf(IdempotencyInterceptor);
    expect(moduleRef.get(IdempotencyService)).toBeInstanceOf(IdempotencyService);
    expect(moduleRef.get(Reflector)).toBeInstanceOf(Reflector);
  });
});
