import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { LeaderboardEntryDto, UserRankDto } from '../dto/gamification.dto';

export type LeaderboardTimeRange = 'ALL_TIME' | 'THIS_YEAR' | 'THIS_MONTH';

@Injectable()
export class LeaderboardService {
  constructor(private readonly db: PrismaService) {}

  async getLeaderboard(
    timeRange: LeaderboardTimeRange = 'ALL_TIME',
    page = 1,
    limit = 10,
  ): Promise<{ entries: LeaderboardEntryDto[]; total: number }> {
    const skip = (page - 1) * limit;

    const activeUserIds = await this.getActiveUserIds(timeRange);
    const whereClause = activeUserIds
      ? { leaderboardVisibility: true, userId: { in: activeUserIds } }
      : { leaderboardVisibility: true };

    const [entries, total] = await Promise.all([
      this.db.gamificationProfile.findMany({
        where: whereClause,
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              avatarUrl: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: [{ totalXp: 'desc' }],
      }),
      this.db.gamificationProfile.count({ where: whereClause }),
    ]);

    const donationCounts = await this.getDonationCounts(
      entries.map((e) => e.userId),
    );

    const rankedEntries: LeaderboardEntryDto[] = entries.map((profile, index) => ({
      rank: skip + index + 1,
      userId: profile.user.id,
      displayName: profile.user.displayName || 'Anonymous Donor',
      avatarUrl: profile.user.avatarUrl || undefined,
      level: profile.level,
      xp: profile.totalXp,
      donationCount: donationCounts.get(profile.userId) || 0,
    }));

    return { entries: rankedEntries, total };
  }

  async getUserRank(
    userId: string,
    timeRange: LeaderboardTimeRange = 'ALL_TIME',
  ): Promise<UserRankDto | null> {
    const profile = await this.db.gamificationProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      return null;
    }

    const activeUserIds = await this.getActiveUserIds(timeRange);
    const whereClause = activeUserIds
      ? { leaderboardVisibility: true, userId: { in: activeUserIds } }
      : { leaderboardVisibility: true };

    const higherRankedCount = await this.db.gamificationProfile.count({
      where: {
        ...whereClause,
        totalXp: { gt: profile.totalXp },
      },
    });

    const total = await this.db.gamificationProfile.count({
      where: whereClause,
    });

    return {
      rank: higherRankedCount + 1,
      total,
      level: profile.level,
      xp: profile.totalXp,
    };
  }

  async getDonationStats(userId: string): Promise<{
    totalDonations: number;
    successfulEmergencyResponses: number;
    bloodTestsCompleted: number;
  }> {
    const [totalDonations, emergencyResponses, bloodTests] = await Promise.all([
      this.db.donation.count({
        where: { donorId: userId, status: 'COMPLETED' },
      }),
      this.db.emergencyResponse.count({
        where: { donorId: userId, status: 'COMPLETED' },
      }),
      this.db.laboratoryResult.count({
        where: { donorId: userId, status: 'PUBLISHED' },
      }),
    ]);

    return {
      totalDonations,
      successfulEmergencyResponses: emergencyResponses,
      bloodTestsCompleted: bloodTests,
    };
  }

  async updateLeaderboardVisibility(
    userId: string,
    visible: boolean,
  ): Promise<void> {
    await this.db.gamificationProfile.update({
      where: { userId },
      data: { leaderboardVisibility: visible },
    });
  }

  private async getDonationCounts(userIds: string[]): Promise<Map<string, number>> {
    if (userIds.length === 0) return new Map();

    const donations = await this.db.donation.groupBy({
      by: ['donorId'],
      where: {
        donorId: { in: userIds },
        status: 'COMPLETED',
      },
      _count: { id: true },
    });

    return new Map(donations.map((d) => [d.donorId, d._count.id]));
  }

  private async getActiveUserIds(
    timeRange: LeaderboardTimeRange,
  ): Promise<string[] | undefined> {
    const dateFilter = this.getDateFilter(timeRange);
    if (!dateFilter) return undefined;

    const active = await this.db.xpTransaction.findMany({
      where: { createdAt: dateFilter },
      select: { userId: true },
      distinct: ['userId'],
    });
    return active.map((a) => a.userId);
  }

  private getDateFilter(
    timeRange: LeaderboardTimeRange,
  ): { gte?: Date } | undefined {
    const now = new Date();

    switch (timeRange) {
      case 'THIS_YEAR':
        return { gte: new Date(now.getFullYear(), 0, 1) };
      case 'THIS_MONTH':
        return { gte: new Date(now.getFullYear(), now.getMonth(), 1) };
      case 'ALL_TIME':
      default:
        return undefined;
    }
  }
}
