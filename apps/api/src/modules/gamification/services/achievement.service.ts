import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../database/prisma.service';
import {
  ACHIEVEMENT_UNLOCKED_EVENT,
  type AchievementUnlockedPayload,
} from '../../notifications/operational-notification.events';
import { ACHIEVEMENT_DEFINITIONS } from '../config/gamification.config';
import { AchievementType } from '@prisma/client';
import { AchievementDto, AchievementListDto } from '../dto/gamification.dto';

@Injectable()
export class AchievementService {
  constructor(
    private readonly db: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async seedAchievements(): Promise<void> {
    for (const def of ACHIEVEMENT_DEFINITIONS) {
      await this.db.achievement.upsert({
        where: { code: def.code },
        create: {
          code: def.code,
          type: def.type,
          name: def.name,
          description: def.description,
          icon: def.icon,
          rarity: def.rarity,
          criteria: def.criteria,
          xpReward: def.xpReward,
          displayOrder: def.displayOrder,
        },
        update: {
          name: def.name,
          description: def.description,
          icon: def.icon,
          rarity: def.rarity,
          criteria: def.criteria,
          xpReward: def.xpReward,
        },
      });
    }
  }

  async getAllAchievements(): Promise<any[]> {
    return this.db.achievement.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
    });
  }

  async getUserAchievements(userId: string): Promise<AchievementListDto> {
    const [unlocked, allAchievements] = await Promise.all([
      this.db.achievementUnlock.findMany({
        where: { userId },
        include: { achievement: true },
        orderBy: { unlockedAt: 'desc' },
      }),
      this.db.achievement.findMany({
        where: { isActive: true },
        orderBy: { displayOrder: 'asc' },
      }),
    ]);

    const unlockedMap = new Map(
      unlocked.map((u) => [u.achievementId, u]),
    );

    const unlockedList: AchievementDto[] = [];
    const inProgressList: AchievementDto[] = [];
    const lockedList: AchievementDto[] = [];

    for (const achievement of allAchievements) {
      const unlock = unlockedMap.get(achievement.id);
      const criteria = achievement.criteria as any;

      if (unlock) {
        unlockedList.push(this.toDto(achievement, unlock.progress, unlock.unlockedAt, 'UNLOCKED'));
      } else {
        const progress = await this.calculateProgress(userId, criteria);
        if (progress > 0 && progress < (criteria.target || 1)) {
          inProgressList.push(this.toDto(achievement, progress, undefined, 'IN_PROGRESS'));
        } else {
          lockedList.push(this.toDto(achievement, 0, undefined, 'LOCKED'));
        }
      }
    }

    return { unlocked: unlockedList, inProgress: inProgressList, locked: lockedList };
  }

  private async isInProgress(achievement: any, userId: string, criteria: any): Promise<boolean> {
    if (criteria.type === 'DONATION_COUNT') {
      const count = await this.getDonationCount(userId);
      return count > 0 && count < criteria.target;
    }
    if (criteria.type === 'EMERGENCY_RESPONSE_COUNT') {
      const count = await this.getEmergencyResponseCount(userId);
      return count > 0 && count < criteria.target;
    }
    if (criteria.type === 'BLOOD_TEST_COUNT') {
      const count = await this.getBloodTestCount(userId);
      return count > 0 && count < criteria.target;
    }
    if (criteria.type === 'XP_MILESTONE') {
      const profile = await this.db.gamificationProfile.findUnique({ where: { userId } });
      const xp = profile?.totalXp || 0;
      return xp > 0 && xp < criteria.target;
    }
    return false;
  }

  private async calculateProgress(userId: string, criteria: any): Promise<number> {
    if (criteria.type === 'DONATION_COUNT') {
      return this.getDonationCount(userId);
    }
    if (criteria.type === 'EMERGENCY_RESPONSE_COUNT') {
      return this.getEmergencyResponseCount(userId);
    }
    if (criteria.type === 'BLOOD_TEST_COUNT') {
      return this.getBloodTestCount(userId);
    }
    if (criteria.type === 'XP_MILESTONE') {
      const profile = await this.db.gamificationProfile.findUnique({ where: { userId } });
      return profile?.totalXp || 0;
    }
    return 0;
  }

  private async getDonationCount(userId: string): Promise<number> {
    return this.db.donation.count({
      where: { donorId: userId, status: 'COMPLETED' },
    });
  }

  private async getEmergencyResponseCount(userId: string): Promise<number> {
    return this.db.emergencyResponse.count({
      where: { donorId: userId, status: 'COMPLETED' },
    });
  }

  private async getBloodTestCount(userId: string): Promise<number> {
    return this.db.laboratoryResult.count({
      where: { donorId: userId, status: 'PUBLISHED' },
    });
  }

  async checkAndUnlockAchievements(
    userId: string,
    type: AchievementType,
    sourceId?: string,
  ): Promise<{ unlocked: any[]; xpAwarded: number }> {
    const achievements = await this.db.achievement.findMany({
      where: { type, isActive: true },
    });

    const unlocked: any[] = [];
    let totalXpAwarded = 0;

    for (const achievement of achievements) {
      const criteria = achievement.criteria as any;
      const alreadyUnlocked = await this.db.achievementUnlock.findUnique({
        where: { userId_achievementId: { userId, achievementId: achievement.id } },
      });

      if (alreadyUnlocked) continue;

      const currentCount = await this.calculateProgress(userId, criteria);

      if (currentCount >= criteria.target) {
        await this.db.achievementUnlock.create({
          data: {
            userId,
            achievementId: achievement.id,
            progress: currentCount,
            target: criteria.target,
          },
        });

        // Announce it here rather than at each call site: the unique constraint
        // on (userId, achievementId) plus the `alreadyUnlocked` guard above mean
        // this line runs exactly once per achievement per person, which is the
        // idempotency the notification needs. No unlock rule changes -- the
        // event follows the row that was just written.
        const unlockedPayload: AchievementUnlockedPayload = {
          achievementId: achievement.id,
          achievementName: achievement.name,
          userId,
        };
        this.eventEmitter.emit(ACHIEVEMENT_UNLOCKED_EVENT, unlockedPayload);

        unlocked.push(achievement);
        totalXpAwarded += achievement.xpReward;
      }
    }

    return { unlocked, xpAwarded: totalXpAwarded };
  }

  async getDonationAchievementProgress(userId: string): Promise<Map<string, number>> {
    const achievements = await this.db.achievement.findMany({
      where: { type: AchievementType.DONATION_COUNT, isActive: true },
    });

    const count = await this.getDonationCount(userId);
    const progress = new Map<string, number>();

    for (const achievement of achievements) {
      const criteria = achievement.criteria as any;
      progress.set(achievement.code, Math.min(count, criteria.target));
    }

    return progress;
  }

  async getXpMilestoneProgress(userId: string): Promise<Map<string, number>> {
    const achievements = await this.db.achievement.findMany({
      where: { type: AchievementType.XP_MILESTONE, isActive: true },
    });

    const profile = await this.db.gamificationProfile.findUnique({ where: { userId } });
    const xp = profile?.totalXp || 0;
    const progress = new Map<string, number>();

    for (const achievement of achievements) {
      const criteria = achievement.criteria as any;
      progress.set(achievement.code, Math.min(xp, criteria.target));
    }

    return progress;
  }

  private toDto(achievement: any, progress: number, unlockedAt?: Date, status?: string): AchievementDto {
    const criteria = achievement.criteria as any;
    return {
      id: achievement.id,
      code: achievement.code,
      name: achievement.name,
      description: achievement.description,
      icon: achievement.icon,
      rarity: achievement.rarity,
      xpReward: achievement.xpReward,
      progress: progress,
      target: criteria.target || 1,
      status: status || (progress >= (criteria.target || 1) ? 'UNLOCKED' : 'LOCKED'),
      unlockedAt,
    };
  }
}
