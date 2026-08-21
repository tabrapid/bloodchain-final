import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { OrganizationStatus, OrganizationType, RoleCode } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { OrganizationsService } from './organizations.service';

@ApiTags('Organizations')
@Controller('organizations')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Get()
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.HOSPITAL_ADMIN, RoleCode.BLOOD_CENTER_ADMIN)
  @ApiOperation({ summary: 'List organizations (admin only)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'type', required: false, enum: OrganizationType })
  @ApiQuery({ name: 'status', required: false })
  @ApiResponse({ status: 200, description: 'Paginated organization list' })
  list(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('type') type?: OrganizationType,
    @Query('status') status?: string,
  ) {
    return this.organizations.findMany(Number(page), Number(limit), {
      type,
      status: status as OrganizationStatus,
    });
  }

  @Get('discover')
  @ApiOperation({ summary: 'Discover active organizations for booking' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'type', required: false, enum: OrganizationType })
  @ApiResponse({ status: 200, description: 'Active organizations for booking' })
  discover(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('type') type?: OrganizationType,
  ) {
    return this.organizations.getActiveOrganizations(Number(page), Number(limit), { type });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an organization by ID' })
  @ApiResponse({ status: 200, description: 'Organization found' })
  findOne(@Param('id') id: string) {
    return this.organizations.findById(id);
  }
}