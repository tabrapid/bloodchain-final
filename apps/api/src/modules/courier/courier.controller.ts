import { Body, Controller, Get, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleCode } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CourierService } from './courier.service';
import { UpdateCourierStatusDto, UpdateCourierProfileDto } from './dto/courier.dto';

@ApiTags('Courier')
@Controller('courier')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CourierController {
  constructor(private readonly courierService: CourierService) {}

  @Get('profile')
  @Roles(RoleCode.COURIER, RoleCode.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get courier profile' })
  async getProfile(@CurrentUser('sub') userId: string) {
    return { data: await this.courierService.getCourierByUserId(userId) };
  }

  @Patch('profile')
  @Roles(RoleCode.COURIER, RoleCode.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update courier profile' })
  async updateProfile(
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdateCourierProfileDto,
  ) {
    return { data: await this.courierService.updateCourierProfile(userId, dto) };
  }

  @Post('status')
  @Roles(RoleCode.COURIER, RoleCode.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update courier status' })
  async updateStatus(
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdateCourierStatusDto,
  ) {
    return { data: await this.courierService.updateCourierStatus(userId, dto) };
  }

  @Get('shipments')
  @Roles(RoleCode.COURIER, RoleCode.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get courier shipments' })
  getShipments(
    @CurrentUser('sub') userId: string,
    @Query('status') status?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.courierService.getCourierShipments(
      userId,
      { status, limit: limit ? Number(limit) : undefined, offset: offset ? Number(offset) : undefined },
    );
  }

  @Get('shipments/active')
  @Roles(RoleCode.COURIER, RoleCode.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get active shipment' })
  async getActiveShipment(@CurrentUser('sub') userId: string) {
    const courier = await this.courierService.getCourierByUserId(userId);
    return { data: await this.courierService.getActiveShipment(courier.id) };
  }

  @Get('stats')
  @Roles(RoleCode.COURIER, RoleCode.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get courier statistics' })
  async getStats(
    @CurrentUser('sub') userId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const courier = await this.courierService.getCourierByUserId(userId);
    return {
      data: await this.courierService.getCourierStats(
        courier.id,
        startDate ? new Date(startDate) : undefined,
        endDate ? new Date(endDate) : undefined,
      ),
    };
  }
}
