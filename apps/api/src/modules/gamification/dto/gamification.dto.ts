import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsInt, Min } from 'class-validator';

export class GamificationProfileDto {
  @ApiProperty()
  level!: number;

  @ApiProperty()
  totalXp!: number;

  @ApiProperty()
  xpToNextLevel!: number;

  @ApiProperty()
  progress!: number;

  @ApiProperty()
  reputationScore!: number;

  @ApiProperty()
  donationCount!: number;

  @ApiProperty()
  emergencyResponseCount!: number;

  @ApiProperty()
  bloodTestCount!: number;

  @ApiPropertyOptional()
  rank?: number;

  @ApiPropertyOptional()
  nextEligibleDonationDate?: Date;
}

export class XpTransactionDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  amount!: number;

  @ApiProperty()
  type!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty()
  createdAt!: Date;
}

export class XpHistoryDto {
  @ApiProperty({ type: [XpTransactionDto] })
  transactions!: XpTransactionDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;
}

export class AchievementDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty()
  icon!: string;

  @ApiProperty()
  rarity!: string;

  @ApiProperty()
  xpReward!: number;

  @ApiProperty()
  progress!: number;

  @ApiProperty()
  target!: number;

  @ApiProperty()
  status!: string;

  @ApiPropertyOptional()
  unlockedAt?: Date;
}

export class AchievementListDto {
  @ApiProperty({ type: [AchievementDto] })
  unlocked!: AchievementDto[];

  @ApiProperty({ type: [AchievementDto] })
  inProgress!: AchievementDto[];

  @ApiProperty({ type: [AchievementDto] })
  locked!: AchievementDto[];
}

export class BadgeDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty()
  icon!: string;

  @ApiProperty()
  rarity!: string;

  @ApiPropertyOptional()
  earnedAt?: Date;
}

export class LeaderboardEntryDto {
  @ApiProperty()
  rank!: number;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  displayName!: string;

  @ApiPropertyOptional()
  avatarUrl?: string;

  @ApiProperty()
  level!: number;

  @ApiProperty()
  xp!: number;

  @ApiProperty()
  donationCount!: number;
}

export class LeaderboardDto {
  @ApiProperty({ type: [LeaderboardEntryDto] })
  entries!: LeaderboardEntryDto[];

  @ApiProperty()
  timeRange!: string;

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;
}

export class UserRankDto {
  @ApiProperty()
  rank!: number;

  @ApiProperty()
  total!: number;

  @ApiProperty()
  level!: number;

  @ApiProperty()
  xp!: number;
}

export class DonationStatsDto {
  @ApiProperty()
  totalDonations!: number;

  @ApiProperty()
  successfulEmergencyResponses!: number;

  @ApiProperty()
  bloodTestsCompleted!: number;

  @ApiPropertyOptional()
  totalBloodVolume?: number;
}

export class UpdateLeaderboardVisibilityDto {
  @ApiProperty()
  @IsBoolean()
  visible!: boolean;
}

export class AdminAdjustmentDto {
  @ApiProperty()
  @IsInt()
  @Min(-1000)
  xpAmount!: number;

  @ApiProperty()
  reason!: string;
}

export class LevelProgressDto {
  @ApiProperty()
  currentLevel!: number;

  @ApiProperty()
  currentLevelName!: string;

  @ApiProperty()
  currentXp!: number;

  @ApiProperty()
  xpForNextLevel!: number;

  @ApiProperty()
  xpToNextLevel!: number;

  @ApiProperty()
  progress!: number;

  @ApiProperty()
  nextLevelName!: string;

  @ApiProperty()
  isMaxLevel!: boolean;
}
