import { Module } from '@nestjs/common';
import { AICacheService } from './ai-cache.service';

@Module({
  providers: [AICacheService],
  exports: [AICacheService],
})
export class AICacheModule {}
