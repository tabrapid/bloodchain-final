import { Module } from '@nestjs/common';
import { HealthTrendsController } from './health-trends.controller';
import { HealthTrendsService } from './health-trends.service';

@Module({
  controllers: [HealthTrendsController],
  providers: [HealthTrendsService],
  exports: [HealthTrendsService],
})
export class HealthTrendsModule {}
