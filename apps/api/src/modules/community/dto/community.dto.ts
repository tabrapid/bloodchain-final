import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsInt,
  Min,
  Max,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CommunityPostType, CommunityPostStatus } from '@prisma/client';

export class GetFeedDto {
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

  @ApiPropertyOptional({ enum: CommunityPostType })
  @IsOptional()
  @IsEnum(CommunityPostType)
  type?: CommunityPostType;
}

export class GetCommunityPostsDto {
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

  @ApiPropertyOptional({ enum: CommunityPostType })
  @IsOptional()
  @IsEnum(CommunityPostType)
  type?: CommunityPostType;

  @ApiPropertyOptional({ enum: CommunityPostStatus })
  @IsOptional()
  @IsEnum(CommunityPostStatus)
  status?: CommunityPostStatus;
}

export class ReportContentDto {
  @ApiProperty({ enum: ['SPAM', 'HARASSMENT', 'MISINFORMATION', 'INAPPROPRIATE', 'OTHER'] })
  @IsString()
  reason: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

export class CommunityPostResponseDto {
  id: string;
  type: CommunityPostType;
  title: string;
  body: string;
  imageUrl?: string;
  status: CommunityPostStatus;
  publishedAt: Date;
  createdAt: Date;
  author?: {
    id: string;
    displayName?: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string;
  };
  organization?: {
    id: string;
    name: string;
  };
  campaign?: {
    id: string;
    title: string;
  };
  achievement?: {
    id: string;
    name: string;
    icon: string;
  };
  metadata?: any;
}

export class FeedResponseDto {
  items: CommunityPostResponseDto[];
  total: number;
  page: number;
  limit: number;
}

export class ContentReportResponseDto {
  id: string;
  postId: string;
  reporterId: string;
  reason: string;
  description?: string;
  status: string;
  createdAt: Date;
  post?: CommunityPostResponseDto;
}
