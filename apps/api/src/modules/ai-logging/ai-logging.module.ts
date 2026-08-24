import { Module } from '@nestjs/common';
import { AIRequestLogService } from './ai-logging.service';

@Module({
  providers: [AIRequestLogService],
  exports: [AIRequestLogService],
})
export class AILoggingModule {}
