import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../database/prisma.service';
import { XpService } from './services/xp.service';
import { LevelService } from './services/level.service';
import { AchievementService } from './services/achievement.service';
import { BadgeService } from './services/badge.service';
import { LeaderboardService } from './services/leaderboard.service';
import { ReputationService } from './services/reputation.service';
import { AntiAbuseService } from './services/anti-abuse.service';
import { GamificationService } from './gamification.service';

describe('GamificationService.processChallengeCompleted', () => {
  let service: GamificationService;
  let xpService: { awardXp: jest.Mock };
  let levelService: { updateUserLevel: jest.Mock };

  beforeEach(async () => {
    xpService = { awardXp: jest.fn() };
    levelService = { updateUserLevel: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GamificationService,
        { provide: PrismaService, useValue: {} },
        { provide: XpService, useValue: xpService },
        { provide: LevelService, useValue: levelService },
        { provide: AchievementService, useValue: {} },
        { provide: BadgeService, useValue: {} },
        { provide: LeaderboardService, useValue: {} },
        { provide: ReputationService, useValue: {} },
        { provide: AntiAbuseService, useValue: {} },
      ],
    }).compile();

    service = module.get<GamificationService>(GamificationService);
  });

  it('awards XP and updates the level when the reward has not been claimed before', async () => {
    xpService.awardXp.mockResolvedValue({ success: true, newTotal: 250, transactionId: 'tx-1' });

    const result = await service.processChallengeCompleted('user-1', 'chal-1', 50, 'Donate 5 times');

    expect(xpService.awardXp).toHaveBeenCalledWith(
      'user-1',
      50,
      'CHALLENGE_COMPLETED',
      'CHALLENGE',
      'chal-1',
      'Challenge completed: Donate 5 times',
    );
    expect(levelService.updateUserLevel).toHaveBeenCalledWith('user-1', 250);
    expect(result).toEqual({ xpAwarded: true, xpAmount: 50, newTotalXp: 250 });
  });

  it('is idempotent: does not award twice or touch the level for an already-claimed reward', async () => {
    xpService.awardXp.mockResolvedValue({ success: false, newTotal: 0, transactionId: 'tx-existing' });

    const result = await service.processChallengeCompleted('user-1', 'chal-1', 50, 'Donate 5 times');

    expect(levelService.updateUserLevel).not.toHaveBeenCalled();
    expect(result).toEqual({ xpAwarded: false, xpAmount: 0, newTotalXp: 0 });
  });

  it('skips awarding anything for a challenge with no XP reward', async () => {
    const result = await service.processChallengeCompleted('user-1', 'chal-1', 0, 'No-reward challenge');

    expect(xpService.awardXp).not.toHaveBeenCalled();
    expect(result).toEqual({ xpAwarded: false, xpAmount: 0, newTotalXp: 0 });
  });
});
