import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({ description: 'Token from the verification email link.' })
  @IsString()
  @MinLength(10)
  @MaxLength(128)
  token!: string;
}
