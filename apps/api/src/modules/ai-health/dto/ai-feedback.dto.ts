import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export enum AIFeedbackTypeDto {
  HELPFUL = 'HELPFUL',
  NOT_HELPFUL = 'NOT_HELPFUL',
  REPORT_ISSUE = 'REPORT_ISSUE',
}

export class SubmitFeedbackDto {
  @ApiProperty()
  @IsString()
  insightId!: string;

  @ApiProperty({ enum: AIFeedbackTypeDto })
  @IsEnum(AIFeedbackTypeDto)
  type!: AIFeedbackTypeDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class FeedbackResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  insightId!: string;

  @ApiProperty({ enum: AIFeedbackTypeDto })
  type!: AIFeedbackTypeDto;

  @ApiPropertyOptional()
  reason?: string | null;

  @ApiProperty()
  createdAt!: string;
}

export class FeedbackAnalyticsResponseDto {
  @ApiProperty()
  totalFeedback!: number;

  @ApiProperty()
  helpful!: number;

  @ApiProperty()
  notHelpful!: number;

  @ApiProperty()
  reportIssue!: number;

  @ApiProperty()
  helpfulRate!: number;
}
