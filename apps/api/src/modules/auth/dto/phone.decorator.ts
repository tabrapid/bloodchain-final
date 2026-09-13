import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength } from 'class-validator';
import { normalizePhone } from '../../../common/utils/phone.util';

/**
 * A phone number field that is canonical by the time anything reads it.
 *
 * Normalising inside the DTO rather than in each service is what makes
 * `User.phone`'s uniqueness real: there is no path into the application where a
 * number arrives in some other spelling, so no service has to remember to
 * convert, and no future endpoint can forget.
 *
 * A number that cannot be normalised fails validation with a message the
 * clients already translate (`validation.phoneFormat`), rather than being
 * stored as typed.
 */
export function PhoneNumberField(options: { example?: string; uzbekOnly?: boolean } = {}) {
  const pattern = options.uzbekOnly ? /^\+998[1-9]\d{8}$/ : /^\+[1-9]\d{7,14}$/;
  return applyDecorators(
    ApiProperty({
      example: options.example ?? '+998901234567',
      description: 'Accepts +998 90 123 45 67, 998901234567 or 901234567; stored as E.164.',
    }),
    Transform(({ value }) => (typeof value === 'string' ? (normalizePhone(value) ?? value.trim()) : value)),
    IsString(),
    MaxLength(20),
    Matches(pattern, {
      message: options.uzbekOnly ? 'validation.phoneUzbek' : 'validation.phoneFormat',
    }),
  );
}
