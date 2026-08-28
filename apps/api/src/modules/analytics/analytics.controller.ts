import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RoleCode } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AnalyticsService } from './services/analytics.service';
import { AnalyticsFilterDto } from './dto/analytics.dto';

@ApiTags('Analytics')
@Controller('organizations/:organizationId/analytics')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('overview')
  @Roles(
    RoleCode.SUPER_ADMIN,
    RoleCode.HOSPITAL_ADMIN,
    RoleCode.HOSPITAL_STAFF,
    RoleCode.BLOOD_CENTER_ADMIN,
    RoleCode.BLOOD_CENTER_STAFF,
  )
  getOverview(
    @Param('organizationId') organizationId: string,
    @CurrentUser('sub') userId: string,
    @Query() filters: AnalyticsFilterDto,
  ) {
    return this.analytics.getOverview(organizationId, userId, filters);
  }

  @Get('inventory')
  @Roles(
    RoleCode.SUPER_ADMIN,
    RoleCode.HOSPITAL_ADMIN,
    RoleCode.HOSPITAL_STAFF,
    RoleCode.BLOOD_CENTER_ADMIN,
    RoleCode.BLOOD_CENTER_STAFF,
  )
  getInventoryAnalytics(
    @Param('organizationId') organizationId: string,
    @CurrentUser('sub') userId: string,
    @Query() filters: AnalyticsFilterDto,
  ) {
    return this.analytics.getInventoryAnalytics(organizationId, userId, filters);
  }

  @Get('donations')
  @Roles(
    RoleCode.SUPER_ADMIN,
    RoleCode.HOSPITAL_ADMIN,
    RoleCode.HOSPITAL_STAFF,
    RoleCode.BLOOD_CENTER_ADMIN,
    RoleCode.BLOOD_CENTER_STAFF,
  )
  getDonationAnalytics(
    @Param('organizationId') organizationId: string,
    @CurrentUser('sub') userId: string,
    @Query() filters: AnalyticsFilterDto,
  ) {
    return this.analytics.getDonationAnalytics(organizationId, userId, filters);
  }

  @Get('emergencies')
  @Roles(
    RoleCode.SUPER_ADMIN,
    RoleCode.HOSPITAL_ADMIN,
    RoleCode.HOSPITAL_STAFF,
    RoleCode.BLOOD_CENTER_ADMIN,
    RoleCode.BLOOD_CENTER_STAFF,
  )
  getEmergencyAnalytics(
    @Param('organizationId') organizationId: string,
    @CurrentUser('sub') userId: string,
    @Query() filters: AnalyticsFilterDto,
  ) {
    return this.analytics.getEmergencyAnalytics(organizationId, userId, filters);
  }

  @Get('requests')
  @Roles(
    RoleCode.SUPER_ADMIN,
    RoleCode.HOSPITAL_ADMIN,
    RoleCode.HOSPITAL_STAFF,
    RoleCode.BLOOD_CENTER_ADMIN,
    RoleCode.BLOOD_CENTER_STAFF,
  )
  getRequestAnalytics(
    @Param('organizationId') organizationId: string,
    @CurrentUser('sub') userId: string,
    @Query() filters: AnalyticsFilterDto,
  ) {
    return this.analytics.getRequestAnalytics(organizationId, userId, filters);
  }

  @Get('appointments')
  @Roles(
    RoleCode.SUPER_ADMIN,
    RoleCode.HOSPITAL_ADMIN,
    RoleCode.HOSPITAL_STAFF,
    RoleCode.BLOOD_CENTER_ADMIN,
    RoleCode.BLOOD_CENTER_STAFF,
  )
  getAppointmentAnalytics(
    @Param('organizationId') organizationId: string,
    @CurrentUser('sub') userId: string,
    @Query() filters: AnalyticsFilterDto,
  ) {
    return this.analytics.getAppointmentAnalytics(organizationId, userId, filters);
  }

  @Get('laboratory')
  @Roles(
    RoleCode.SUPER_ADMIN,
    RoleCode.HOSPITAL_ADMIN,
    RoleCode.HOSPITAL_STAFF,
    RoleCode.BLOOD_CENTER_ADMIN,
    RoleCode.BLOOD_CENTER_STAFF,
    RoleCode.LAB_TECHNICIAN,
    RoleCode.LAB_REVIEWER,
    RoleCode.LAB_ADMIN,
  )
  getLaboratoryAnalytics(
    @Param('organizationId') organizationId: string,
    @CurrentUser('sub') userId: string,
    @Query() filters: AnalyticsFilterDto,
  ) {
    return this.analytics.getLaboratoryAnalytics(organizationId, userId, filters);
  }

  @Get('shipments')
  @Roles(
    RoleCode.SUPER_ADMIN,
    RoleCode.HOSPITAL_ADMIN,
    RoleCode.HOSPITAL_STAFF,
    RoleCode.BLOOD_CENTER_ADMIN,
    RoleCode.BLOOD_CENTER_STAFF,
    RoleCode.COURIER,
  )
  getShipmentAnalytics(
    @Param('organizationId') organizationId: string,
    @CurrentUser('sub') userId: string,
    @Query() filters: AnalyticsFilterDto,
  ) {
    return this.analytics.getShipmentAnalytics(organizationId, userId, filters);
  }

  @Get('activity')
  @Roles(
    RoleCode.SUPER_ADMIN,
    RoleCode.HOSPITAL_ADMIN,
    RoleCode.HOSPITAL_STAFF,
    RoleCode.BLOOD_CENTER_ADMIN,
    RoleCode.BLOOD_CENTER_STAFF,
  )
  getActivityFeed(
    @Param('organizationId') organizationId: string,
    @CurrentUser('sub') userId: string,
    @Query() filters: { limit?: number; offset?: number },
  ) {
    return this.analytics.getActivityFeed(organizationId, userId, filters);
  }

  @Get('alerts')
  @Roles(
    RoleCode.SUPER_ADMIN,
    RoleCode.HOSPITAL_ADMIN,
    RoleCode.HOSPITAL_STAFF,
    RoleCode.BLOOD_CENTER_ADMIN,
    RoleCode.BLOOD_CENTER_STAFF,
  )
  getAlerts(
    @Param('organizationId') organizationId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.analytics.getAlerts(organizationId, userId);
  }
}
