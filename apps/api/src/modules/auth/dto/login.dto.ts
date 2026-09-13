import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { PhoneNumberField } from './phone.decorator';

/**
 * One sign-in, two ways to say who you are.
 *
 * Donors in Uzbekistan know their phone number and often have no email they
 * check; staff have an address and a console that sends them there. Both are
 * the same account with the same password, the same lockout, the same audit
 * trail and the same sessions -- there is no second identity, only a second
 * way to name the first one.
 *
 * Exactly one of the two is required. The alternative -- one `identifier`
 * field the server sniffs -- looks tidier and is worse: `+998901234567` and
 * `998901234567@x.test` are both plausible strings, and a guess about which
 * one the user meant is a guess about which account to unlock.
 *
 * Sending neither fails: `email` is validated whenever `phone` is absent, so an
 * empty body is rejected as a missing address rather than accepted.
 */
export class LoginDto {
  @ApiPropertyOptional({ example: 'admin@donor.local' })
  @ValidateIf((dto: LoginDto) => !dto.phone)
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @ApiPropertyOptional({ example: '+998901234567' })
  @ValidateIf((dto: LoginDto) => !dto.email)
  @PhoneNumberField()
  phone?: string;

  @ApiPropertyOptional({ example: 'DevelopmentOnly!123' })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;
}
