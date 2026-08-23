import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { LEVEL_CONFIG, LEVEL_NAMES } from '../config/gamification.config';
import { LevelProgressDto } from '../dto/gamification.dto';

@Injectable()
export class LevelService {
  constructor(private readonly db: PrismaService) {}

  calculateLevelFromXp(xp: number): number {
    const thresholds = LEVEL_CONFIG.XP_THRESHOLDS;

    for (let i = thresholds.length - 1; i >= 0; i--) {
      if (xp >= thresholds[i]!) {
        return i + 1;
      }
    }

    return 1;
  }

  calculateXpForLevel(level: number): number {
    if (level <= 1) return 0;
    if (level > LEVEL_CONFIG.MAX_LEVEL) {
      return LEVEL_CONFIG.XP_THRESHOLDS[LEVEL_CONFIG.MAX_LEVEL - 1]!;
    }
    return LEVEL_CONFIG.XP_THRESHOLDS[level - 1]!;
  }

  calculateXpToNextLevel(currentXp: number, currentLevel: number): number {
    if (currentLevel >= LEVEL_CONFIG.MAX_LEVEL) {
      return 0;
    }

    const nextLevelXp = this.calculateXpForLevel(currentLevel + 1);
    return Math.max(0, nextLevelXp - currentXp);
  }

  calculateProgress(currentXp: number, currentLevel: number): number {
    if (currentLevel >= LEVEL_CONFIG.MAX_LEVEL) {
      return 100;
    }

    const currentLevelXp = this.calculateXpForLevel(currentLevel);
    const nextLevelXp = this.calculateXpForLevel(currentLevel + 1);

    const xpInCurrentLevel = currentXp - currentLevelXp;
    const xpNeededForLevel = nextLevelXp - currentLevelXp;

    if (xpNeededForLevel <= 0) return 100;

    return Math.min(100, Math.round((xpInCurrentLevel / xpNeededForLevel) * 100));
  }

  async updateUserLevel(userId: string, xp: number): Promise<{ previousLevel: number; newLevel: number; leveledUp: boolean }> {
    const profile = await this.db.gamificationProfile.findUnique({
      where: { userId },
    });

    const previousLevel = profile?.level || 1;
    const newLevel = this.calculateLevelFromXp(xp);
    const leveledUp = newLevel > previousLevel;

    if (leveledUp) {
      await this.db.gamificationProfile.update({
        where: { userId },
        data: { level: newLevel },
      });
    }

    return { previousLevel, newLevel, leveledUp };
  }

  async getLevelProgress(userId: string): Promise<LevelProgressDto> {
    const profile = await this.db.gamificationProfile.findUnique({
      where: { userId },
    });

    const totalXp = profile?.totalXp || 0;
    const currentLevel = profile?.level || this.calculateLevelFromXp(totalXp);

    const currentLevelXp = this.calculateXpForLevel(currentLevel);
    const nextLevelXp = this.calculateXpForLevel(currentLevel + 1);
    const xpToNextLevel = this.calculateXpToNextLevel(totalXp, currentLevel);
    const progress = this.calculateProgress(totalXp, currentLevel);
    const isMaxLevel = currentLevel >= LEVEL_CONFIG.MAX_LEVEL;

    return {
      currentLevel,
      currentLevelName: LEVEL_NAMES[currentLevel] || 'Unknown',
      currentXp: totalXp,
      xpForNextLevel: isMaxLevel ? totalXp : nextLevelXp,
      xpToNextLevel,
      progress,
      nextLevelName: isMaxLevel ? LEVEL_NAMES[currentLevel]! : LEVEL_NAMES[currentLevel + 1] || 'Unknown',
      isMaxLevel,
    };
  }

  async syncUserLevel(userId: string): Promise<{ level: number; totalXp: number }> {
    const profile = await this.db.gamificationProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      return { level: 1, totalXp: 0 };
    }

    const calculatedLevel = this.calculateLevelFromXp(profile.totalXp);

    if (calculatedLevel !== profile.level) {
      await this.db.gamificationProfile.update({
        where: { userId },
        data: { level: calculatedLevel },
      });
      return { level: calculatedLevel, totalXp: profile.totalXp };
    }

    return { level: profile.level, totalXp: profile.totalXp };
  }

  getLevelName(level: number): string {
    return LEVEL_NAMES[level] || 'Unknown';
  }

  getMaxLevel(): number {
    return LEVEL_CONFIG.MAX_LEVEL;
  }
}
