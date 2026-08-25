import { Module } from '@nestjs/common';
import { EmergencyController } from './emergency.controller';
import { EmergencyService } from './emergency.service';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { EmergencyGateway } from '../../gateways/emergency.gateway';
import { DonationEligibilityModule } from '../donation-eligibility/donation-eligibility.module';

@Module({
  imports: [AuditLogsModule, DonationEligibilityModule],
  controllers: [EmergencyController],
  providers: [EmergencyService, EmergencyGateway],
  exports: [EmergencyService],
})
export class EmergencyModule {}