import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { BADGE_DEFINITIONS } from '../config/gamification.config';
import { BadgeDto } from '../dto/gamification.dto';

@Injectable()
export class BadgeService {
  constructor(private readonly db: PrismaService) {}

  async seedBadges(): Promise<void> {
    for (const def of BADGE_DEFINITIONS) {
      let achievementId: string | undefined;

      if (def.achievementCode) {
        const achievement = await this.db.achievement.findUnique({
          where: { code: def.achievementCode },
        });
        achievementId = achievement?.id;
      }

      await this.db.badge.upsert({
        where: { code: def.code },
        create: {
          code: def.code,
          name: def.name,
          description: def.description,
          icon: def.icon,
          rarity: def.rarity,
          achievementId,
          displayOrder: def.displayOrder,
        },
        update: {
          name: def.name,
          description: def.description,
          icon: def.icon,
          rarity: def.rarity,
          achievementId,
        },
      });
    }
  }

  async getAllBadges(): Promise<BadgeDto[]> {
    const badges = await this.db.badge.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
    });

    return badges.map((badge) => this.toDto(badge));
  }

  async getUserBadges(userId: string): Promise<BadgeDto[]> {
    const [userBadges, allBadges] = await Promise.all([
      this.db.userBadge.findMany({
        where: { userId },
        include: { badge: true },
        orderBy: { earnedAt: 'desc' },
      }),
      this.db.badge.findMany({
        where: { isActive: true },
        orderBy: { displayOrder: 'asc' },
      }),
    ]);

    const earnedMap = new Map(
      userBadges.map((ub) => [ub.badgeId, ub.earnedAt]),
    );

    return allBadges.map((badge) => ({
      id: badge.id,
      code: badge.code,
      name: badge.name,
      description: badge.description,
      icon: badge.icon,
      rarity: badge.rarity,
      earnedAt: earnedMap.get(badge.id),
    }));
  }

  async awardBadge(userId: string, badgeCode: string): Promise<{ success: boolean; badge?: BadgeDto }> {
    const badge = await this.db.badge.findUnique({
      where: { code: badgeCode },
    });

    if (!badge) {
      return { success: false };
    }

    const existing = await this.db.userBadge.findUnique({
      where: { userId_badgeId: { userId, badgeId: badge.id } },
    });

    if (existing) {
      return { success: false };
    }

    await this.db.userBadge.create({
      data: { userId, badgeId: badge.id },
    });

    return { success: true, badge: this.toDto(badge, new Date()) };
  }

  async awardBadgeForAchievement(userId: string, achievementCode: string): Promise<{ success: boolean }> {
    const badge = await this.db.badge.findFirst({
      where: {
        achievement: { code: achievementCode },
        isActive: true,
      },
    });

    if (!badge) {
      return { success: false };
    }

    const existing = await this.db.userBadge.findUnique({
      where: { userId_badgeId: { userId, badgeId: badge.id } },
    });

    if (existing) {
      return { success: false };
    }

    await this.db.userBadge.create({
      data: { userId, badgeId: badge.id },
    });

    return { success: true };
  }

  async awardMaxLevelBadge(userId: string): Promise<{ success: boolean }> {
    return this.awardBadge(userId, 'PLATINUM_BADGE');
  }

  private toDto(badge: any, earnedAt?: Date): BadgeDto {
    return {
      id: badge.id,
      code: badge.code,
      name: badge.name,
      description: badge.description,
      icon: badge.icon,
      rarity: badge.rarity,
      earnedAt,
    };
  }
}
