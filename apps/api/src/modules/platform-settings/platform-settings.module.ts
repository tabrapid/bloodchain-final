import { Global, Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { PlatformSettingsService } from './platform-settings.service';

@Global()
@Module({
  imports: [DatabaseModule, AuditLogsModule],
  providers: [PlatformSettingsService],
  exports: [PlatformSettingsService],
})
export class PlatformSettingsModule {}
