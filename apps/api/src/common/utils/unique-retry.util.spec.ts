import { Prisma } from '@prisma/client';
import { withUniqueRetry } from './unique-retry.util';

function uniqueConstraintError(target: string[] | string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
    meta: { target },
  });
}

describe('withUniqueRetry', () => {
  it('returns the result on the first successful attempt without retrying', async () => {
    const operation = jest.fn().mockResolvedValue('ok');

    const result = await withUniqueRetry(operation, { uniqueFields: ['donationReference'] });

    expect(result).toBe('ok');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('retries on a unique-constraint violation for a tracked field and succeeds', async () => {
    const operation = jest
      .fn()
      .mockRejectedValueOnce(uniqueConstraintError(['donationReference']))
      .mockResolvedValueOnce('ok-on-retry');

    const result = await withUniqueRetry(operation, { uniqueFields: ['donationReference'] });

    expect(result).toBe('ok-on-retry');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('retries when the violated target is a raw constraint-name string containing the field', async () => {
    const operation = jest
      .fn()
      .mockRejectedValueOnce(uniqueConstraintError('Donation_donationReference_key'))
      .mockResolvedValueOnce('ok-on-retry');

    const result = await withUniqueRetry(operation, { uniqueFields: ['donationReference'] });

    expect(result).toBe('ok-on-retry');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('rethrows immediately for a unique-constraint violation on an untracked field', async () => {
    const error = uniqueConstraintError(['appointmentId']);
    const operation = jest.fn().mockRejectedValue(error);

    await expect(withUniqueRetry(operation, { uniqueFields: ['donationReference'] })).rejects.toBe(error);
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('rethrows immediately for a non-P2002 error without retrying', async () => {
    const error = new Error('connection lost');
    const operation = jest.fn().mockRejectedValue(error);

    await expect(withUniqueRetry(operation, { uniqueFields: ['donationReference'] })).rejects.toBe(error);
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('gives up and rethrows after exhausting maxAttempts', async () => {
    const error = uniqueConstraintError(['donationReference']);
    const operation = jest.fn().mockRejectedValue(error);

    await expect(
      withUniqueRetry(operation, { uniqueFields: ['donationReference'], maxAttempts: 3 }),
    ).rejects.toBe(error);
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it('defaults to 5 max attempts', async () => {
    const error = uniqueConstraintError(['donationReference']);
    const operation = jest.fn().mockRejectedValue(error);

    await expect(withUniqueRetry(operation, { uniqueFields: ['donationReference'] })).rejects.toBe(error);
    expect(operation).toHaveBeenCalledTimes(5);
  });
});
