import { ApiPropertyOptional } from '@nestjs/swagger';
import { BloodType, DonorStatus, VerificationStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/**
 * The staff donor directory's query.
 *
 * The route used to take six loose `@Query('...')` strings, so `?bloodType=Z`
 * went to Prisma verbatim and came back as a 500 rather than a 400 -- and
 * `page` and `limit` were `Number()`d at the call site, where `?limit=all`
 * became `NaN`. Sprint 3 adds a verification filter and a name search to this
 * same route, which is a reason to give it a shape rather than two more loose
 * strings.
 */
export class ListDonorsQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ enum: BloodType })
  @IsOptional()
  @IsEnum(BloodType)
  bloodType?: BloodType;

  @ApiPropertyOptional({ enum: DonorStatus })
  @IsOptional()
  @IsEnum(DonorStatus)
  donorStatus?: DonorStatus;

  @ApiPropertyOptional({ enum: VerificationStatus })
  @IsOptional()
  @IsEnum(VerificationStatus)
  verificationStatus?: VerificationStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @ApiPropertyOptional({ description: "Matches the donor's first name, last name or email" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}
