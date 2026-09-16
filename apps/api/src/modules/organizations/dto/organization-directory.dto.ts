import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { OrganizationServiceType, OrganizationStatus, OrganizationType } from '@prisma/client';
import {
  OptionalBooleanField,
  RequiredBooleanField,
} from '../../../common/decorators/strict-boolean.decorator';

/** "HH:MM" on a 24-hour clock. Uzbekistan has one time zone and no DST. */
const TIME_OF_DAY = /^([01]\d|2[0-3]):[0-5]\d$/;

export class OrganizationHoursDto {
  @ApiProperty({ minimum: 0, maximum: 6, description: '0 = Sunday … 6 = Saturday' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @ApiPropertyOptional({ example: '09:00' })
  @IsOptional()
  @IsString()
  @Matches(TIME_OF_DAY, { message: 'validation.timeOfDay' })
  opensAt?: string;

  @ApiPropertyOptional({ example: '17:00' })
  @IsOptional()
  @IsString()
  @Matches(TIME_OF_DAY, { message: 'validation.timeOfDay' })
  closesAt?: string;

  @OptionalBooleanField('Closed all day; clears the opening times')
  isClosed?: boolean;
}

export class OrganizationServiceDto {
  @ApiProperty({ enum: OrganizationServiceType })
  @IsEnum(OrganizationServiceType)
  service!: OrganizationServiceType;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}

/**
 * The directory fields of an organization.
 *
 * Deliberately excludes `name`, `type` and `status`: those are the identity and
 * the lifecycle of the organization, changed through the existing admin paths,
 * not through a directory edit. This DTO is the address book entry.
 */
export class UpdateOrganizationDirectoryDto {
  @ApiPropertyOptional({ description: 'Region id from GET /geography/regions' })
  @IsOptional()
  @IsString()
  regionId?: string | null;

  @ApiPropertyOptional({ description: 'District id from GET /geography/districts' })
  @IsOptional()
  @IsString()
  districtId?: string | null;

  @ApiPropertyOptional({ maxLength: 300, description: 'Street line only' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string | null;

  @ApiPropertyOptional({ maxLength: 300 })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  directionsNote?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  latitude?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  longitude?: number | null;

  @ApiPropertyOptional({ maxLength: 32 })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  publicPhone?: string | null;

  @OptionalBooleanField('Whether donors can book a donation here')
  acceptsDonations?: boolean;

  @OptionalBooleanField('Whether this organization runs laboratory testing')
  providesLaboratory?: boolean;

  @ApiPropertyOptional({ type: [OrganizationServiceDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => OrganizationServiceDto)
  services?: OrganizationServiceDto[];

  @ApiPropertyOptional({ type: [OrganizationHoursDto], maxItems: 7 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => OrganizationHoursDto)
  hours?: OrganizationHoursDto[];
}

/** Filters for the staff-facing directory listing. */
export class OrganizationDirectoryQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ enum: OrganizationType })
  @IsOptional()
  @IsEnum(OrganizationType)
  type?: OrganizationType;

  @ApiPropertyOptional({ enum: OrganizationStatus })
  @IsOptional()
  @IsEnum(OrganizationStatus)
  status?: OrganizationStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  regionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  districtId?: string;

  @ApiPropertyOptional({ enum: OrganizationServiceType })
  @IsOptional()
  @IsEnum(OrganizationServiceType)
  service?: OrganizationServiceType;

  @OptionalBooleanField('Only organizations that collect donations')
  acceptsDonations?: boolean;

  @OptionalBooleanField('Only organizations that run laboratory testing')
  providesLaboratory?: boolean;

  @OptionalBooleanField('Only verified / only unverified')
  verified?: boolean;

  @ApiPropertyOptional({ description: 'Name or address contains' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}

/**
 * Donor-facing discovery. Same filters minus the ones only staff can act on,
 * plus a radius search that is only meaningful when the donor has shared a
 * location.
 */
export class DiscoverOrganizationsQueryDto extends OrganizationDirectoryQueryDto {
  @ApiPropertyOptional({ description: 'Donor latitude; requires longitude and radiusKm' })
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  latitude?: number;

  @ApiPropertyOptional({ description: 'Donor longitude; requires latitude and radiusKm' })
  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  longitude?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 500, description: 'Search radius in kilometres' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(500)
  radiusKm?: number;
}

/**
 * A DTO rather than an inline `{ verified: boolean }`, so the global validation
 * pipe actually runs: an inline type is erased at compile time and the pipe has
 * nothing to validate against, which would let `verified: "no"` through as a
 * truthy string.
 */
export class SetOrganizationVerificationDto {
  @RequiredBooleanField('True to verify, false to withdraw verification')
  verified!: boolean;
}
