import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { RoleCode } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Idempotent } from '../idempotency/idempotent.decorator';
import { IdempotencyInterceptor } from '../idempotency/idempotency.interceptor';
import { InventoryService } from './inventory.service';
import {
  AdjustUnitDto,
  CreateLocationDto,
  DiscardUnitDto,
  GetInventoryDto,
  GetMovementsDto,
  GetReservationsDto,
  IssueUnitDto,
  MoveUnitDto,
  QuarantineUnitDto,
  ReleaseReservationDto,
  ReleaseUnitDto,
  ReserveUnitDto,
  UpdateLocationDto,
} from './dto/inventory.dto';

@ApiTags('Inventory')
@Controller('organizations/:organizationId/inventory')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get('summary')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.HOSPITAL_ADMIN, RoleCode.HOSPITAL_STAFF, RoleCode.BLOOD_CENTER_ADMIN, RoleCode.BLOOD_CENTER_STAFF)
  @ApiOperation({ summary: 'Get inventory summary' })
  getSummary(
    @Param('organizationId') organizationId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.inventory.getInventorySummary(organizationId, userId);
  }

  @Get()
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.HOSPITAL_ADMIN, RoleCode.HOSPITAL_STAFF, RoleCode.BLOOD_CENTER_ADMIN, RoleCode.BLOOD_CENTER_STAFF)
  @ApiOperation({ summary: 'Get inventory units' })
  getInventory(
    @Param('organizationId') organizationId: string,
    @CurrentUser('sub') userId: string,
    @Query() filters: GetInventoryDto,
  ) {
    return this.inventory.getInventory(organizationId, userId, filters);
  }

  @Get('units/:unitId')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.HOSPITAL_ADMIN, RoleCode.HOSPITAL_STAFF, RoleCode.BLOOD_CENTER_ADMIN, RoleCode.BLOOD_CENTER_STAFF)
  @ApiOperation({ summary: 'Get inventory unit details' })
  getUnit(
    @Param('organizationId') organizationId: string,
    @Param('unitId') unitId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.inventory.getUnit(organizationId, unitId, userId);
  }

  @Post('units/:unitId/release')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.BLOOD_CENTER_ADMIN, RoleCode.BLOOD_CENTER_STAFF)
  @ApiOperation({ summary: 'Release unit to inventory' })
  releaseUnit(
    @Param('organizationId') organizationId: string,
    @Param('unitId') unitId: string,
    @Body() dto: ReleaseUnitDto,
    @CurrentUser('sub') userId: string,
    @Req() req: Request,
  ) {
    return this.inventory.releaseUnit(organizationId, unitId, userId, dto, req.headers['x-forwarded-for'] as string);
  }

  @Post('units/:unitId/quarantine')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.BLOOD_CENTER_ADMIN, RoleCode.BLOOD_CENTER_STAFF)
  @ApiOperation({ summary: 'Quarantine unit' })
  quarantineUnit(
    @Param('organizationId') organizationId: string,
    @Param('unitId') unitId: string,
    @Body() dto: QuarantineUnitDto,
    @CurrentUser('sub') userId: string,
    @Req() req: Request,
  ) {
    return this.inventory.quarantineUnit(organizationId, unitId, userId, dto, req.headers['x-forwarded-for'] as string);
  }

  @Post('units/:unitId/discard')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.BLOOD_CENTER_ADMIN, RoleCode.BLOOD_CENTER_STAFF)
  @ApiOperation({ summary: 'Discard unit' })
  discardUnit(
    @Param('organizationId') organizationId: string,
    @Param('unitId') unitId: string,
    @Body() dto: DiscardUnitDto,
    @CurrentUser('sub') userId: string,
    @Req() req: Request,
  ) {
    return this.inventory.discardUnit(organizationId, unitId, userId, dto, req.headers['x-forwarded-for'] as string);
  }

  @Post('units/:unitId/issue')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.BLOOD_CENTER_ADMIN, RoleCode.BLOOD_CENTER_STAFF, RoleCode.HOSPITAL_ADMIN, RoleCode.HOSPITAL_STAFF)
  @Idempotent('inventory.issue-unit')
  @UseInterceptors(IdempotencyInterceptor)
  @ApiOperation({ summary: 'Issue (dispense) a unit for clinical use' })
  issueUnit(
    @Param('organizationId') organizationId: string,
    @Param('unitId') unitId: string,
    @Body() dto: IssueUnitDto,
    @CurrentUser('sub') userId: string,
    @Req() req: Request,
  ) {
    return this.inventory.issueUnit(organizationId, unitId, userId, dto, req.headers['x-forwarded-for'] as string);
  }

  @Patch('units/:unitId/adjust')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.BLOOD_CENTER_ADMIN, RoleCode.BLOOD_CENTER_STAFF)
  @ApiOperation({ summary: 'Manually correct a unit\'s volume, component type, or expiry date' })
  adjustUnit(
    @Param('organizationId') organizationId: string,
    @Param('unitId') unitId: string,
    @Body() dto: AdjustUnitDto,
    @CurrentUser('sub') userId: string,
    @Req() req: Request,
  ) {
    return this.inventory.adjustUnit(organizationId, unitId, userId, dto, req.headers['x-forwarded-for'] as string);
  }

  @Post('units/:unitId/move')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.BLOOD_CENTER_ADMIN, RoleCode.BLOOD_CENTER_STAFF)
  @ApiOperation({ summary: 'Move unit to location' })
  moveUnit(
    @Param('organizationId') organizationId: string,
    @Param('unitId') unitId: string,
    @Body() dto: MoveUnitDto,
    @CurrentUser('sub') userId: string,
    @Req() req: Request,
  ) {
    return this.inventory.moveUnit(organizationId, unitId, userId, dto, req.headers['x-forwarded-for'] as string);
  }

  @Post('units/:unitId/reserve')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.BLOOD_CENTER_ADMIN, RoleCode.BLOOD_CENTER_STAFF, RoleCode.HOSPITAL_ADMIN, RoleCode.HOSPITAL_STAFF)
  @Idempotent('inventory.reserve-unit')
  @UseInterceptors(IdempotencyInterceptor)
  @ApiOperation({ summary: 'Reserve unit' })
  reserveUnit(
    @Param('organizationId') organizationId: string,
    @Param('unitId') unitId: string,
    @Body() dto: ReserveUnitDto,
    @CurrentUser('sub') userId: string,
    @Req() req: Request,
  ) {
    return this.inventory.reserveUnit(organizationId, unitId, userId, dto, req.headers['x-forwarded-for'] as string);
  }

  @Post('reservations/:reservationId/release')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.BLOOD_CENTER_ADMIN, RoleCode.BLOOD_CENTER_STAFF)
  @ApiOperation({ summary: 'Release reservation' })
  releaseReservation(
    @Param('organizationId') organizationId: string,
    @Param('reservationId') reservationId: string,
    @Body() dto: ReleaseReservationDto,
    @CurrentUser('sub') userId: string,
    @Req() req: Request,
  ) {
    return this.inventory.releaseReservation(organizationId, reservationId, userId, dto, req.headers['x-forwarded-for'] as string);
  }

  @Get('locations')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.BLOOD_CENTER_ADMIN, RoleCode.BLOOD_CENTER_STAFF)
  @ApiOperation({ summary: 'Get inventory locations' })
  getLocations(
    @Param('organizationId') organizationId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.inventory.getLocations(organizationId, userId);
  }

  @Post('locations')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.BLOOD_CENTER_ADMIN)
  @ApiOperation({ summary: 'Create inventory location' })
  createLocation(
    @Param('organizationId') organizationId: string,
    @Body() dto: CreateLocationDto,
    @CurrentUser('sub') userId: string,
    @Req() req: Request,
  ) {
    return this.inventory.createLocation(organizationId, userId, dto, req.headers['x-forwarded-for'] as string);
  }

  @Patch('locations/:locationId')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.BLOOD_CENTER_ADMIN)
  @ApiOperation({ summary: 'Update inventory location' })
  updateLocation(
    @Param('organizationId') organizationId: string,
    @Param('locationId') locationId: string,
    @Body() dto: UpdateLocationDto,
    @CurrentUser('sub') userId: string,
    @Req() req: Request,
  ) {
    return this.inventory.updateLocation(organizationId, locationId, userId, dto, req.headers['x-forwarded-for'] as string);
  }

  @Get('movements')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.BLOOD_CENTER_ADMIN, RoleCode.BLOOD_CENTER_STAFF)
  @ApiOperation({ summary: 'Get inventory movements' })
  getMovements(
    @Param('organizationId') organizationId: string,
    @CurrentUser('sub') userId: string,
    @Query() filters: GetMovementsDto,
  ) {
    return this.inventory.getMovements(organizationId, userId, filters);
  }

  @Get('reservations')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.BLOOD_CENTER_ADMIN, RoleCode.BLOOD_CENTER_STAFF)
  @ApiOperation({ summary: 'Get reservations' })
  getReservations(
    @Param('organizationId') organizationId: string,
    @CurrentUser('sub') userId: string,
    @Query() filters: GetReservationsDto,
  ) {
    return this.inventory.getReservations(organizationId, userId, filters);
  }

  @Get('alerts')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.BLOOD_CENTER_ADMIN, RoleCode.BLOOD_CENTER_STAFF)
  @ApiOperation({ summary: 'Get inventory alerts' })
  getAlerts(
    @Param('organizationId') organizationId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.inventory.getAlerts(organizationId, userId);
  }

  @Post('alerts/:alertId/acknowledge')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.BLOOD_CENTER_ADMIN, RoleCode.BLOOD_CENTER_STAFF)
  @ApiOperation({ summary: 'Acknowledge alert' })
  acknowledgeAlert(
    @Param('organizationId') organizationId: string,
    @Param('alertId') alertId: string,
    @CurrentUser('sub') userId: string,
    @Req() req: Request,
  ) {
    return this.inventory.acknowledgeAlert(organizationId, alertId, userId, req.headers['x-forwarded-for'] as string);
  }
}

@ApiTags('Blood Availability')
@Controller('blood-availability')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BloodAvailabilityController {
  constructor(private readonly inventory: InventoryService) {}

  @Get()
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.HOSPITAL_ADMIN, RoleCode.HOSPITAL_STAFF)
  @ApiOperation({ summary: 'Get external blood availability' })
  getAvailability(
    @CurrentUser('sub') userId: string,
    @Query() filters: { bloodType?: string; rhFactor?: string; componentType?: string },
  ) {
    return this.inventory.getBloodAvailability(userId, {
      bloodType: filters.bloodType as any,
      rhFactor: filters.rhFactor as any,
      componentType: filters.componentType as any,
    });
  }
}