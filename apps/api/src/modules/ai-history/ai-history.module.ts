import { Module } from '@nestjs/common';
import { AIInsightHistoryService } from './ai-history.service';

@Module({
  providers: [AIInsightHistoryService],
  exports: [AIInsightHistoryService],
})
export class AIHistoryModule {}
