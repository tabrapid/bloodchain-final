import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { BloodType, RhFactor, RoleCode } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { EmergencyService } from './emergency.service';

@ApiTags('Emergency')
@Controller()
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class EmergencyController {
  constructor(private readonly emergency: EmergencyService) {}

  @Post('organizations/:organizationId/emergencies')
  @Roles(RoleCode.HOSPITAL_ADMIN, RoleCode.HOSPITAL_STAFF, RoleCode.SUPER_ADMIN)
  createEmergency(
    @Param('organizationId') organizationId: string,
    @Body() dto: {
      bloodType: string;
      rhFactor: string;
      unitsRequired: number;
      urgencyLevel?: string;
      patientReference?: string;
      description?: string;
      requiredBefore?: string;
      donationLocation?: string;
      latitude?: number;
      longitude?: number;
    },
    @CurrentUser('sub') userId: string,
  ) {
    return this.emergency.createEmergency(organizationId, userId, dto);
  }

  @Post('organizations/:organizationId/emergencies/:emergencyId/activate')
  @Roles(RoleCode.HOSPITAL_ADMIN, RoleCode.HOSPITAL_STAFF, RoleCode.SUPER_ADMIN)
  activateEmergency(
    @Param('organizationId') organizationId: string,
    @Param('emergencyId') emergencyId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.emergency.activateEmergency(organizationId, userId, emergencyId);
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
  getEmergency(
    @Param('organizationId') organizationId: string,
    @Param('emergencyId') emergencyId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.emergency.getEmergency(organizationId, userId, emergencyId);
  }

  @Get('organizations/:organizationId/emergencies/:emergencyId/tracking')
  @Roles(RoleCode.HOSPITAL_ADMIN, RoleCode.HOSPITAL_STAFF, RoleCode.SUPER_ADMIN)
  getEmergencyTracking(
    @Param('organizationId') organizationId: string,
    @Param('emergencyId') emergencyId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.emergency.getEmergencyTracking(organizationId, userId, emergencyId);
  }

  @Post('organizations/:organizationId/emergencies/:emergencyId/cancel')
  @Roles(RoleCode.HOSPITAL_ADMIN, RoleCode.HOSPITAL_STAFF, RoleCode.SUPER_ADMIN)
  cancelEmergency(
    @Param('organizationId') organizationId: string,
    @Param('emergencyId') emergencyId: string,
    @Body() body: { reason?: string },
    @CurrentUser('sub') userId: string,
  ) {
    return this.emergency.cancelEmergency(organizationId, userId, emergencyId, body.reason);
  }

  @Post('organizations/:organizationId/emergency-responses/:responseId/confirm-arrival')
  @Roles(RoleCode.HOSPITAL_ADMIN, RoleCode.HOSPITAL_STAFF, RoleCode.SUPER_ADMIN)
  confirmArrival(
    @Param('organizationId') organizationId: string,
    @Param('responseId') responseId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.emergency.confirmArrival(organizationId, userId, responseId);
  }

  @Post('organizations/:organizationId/emergency-responses/:responseId/complete')
  @Roles(RoleCode.HOSPITAL_ADMIN, RoleCode.HOSPITAL_STAFF, RoleCode.SUPER_ADMIN)
  completeEmergency(
    @Param('organizationId') organizationId: string,
    @Param('responseId') responseId: string,
    @Body() body: { bloodType?: BloodType; rhFactor?: RhFactor; volumeMl?: number },
    @CurrentUser('sub') userId: string,
  ) {
    return this.emergency.completeEmergency(organizationId, userId, responseId, body);
  }

  @Get('donor/emergencies')
  @Roles(RoleCode.DONOR, RoleCode.SUPER_ADMIN)
  getDonorEmergencies(@CurrentUser('sub') userId: string) {
    return this.emergency.getDonorEmergencies(userId);
  }

  @Post('donor/emergency-matches/:matchId/view')
  @Roles(RoleCode.DONOR, RoleCode.SUPER_ADMIN)
  viewEmergencyMatch(
    @Param('matchId') matchId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.emergency.viewEmergencyMatch(userId, matchId);
  }

  @Post('donor/emergency-matches/:matchId/accept')
  @Roles(RoleCode.DONOR, RoleCode.SUPER_ADMIN)
  acceptEmergency(
    @Param('matchId') matchId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.emergency.acceptEmergency(userId, matchId);
  }

  @Post('donor/emergency-matches/:matchId/decline')
  @Roles(RoleCode.DONOR, RoleCode.SUPER_ADMIN)
  declineEmergency(
    @Param('matchId') matchId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.emergency.declineEmergency(userId, matchId);
  }

  @Post('donor/emergency-responses/:responseId/start-journey')
  @Roles(RoleCode.DONOR, RoleCode.SUPER_ADMIN)
  startJourney(
    @Param('responseId') responseId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.emergency.startJourney(userId, responseId);
  }

  @Post('donor/emergency-responses/:responseId/update-location')
  @Roles(RoleCode.DONOR, RoleCode.SUPER_ADMIN)
  updateLocation(
    @Param('responseId') responseId: string,
    @Body() dto: { latitude: number; longitude: number; accuracy?: number; heading?: number; speed?: number },
    @CurrentUser('sub') userId: string,
  ) {
    return this.emergency.updateLocation(userId, responseId, dto);
  }

  @Post('donor/emergency-responses/:responseId/arrive')
  @Roles(RoleCode.DONOR, RoleCode.SUPER_ADMIN)
  arriveAtHospital(
    @Param('responseId') responseId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.emergency.arriveAtHospital(userId, responseId);
  }

  @Get('donor/emergency-responses/:responseId/tracking')
  @Roles(RoleCode.DONOR, RoleCode.SUPER_ADMIN)
  getDonorTracking(
    @Param('responseId') responseId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.emergency.getDonorTracking(userId, responseId);
  }

  @Post('donor/emergency-responses/:responseId/cancel')
  @Roles(RoleCode.DONOR, RoleCode.SUPER_ADMIN)
  cancelResponse(
    @Param('responseId') responseId: string,
    @Body() body: { reason?: string },
    @CurrentUser('sub') userId: string,
  ) {
    return this.emergency.cancelResponse(userId, responseId, body.reason);
  }
}