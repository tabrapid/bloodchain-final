import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { XpService } from './services/xp.service';
import { LevelService } from './services/level.service';
import { AchievementService } from './services/achievement.service';
import { BadgeService } from './services/badge.service';
import { LeaderboardService } from './services/leaderboard.service';
import { ReputationService } from './services/reputation.service';
import { AntiAbuseService } from './services/anti-abuse.service';
import { GamificationProfileDto, XpHistoryDto, DonationStatsDto } from './dto/gamification.dto';
import { AchievementType, XpTransactionType } from '@prisma/client';
import { LEVEL_CONFIG } from './config/gamification.config';

@Injectable()
export class GamificationService {
  private readonly logger = new Logger(GamificationService.name);

  constructor(
    private readonly db: PrismaService,
    private readonly xpService: XpService,
    private readonly levelService: LevelService,
    private readonly achievementService: AchievementService,
    private readonly badgeService: BadgeService,
    private readonly leaderboardService: LeaderboardService,
    private readonly reputationService: ReputationService,
    private readonly antiAbuseService: AntiAbuseService,
  ) {}

  async onModuleInit() {
    await this.seedData();
  }

  private async seedData() {
    try {
      await this.achievementService.seedAchievements();
      await this.badgeService.seedBadges();
      this.logger.log('Gamification data seeded successfully');
    } catch (error) {
      this.logger.error('Failed to seed gamification data', error);
    }
  }

  async getGamificationProfile(userId: string): Promise<GamificationProfileDto> {
    const [profile, donationStats, userRank] = await Promise.all([
      this.db.gamificationProfile.findUnique({ where: { userId } }),
      this.leaderboardService.getDonationStats(userId),
      this.leaderboardService.getUserRank(userId),
    ]);

    const totalXp = profile?.totalXp || 0;
    const level = profile?.level || this.levelService.calculateLevelFromXp(totalXp);
    const xpToNextLevel = this.levelService.calculateXpToNextLevel(totalXp, level);
    const progress = this.levelService.calculateProgress(totalXp, level);

    let nextEligibleDate: Date | undefined;
    if (donationStats.totalDonations > 0) {
      const lastDonation = await this.db.donation.findFirst({
        where: { donorId: userId, status: 'COMPLETED' },
        orderBy: { completedAt: 'desc' },
        select: { nextDonationDate: true },
      });
      nextEligibleDate = lastDonation?.nextDonationDate || undefined;
    }

    return {
      level,
      totalXp,
      xpToNextLevel,
      progress,
      reputationScore: profile?.reputationScore || 0,
      donationCount: donationStats.totalDonations,
      emergencyResponseCount: donationStats.successfulEmergencyResponses,
      bloodTestCount: donationStats.bloodTestsCompleted,
      rank: userRank?.rank,
      nextEligibleDonationDate: nextEligibleDate,
    };
  }

  async getXpHistory(userId: string, page = 1, limit = 20): Promise<XpHistoryDto> {
    const { transactions, total } = await this.xpService.getXpTransactions(userId, page, limit);

    return {
      transactions: transactions.map((tx) => ({
        id: tx.id,
        amount: tx.amount,
        type: tx.type,
        description: tx.description || tx.type,
        createdAt: tx.createdAt,
      })),
      total,
      page,
      limit,
    };
  }

  async processDonationCompleted(
    userId: string,
    donationId: string,
    isEmergency = false,
  ): Promise<{
    xpAwarded: boolean;
    xpAmount: number;
    newTotalXp: number;
    levelUp: boolean;
    newLevel: number;
    achievementsUnlocked: string[];
    badgesEarned: string[];
  }> {
    const verification = await this.antiAbuseService.verifyDonationCompletion(donationId);
    if (!verification.valid) {
      this.logger.warn(`Donation ${donationId} not valid for XP: ${verification.reason}`);
      return {
        xpAwarded: false,
        xpAmount: 0,
        newTotalXp: 0,
        levelUp: false,
        newLevel: 1,
        achievementsUnlocked: [],
        badgesEarned: [],
      };
    }

    const duplicateCheck = await this.antiAbuseService.checkForDuplicateDonation(userId, donationId);
    if (duplicateCheck) {
      this.logger.warn(`Duplicate donation XP attempt for donation ${donationId}`);
      return {
        xpAwarded: false,
        xpAmount: 0,
        newTotalXp: 0,
        levelUp: false,
        newLevel: 1,
        achievementsUnlocked: [],
        badgesEarned: [],
      };
    }

    const xpResult = isEmergency
      ? await this.xpService.awardEmergencyDonationXp(userId, donationId)
      : await this.xpService.awardDonationXp(userId, donationId);

    if (!xpResult.success) {
      return {
        xpAwarded: false,
        xpAmount: 0,
        newTotalXp: 0,
        levelUp: false,
        newLevel: 1,
        achievementsUnlocked: [],
        badgesEarned: [],
      };
    }

    const { previousLevel, newLevel, leveledUp } = await this.levelService.updateUserLevel(
      userId,
      xpResult.newTotal,
    );

    await this.reputationService.awardVerifiedContributionReputation(userId, donationId);

    const { unlocked: achievements, xpAwarded: achievementXp } =
      await this.achievementService.checkAndUnlockAchievements(userId, AchievementType.DONATION_COUNT, donationId);

    if (achievementXp > 0) {
      await this.xpService.awardAchievementXp(userId, 'MULTIPLE', achievementXp);
    }

    const badgesEarned: string[] = [];
    for (const achievement of achievements) {
      const badgeResult = await this.badgeService.awardBadgeForAchievement(
        userId,
        achievement.code,
      );
      if (badgeResult.success) {
        badgesEarned.push(achievement.code);
      }
    }

    if (newLevel >= LEVEL_CONFIG.MAX_LEVEL) {
      const badgeResult = await this.badgeService.awardMaxLevelBadge(userId);
      if (badgeResult.success) {
        badgesEarned.push('PLATINUM_BADGE');
      }
    }

    return {
      xpAwarded: true,
      xpAmount: xpResult.xpAmount,
      newTotalXp: xpResult.newTotal,
      levelUp: leveledUp,
      newLevel,
      achievementsUnlocked: achievements.map((a) => a.code),
      badgesEarned,
    };
  }

  async processBloodTestCompleted(
    userId: string,
    resultId: string,
  ): Promise<{
    xpAwarded: boolean;
    xpAmount: number;
    newTotalXp: number;
    achievementsUnlocked: string[];
  }> {
    const verification = await this.antiAbuseService.verifyBloodTestCompletion(resultId);
    if (!verification.valid) {
      return {
        xpAwarded: false,
        xpAmount: 0,
        newTotalXp: 0,
        achievementsUnlocked: [],
      };
    }

    const xpResult = await this.xpService.awardBloodTestXp(userId, resultId);

    if (!xpResult.success) {
      return {
        xpAwarded: false,
        xpAmount: 0,
        newTotalXp: 0,
        achievementsUnlocked: [],
      };
    }

    await this.levelService.updateUserLevel(userId, xpResult.newTotal);

    const { unlocked: achievements } = await this.achievementService.checkAndUnlockAchievements(
      userId,
      AchievementType.BLOOD_TEST_COUNT,
      resultId,
    );

    return {
      xpAwarded: true,
      xpAmount: xpResult.xpAmount,
      newTotalXp: xpResult.newTotal,
      achievementsUnlocked: achievements.map((a) => a.code),
    };
  }

  async processAppointmentCompleted(
    userId: string,
    appointmentId: string,
  ): Promise<{
    xpAwarded: boolean;
    xpAmount: number;
    newTotalXp: number;
  }> {
    const verification = await this.antiAbuseService.verifyAppointmentCompletion(appointmentId);
    if (!verification.valid) {
      return {
        xpAwarded: false,
        xpAmount: 0,
        newTotalXp: 0,
      };
    }

    const xpResult = await this.xpService.awardAppointmentXp(userId, appointmentId);

    if (!xpResult.success) {
      return {
        xpAwarded: false,
        xpAmount: 0,
        newTotalXp: 0,
      };
    }

    await this.levelService.updateUserLevel(userId, xpResult.newTotal);

    return {
      xpAwarded: true,
      xpAmount: xpResult.xpAmount,
      newTotalXp: xpResult.newTotal,
    };
  }

  async processEmergencyResponseCompleted(
    userId: string,
    responseId: string,
  ): Promise<{
    xpAwarded: boolean;
    xpAmount: number;
    newTotalXp: number;
    achievementsUnlocked: string[];
  }> {
    const verification = await this.antiAbuseService.verifyEmergencyResponseCompletion(responseId);
    if (!verification.valid) {
      return {
        xpAwarded: false,
        xpAmount: 0,
        newTotalXp: 0,
        achievementsUnlocked: [],
      };
    }

    const xpResult = await this.xpService.awardEmergencyResponseXp(userId, responseId);

    if (!xpResult.success) {
      return {
        xpAwarded: false,
        xpAmount: 0,
        newTotalXp: 0,
        achievementsUnlocked: [],
      };
    }

    await this.reputationService.awardEmergencyResponseReputation(userId, responseId);
    await this.levelService.updateUserLevel(userId, xpResult.newTotal);

    const { unlocked: achievements } = await this.achievementService.checkAndUnlockAchievements(
      userId,
      AchievementType.EMERGENCY_RESPONSE_COUNT,
      responseId,
    );

    const badgesEarned: string[] = [];
    for (const achievement of achievements) {
      const badgeResult = await this.badgeService.awardBadgeForAchievement(
        userId,
        achievement.code,
      );
      if (badgeResult.success) {
        badgesEarned.push(achievement.code);
      }
    }

    return {
      xpAwarded: true,
      xpAmount: xpResult.xpAmount,
      newTotalXp: xpResult.newTotal,
      achievementsUnlocked: achievements.map((a) => a.code).concat(badgesEarned),
    };
  }

  async processChallengeCompleted(
    userId: string,
    challengeId: string,
    xpAmount: number,
    challengeTitle: string,
  ): Promise<{
    xpAwarded: boolean;
    xpAmount: number;
    newTotalXp: number;
  }> {
    if (xpAmount <= 0) {
      return { xpAwarded: false, xpAmount: 0, newTotalXp: 0 };
    }

    const xpResult = await this.xpService.awardXp(
      userId,
      xpAmount,
      XpTransactionType.CHALLENGE_COMPLETED,
      'CHALLENGE',
      challengeId,
      `Challenge completed: ${challengeTitle}`,
    );

    if (!xpResult.success) {
      return { xpAwarded: false, xpAmount: 0, newTotalXp: 0 };
    }

    await this.levelService.updateUserLevel(userId, xpResult.newTotal);

    return {
      xpAwarded: true,
      xpAmount,
      newTotalXp: xpResult.newTotal,
    };
  }

  async ensureGamificationProfile(userId: string): Promise<void> {
    await this.xpService.ensureProfileExists(userId);
  }

  async syncUserLevel(userId: string): Promise<void> {
    await this.levelService.syncUserLevel(userId);
  }
}
