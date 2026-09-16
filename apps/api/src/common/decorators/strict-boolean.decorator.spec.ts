import { ArgumentMetadata, ValidationPipe } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { VALIDATION_PIPE_OPTIONS } from '../../bootstrap';
import {
  OptionalBooleanField,
  RequiredBooleanField,
  toStrictBoolean,
} from './strict-boolean.decorator';

/**
 * Everything here runs through the options the server actually configures
 * (`VALIDATION_PIPE_OPTIONS`), because `enableImplicitConversion` is the whole
 * reason these decorators exist. A test that built its own transform options
 * would pass on exactly the values the running server turns into their
 * opposite.
 */
class Filters {
  @OptionalBooleanField()
  verified?: boolean;
}

class Body {
  @RequiredBooleanField()
  verified!: boolean;
}

function parse<T extends object>(cls: new () => T, plain: Record<string, unknown>) {
  const instance = plainToInstance(cls, plain, VALIDATION_PIPE_OPTIONS.transformOptions);
  return { instance, errors: validateSync(instance) };
}

/** The same value, taken all the way through the real pipe. */
const pipe = new ValidationPipe(VALIDATION_PIPE_OPTIONS);
async function throughPipe<T>(cls: new () => T, plain: Record<string, unknown>, type: 'query' | 'body') {
  const metadata = { type, metatype: cls, data: '' } as ArgumentMetadata;
  return (await pipe.transform(plain, metadata)) as T;
}

/** Values that are a boolean and values that only look like one. */
const ACCEPTED: Array<[unknown, boolean]> = [
  [true, true],
  [false, false],
  ['true', true],
  ['false', false],
  ['TRUE', true],
  ['False', false],
  ['  true  ', true],
  ['\tfalse\n', false],
];

const REJECTED: unknown[] = [
  '1',
  '0',
  'yes',
  'no',
  'on',
  'off',
  'y',
  'n',
  'maybe',
  '',
  '   ',
  'truthy',
  'falsey',
  0,
  1,
  2,
  [],
  {},
  ['true'],
];

describe('toStrictBoolean', () => {
  it.each(ACCEPTED)('reads %p as %p', (input, expected) => {
    expect(toStrictBoolean(input)).toBe(expected);
  });

  it.each(REJECTED.map((value) => [value]))(
    'passes %p through untouched so validation can refuse it',
    (value) => {
      expect(toStrictBoolean(value)).toBe(value);
    },
  );

  it('leaves an absent value absent', () => {
    expect(toStrictBoolean(undefined)).toBeUndefined();
    expect(toStrictBoolean(null)).toBeNull();
  });
});

describe('OptionalBooleanField', () => {
  it.each(ACCEPTED)('accepts %p and stores %p', (input, expected) => {
    const { instance, errors } = parse(Filters, { verified: input });
    expect(instance.verified).toBe(expected);
    expect(errors).toHaveLength(0);
  });

  /**
   * The bug this decorator exists for: implicit conversion turns every one of
   * these into `true`, so the request succeeds and means the opposite.
   */
  it.each(REJECTED.map((value) => [value]))('refuses %p rather than guessing', (value) => {
    const { errors } = parse(Filters, { verified: value });
    expect(errors).toHaveLength(1);
    expect(errors[0]?.constraints).toEqual({ isBoolean: 'validation.booleanStrict' });
  });

  it('stays optional when omitted', () => {
    const { instance, errors } = parse(Filters, {});
    expect(instance.verified).toBeUndefined();
    expect(errors).toHaveLength(0);
  });
});

describe('RequiredBooleanField', () => {
  it.each(ACCEPTED)('accepts %p and stores %p', (input, expected) => {
    const { instance, errors } = parse(Body, { verified: input });
    expect(instance.verified).toBe(expected);
    expect(errors).toHaveLength(0);
  });

  it.each(REJECTED.map((value) => [value]))('refuses %p rather than guessing', (value) => {
    expect(parse(Body, { verified: value }).errors).toHaveLength(1);
  });

  it('is required', () => {
    expect(parse(Body, {}).errors).toHaveLength(1);
  });
});

/**
 * A query string carries `"false"`; a JSON body usually carries `false`. The
 * point of reading the raw value is that neither path can diverge from the
 * other, so the same input has to mean the same thing on both.
 */
describe('a query string and a request body agree', () => {
  it.each(ACCEPTED)('%p means %p either way', async (input, expected) => {
    const fromQuery = await throughPipe(Filters, { verified: input }, 'query');
    const fromBody = await throughPipe(Body, { verified: input }, 'body');
    expect(fromQuery.verified).toBe(expected);
    expect(fromBody.verified).toBe(expected);
  });

  it.each(REJECTED.map((value) => [value]))('%p is a 400 either way', async (value) => {
    await expect(throughPipe(Filters, { verified: value }, 'query')).rejects.toMatchObject({
      status: 400,
    });
    await expect(throughPipe(Body, { verified: value }, 'body')).rejects.toMatchObject({
      status: 400,
    });
  });
});
