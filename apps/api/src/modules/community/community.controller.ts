import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CommunityService } from './community.service';
import {
  GetFeedDto,
  ReportContentDto,
  FeedResponseDto,
  CommunityPostResponseDto,
  ContentReportResponseDto,
} from './dto/community.dto';

@ApiTags('Community')
@Controller('community')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CommunityController {
  constructor(private readonly communityService: CommunityService) {}

  @Get('feed')
  @ApiOperation({ summary: 'Get community feed' })
  @ApiResponse({ status: 200, description: 'Feed retrieved successfully', type: FeedResponseDto })
  async getFeed(
    @CurrentUser('sub') userId: string,
    @Query() query: GetFeedDto,
  ) {
    return this.communityService.getFeed(
      userId,
      query.page,
      query.limit,
      query.type,
    );
  }

  @Get('posts/:id')
  @ApiOperation({ summary: 'Get community post by ID' })
  @ApiResponse({ status: 200, description: 'Post retrieved successfully', type: CommunityPostResponseDto })
  async getPost(@Param('id') id: string) {
    return this.communityService.getPost(id);
  }

  @Post('posts/:id/report')
  @ApiOperation({ summary: 'Report a community post' })
  @ApiResponse({ status: 201, description: 'Report submitted successfully', type: ContentReportResponseDto })
  async reportContent(
    @Param('id') postId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: ReportContentDto,
  ) {
    return this.communityService.reportContent(
      postId,
      userId,
      dto.reason,
      dto.description,
    );
  }

  @Get('impact')
  @ApiOperation({ summary: 'Get user impact statistics' })
  @ApiResponse({ status: 200, description: 'Impact stats retrieved successfully' })
  async getImpactStats(@CurrentUser('sub') userId: string) {
    return this.communityService.getImpactStats(userId);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get community statistics' })
  @ApiResponse({ status: 200, description: 'Community stats retrieved successfully' })
  async getCommunityStats() {
    return this.communityService.getCommunityStats();
  }
}
