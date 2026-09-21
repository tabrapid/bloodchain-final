import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { HemovigilanceStatus } from '@prisma/client';
import { IsEnum, IsISO8601, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ReportHemovigilanceEventDto {
  @ApiPropertyOptional({ description: 'The component involved, when it is known.' })
  @IsOptional()
  @IsString()
  bloodUnitId?: string;

  @ApiPropertyOptional({
    description: 'Opaque and scoped to this organization. No identity policy is attached.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  recipientReference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  encounterReference?: string;

  @ApiPropertyOptional({
    description: 'A code from a vocabulary that ships empty. Not a reaction classification.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  eventCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  occurredAt?: string;

  @ApiPropertyOptional({ description: 'Clinical narrative. Never leaves this organization.' })
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  confidentialNarrative?: string;

  @ApiPropertyOptional({
    description: 'What other organizations may be told: that an event exists and what they must do.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  operationalSummary?: string;
}

export class InvestigateHemovigilanceEventDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(8000)
  investigationNote!: string;
}

export class CloseHemovigilanceEventDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  investigationNote?: string;
}

export class ListHemovigilanceEventsDto {
  @ApiPropertyOptional({ enum: HemovigilanceStatus })
  @IsOptional()
  @IsEnum(HemovigilanceStatus)
  status?: HemovigilanceStatus;
}
