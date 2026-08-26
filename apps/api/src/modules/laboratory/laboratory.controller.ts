import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RoleCode } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { LaboratoryService } from './laboratory.service';

@ApiTags('Laboratory')
@Controller()
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class LaboratoryController {
  constructor(private readonly laboratory: LaboratoryService) {}

  @Get('laboratories')
  getLaboratories(@Query('organizationId') organizationId?: string) {
    return this.laboratory.getLaboratories(organizationId);
  }

  @Get('laboratories/:laboratoryId')
  getLaboratory(
    @Param('laboratoryId') laboratoryId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.laboratory.getLaboratory(laboratoryId, userId);
  }

  @Get('test-types')
  getTestTypes(
    @Query('category') category?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.laboratory.getTestTypes({
      category,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    });
  }

  @Get('test-types/:testTypeId')
  getTestType(@Param('testTypeId') testTypeId: string) {
    return this.laboratory.getTestType(testTypeId);
  }

  @Get('laboratories/:laboratoryId/slots')
  @Roles(RoleCode.DONOR, RoleCode.SUPER_ADMIN)
  getAvailableSlots(
    @Param('laboratoryId') laboratoryId: string,
    @Query('testTypeId') testTypeId: string,
    @Query('date') date: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.laboratory.getAvailableSlots(laboratoryId, testTypeId, date, userId);
  }

  @Post('laboratory-appointments')
  @Roles(RoleCode.DONOR, RoleCode.SUPER_ADMIN)
  bookAppointment(
    @Body() dto: {
      laboratoryId: string;
      testTypeId: string;
      slotId: string;
      notes?: string;
    },
    @CurrentUser('sub') userId: string,
  ) {
    return this.laboratory.bookLaboratoryAppointment(
      userId,
      dto.laboratoryId,
      dto.testTypeId,
      dto.slotId,
      dto.notes,
    );
  }

  @Get('me/laboratory-appointments')
  @Roles(RoleCode.DONOR, RoleCode.SUPER_ADMIN)
  getDonorAppointments(
    @CurrentUser('sub') userId: string,
    @Query() filters: {
      status?: string;
      laboratoryId?: string;
      startDate?: string;
      endDate?: string;
    },
  ) {
    return this.laboratory.getDonorAppointments(userId, filters);
  }

  @Get('me/laboratory-appointments/:appointmentId')
  @Roles(RoleCode.DONOR, RoleCode.SUPER_ADMIN)
  getDonorAppointment(
    @Param('appointmentId') appointmentId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.laboratory.getDonorAppointment(userId, appointmentId);
  }

  @Post('me/laboratory-appointments/:appointmentId/cancel')
  @Roles(RoleCode.DONOR, RoleCode.SUPER_ADMIN)
  cancelAppointment(
    @Param('appointmentId') appointmentId: string,
    @Body() body: { reason?: string },
    @CurrentUser('sub') userId: string,
  ) {
    return this.laboratory.cancelAppointment(userId, appointmentId, body.reason);
  }

  @Get('me/laboratory-results')
  @Roles(RoleCode.DONOR, RoleCode.SUPER_ADMIN)
  getDonorResults(
    @CurrentUser('sub') userId: string,
    @Query() filters: { testTypeId?: string; startDate?: string; endDate?: string },
  ) {
    return this.laboratory.getDonorResults(userId, filters);
  }

  @Get('me/laboratory-results/:resultId')
  @Roles(RoleCode.DONOR, RoleCode.SUPER_ADMIN)
  getDonorResult(
    @Param('resultId') resultId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.laboratory.getDonorResult(userId, resultId);
  }

  @Get('me/laboratory-results/parameter/:parameterId/trend')
  @Roles(RoleCode.DONOR, RoleCode.SUPER_ADMIN)
  getParameterTrend(
    @Param('parameterId') parameterId: string,
    @CurrentUser('sub') userId: string,
    @Query() options: { startDate?: string; endDate?: string; limit?: string },
  ) {
    return this.laboratory.getParameterTrend(userId, parameterId, {
      limit: options.limit ? parseInt(options.limit) : undefined,
      startDate: options.startDate,
      endDate: options.endDate,
    });
  }

  @Get('organizations/:organizationId/laboratory-appointments')
  @Roles(
    RoleCode.BLOOD_CENTER_ADMIN,
    RoleCode.BLOOD_CENTER_STAFF,
    RoleCode.HOSPITAL_ADMIN,
    RoleCode.HOSPITAL_STAFF,
    RoleCode.LAB_TECHNICIAN,
    RoleCode.LAB_REVIEWER,
    RoleCode.LAB_ADMIN,
    RoleCode.SUPER_ADMIN,
  )
  getLaboratoryAppointments(
    @Param('organizationId') organizationId: string,
    @CurrentUser('sub') userId: string,
    @Query() filters: { status?: string; startDate?: string; endDate?: string; search?: string },
  ) {
    return this.laboratory.getLaboratoryAppointments(organizationId, userId, filters);
  }

  @Post('organizations/:organizationId/laboratory-appointments/:appointmentId/confirm')
  @Roles(
    RoleCode.BLOOD_CENTER_ADMIN,
    RoleCode.BLOOD_CENTER_STAFF,
    RoleCode.HOSPITAL_ADMIN,
    RoleCode.HOSPITAL_STAFF,
    RoleCode.LAB_TECHNICIAN,
    RoleCode.LAB_ADMIN,
    RoleCode.SUPER_ADMIN,
  )
  confirmAppointment(
    @Param('organizationId') organizationId: string,
    @Param('appointmentId') appointmentId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.laboratory.confirmAppointment(organizationId, userId, appointmentId);
  }

  @Post('organizations/:organizationId/laboratory-appointments/:appointmentId/check-in')
  @Roles(
    RoleCode.BLOOD_CENTER_ADMIN,
    RoleCode.BLOOD_CENTER_STAFF,
    RoleCode.HOSPITAL_ADMIN,
    RoleCode.HOSPITAL_STAFF,
    RoleCode.LAB_TECHNICIAN,
    RoleCode.LAB_ADMIN,
    RoleCode.SUPER_ADMIN,
  )
  checkInAppointment(
    @Param('organizationId') organizationId: string,
    @Param('appointmentId') appointmentId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.laboratory.checkInAppointment(organizationId, userId, appointmentId);
  }

  @Post('organizations/:organizationId/laboratory-appointments/:appointmentId/start')
  @Roles(
    RoleCode.BLOOD_CENTER_ADMIN,
    RoleCode.BLOOD_CENTER_STAFF,
    RoleCode.HOSPITAL_ADMIN,
    RoleCode.HOSPITAL_STAFF,
    RoleCode.LAB_TECHNICIAN,
    RoleCode.LAB_ADMIN,
    RoleCode.SUPER_ADMIN,
  )
  startTest(
    @Param('organizationId') organizationId: string,
    @Param('appointmentId') appointmentId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.laboratory.startTest(organizationId, userId, appointmentId);
  }

  @Post('organizations/:organizationId/laboratory-appointments/:appointmentId/complete')
  @Roles(
    RoleCode.BLOOD_CENTER_ADMIN,
    RoleCode.BLOOD_CENTER_STAFF,
    RoleCode.HOSPITAL_ADMIN,
    RoleCode.HOSPITAL_STAFF,
    RoleCode.LAB_TECHNICIAN,
    RoleCode.LAB_ADMIN,
    RoleCode.SUPER_ADMIN,
  )
  completeAppointment(
    @Param('organizationId') organizationId: string,
    @Param('appointmentId') appointmentId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.laboratory.completeAppointment(organizationId, userId, appointmentId);
  }

  @Post('organizations/:organizationId/laboratory-appointments/:appointmentId/no-show')
  @Roles(
    RoleCode.BLOOD_CENTER_ADMIN,
    RoleCode.BLOOD_CENTER_STAFF,
    RoleCode.HOSPITAL_ADMIN,
    RoleCode.HOSPITAL_STAFF,
    RoleCode.LAB_TECHNICIAN,
    RoleCode.LAB_ADMIN,
    RoleCode.SUPER_ADMIN,
  )
  markNoShow(
    @Param('organizationId') organizationId: string,
    @Param('appointmentId') appointmentId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.laboratory.markNoShow(organizationId, userId, appointmentId);
  }

  @Post('organizations/:organizationId/laboratory-results')
  @Roles(
    RoleCode.BLOOD_CENTER_ADMIN,
    RoleCode.BLOOD_CENTER_STAFF,
    RoleCode.HOSPITAL_ADMIN,
    RoleCode.HOSPITAL_STAFF,
    RoleCode.LAB_TECHNICIAN,
    RoleCode.LAB_ADMIN,
    RoleCode.SUPER_ADMIN,
  )
  createResult(
    @Param('organizationId') organizationId: string,
    @Param('appointmentId') appointmentId: string,
    @Body() dto: {
      items: Array<{
        parameterId: string;
        value: string;
        numericValue?: number;
        unit?: string;
        flag?: string;
        notes?: string;
      }>;
      testTypeId: string;
    },
    @CurrentUser('sub') userId: string,
  ) {
    return this.laboratory.createResult(
      organizationId,
      userId,
      appointmentId,
      {
        items: dto.items.map((item) => ({
          ...item,
          flag: item.flag as any,
        })),
      },
      dto.testTypeId,
    );
  }

  @Get('organizations/:organizationId/laboratory-results/:resultId')
  @Roles(
    RoleCode.BLOOD_CENTER_ADMIN,
    RoleCode.BLOOD_CENTER_STAFF,
    RoleCode.HOSPITAL_ADMIN,
    RoleCode.HOSPITAL_STAFF,
    RoleCode.LAB_TECHNICIAN,
    RoleCode.LAB_REVIEWER,
    RoleCode.LAB_ADMIN,
    RoleCode.SUPER_ADMIN,
  )
  getResult(
    @Param('organizationId') organizationId: string,
    @Param('resultId') resultId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.laboratory.getResult(organizationId, userId, resultId);
  }

  @Post('organizations/:organizationId/laboratory-results/:resultId/review')
  @Roles(
    RoleCode.BLOOD_CENTER_ADMIN,
    RoleCode.BLOOD_CENTER_STAFF,
    RoleCode.HOSPITAL_ADMIN,
    RoleCode.HOSPITAL_STAFF,
    RoleCode.LAB_REVIEWER,
    RoleCode.LAB_ADMIN,
    RoleCode.SUPER_ADMIN,
  )
  reviewResult(
    @Param('organizationId') organizationId: string,
    @Param('resultId') resultId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.laboratory.reviewResult(organizationId, userId, resultId);
  }

  @Post('organizations/:organizationId/laboratory-results/:resultId/publish')
  @Roles(
    RoleCode.BLOOD_CENTER_ADMIN,
    RoleCode.BLOOD_CENTER_STAFF,
    RoleCode.HOSPITAL_ADMIN,
    RoleCode.HOSPITAL_STAFF,
    RoleCode.LAB_REVIEWER,
    RoleCode.LAB_ADMIN,
    RoleCode.SUPER_ADMIN,
  )
  publishResult(
    @Param('organizationId') organizationId: string,
    @Param('resultId') resultId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.laboratory.publishResult(organizationId, userId, resultId);
  }
}
