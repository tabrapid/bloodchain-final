import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { envValidationSchema } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { AppointmentSlotsModule } from './modules/appointment-slots/appointment-slots.module';
import { AuthModule } from './modules/auth/auth.module';
import { DonationsModule } from './modules/donations/donations.module';
import { DonorsModule } from './modules/donors/donors.module';
import { EmergencyModule } from './modules/emergency/emergency.module';
import { HealthModule } from './modules/health/health.module';
import { HealthTrendsModule } from './modules/health-trends/health-trends.module';
import { AIHealthModule } from './modules/ai-health/ai-health.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { LaboratoryModule } from './modules/laboratory/laboratory.module';
import { NotificationPreferencesModule } from './modules/notification-preferences/notification-preferences.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { PermissionsModule } from './modules/permissions/permissions.module';
import { ShipmentsModule } from './modules/shipments/shipments.module';
import { UsersModule } from './modules/users/users.module';

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
    JwtModule.register({
      global: true,
      secret: process.env.JWT_ACCESS_SECRET ?? 'development-only-secret',
    }),
    DatabaseModule,
    AuditLogsModule,
    AuthModule,
    UsersModule,
    OrganizationsModule,
    DonorsModule,
    HealthModule,
    PermissionsModule,
    NotificationPreferencesModule,
    AppointmentsModule,
    AppointmentSlotsModule,
    DonationsModule,
    InventoryModule,
    ShipmentsModule,
    EmergencyModule,
    LaboratoryModule,
    HealthTrendsModule,
    AIHealthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
