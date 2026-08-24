import { Module, forwardRef } from '@nestjs/common';
import { GamificationService } from './gamification.service';
import { GamificationController, LeaderboardController } from './gamification.controller';
import { XpService } from './services/xp.service';
import { LevelService } from './services/level.service';
import { AchievementService } from './services/achievement.service';
import { BadgeService } from './services/badge.service';
import { LeaderboardService } from './services/leaderboard.service';
import { ReputationService } from './services/reputation.service';
import { AntiAbuseService } from './services/anti-abuse.service';
import { GamificationEventHandler } from './events/gamification-event.handler';

@Module({
  imports: [],
  controllers: [GamificationController, LeaderboardController],
  providers: [
    GamificationService,
    XpService,
    LevelService,
    AchievementService,
    BadgeService,
    LeaderboardService,
    ReputationService,
    AntiAbuseService,
    GamificationEventHandler,
  ],
  exports: [
    GamificationService,
    XpService,
    LevelService,
    AchievementService,
    BadgeService,
    LeaderboardService,
    ReputationService,
    AntiAbuseService,
    GamificationEventHandler,
  ],
})
export class GamificationModule {}
