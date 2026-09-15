import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { BooleanField, BooleanQuery, toStrictBoolean } from './boolean-query.decorator';

/**
 * These run the DTO through the same transform options the application
 * configures in `bootstrap.ts` -- `enableImplicitConversion: true` -- because
 * that setting is the whole reason this decorator exists. Validating without it
 * would pass while the running server did the opposite.
 */
const TRANSFORM = { enableImplicitConversion: true };

class Filters {
  @BooleanQuery()
  verified?: boolean;
}

class Body {
  @BooleanField()
  verified!: boolean;
}

function parse<T>(cls: new () => T, plain: Record<string, unknown>) {
  const instance = plainToInstance(cls, plain, TRANSFORM);
  return { instance, errors: validateSync(instance as object) };
}

describe('toStrictBoolean', () => {
  it.each([
    ['true', true],
    ['TRUE', true],
    [' 1 ', true],
    ['yes', true],
    ['on', true],
    ['false', false],
    ['FALSE', false],
    ['0', false],
    ['no', false],
    ['off', false],
  ])('reads %p as %p', (input, expected) => {
    expect(toStrictBoolean(input)).toBe(expected);
  });

  it('leaves real booleans alone', () => {
    expect(toStrictBoolean(true)).toBe(true);
    expect(toStrictBoolean(false)).toBe(false);
  });

  it('passes anything else through, so validation can reject it', () => {
    expect(toStrictBoolean('maybe')).toBe('maybe');
    expect(toStrictBoolean('')).toBe('');
    expect(toStrictBoolean(2)).toBe(2);
  });

  it('leaves an absent value absent', () => {
    expect(toStrictBoolean(undefined)).toBeUndefined();
    expect(toStrictBoolean(null)).toBeNull();
  });
});

describe('BooleanQuery', () => {
  it('reads "false" as false, which implicit conversion would make true', () => {
    const { instance, errors } = parse(Filters, { verified: 'false' });
    expect(instance.verified).toBe(false);
    expect(errors).toHaveLength(0);
  });

  it('reads "true" as true', () => {
    expect(parse(Filters, { verified: 'true' }).instance.verified).toBe(true);
  });

  it('rejects a value it cannot read rather than guessing', () => {
    const { errors } = parse(Filters, { verified: 'maybe' });
    expect(errors).toHaveLength(1);
    expect(errors[0]?.constraints).toHaveProperty('isBoolean');
  });

  it('stays optional when omitted', () => {
    const { instance, errors } = parse(Filters, {});
    expect(instance.verified).toBeUndefined();
    expect(errors).toHaveLength(0);
  });
});

describe('BooleanField', () => {
  it('reads "no" as false rather than as a truthy string', () => {
    const { instance, errors } = parse(Body, { verified: 'no' });
    expect(instance.verified).toBe(false);
    expect(errors).toHaveLength(0);
  });

  it('is required', () => {
    const { errors } = parse(Body, {});
    expect(errors).toHaveLength(1);
  });

  it('rejects an unreadable value', () => {
    const { errors } = parse(Body, { verified: 'maybe' });
    expect(errors).toHaveLength(1);
  });
});
