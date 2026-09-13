import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { EmailModule } from '../email/email.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { SmsModule } from '../sms/sms.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PhoneVerificationService } from './phone-verification.service';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [PassportModule, AuditLogsModule, PermissionsModule, EmailModule, SmsModule],
  controllers: [AuthController],
  providers: [AuthService, PhoneVerificationService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
