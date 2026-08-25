import { ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of, firstValueFrom } from 'rxjs';
import { IdempotencyInterceptor } from './idempotency.interceptor';
import { IdempotencyService } from './idempotency.service';

function makeContext(request: Record<string, any>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => jest.fn(),
  } as unknown as ExecutionContext;
}

function makeCallHandler(returnValue: unknown): CallHandler {
  const handle = jest.fn().mockReturnValue(of(returnValue));
  return { handle } as unknown as CallHandler;
}

describe('IdempotencyInterceptor', () => {
  let idempotency: { checkAndSet: jest.Mock; storeResult: jest.Mock };
  let reflector: { get: jest.Mock };
  let interceptor: IdempotencyInterceptor;

  beforeEach(() => {
    idempotency = {
      checkAndSet: jest.fn().mockResolvedValue({ isDuplicate: false }),
      storeResult: jest.fn().mockResolvedValue(undefined),
    };
    reflector = { get: jest.fn().mockReturnValue('donation.complete') };
    interceptor = new IdempotencyInterceptor(
      idempotency as unknown as IdempotencyService,
      reflector as unknown as Reflector,
    );
  });

  it('runs the handler unchanged when the endpoint has no @Idempotent operation', async () => {
    reflector.get.mockReturnValue(undefined);
    const handler = makeCallHandler({ id: 'donation-1' });
    const context = makeContext({ headers: {}, user: { sub: 'user-1' } });

    const result = await firstValueFrom(interceptor.intercept(context, handler));

    expect(result).toEqual({ id: 'donation-1' });
    expect(idempotency.checkAndSet).not.toHaveBeenCalled();
    expect(handler.handle).toHaveBeenCalled();
  });

  it('runs the handler unchanged when no Idempotency-Key header is sent', async () => {
    const handler = makeCallHandler({ id: 'donation-1' });
    const context = makeContext({ headers: {}, user: { sub: 'user-1' } });

    await firstValueFrom(interceptor.intercept(context, handler));

    expect(idempotency.checkAndSet).not.toHaveBeenCalled();
    expect(handler.handle).toHaveBeenCalled();
  });

  it('runs the handler unchanged when there is no authenticated user', async () => {
    const handler = makeCallHandler({ id: 'donation-1' });
    const context = makeContext({ headers: { 'idempotency-key': 'key-abc' } });

    await firstValueFrom(interceptor.intercept(context, handler));

    expect(idempotency.checkAndSet).not.toHaveBeenCalled();
    expect(handler.handle).toHaveBeenCalled();
  });

  it('runs the handler and stores its result on a fresh key', async () => {
    const handler = makeCallHandler({ id: 'donation-1' });
    const context = makeContext({
      headers: { 'idempotency-key': 'key-abc' },
      user: { sub: 'user-1' },
    });

    const result = await firstValueFrom(interceptor.intercept(context, handler));

    expect(idempotency.checkAndSet).toHaveBeenCalledWith('user-1', 'donation.complete', 'key-abc');
    expect(handler.handle).toHaveBeenCalled();
    expect(idempotency.storeResult).toHaveBeenCalledWith(
      'user-1',
      'donation.complete',
      'key-abc',
      { id: 'donation-1' },
    );
    expect(result).toEqual({ id: 'donation-1' });
  });

  it('replays the stored result and never re-runs the handler on a duplicate key', async () => {
    idempotency.checkAndSet.mockResolvedValue({
      isDuplicate: true,
      existingResult: { id: 'donation-1', replayed: true },
    });
    const handler = makeCallHandler({ id: 'should-not-be-returned' });
    const context = makeContext({
      headers: { 'idempotency-key': 'key-abc' },
      user: { sub: 'user-1' },
    });

    const result = await firstValueFrom(interceptor.intercept(context, handler));

    expect(result).toEqual({ id: 'donation-1', replayed: true });
    expect(handler.handle).not.toHaveBeenCalled();
    expect(idempotency.storeResult).not.toHaveBeenCalled();
  });
});
