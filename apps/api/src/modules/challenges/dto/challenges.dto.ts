import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsInt,
  IsDateString,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ChallengeType, ChallengeStatus, ChallengeVisibility } from '@prisma/client';

export class CreateChallengeDto {
  @ApiProperty()
  @IsString()
  title!: string;

  @ApiProperty()
  @IsString()
  description!: string;

  @ApiProperty({ enum: ChallengeType })
  @IsEnum(ChallengeType)
  type!: ChallengeType;

  @ApiPropertyOptional({ enum: ChallengeVisibility, default: ChallengeVisibility.PUBLIC })
  @IsOptional()
  @IsEnum(ChallengeVisibility)
  visibility?: ChallengeVisibility = ChallengeVisibility.PUBLIC;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  goal?: number = 1;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  xpReward?: number = 0;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  badgeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  organizationId?: string;
}

export class UpdateChallengeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: ChallengeStatus })
  @IsOptional()
  @IsEnum(ChallengeStatus)
  status?: ChallengeStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  goal?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  xpReward?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  badgeId?: string;
}

export class GetChallengesDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ enum: ChallengeType })
  @IsOptional()
  @IsEnum(ChallengeType)
  type?: ChallengeType;

  @ApiPropertyOptional({ enum: ChallengeStatus })
  @IsOptional()
  @IsEnum(ChallengeStatus)
  status?: ChallengeStatus;

  @ApiPropertyOptional({ enum: ChallengeVisibility })
  @IsOptional()
  @IsEnum(ChallengeVisibility)
  visibility?: ChallengeVisibility;
}

export class ChallengeResponseDto {
  id!: string;
  title!: string;
  description!: string;
  type!: ChallengeType;
  status!: ChallengeStatus;
  visibility!: ChallengeVisibility;
  organizationId?: string;
  startDate?: Date;
  endDate?: Date;
  goal!: number;
  xpReward!: number;
  badgeId?: string;
  createdAt!: Date;
  updatedAt!: Date;
  organization?: {
    id: string;
    name: string;
  };
  badge?: {
    id: string;
    name: string;
    icon: string;
  };
  participantCount?: number;
}

export class ChallengeListResponseDto {
  items!: ChallengeResponseDto[];
  total!: number;
  page!: number;
  limit!: number;
}

export class ChallengeParticipantResponseDto {
  id!: string;
  challengeId!: string;
  userId!: string;
  progress!: number;
  completedAt?: Date;
  joinedAt!: Date;
  challenge?: ChallengeResponseDto;
}
