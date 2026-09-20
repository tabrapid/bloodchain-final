import { Body, Controller, Delete, Get, Param, Put, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { RoleCode } from '@prisma/client';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { InventoryThresholdsService } from './inventory-thresholds.service';
import { UpsertThresholdDto } from './dto/inventory-thresholds.dto';

/**
 * Organisation-administration routes. Staff can see the alerts; only an
 * administrator changes the number that produces them, so a noisy shift cannot
 * quietly widen the organisation's blind spot.
 */
@ApiTags('Inventory thresholds')
@Controller('organizations/:organizationId/inventory/thresholds')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class InventoryThresholdsController {
  constructor(private readonly thresholds: InventoryThresholdsService) {}

  @Get()
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.BLOOD_CENTER_ADMIN, RoleCode.HOSPITAL_ADMIN)
  @ApiOperation({ summary: 'Low-stock thresholds configured for this organization' })
  list(
    @Param('organizationId') organizationId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.thresholds.list(organizationId, userId);
  }

  /**
   * PUT rather than POST: the scope (organisation default, blood group, blood
   * group and component) is the identity of the row, so sending the same scope
   * twice updates rather than duplicating.
   */
  @Put()
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.BLOOD_CENTER_ADMIN, RoleCode.HOSPITAL_ADMIN)
  @ApiOperation({ summary: 'Set the low-stock threshold for one scope' })
  upsert(
    @Param('organizationId') organizationId: string,
    @Body() dto: UpsertThresholdDto,
    @CurrentUser('sub') userId: string,
    @Req() req: Request,
  ) {
    return this.thresholds.upsert(organizationId, userId, dto, req.headers['x-forwarded-for'] as string);
  }

  @Delete(':thresholdId')
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.BLOOD_CENTER_ADMIN, RoleCode.HOSPITAL_ADMIN)
  @ApiOperation({ summary: 'Remove a configured threshold' })
  remove(
    @Param('organizationId') organizationId: string,
    @Param('thresholdId') thresholdId: string,
    @CurrentUser('sub') userId: string,
    @Req() req: Request,
  ) {
    return this.thresholds.remove(organizationId, thresholdId, userId, req.headers['x-forwarded-for'] as string);
  }
}
