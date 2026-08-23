import { Controller, Get, Post, Query, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { GamificationService } from './gamification.service';
import { AchievementService } from './services/achievement.service';
import { BadgeService } from './services/badge.service';
import { LeaderboardService, LeaderboardTimeRange } from './services/leaderboard.service';
import { LevelService } from './services/level.service';
import {
  GamificationProfileDto,
  XpHistoryDto,
  AchievementListDto,
  LeaderboardDto,
  UserRankDto,
  DonationStatsDto,
  LevelProgressDto,
  UpdateLeaderboardVisibilityDto,
} from './dto/gamification.dto';

@ApiTags('Gamification')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class GamificationController {
  constructor(
    private readonly gamificationService: GamificationService,
    private readonly achievementService: AchievementService,
    private readonly badgeService: BadgeService,
    private readonly leaderboardService: LeaderboardService,
    private readonly levelService: LevelService,
  ) {}

  @Get('me/gamification')
  @ApiOperation({ summary: 'Get current user gamification profile' })
  @ApiResponse({ status: 200, description: 'Gamification profile retrieved', type: GamificationProfileDto })
  async getProfile(@Request() req: any): Promise<GamificationProfileDto> {
    return this.gamificationService.getGamificationProfile(req.user.sub);
  }

  @Get('me/gamification/progress')
  @ApiOperation({ summary: 'Get current user level progress' })
  @ApiResponse({ status: 200, description: 'Level progress retrieved', type: LevelProgressDto })
  async getLevelProgress(@Request() req: any): Promise<LevelProgressDto> {
    return this.levelService.getLevelProgress(req.user.sub);
  }

  @Get('me/gamification/xp')
  @ApiOperation({ summary: 'Get XP transaction history' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'XP history retrieved', type: XpHistoryDto })
  async getXpHistory(
    @Request() req: any,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ): Promise<XpHistoryDto> {
    return this.gamificationService.getXpHistory(req.user.sub, Number(page), Number(limit));
  }

  @Get('me/gamification/achievements')
  @ApiOperation({ summary: 'Get user achievements' })
  @ApiResponse({ status: 200, description: 'Achievements retrieved', type: AchievementListDto })
  async getAchievements(@Request() req: any): Promise<AchievementListDto> {
    return this.achievementService.getUserAchievements(req.user.sub);
  }

  @Get('me/gamification/badges')
  @ApiOperation({ summary: 'Get user badges' })
  @ApiResponse({ status: 200, description: 'Badges retrieved' })
  async getBadges(@Request() req: any) {
    return this.badgeService.getUserBadges(req.user.sub);
  }

  @Get('me/gamification/stats')
  @ApiOperation({ summary: 'Get donation statistics' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved', type: DonationStatsDto })
  async getStats(@Request() req: any): Promise<DonationStatsDto> {
    return this.leaderboardService.getDonationStats(req.user.sub);
  }

  @Post('me/gamification/leaderboard-visibility')
  @ApiOperation({ summary: 'Update leaderboard visibility setting' })
  @ApiResponse({ status: 200, description: 'Visibility updated' })
  async updateLeaderboardVisibility(
    @Request() req: any,
    @Body() dto: UpdateLeaderboardVisibilityDto,
  ): Promise<{ success: boolean }> {
    await this.leaderboardService.updateLeaderboardVisibility(req.user.sub, dto.visible);
    return { success: true };
  }
}

@ApiTags('Leaderboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get()
  @ApiOperation({ summary: 'Get donor leaderboard' })
  @ApiQuery({ name: 'timeRange', required: false, enum: ['ALL_TIME', 'THIS_YEAR', 'THIS_MONTH'] })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Leaderboard retrieved', type: LeaderboardDto })
  async getLeaderboard(
    @Query('timeRange') timeRange: LeaderboardTimeRange = 'ALL_TIME',
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ): Promise<LeaderboardDto> {
    const result = await this.leaderboardService.getLeaderboard(
      timeRange,
      Number(page),
      Number(limit),
    );
    return {
      entries: result.entries,
      timeRange,
      total: result.total,
      page: Number(page),
      limit: Number(limit),
    };
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current user rank' })
  @ApiQuery({ name: 'timeRange', required: false, enum: ['ALL_TIME', 'THIS_YEAR', 'THIS_MONTH'] })
  @ApiResponse({ status: 200, description: 'User rank retrieved', type: UserRankDto })
  async getUserRank(
    @Request() req: any,
    @Query('timeRange') timeRange: LeaderboardTimeRange = 'ALL_TIME',
  ): Promise<UserRankDto | { message: string }> {
    const rank = await this.leaderboardService.getUserRank(req.user.sub, timeRange);
    if (!rank) {
      return { message: 'User not on leaderboard' };
    }
    return rank;
  }
}
