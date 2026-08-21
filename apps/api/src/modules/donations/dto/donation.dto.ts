import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  AssessmentDecision,
  CancellationReason,
  DonationType,
} from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsInt, Min, Max, IsDateString } from 'class-validator';

export class CheckInDonationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class RecordAssessmentDto {
  @ApiPropertyOptional({ enum: AssessmentDecision })
  @IsEnum(AssessmentDecision)
  decision!: AssessmentDecision;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reasonCategory?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class StartDonationDto {
  @ApiPropertyOptional({ enum: DonationType })
  @IsOptional()
  @IsEnum(DonationType)
  donationType?: DonationType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CompleteDonationDto {
  @ApiPropertyOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  volumeMl!: number;

  @ApiPropertyOptional()
  @IsDateString()
  collectionStartedAt!: string;

  @ApiPropertyOptional()
  @IsDateString()
  collectionCompletedAt!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bloodType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  rhFactor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  nextDonationDate?: string;
}

export class CancelDonationDto {
  @ApiPropertyOptional({ enum: CancellationReason })
  @IsEnum(CancellationReason)
  reason!: CancellationReason;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class AbortDonationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class GetMyDonationsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  upcoming?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  past?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  organizationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  page?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  limit?: string;
}

export class GetOrganizationDonationsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  donationType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  today?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  page?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  limit?: string;
}