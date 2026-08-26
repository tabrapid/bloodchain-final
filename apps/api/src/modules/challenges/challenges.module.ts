import { Module } from '@nestjs/common';
import { ChallengesController } from './challenges.controller';
import { ChallengesService } from './challenges.service';
import { ChallengeProgressEventHandler } from './events/challenge-progress-event.handler';

@Module({
  controllers: [ChallengesController],
  providers: [ChallengesService, ChallengeProgressEventHandler],
  exports: [ChallengesService],
})
export class ChallengesModule {}
