import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

/**
 * A boolean that is read from what the client actually sent, and only from a
 * spelling that can mean one thing.
 *
 * The global pipe runs with `enableImplicitConversion`, which coerces every
 * property to its declared type -- and for a boolean that is `Boolean(value)`,
 * under which every non-empty string is true. So `?verified=false` arrives as
 * `true`, and `{"maintenanceMode":"false"}` turns the platform off. Neither is
 * a validation failure anyone would notice: the request succeeds and the answer
 * looks plausible while meaning the opposite.
 *
 * Two rules, both deliberate:
 *
 * 1. The transform reads `obj[key]` -- the raw value, before implicit
 *    conversion -- rather than `value`, which has already been coerced.
 * 2. Only `true` and `false` are accepted, as booleans or as those two words.
 *    `"1"`, `"0"`, `"yes"`, `"no"`, `"on"` and `"off"` are rejected rather than
 *    interpreted: each is a convention some clients hold and others invert, and
 *    a guess that lands the wrong way on `maintenanceMode` or `consentLocation`
 *    costs more than a 400 does. Anything unrecognised is passed through
 *    untouched so `@IsBoolean()` refuses it.
 *
 * Surrounding whitespace and letter case are the exception: `" TRUE "` is the
 * word `true` as some clients spell it, not a different value, and reading it
 * cannot land on the wrong answer.
 */
const BOOLEAN_MESSAGE = 'validation.booleanStrict';

export function toStrictBoolean(value: unknown): unknown {
  if (typeof value === 'boolean' || value === undefined || value === null) return value;
  if (typeof value !== 'string') return value;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  return value;
}

/** Reads the value as the client sent it, behind the pipe's implicit conversion. */
const fromRaw = () =>
  Transform(({ obj, key, value }) =>
    toStrictBoolean(obj && typeof obj === 'object' && key in obj ? obj[key] : value),
  );

/** An optional boolean field, in a query string or a request body. */
export function OptionalBooleanField(description?: string) {
  return applyDecorators(
    ApiPropertyOptional({ type: Boolean, description }),
    IsOptional(),
    fromRaw(),
    IsBoolean({ message: BOOLEAN_MESSAGE }),
  );
}

/** A required boolean field in a request body. */
export function RequiredBooleanField(description?: string) {
  return applyDecorators(
    ApiProperty({ type: Boolean, description }),
    fromRaw(),
    IsBoolean({ message: BOOLEAN_MESSAGE }),
  );
}
