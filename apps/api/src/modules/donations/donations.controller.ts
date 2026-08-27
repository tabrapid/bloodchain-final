import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { RoleCode } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Idempotent } from '../idempotency/idempotent.decorator';
import { IdempotencyInterceptor } from '../idempotency/idempotency.interceptor';
import { DonationsService } from './donations.service';
import {
  CheckInDonationDto,
  RecordAssessmentDto,
  StartDonationDto,
  CompleteDonationDto,
  CancelDonationDto,
  AbortDonationDto,
  GetMyDonationsDto,
  GetOrganizationDonationsDto,
} from './dto/donation.dto';

@ApiTags('Donations')
@Controller('donations')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DonationsController {
  constructor(private readonly donations: DonationsService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get my donations' })
  @ApiResponse({ status: 200, description: 'Donations list' })
  getMyDonations(@CurrentUser('sub') userId: string, @Query() filters: GetMyDonationsDto) {
    return this.donations.getMyDonations(userId, filters);
  }

  @Get('me/statistics')
  @ApiOperation({ summary: 'Get my donation statistics' })
  @ApiResponse({ status: 200, description: 'Donation statistics' })
  getMyDonationStatistics(@CurrentUser('sub') userId: string) {
    return this.donations.getMyDonationStatistics(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get donation by ID' })
  @ApiResponse({ status: 200, description: 'Donation details' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Donation not found' })
  getDonation(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.donations.getDonationById(id, userId);
  }
}

@ApiTags('Organization Donations')
@Controller('organizations/:organizationId/donations')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class OrganizationDonationsController {
  constructor(private readonly donations: DonationsService) {}

  @Get()
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.HOSPITAL_ADMIN, RoleCode.HOSPITAL_STAFF, RoleCode.BLOOD_CENTER_ADMIN, RoleCode.BLOOD_CENTER_STAFF)
  @ApiOperation({ summary: 'Get organization donations (staff only)' })
  @ApiResponse({ status: 200, description: 'Donations list' })
  getOrganizationDonations(
    @Param('organizationId') organizationId: string,
    @CurrentUser('sub') userId: string,
    @Query() filters: GetOrganizationDonationsDto,
  ) {
    return this.donations.getOrganizationDonations(organizationId, userId, filters);
  }

  @Get('today-appointments')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.HOSPITAL_ADMIN, RoleCode.HOSPITAL_STAFF, RoleCode.BLOOD_CENTER_ADMIN, RoleCode.BLOOD_CENTER_STAFF)
  @ApiOperation({ summary: "Get today's donation appointments (staff only)" })
  @ApiResponse({ status: 200, description: "Today's appointments" })
  getTodayAppointments(
    @Param('organizationId') organizationId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.donations.getTodayAppointments(organizationId, userId);
  }

  @Get('check-in/:appointmentId')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.HOSPITAL_ADMIN, RoleCode.HOSPITAL_STAFF, RoleCode.BLOOD_CENTER_ADMIN, RoleCode.BLOOD_CENTER_STAFF)
  @ApiOperation({ summary: 'Get appointment details for check-in (staff only)' })
  @ApiResponse({ status: 200, description: 'Appointment details for check-in' })
  getCheckInDetails(
    @Param('organizationId') organizationId: string,
    @Param('appointmentId') appointmentId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.donations.getDonationForCheckIn(appointmentId, organizationId, userId);
  }

  @Post('check-in/:appointmentId')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.HOSPITAL_ADMIN, RoleCode.HOSPITAL_STAFF, RoleCode.BLOOD_CENTER_ADMIN, RoleCode.BLOOD_CENTER_STAFF)
  @ApiOperation({ summary: 'Check in donor for donation (staff only)' })
  @ApiResponse({ status: 201, description: 'Donation checked in' })
  @ApiResponse({ status: 400, description: 'Cannot check in' })
  @ApiResponse({ status: 404, description: 'Appointment not found' })
  checkInDonation(
    @Param('organizationId') organizationId: string,
    @Param('appointmentId') appointmentId: string,
    @Body() dto: CheckInDonationDto,
    @CurrentUser('sub') userId: string,
    @Req() req: Request,
  ) {
    return this.donations.checkInDonation(
      appointmentId,
      organizationId,
      userId,
      dto,
      req.headers['x-forwarded-for'] as string,
    );
  }

  @Post(':id/start')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.HOSPITAL_ADMIN, RoleCode.HOSPITAL_STAFF, RoleCode.BLOOD_CENTER_ADMIN, RoleCode.BLOOD_CENTER_STAFF)
  @ApiOperation({ summary: 'Start donation (staff only)' })
  @ApiResponse({ status: 200, description: 'Donation started' })
  @ApiResponse({ status: 400, description: 'Cannot start donation' })
  startDonation(
    @Param('organizationId') organizationId: string,
    @Param('id') donationId: string,
    @Body() dto: StartDonationDto,
    @CurrentUser('sub') userId: string,
    @Req() req: Request,
  ) {
    return this.donations.startDonation(
      donationId,
      organizationId,
      userId,
      dto,
      req.headers['x-forwarded-for'] as string,
    );
  }

  @Post(':id/assessment')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.HOSPITAL_ADMIN, RoleCode.HOSPITAL_STAFF, RoleCode.BLOOD_CENTER_ADMIN, RoleCode.BLOOD_CENTER_STAFF)
  @ApiOperation({ summary: 'Record donation assessment (staff only)' })
  @ApiResponse({ status: 201, description: 'Assessment recorded' })
  @ApiResponse({ status: 400, description: 'Cannot record assessment' })
  recordAssessment(
    @Param('organizationId') organizationId: string,
    @Param('id') donationId: string,
    @Body() dto: RecordAssessmentDto,
    @CurrentUser('sub') userId: string,
    @Req() req: Request,
  ) {
    return this.donations.recordAssessment(
      donationId,
      organizationId,
      userId,
      dto,
      req.headers['x-forwarded-for'] as string,
    );
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.HOSPITAL_ADMIN, RoleCode.HOSPITAL_STAFF, RoleCode.BLOOD_CENTER_ADMIN, RoleCode.BLOOD_CENTER_STAFF)
  @Idempotent('donation.complete')
  @UseInterceptors(IdempotencyInterceptor)
  @ApiOperation({ summary: 'Complete donation (staff only)' })
  @ApiResponse({ status: 200, description: 'Donation completed' })
  @ApiResponse({ status: 400, description: 'Cannot complete donation' })
  completeDonation(
    @Param('organizationId') organizationId: string,
    @Param('id') donationId: string,
    @Body() dto: CompleteDonationDto,
    @CurrentUser('sub') userId: string,
    @Req() req: Request,
  ) {
    return this.donations.completeDonation(
      donationId,
      organizationId,
      userId,
      dto,
      req.headers['x-forwarded-for'] as string,
    );
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.HOSPITAL_ADMIN, RoleCode.HOSPITAL_STAFF, RoleCode.BLOOD_CENTER_ADMIN, RoleCode.BLOOD_CENTER_STAFF)
  @ApiOperation({ summary: 'Cancel donation (staff only)' })
  @ApiResponse({ status: 200, description: 'Donation cancelled' })
  @ApiResponse({ status: 400, description: 'Cannot cancel donation' })
  cancelDonation(
    @Param('organizationId') organizationId: string,
    @Param('id') donationId: string,
    @Body() dto: CancelDonationDto,
    @CurrentUser('sub') userId: string,
    @Req() req: Request,
  ) {
    return this.donations.cancelDonation(
      donationId,
      organizationId,
      userId,
      dto,
      req.headers['x-forwarded-for'] as string,
    );
  }

  @Post(':id/abort')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.HOSPITAL_ADMIN, RoleCode.HOSPITAL_STAFF, RoleCode.BLOOD_CENTER_ADMIN, RoleCode.BLOOD_CENTER_STAFF)
  @ApiOperation({ summary: 'Abort donation (staff only)' })
  @ApiResponse({ status: 200, description: 'Donation aborted' })
  @ApiResponse({ status: 400, description: 'Cannot abort donation' })
  abortDonation(
    @Param('organizationId') organizationId: string,
    @Param('id') donationId: string,
    @Body() dto: AbortDonationDto,
    @CurrentUser('sub') userId: string,
    @Req() req: Request,
  ) {
    return this.donations.abortDonation(
      donationId,
      organizationId,
      userId,
      dto,
      req.headers['x-forwarded-for'] as string,
    );
  }
}