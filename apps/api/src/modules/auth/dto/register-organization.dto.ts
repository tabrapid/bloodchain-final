import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrganizationType } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterOrganizationDto {
  @ApiProperty({ enum: [OrganizationType.HOSPITAL, OrganizationType.BLOOD_CENTER] })
  @IsEnum(OrganizationType)
  organizationType!: OrganizationType;

  @ApiProperty({ example: 'Northstar Hospital' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  organizationName!: string;

  @ApiPropertyOptional({ example: 'Northstar Hospital, Inc.' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  legalName?: string;

  @ApiPropertyOptional({ example: 'contact@northstar-hospital.example' })
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  organizationEmail?: string;

  @ApiPropertyOptional({ example: '+14155550100' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  organizationPhone?: string;

  @ApiPropertyOptional({ example: '123 Main St, San Francisco, CA' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @ApiPropertyOptional({ example: 37.7749 })
  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @ApiPropertyOptional({ example: -122.4194 })
  @IsOptional()
  @IsLongitude()
  longitude?: number;

  @ApiProperty({ example: 'admin@northstar-hospital.example', description: 'Email for the organization admin account' })
  @IsEmail()
  @MaxLength(254)
  adminEmail!: string;

  @ApiProperty({ example: 'DevelopmentOnly!123', minLength: 12, description: 'Must contain uppercase, lowercase, number, and special character' })
  @IsString()
  @MinLength(12, { message: 'Password must be at least 12 characters long.' })
  @MaxLength(128)
  @Matches(/[A-Z]/, { message: 'Password must contain at least one uppercase letter.' })
  @Matches(/[a-z]/, { message: 'Password must contain at least one lowercase letter.' })
  @Matches(/[0-9]/, { message: 'Password must contain at least one number.' })
  @Matches(/[^A-Za-z0-9]/, { message: 'Password must contain at least one special character.' })
  adminPassword!: string;

  @ApiProperty({ example: 'Alex' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  adminFirstName!: string;

  @ApiProperty({ example: 'Rivera' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  adminLastName!: string;

  @ApiPropertyOptional({ example: '+14155550123' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  adminPhone?: string;
}
