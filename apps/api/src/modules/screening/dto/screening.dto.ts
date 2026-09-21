import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ScreeningOrderStatus, ScreeningResultSource } from '@prisma/client';
import {
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CollectSampleDto {
  @ApiPropertyOptional({ description: 'A code in a vocabulary that ships empty.' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  sampleType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional({ description: 'Attach the sample to this open order.' })
  @IsOptional()
  @IsString()
  orderId?: string;
}

export class RejectSampleDto {
  @ApiProperty({ description: 'Structured reason the sample is unusable. Not a clinical finding.' })
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  rejectionReason!: string;
}

export class RecordScreeningResultDto {
  @ApiProperty({ description: "A requirement code from the order's pinned policy version." })
  @IsString()
  @MaxLength(80)
  requirementCode!: string;

  @ApiProperty({ description: "The laboratory's own result code. Stored verbatim and uninterpreted." })
  @IsString()
  @MaxLength(80)
  resultCode!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  resultValue?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sampleId?: string;

  @ApiPropertyOptional({ enum: ScreeningResultSource })
  @IsOptional()
  @IsEnum(ScreeningResultSource)
  source?: ScreeningResultSource;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  methodReference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  reagentReference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  reagentLot?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  reagentExpiresAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  analyzerReference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  performedAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  receivedAt?: string;

  @ApiPropertyOptional({ description: 'Operational comment. Not clinical detail.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;

  @ApiPropertyOptional({
    description: 'Clinical detail. Never returned outside the organization that recorded it.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  confidentialComment?: string;
}

export class ReviewScreeningResultDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

export class CorrectScreeningResultDto {
  @ApiProperty()
  @IsString()
  @MaxLength(80)
  resultCode!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  resultValue?: string;

  @ApiProperty({ description: 'Why the original result was wrong.' })
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  reason!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  confidentialComment?: string;
}

export class CancelScreeningOrderDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  reason!: string;
}

export class ListScreeningOrdersDto {
  @ApiPropertyOptional({ enum: ScreeningOrderStatus })
  @IsOptional()
  @IsEnum(ScreeningOrderStatus)
  status?: ScreeningOrderStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  donationId?: string;
}
