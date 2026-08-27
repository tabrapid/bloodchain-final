import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { RoleCode } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Idempotent } from '../idempotency/idempotent.decorator';
import { IdempotencyInterceptor } from '../idempotency/idempotency.interceptor';
import { ShipmentsService } from './shipments.service';
import {
  ApproveRequestDto,
  CreateBloodRequestDto,
  CreateShipmentDto,
  DeclineShipmentDto,
  FailShipmentDto,
  GetCourierShipmentsDto,
  GetRequestsDto,
  GetShipmentsDto,
  UpdateLocationDto,
  CancelShipmentDto,
  ReassignCourierDto,
  AssignCourierDto,
  DeliveryConfirmationDto,
} from './dto/shipment.dto';

@ApiTags('Shipments')
@Controller()
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ShipmentsController {
  constructor(private readonly shipments: ShipmentsService) {}

  @Post('organizations/:organizationId/blood-requests')
  @Roles(RoleCode.HOSPITAL_ADMIN, RoleCode.HOSPITAL_STAFF, RoleCode.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create blood request' })
  createRequest(
    @Param('organizationId') organizationId: string,
    @Body() dto: CreateBloodRequestDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.shipments.createRequest(organizationId, userId, dto);
  }

  @Get('organizations/:organizationId/blood-requests')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.HOSPITAL_ADMIN, RoleCode.HOSPITAL_STAFF, RoleCode.BLOOD_CENTER_ADMIN, RoleCode.BLOOD_CENTER_STAFF)
  @ApiOperation({ summary: 'Get blood requests' })
  getRequests(
    @Param('organizationId') organizationId: string,
    @CurrentUser('sub') userId: string,
    @Query() filters: GetRequestsDto,
  ) {
    return this.shipments.getRequests(organizationId, userId, filters);
  }

  @Get('organizations/:organizationId/blood-requests/:requestId')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.HOSPITAL_ADMIN, RoleCode.HOSPITAL_STAFF, RoleCode.BLOOD_CENTER_ADMIN, RoleCode.BLOOD_CENTER_STAFF)
  @ApiOperation({ summary: 'Get blood request details' })
  getRequest(
    @Param('organizationId') organizationId: string,
    @Param('requestId') requestId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.shipments.getRequest(organizationId, userId, requestId);
  }

  @Post('organizations/:organizationId/blood-requests/:requestId/approve')
  @Roles(RoleCode.BLOOD_CENTER_ADMIN, RoleCode.BLOOD_CENTER_STAFF, RoleCode.SUPER_ADMIN)
  @ApiOperation({ summary: 'Approve blood request' })
  approveRequest(
    @Param('organizationId') organizationId: string,
    @Param('requestId') requestId: string,
    @Body() dto: ApproveRequestDto,
    @CurrentUser('sub') userId: string,
    @Req() req: Request,
  ) {
    return this.shipments.approveRequest(organizationId, userId, requestId, dto);
  }

  @Post('organizations/:organizationId/blood-requests/:requestId/ready-for-pickup')
  @Roles(RoleCode.BLOOD_CENTER_ADMIN, RoleCode.BLOOD_CENTER_STAFF, RoleCode.SUPER_ADMIN)
  @ApiOperation({ summary: 'Mark request as ready for pickup' })
  markReadyForPickup(
    @Param('organizationId') organizationId: string,
    @Param('requestId') requestId: string,
    @CurrentUser('sub') userId: string,
    @Req() req: Request,
  ) {
    return this.shipments.markReadyForPickup(organizationId, userId, requestId);
  }

  @Post('organizations/:organizationId/blood-requests/:requestId/shipments')
  @Roles(RoleCode.BLOOD_CENTER_ADMIN, RoleCode.BLOOD_CENTER_STAFF, RoleCode.SUPER_ADMIN)
  @Idempotent('shipment.create')
  @UseInterceptors(IdempotencyInterceptor)
  @ApiOperation({ summary: 'Create shipment for request' })
  createShipment(
    @Param('organizationId') organizationId: string,
    @Param('requestId') requestId: string,
    @Body() dto: CreateShipmentDto,
    @CurrentUser('sub') userId: string,
    @Req() req: Request,
  ) {
    return this.shipments.createShipment(organizationId, userId, requestId, dto, req.headers['x-forwarded-for'] as string);
  }

  @Get('organizations/:organizationId/shipments')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.HOSPITAL_ADMIN, RoleCode.HOSPITAL_STAFF, RoleCode.BLOOD_CENTER_ADMIN, RoleCode.BLOOD_CENTER_STAFF)
  @ApiOperation({ summary: 'Get shipments' })
  getShipments(
    @Param('organizationId') organizationId: string,
    @CurrentUser('sub') userId: string,
    @Query() filters: GetShipmentsDto,
  ) {
    return this.shipments.getShipments(organizationId, userId, filters);
  }

  @Get('organizations/:organizationId/shipments/:shipmentId')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.HOSPITAL_ADMIN, RoleCode.HOSPITAL_STAFF, RoleCode.BLOOD_CENTER_ADMIN, RoleCode.BLOOD_CENTER_STAFF)
  @ApiOperation({ summary: 'Get shipment details' })
  getShipment(
    @Param('organizationId') organizationId: string,
    @Param('shipmentId') shipmentId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.shipments.getShipment(organizationId, userId, shipmentId);
  }

  @Get('organizations/:organizationId/couriers')
  @Roles(RoleCode.BLOOD_CENTER_ADMIN, RoleCode.BLOOD_CENTER_STAFF, RoleCode.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get available couriers' })
  getAvailableCouriers(
    @Param('organizationId') organizationId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.shipments.getAvailableCouriers(organizationId, userId);
  }

  @Get('organizations/:organizationId/couriers/roster')
  @Roles(RoleCode.BLOOD_CENTER_ADMIN, RoleCode.BLOOD_CENTER_STAFF, RoleCode.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get full courier roster regardless of status (management view)' })
  getCourierRoster(
    @Param('organizationId') organizationId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.shipments.getCourierRoster(organizationId, userId);
  }

  @Post('organizations/:organizationId/shipments/:shipmentId/assign')
  @Roles(RoleCode.BLOOD_CENTER_ADMIN, RoleCode.BLOOD_CENTER_STAFF, RoleCode.SUPER_ADMIN)
  @ApiOperation({ summary: 'Assign courier to shipment' })
  assignCourier(
    @Param('organizationId') organizationId: string,
    @Param('shipmentId') shipmentId: string,
    @Body() dto: AssignCourierDto,
    @CurrentUser('sub') userId: string,
    @Req() req: Request,
  ) {
    return this.shipments.assignCourier(organizationId, userId, shipmentId, dto.courierId, req.headers['x-forwarded-for'] as string);
  }

  @Post('courier/shipments/:shipmentId/accept')
  @Roles(RoleCode.COURIER, RoleCode.SUPER_ADMIN)
  @ApiOperation({ summary: 'Courier accepts shipment' })
  acceptShipment(
    @Param('shipmentId') shipmentId: string,
    @CurrentUser('sub') userId: string,
    @Req() req: Request,
  ) {
    return this.shipments.acceptShipment(userId, shipmentId, req.headers['x-forwarded-for'] as string);
  }

  @Post('courier/shipments/:shipmentId/decline')
  @Roles(RoleCode.COURIER, RoleCode.SUPER_ADMIN)
  @ApiOperation({ summary: 'Courier declines shipment' })
  declineShipment(
    @Param('shipmentId') shipmentId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: DeclineShipmentDto,
    @Req() req: Request,
  ) {
    return this.shipments.declineShipment(userId, shipmentId, dto.reason, req.headers['x-forwarded-for'] as string);
  }

  @Post('courier/shipments/:shipmentId/start-pickup')
  @Roles(RoleCode.COURIER, RoleCode.SUPER_ADMIN)
  @ApiOperation({ summary: 'Start pickup' })
  startPickup(
    @Param('shipmentId') shipmentId: string,
    @CurrentUser('sub') userId: string,
    @Req() req: Request,
  ) {
    return this.shipments.startPickup(userId, shipmentId, req.headers['x-forwarded-for'] as string);
  }

  @Post('courier/shipments/:shipmentId/confirm-pickup')
  @Roles(RoleCode.COURIER, RoleCode.SUPER_ADMIN)
  @ApiOperation({ summary: 'Confirm pickup' })
  confirmPickup(
    @Param('shipmentId') shipmentId: string,
    @CurrentUser('sub') userId: string,
    @Req() req: Request,
  ) {
    return this.shipments.confirmPickup(userId, shipmentId, req.headers['x-forwarded-for'] as string);
  }

  @Post('courier/shipments/:shipmentId/start-delivery')
  @Roles(RoleCode.COURIER, RoleCode.SUPER_ADMIN)
  @ApiOperation({ summary: 'Start delivery' })
  startDelivery(
    @Param('shipmentId') shipmentId: string,
    @CurrentUser('sub') userId: string,
    @Req() req: Request,
  ) {
    return this.shipments.startDelivery(userId, shipmentId, req.headers['x-forwarded-for'] as string);
  }

  @Post('courier/shipments/:shipmentId/update-location')
  @Roles(RoleCode.COURIER, RoleCode.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update courier location' })
  updateLocation(
    @Param('shipmentId') shipmentId: string,
    @Body() dto: UpdateLocationDto,
    @CurrentUser('sub') userId: string,
    @Req() req: Request,
  ) {
    return this.shipments.updateLocation(userId, shipmentId, dto, req.headers['x-forwarded-for'] as string);
  }

  @Post('courier/shipments/:shipmentId/arrive')
  @Roles(RoleCode.COURIER, RoleCode.SUPER_ADMIN)
  @ApiOperation({ summary: 'Arrived at hospital' })
  arriveAtHospital(
    @Param('shipmentId') shipmentId: string,
    @CurrentUser('sub') userId: string,
    @Req() req: Request,
  ) {
    return this.shipments.arriveAtHospital(userId, shipmentId, req.headers['x-forwarded-for'] as string);
  }

  @Post('courier/shipments/:shipmentId/fail')
  @Roles(RoleCode.COURIER, RoleCode.SUPER_ADMIN)
  @ApiOperation({ summary: 'Fail shipment' })
  failShipment(
    @Param('shipmentId') shipmentId: string,
    @Body() dto: FailShipmentDto,
    @CurrentUser('sub') userId: string,
    @Req() req: Request,
  ) {
    return this.shipments.failShipment(userId, shipmentId, dto, req.headers['x-forwarded-for'] as string);
  }

  @Get('shipments/:shipmentId/locations')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.HOSPITAL_ADMIN, RoleCode.HOSPITAL_STAFF, RoleCode.BLOOD_CENTER_ADMIN, RoleCode.BLOOD_CENTER_STAFF, RoleCode.COURIER)
  @ApiOperation({ summary: 'Get shipment location history' })
  getShipmentLocations(
    @Param('shipmentId') shipmentId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.shipments.getShipmentLocations(shipmentId, userId);
  }

  @Get('courier/shipments')
  @Roles(RoleCode.COURIER, RoleCode.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get courier shipments' })
  getCourierShipments(
    @CurrentUser('sub') userId: string,
    @Query() filters: GetCourierShipmentsDto,
  ) {
    return this.shipments.getCourierShipments(userId, filters);
  }

  @Get('shipments/:shipmentId/timeline')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.HOSPITAL_ADMIN, RoleCode.HOSPITAL_STAFF, RoleCode.BLOOD_CENTER_ADMIN, RoleCode.BLOOD_CENTER_STAFF, RoleCode.COURIER)
  @ApiOperation({ summary: 'Get shipment timeline' })
  getShipmentTimeline(
    @Param('shipmentId') shipmentId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.shipments.getShipmentTimeline(shipmentId, userId);
  }

  @Get('shipments/:shipmentId/tracking')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.HOSPITAL_ADMIN, RoleCode.HOSPITAL_STAFF, RoleCode.BLOOD_CENTER_ADMIN, RoleCode.BLOOD_CENTER_STAFF, RoleCode.COURIER)
  @ApiOperation({ summary: 'Get shipment tracking info' })
  getShipmentTracking(
    @Param('shipmentId') shipmentId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.shipments.getShipmentTracking(shipmentId, userId);
  }

  @Post('organizations/:organizationId/shipments/:shipmentId/cancel')
  @Roles(RoleCode.BLOOD_CENTER_ADMIN, RoleCode.BLOOD_CENTER_STAFF, RoleCode.SUPER_ADMIN)
  @ApiOperation({ summary: 'Cancel shipment' })
  cancelShipment(
    @Param('organizationId') organizationId: string,
    @Param('shipmentId') shipmentId: string,
    @Body() dto: CancelShipmentDto,
    @CurrentUser('sub') userId: string,
    @Req() req: Request,
  ) {
    return this.shipments.cancelShipment(organizationId, userId, shipmentId, dto.reason, req.headers['x-forwarded-for'] as string);
  }

  @Post('organizations/:organizationId/shipments/:shipmentId/reassign')
  @Roles(RoleCode.BLOOD_CENTER_ADMIN, RoleCode.BLOOD_CENTER_STAFF, RoleCode.SUPER_ADMIN)
  @ApiOperation({ summary: 'Reassign shipment to different courier' })
  reassignShipment(
    @Param('organizationId') organizationId: string,
    @Param('shipmentId') shipmentId: string,
    @Body() dto: ReassignCourierDto,
    @CurrentUser('sub') userId: string,
    @Req() req: Request,
  ) {
    return this.shipments.reassignCourier(organizationId, userId, shipmentId, dto.courierId, req.headers['x-forwarded-for'] as string);
  }

  @Post('organizations/:organizationId/shipments/:shipmentId/confirm-delivery')
  @Roles(RoleCode.HOSPITAL_ADMIN, RoleCode.HOSPITAL_STAFF, RoleCode.SUPER_ADMIN)
  @Idempotent('shipment.confirm-delivery')
  @UseInterceptors(IdempotencyInterceptor)
  @ApiOperation({ summary: 'Hospital confirms delivery with details' })
  confirmDelivery(
    @Param('organizationId') organizationId: string,
    @Param('shipmentId') shipmentId: string,
    @Body() dto: DeliveryConfirmationDto,
    @CurrentUser('sub') userId: string,
    @Req() req: Request,
  ) {
    return this.shipments.confirmDeliveryFull(organizationId, userId, shipmentId, dto, req.headers['x-forwarded-for'] as string);
  }
}