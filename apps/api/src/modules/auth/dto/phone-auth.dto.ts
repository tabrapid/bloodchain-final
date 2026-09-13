import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PhoneVerificationPurpose } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PhoneNumberField } from './phone.decorator';

/** The three languages the donor app speaks; picks the SMS body's language. */
export class LocaleAware {
  @ApiPropertyOptional({ example: 'uz', enum: ['uz', 'ru', 'en'] })
  @IsOptional()
  @IsIn(['uz', 'ru', 'en'])
  locale?: 'uz' | 'ru' | 'en';
}

export class RequestPhoneCodeDto extends LocaleAware {
  // Uzbek-only: this is donor sign-up and account recovery for a service that
  // operates in Uzbekistan, and an SMS to another country is a cost with no
  // corresponding user.
  @PhoneNumberField({ uzbekOnly: true })
  phone!: string;

  @ApiProperty({ enum: PhoneVerificationPurpose, example: 'REGISTRATION' })
  @IsEnum(PhoneVerificationPurpose)
  purpose!: PhoneVerificationPurpose;
}

export class VerifyPhoneCodeDto extends LocaleAware {
  @PhoneNumberField({ uzbekOnly: true })
  phone!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'validation.otpFormat' })
  code!: string;

  @ApiProperty({ enum: PhoneVerificationPurpose, example: 'REGISTRATION' })
  @IsEnum(PhoneVerificationPurpose)
  purpose!: PhoneVerificationPurpose;
}

/**
 * The second half of phone-first sign-up.
 *
 * `verificationToken` is the ticket minted when the code was verified. The
 * phone number is *inside* it, signed, and is not accepted as a field here --
 * otherwise a caller could verify a number they own and then register a
 * different one, which is the whole attack this flow exists to prevent.
 */
export class RegisterWithPhoneDto {
  @ApiProperty({ description: 'The token returned by verify-code.' })
  @IsString()
  @MaxLength(2048)
  verificationToken!: string;

  @ApiProperty({ example: 'Aziz' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  firstName!: string;

  @ApiProperty({ example: 'Karimov' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  lastName!: string;

  @ApiProperty({ example: 'DevelopmentOnly!123', minLength: 12 })
  @IsString()
  @MinLength(12, { message: 'Password must be at least 12 characters long.' })
  @MaxLength(128)
  @Matches(/[A-Z]/, { message: 'Password must contain at least one uppercase letter.' })
  @Matches(/[a-z]/, { message: 'Password must contain at least one lowercase letter.' })
  @Matches(/[0-9]/, { message: 'Password must contain at least one number.' })
  @Matches(/[^A-Za-z0-9]/, { message: 'Password must contain at least one special character.' })
  password!: string;

  /**
   * Optional, and secondary. A donor who gives one gets password recovery by
   * email and the receipts that go with it; one who does not is still a full
   * account, because requiring an address most of this market does not use was
   * the barrier this sprint exists to remove.
   */
  @ApiPropertyOptional({ example: 'aziz@example.uz' })
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;
}

/** Turns a verified phone into a password-reset token, reusing that flow. */
export class ResetPasswordWithPhoneDto extends LocaleAware {
  @PhoneNumberField({ uzbekOnly: true })
  phone!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'validation.otpFormat' })
  code!: string;
}
