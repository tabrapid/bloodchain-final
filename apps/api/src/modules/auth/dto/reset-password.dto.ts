import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ description: 'The token from the reset email' })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  token!: string;

  /**
   * Deliberately the same rules as registration and change-password. A reset is
   * a normal way to end up with a new password, so relaxing the policy here
   * would make it the easy way around the policy everywhere else.
   */
  @ApiProperty({ minLength: 12, description: 'Must contain uppercase, lowercase, number, and special character' })
  @IsString()
  @MinLength(12, { message: 'Password must be at least 12 characters long.' })
  @MaxLength(128)
  @Matches(/[A-Z]/, { message: 'Password must contain at least one uppercase letter.' })
  @Matches(/[a-z]/, { message: 'Password must contain at least one lowercase letter.' })
  @Matches(/[0-9]/, { message: 'Password must contain at least one number.' })
  @Matches(/[^A-Za-z0-9]/, { message: 'Password must contain at least one special character.' })
  newPassword!: string;
}
