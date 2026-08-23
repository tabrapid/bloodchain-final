import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsInt,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EducationContentType } from '@prisma/client';

export class CreateEducationalContentDto {
  @ApiProperty({ enum: EducationContentType })
  @IsEnum(EducationContentType)
  type: EducationContentType;

  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty()
  @IsString()
  description: string;

  @ApiProperty()
  @IsString()
  body: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiProperty()
  @IsString()
  category: string;

  @ApiPropertyOptional({ default: 'BEGINNER' })
  @IsOptional()
  @IsString()
  difficulty?: string = 'BEGINNER';

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  xpReward?: number = 0;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  estimatedMinutes?: number;
}

export class UpdateEducationalContentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  body?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  difficulty?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  xpReward?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  estimatedMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class GetEducationalContentDto {
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

  @ApiPropertyOptional({ enum: EducationContentType })
  @IsOptional()
  @IsEnum(EducationContentType)
  type?: EducationContentType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;
}

export class EducationalContentResponseDto {
  id: string;
  type: EducationContentType;
  title: string;
  description: string;
  body: string;
  imageUrl?: string;
  category: string;
  difficulty: string;
  xpReward: number;
  estimatedMinutes?: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class EducationalContentListResponseDto {
  items: EducationalContentResponseDto[];
  total: number;
  page: number;
  limit: number;
}

export class EducationProgressResponseDto {
  id: string;
  userId: string;
  contentId: string;
  status: string;
  startedAt: Date;
  completedAt?: Date;
  xpAwarded: number;
  content?: EducationalContentResponseDto;
}

export class CompleteContentDto {
  @ApiProperty()
  @IsString()
  contentId: string;
}
