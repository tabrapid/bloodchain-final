import { Body, Controller, Get, Param, Post, Query, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { RoleCode } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Idempotent } from '../idempotency/idempotent.decorator';
import { IdempotencyInterceptor } from '../idempotency/idempotency.interceptor';
import { AppointmentsService } from './appointments.service';
import {
  CreateAppointmentDto,
  CancelAppointmentDto,
  RescheduleAppointmentDto,
  GetMyAppointmentsDto,
} from './dto/appointment.dto';

@ApiTags('Appointments')
@Controller('appointments')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AppointmentsController {
  constructor(private readonly appointments: AppointmentsService) {}

  @Post()
  @Idempotent('appointment.book')
  @UseInterceptors(IdempotencyInterceptor)
  @ApiOperation({ summary: 'Book an appointment' })
  @ApiResponse({ status: 201, description: 'Appointment booked' })
  @ApiResponse({ status: 409, description: 'Slot not available or conflict' })
  bookAppointment(
    @Body() dto: CreateAppointmentDto,
    @CurrentUser('sub') userId: string,
    @Req() req: Request,
  ) {
    return this.appointments.bookAppointment(userId, dto, req.headers['x-forwarded-for'] as string);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get my appointments' })
  @ApiResponse({ status: 200, description: 'Appointments list' })
  getMyAppointments(@CurrentUser('sub') userId: string, @Query() filters: GetMyAppointmentsDto) {
    return this.appointments.getMyAppointments(userId, filters);
  }

  @Get('me/next')
  @ApiOperation({ summary: 'Get next upcoming appointment' })
  @ApiResponse({ status: 200, description: 'Next appointment or null' })
  getNextAppointment(@CurrentUser('sub') userId: string) {
    return this.appointments.getNextAppointment(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get appointment by ID' })
  @ApiResponse({ status: 200, description: 'Appointment details' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Appointment not found' })
  getAppointment(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.appointments.getAppointmentById(id, userId);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel an appointment' })
  @ApiResponse({ status: 200, description: 'Appointment cancelled' })
  @ApiResponse({ status: 400, description: 'Cannot cancel this appointment' })
  cancelAppointment(
    @Param('id') id: string,
    @Body() dto: CancelAppointmentDto,
    @CurrentUser('sub') userId: string,
    @Req() req: Request,
  ) {
    return this.appointments.cancelAppointment(id, userId, dto, req.headers['x-forwarded-for'] as string);
  }

  @Post(':id/reschedule')
  @ApiOperation({ summary: 'Reschedule an appointment' })
  @ApiResponse({ status: 200, description: 'Appointment rescheduled' })
  @ApiResponse({ status: 409, description: 'New slot not available' })
  rescheduleAppointment(
    @Param('id') id: string,
    @Body() dto: RescheduleAppointmentDto,
    @CurrentUser('sub') userId: string,
    @Req() req: Request,
  ) {
    return this.appointments.rescheduleAppointment(id, userId, dto, req.headers['x-forwarded-for'] as string);
  }

  @Post(':id/confirm')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.HOSPITAL_ADMIN, RoleCode.HOSPITAL_STAFF, RoleCode.BLOOD_CENTER_ADMIN, RoleCode.BLOOD_CENTER_STAFF)
  @ApiOperation({ summary: 'Confirm appointment (staff only)' })
  @ApiResponse({ status: 200, description: 'Appointment confirmed' })
  confirmAppointment(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @Req() req: Request,
  ) {
    return this.appointments.confirmAppointment(id, userId, req.headers['x-forwarded-for'] as string);
  }

  @Post(':id/complete')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.HOSPITAL_ADMIN, RoleCode.HOSPITAL_STAFF, RoleCode.BLOOD_CENTER_ADMIN, RoleCode.BLOOD_CENTER_STAFF)
  @ApiOperation({ summary: 'Mark appointment as completed (staff only)' })
  @ApiResponse({ status: 200, description: 'Appointment completed' })
  completeAppointment(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @Req() req: Request,
  ) {
    return this.appointments.completeAppointment(id, userId, req.headers['x-forwarded-for'] as string);
  }
}