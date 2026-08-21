import { Body, Controller, Get, Param, Post, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AppointmentType, RoleCode } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AppointmentSlotsService } from './appointment-slots.service';
import { CreateAppointmentSlotDto, UpdateAppointmentSlotDto, GetAvailabilityDto } from './dto/appointment-slot.dto';

@ApiTags('Appointment Slots')
@Controller('appointments')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AppointmentSlotsController {
  constructor(private readonly slots: AppointmentSlotsService) {}

  @Get('availability')
  @ApiOperation({ summary: 'Get available appointment slots' })
  @ApiResponse({ status: 200, description: 'Available slots' })
  getAvailability(@Query() filters: GetAvailabilityDto) {
    return this.slots.getAvailability(filters);
  }

  @Get('organizations/:organizationId/slots')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.HOSPITAL_ADMIN, RoleCode.HOSPITAL_STAFF, RoleCode.BLOOD_CENTER_ADMIN, RoleCode.BLOOD_CENTER_STAFF)
  @ApiOperation({ summary: 'Get slots for organization (staff only)' })
  @ApiResponse({ status: 200, description: 'Slots list' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  getSlotsByOrganization(
    @Param('organizationId') organizationId: string,
    @CurrentUser('sub') userId: string,
    @Query('appointmentType') appointmentType?: AppointmentType,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.slots.getSlotsByOrganization(organizationId, userId, { appointmentType, startDate, endDate });
  }

  @Post('organizations/:organizationId/slots')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.HOSPITAL_ADMIN, RoleCode.HOSPITAL_STAFF, RoleCode.BLOOD_CENTER_ADMIN, RoleCode.BLOOD_CENTER_STAFF)
  @ApiOperation({ summary: 'Create appointment slot (staff only)' })
  @ApiResponse({ status: 201, description: 'Slot created' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  createSlot(
    @Param('organizationId') organizationId: string,
    @Body() dto: CreateAppointmentSlotDto,
    @CurrentUser('sub') userId: string,
    @Req() req: Request,
  ) {
    return this.slots.createSlot(organizationId, userId, dto, req.headers['x-forwarded-for'] as string);
  }

  @Patch('organizations/:organizationId/slots/:slotId')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.HOSPITAL_ADMIN, RoleCode.HOSPITAL_STAFF, RoleCode.BLOOD_CENTER_ADMIN, RoleCode.BLOOD_CENTER_STAFF)
  @ApiOperation({ summary: 'Update appointment slot (staff only)' })
  @ApiResponse({ status: 200, description: 'Slot updated' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  updateSlot(
    @Param('organizationId') organizationId: string,
    @Param('slotId') slotId: string,
    @Body() dto: UpdateAppointmentSlotDto,
    @CurrentUser('sub') userId: string,
    @Req() req: Request,
  ) {
    return this.slots.updateSlot(organizationId, slotId, userId, dto, req.headers['x-forwarded-for'] as string);
  }

  @Post('organizations/:organizationId/slots/:slotId/block')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.HOSPITAL_ADMIN, RoleCode.HOSPITAL_STAFF, RoleCode.BLOOD_CENTER_ADMIN, RoleCode.BLOOD_CENTER_STAFF)
  @ApiOperation({ summary: 'Block appointment slot (staff only)' })
  @ApiResponse({ status: 200, description: 'Slot blocked' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  blockSlot(
    @Param('organizationId') organizationId: string,
    @Param('slotId') slotId: string,
    @CurrentUser('sub') userId: string,
    @Req() req: Request,
  ) {
    return this.slots.blockSlot(organizationId, slotId, userId, req.headers['x-forwarded-for'] as string);
  }
}