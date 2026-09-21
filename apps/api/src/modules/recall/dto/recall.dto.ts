import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RecallCaseStatus, RecallComponentState } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class OpenRecallDto {
  @ApiPropertyOptional({ description: 'Structured reason code. The vocabulary ships empty.' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  reasonCode?: string;

  @ApiPropertyOptional({
    description: 'What every affected organization may read: what they must do.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  operationalReason?: string;

  @ApiPropertyOptional({
    description: 'Clinical detail. Never returned outside the organization that opened the case.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  confidentialDetail?: string;
}

export class AcknowledgeRecallDto {
  @ApiPropertyOptional({ description: 'What this organization reports doing. Operational.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  responseNote?: string;
}

export class UpdateRecallComponentDto {
  @ApiProperty({ enum: RecallComponentState })
  @IsEnum(RecallComponentState)
  state!: RecallComponentState;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

export class CloseRecallDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  closureNote?: string;
}

export class ListRecallsDto {
  @ApiPropertyOptional({ enum: RecallCaseStatus })
  @IsOptional()
  @IsEnum(RecallCaseStatus)
  status?: RecallCaseStatus;
}
