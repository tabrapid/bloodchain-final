import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

/**
 * A boolean that is read from what the client actually sent.
 *
 * The global pipe runs with `enableImplicitConversion`, which coerces every
 * property to its declared type -- and for a boolean that is `Boolean(value)`,
 * under which every non-empty string is true. So `?verified=false` arrives as
 * `true`, and `{"verified":"no"}` passes `@IsBoolean()` as `true`. Neither is a
 * validation failure anyone would notice: the request succeeds and the answer
 * looks plausible while meaning the opposite.
 *
 * The transform therefore reads `obj[key]` -- the raw value, before implicit
 * conversion -- rather than `value`, which has already been coerced. Anything
 * that is neither a recognised true nor a recognised false spelling is passed
 * through untouched so `@IsBoolean()` rejects it with a 400, rather than being
 * guessed into whichever answer happens to be truthy.
 */
const TRUE = new Set(['true', '1', 'yes', 'on']);
const FALSE = new Set(['false', '0', 'no', 'off']);

export function toStrictBoolean(value: unknown): unknown {
  if (typeof value === 'boolean' || value === undefined || value === null) return value;
  if (typeof value !== 'string') return value;
  const normalized = value.trim().toLowerCase();
  if (TRUE.has(normalized)) return true;
  if (FALSE.has(normalized)) return false;
  return value;
}

/** Reads the value as the client sent it, behind the pipe's implicit conversion. */
const fromRaw = () =>
  Transform(({ obj, key, value }) =>
    toStrictBoolean(obj && typeof obj === 'object' && key in obj ? obj[key] : value),
  );

/** An optional boolean filter, typically from a query string. */
export function BooleanQuery(description?: string) {
  return applyDecorators(
    ApiPropertyOptional({ type: Boolean, description }),
    IsOptional(),
    fromRaw(),
    IsBoolean(),
  );
}

/** A required boolean field in a request body. */
export function BooleanField(description?: string) {
  return applyDecorators(ApiProperty({ type: Boolean, description }), fromRaw(), IsBoolean());
}
