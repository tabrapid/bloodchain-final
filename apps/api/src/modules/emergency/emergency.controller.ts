import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RoleCode } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { EmergencyService } from './emergency.service';
import {
  CancelEmergencyDto,
  CancelEmergencyResponseDto,
  CompleteEmergencyResponseDto,
  CreateEmergencyDto,
  UpdateEmergencyLocationDto,
} from './dto/emergency.dto';

@ApiTags('Emergency')
@Controller()
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class EmergencyController {
  constructor(private readonly emergency: EmergencyService) {}

  @Post('organizations/:organizationId/emergencies')
  @Roles(RoleCode.HOSPITAL_ADMIN, RoleCode.HOSPITAL_STAFF, RoleCode.SUPER_ADMIN)
  async createEmergency(
    @Param('organizationId') organizationId: string,
    @Body() dto: CreateEmergencyDto,
    @CurrentUser('sub') userId: string,
  ) {
    return { data: await this.emergency.createEmergency(organizationId, userId, dto) };
  }

  @Post('organizations/:organizationId/emergencies/:emergencyId/activate')
  @Roles(RoleCode.HOSPITAL_ADMIN, RoleCode.HOSPITAL_STAFF, RoleCode.SUPER_ADMIN)
  async activateEmergency(
    @Param('organizationId') organizationId: string,
    @Param('emergencyId') emergencyId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return { data: await this.emergency.activateEmergency(organizationId, userId, emergencyId) };
  }

  @Get('organizations/:organizationId/emergencies')
  @Roles(RoleCode.HOSPITAL_ADMIN, RoleCode.HOSPITAL_STAFF, RoleCode.SUPER_ADMIN)
  getEmergencies(
    @Param('organizationId') organizationId: string,
    @CurrentUser('sub') userId: string,
    @Query() filters: { status?: string; urgencyLevel?: string },
  ) {
    return this.emergency.getEmergencies(organizationId, userId, filters);
  }

  @Get('organizations/:organizationId/emergencies/:emergencyId')
  @Roles(RoleCode.HOSPITAL_ADMIN, RoleCode.HOSPITAL_STAFF, RoleCode.SUPER_ADMIN)
  async getEmergency(
    @Param('organizationId') organizationId: string,
    @Param('emergencyId') emergencyId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return { data: await this.emergency.getEmergency(organizationId, userId, emergencyId) };
  }

  @Get('organizations/:organizationId/emergencies/:emergencyId/tracking')
  @Roles(RoleCode.HOSPITAL_ADMIN, RoleCode.HOSPITAL_STAFF, RoleCode.SUPER_ADMIN)
  async getEmergencyTracking(
    @Param('organizationId') organizationId: string,
    @Param('emergencyId') emergencyId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return { data: await this.emergency.getEmergencyTracking(organizationId, userId, emergencyId) };
  }

  @Post('organizations/:organizationId/emergencies/:emergencyId/cancel')
  @Roles(RoleCode.HOSPITAL_ADMIN, RoleCode.HOSPITAL_STAFF, RoleCode.SUPER_ADMIN)
  async cancelEmergency(
    @Param('organizationId') organizationId: string,
    @Param('emergencyId') emergencyId: string,
    @Body() body: CancelEmergencyDto,
    @CurrentUser('sub') userId: string,
  ) {
    return { data: await this.emergency.cancelEmergency(organizationId, userId, emergencyId, body.reason) };
  }

  @Post('organizations/:organizationId/emergency-responses/:responseId/confirm-arrival')
  @Roles(RoleCode.HOSPITAL_ADMIN, RoleCode.HOSPITAL_STAFF, RoleCode.SUPER_ADMIN)
  async confirmArrival(
    @Param('organizationId') organizationId: string,
    @Param('responseId') responseId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return { data: await this.emergency.confirmArrival(organizationId, userId, responseId) };
  }

  @Post('organizations/:organizationId/emergency-responses/:responseId/complete')
  @Roles(RoleCode.HOSPITAL_ADMIN, RoleCode.HOSPITAL_STAFF, RoleCode.SUPER_ADMIN)
  async completeEmergency(
    @Param('organizationId') organizationId: string,
    @Param('responseId') responseId: string,
    @Body() body: CompleteEmergencyResponseDto,
    @CurrentUser('sub') userId: string,
  ) {
    return { data: await this.emergency.completeEmergency(organizationId, userId, responseId, body) };
  }

  @Get('donor/emergencies')
  @Roles(RoleCode.DONOR, RoleCode.SUPER_ADMIN)
  getDonorEmergencies(@CurrentUser('sub') userId: string) {
    return this.emergency.getDonorEmergencies(userId);
  }

  @Post('donor/emergency-matches/:matchId/view')
  @Roles(RoleCode.DONOR, RoleCode.SUPER_ADMIN)
  async viewEmergencyMatch(
    @Param('matchId') matchId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return { data: await this.emergency.viewEmergencyMatch(userId, matchId) };
  }

  @Post('donor/emergency-matches/:matchId/accept')
  @Roles(RoleCode.DONOR, RoleCode.SUPER_ADMIN)
  async acceptEmergency(
    @Param('matchId') matchId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return { data: await this.emergency.acceptEmergency(userId, matchId) };
  }

  @Post('donor/emergency-matches/:matchId/decline')
  @Roles(RoleCode.DONOR, RoleCode.SUPER_ADMIN)
  async declineEmergency(
    @Param('matchId') matchId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return { data: await this.emergency.declineEmergency(userId, matchId) };
  }

  @Post('donor/emergency-responses/:responseId/start-journey')
  @Roles(RoleCode.DONOR, RoleCode.SUPER_ADMIN)
  async startJourney(
    @Param('responseId') responseId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return { data: await this.emergency.startJourney(userId, responseId) };
  }

  @Post('donor/emergency-responses/:responseId/update-location')
  @Roles(RoleCode.DONOR, RoleCode.SUPER_ADMIN)
  async updateLocation(
    @Param('responseId') responseId: string,
    @Body() dto: UpdateEmergencyLocationDto,
    @CurrentUser('sub') userId: string,
  ) {
    return { data: await this.emergency.updateLocation(userId, responseId, dto) };
  }

  @Post('donor/emergency-responses/:responseId/arrive')
  @Roles(RoleCode.DONOR, RoleCode.SUPER_ADMIN)
  async arriveAtHospital(
    @Param('responseId') responseId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return { data: await this.emergency.arriveAtHospital(userId, responseId) };
  }

  @Get('donor/emergency-responses/:responseId/tracking')
  @Roles(RoleCode.DONOR, RoleCode.SUPER_ADMIN)
  async getDonorTracking(
    @Param('responseId') responseId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return { data: await this.emergency.getDonorTracking(userId, responseId) };
  }

  @Post('donor/emergency-responses/:responseId/cancel')
  @Roles(RoleCode.DONOR, RoleCode.SUPER_ADMIN)
  async cancelResponse(
    @Param('responseId') responseId: string,
    @Body() body: CancelEmergencyResponseDto,
    @CurrentUser('sub') userId: string,
  ) {
    return { data: await this.emergency.cancelResponse(userId, responseId, body.reason) };
  }
}
