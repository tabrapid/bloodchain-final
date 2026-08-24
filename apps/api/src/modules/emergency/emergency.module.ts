import { Module } from '@nestjs/common';
import { EmergencyController } from './emergency.controller';
import { EmergencyService } from './emergency.service';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { EmergencyGateway } from '../../gateways/emergency.gateway';

@Module({
  imports: [AuditLogsModule],
  controllers: [EmergencyController],
  providers: [EmergencyService, EmergencyGateway],
  exports: [EmergencyService],
})
export class EmergencyModule {}