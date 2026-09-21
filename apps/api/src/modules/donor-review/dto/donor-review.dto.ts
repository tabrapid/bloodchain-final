import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DonorReviewResolution, DonorReviewTriggerStatus } from '@prisma/client';
import { IsEnum, IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';

export class ResolveDonorReviewDto {
  @ApiProperty({ enum: DonorReviewResolution })
  @IsEnum(DonorReviewResolution)
  resolution!: DonorReviewResolution;

  @ApiPropertyOptional({ description: 'Operational note. Not clinical detail.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;

  @ApiPropertyOptional({
    description:
      'Structured deferral reason code, required when the resolution defers. The vocabulary ships empty.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  deferralReasonCode?: string;

  @ApiPropertyOptional({ description: 'Required for a temporary deferral.' })
  @IsOptional()
  @IsISO8601()
  deferralEndsAt?: string;

  @ApiPropertyOptional({
    description:
      "The clinician's verbatim note. Stays with the organization that recorded it; never returned to another one.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  confidentialNote?: string;
}

export class ListDonorReviewsDto {
  @ApiPropertyOptional({ enum: DonorReviewTriggerStatus })
  @IsOptional()
  @IsEnum(DonorReviewTriggerStatus)
  status?: DonorReviewTriggerStatus;
}
