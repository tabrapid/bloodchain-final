import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum, IsDateString } from 'class-validator';

export enum InsightType {
  TREND_SUMMARY = 'TREND_SUMMARY',
  RESULT_EXPLANATION = 'RESULT_EXPLANATION',
  DATA_CHANGE = 'DATA_CHANGE',
  REFERENCE_RANGE_CONTEXT = 'REFERENCE_RANGE_CONTEXT',
  GENERAL_HEALTH_INFORMATION = 'GENERAL_HEALTH_INFORMATION',
  QUESTION_SUGGESTION = 'QUESTION_SUGGESTION',
  DATA_QUALITY_WARNING = 'DATA_QUALITY_WARNING',
}

export enum SafetyLevel {
  SAFE_INFORMATIONAL = 'SAFE_INFORMATIONAL',
  NEEDS_CONTEXT = 'NEEDS_CONTEXT',
  PROFESSIONAL_REVIEW_SUGGESTED = 'PROFESSIONAL_REVIEW_SUGGESTED',
  EMERGENCY_REDIRECT = 'EMERGENCY_REDIRECT',
  OUT_OF_SCOPE = 'OUT_OF_SCOPE',
}

export class GenerateInsightDto {
  @ApiProperty({ enum: InsightType })
  @IsEnum(InsightType)
  type!: InsightType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  resultId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  parameterCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  question?: string;
}

export class ExplainResultDto {
  @ApiProperty()
  @IsString()
  resultId!: string;
}

export class AnalyzeTrendDto {
  @ApiProperty()
  @IsString()
  parameterCode!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  to?: string;
}

export class ChatMessageDto {
  @ApiProperty()
  @IsString()
  role!: 'user' | 'assistant';

  @ApiProperty()
  @IsString()
  content!: string;
}

export class SendChatMessageDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  conversationId?: string;

  @ApiProperty()
  @IsString()
  message!: string;
}

export class GetInsightsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  limit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  offset?: string;
}

export class DataReferenceDto {
  @ApiProperty()
  resultId!: string;

  @ApiPropertyOptional()
  parameterCode?: string;

  @ApiProperty()
  date!: string;

  @ApiPropertyOptional()
  value?: number;

  @ApiPropertyOptional()
  unit?: string;
}

export class DataPointDto {
  @ApiProperty()
  label!: string;

  @ApiProperty()
  value!: string;

  @ApiPropertyOptional()
  unit?: string;

  @ApiPropertyOptional()
  date?: string;
}

export class AiInsightResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: InsightType })
  type!: InsightType;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  summary!: string;

  @ApiProperty({ type: [String] })
  observations!: string[];

  @ApiPropertyOptional({ type: [DataPointDto] })
  dataPoints?: DataPointDto[];

  @ApiProperty({ type: [String] })
  caveats!: string[];

  @ApiPropertyOptional({ type: [String] })
  questionsForProfessional?: string[];

  @ApiProperty({ enum: SafetyLevel })
  safetyLevel!: SafetyLevel;

  @ApiProperty()
  generatedAt!: string;

  @ApiPropertyOptional()
  dataVersion?: string;

  @ApiPropertyOptional({ type: [DataReferenceDto] })
  dataReferences?: DataReferenceDto[];
}

export class ChatConversationDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;

  @ApiPropertyOptional()
  lastMessage?: string;
}

export class ChatMessageResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  conversationId!: string;

  @ApiProperty()
  role!: 'user' | 'assistant';

  @ApiProperty()
  content!: string;

  @ApiProperty()
  createdAt!: string;

  @ApiPropertyOptional()
  insight?: AiInsightResponseDto;
}

export class ChatResponseDto {
  @ApiProperty()
  conversation!: ChatConversationDto;

  @ApiProperty()
  message!: ChatMessageResponseDto;
}

export class AiConsentDto {
  @ApiProperty()
  userId!: string;

  @ApiProperty()
  consentType!: string;

  @ApiProperty()
  version!: string;

  @ApiProperty()
  grantedAt!: string;

  @ApiPropertyOptional()
  revokedAt?: string;

  @ApiProperty()
  status!: 'GRANTED' | 'REVOKED' | 'EXPIRED';
}
