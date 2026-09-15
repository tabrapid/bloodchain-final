import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { envValidationSchema } from './config/env.validation';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { OrganizationGuard } from './common/guards/organization.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { DatabaseModule } from './database/database.module';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';
import { AdminModule } from './modules/admin/admin.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { AppointmentSlotsModule } from './modules/appointment-slots/appointment-slots.module';
import { AuthModule } from './modules/auth/auth.module';
import { SmsModule } from './modules/sms/sms.module';
import { DonationsModule } from './modules/donations/donations.module';
import { DonorsModule } from './modules/donors/donors.module';
import { EmergencyModule } from './modules/emergency/emergency.module';
import { HealthModule } from './modules/health/health.module';
import { HealthTrendsModule } from './modules/health-trends/health-trends.module';
import { AIHealthModule } from './modules/ai-health/ai-health.module';
import { AIHistoryModule } from './modules/ai-history/ai-history.module';
import { AILoggingModule } from './modules/ai-logging/ai-logging.module';
import { AICacheModule } from './modules/ai-cache/ai-cache.module';
import { GamificationModule } from './modules/gamification/gamification.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { LaboratoryModule } from './modules/laboratory/laboratory.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { GeographyModule } from './modules/geography/geography.module';
import { PermissionsModule } from './modules/permissions/permissions.module';
import { PlatformSettingsModule } from './modules/platform-settings/platform-settings.module';
import { ShipmentsModule } from './modules/shipments/shipments.module';
import { UsersModule } from './modules/users/users.module';
import { CourierModule } from './modules/courier/courier.module';
import { CommunityModule } from './modules/community/community.module';
import { CampaignsModule } from './modules/campaigns/campaigns.module';
import { ChallengesModule } from './modules/challenges/challenges.module';
import { EducationModule } from './modules/education/education.module';
import { IdempotencyModule } from './modules/idempotency/idempotency.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
      validationOptions: { abortEarly: false },
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        transport: process.env.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined,
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'req.body.password',
            'req.body.refreshToken',
            'req.body.currentPassword',
            'req.body.newPassword',
          ],
          remove: true,
        },
      },
    }),
    ThrottlerModule.forRootAsync({
      useFactory: () => ({
        throttlers: [
          {
            ttl: Number(process.env.THROTTLER_TTL ?? 60) * 1000,
            limit: Number(process.env.THROTTLER_LIMIT ?? 100),
          },
        ],
      }),
    }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    JwtModule.register({
      global: true,
      secret: process.env.JWT_ACCESS_SECRET ?? 'development-only-secret',
    }),
    DatabaseModule,
    AuditLogsModule,
    PlatformSettingsModule,
    AdminModule,
    SmsModule,
    AuthModule,
    UsersModule,
    OrganizationsModule,
    GeographyModule,
    DonorsModule,
    HealthModule,
    PermissionsModule,
    NotificationsModule,
    AppointmentSlotsModule,
    AppointmentsModule,
    DonationsModule,
    InventoryModule,
    ShipmentsModule,
    EmergencyModule,
    LaboratoryModule,
    HealthTrendsModule,
    AIHealthModule,
    AIHistoryModule,
    AILoggingModule,
    AICacheModule,
    GamificationModule,
    AnalyticsModule,
    IdempotencyModule,
    CourierModule,
    CommunityModule,
    CampaignsModule,
    ChallengesModule,
    EducationModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
    {
      provide: APP_GUARD,
      useClass: OrganizationGuard,
    },
  ],
})
export class AppModule {}
