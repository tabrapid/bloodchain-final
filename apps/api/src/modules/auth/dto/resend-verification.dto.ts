import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, MaxLength } from 'class-validator';

export class ResendVerificationDto {
  @ApiProperty({ example: 'donor@donor.local' })
  @IsEmail()
  @MaxLength(254)
  email!: string;
}
