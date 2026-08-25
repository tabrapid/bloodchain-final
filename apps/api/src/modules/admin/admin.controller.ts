import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  UseInterceptors,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { RoleCode } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { WrapResponseInterceptor } from '../../common/interceptors/wrap-response.interceptor';
import { AdminService } from './admin.service';
import {
  AdminListUsersDto,
  AdminListOrganizationsDto,
  AdminListCouriersDto,
  AdminSuspendUserDto,
  AdminVerifyOrganizationDto,
  AdminRejectOrganizationDto,
  AdminSuspendOrganizationDto,
  AdminSearchDto,
  AdminListAuditLogsDto,
  AdminListShipmentsDto,
  AdminListBloodRequestsDto,
  AdminListEmergenciesDto,
  AdminListAlertsDto,
  AdminAcknowledgeAlertDto,
  AdminUpdateRolePermissionsDto,
  AdminUpdateMembershipRoleDto,
} from './dto/admin.dto';

@ApiTags('Admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@UseInterceptors(WrapResponseInterceptor)
@ApiBearerAuth()
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('dashboard')
  @Roles(RoleCode.SUPER_ADMIN)
  @Permissions('admin.manage')
  @ApiOperation({ summary: 'Get platform dashboard overview' })
  getDashboard(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.admin.getPlatformStats(
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  @Get('activity')
  @Roles(RoleCode.SUPER_ADMIN)
  @Permissions('admin.manage')
  @ApiOperation({ summary: 'Get recent platform activity' })
  getActivityFeed(
    @Query('limit', new DefaultValuePipe('50')) limit?: string,
    @Query('offset', new DefaultValuePipe('0')) offset?: string,
  ) {
    return this.admin.getActivityFeed(Number(limit), Number(offset));
  }

  @Get('users')
  @Roles(RoleCode.SUPER_ADMIN)
  @Permissions('admin.manage')
  @ApiOperation({ summary: 'List all users' })
  listUsers(@Query() query: AdminListUsersDto) {
    return this.admin.listUsers({
      page: Number(query.page) || 1,
      limit: Number(query.limit) || 20,
      role: query.role,
      status: query.status,
      organizationId: query.organizationId,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      search: query.search,
    });
  }

  @Get('users/:id')
  @Roles(RoleCode.SUPER_ADMIN)
  @Permissions('admin.manage')
  @ApiOperation({ summary: 'Get user details' })
  getUser(@Param('id') id: string) {
    return this.admin.getUser(id);
  }

  @Post('users/:id/suspend')
  @Roles(RoleCode.SUPER_ADMIN)
  @Permissions('admin.manage')
  @ApiOperation({ summary: 'Suspend a user' })
  suspendUser(
    @CurrentUser('sub') adminId: string,
    @Param('id') userId: string,
    @Body() body: AdminSuspendUserDto,
  ) {
    return this.admin.suspendUser(
      adminId,
      userId,
      body.reason,
      body.expiresAt ? new Date(body.expiresAt) : undefined,
    );
  }

  @Post('users/:id/restore')
  @Roles(RoleCode.SUPER_ADMIN)
  @Permissions('admin.manage')
  @ApiOperation({ summary: 'Restore a suspended user' })
  restoreUser(@CurrentUser('sub') adminId: string, @Param('id') userId: string) {
    return this.admin.restoreUser(adminId, userId);
  }

  @Get('roles')
  @Roles(RoleCode.SUPER_ADMIN)
  @Permissions('admin.manage')
  @ApiOperation({ summary: 'List all roles with their assigned permissions' })
  listRoles() {
    return this.admin.listRoles();
  }

  @Get('permissions')
  @Roles(RoleCode.SUPER_ADMIN)
  @Permissions('admin.manage')
  @ApiOperation({ summary: 'List the full permission catalog' })
  listPermissions() {
    return this.admin.listPermissions();
  }

  @Patch('roles/:id/permissions')
  @Roles(RoleCode.SUPER_ADMIN)
  @Permissions('admin.manage')
  @ApiOperation({ summary: "Replace a role's permission set" })
  updateRolePermissions(
    @CurrentUser('sub') adminId: string,
    @Param('id') roleId: string,
    @Body() body: AdminUpdateRolePermissionsDto,
  ) {
    return this.admin.updateRolePermissions(adminId, roleId, body.permissionCodes);
  }

  @Patch('memberships/:id/role')
  @Roles(RoleCode.SUPER_ADMIN)
  @Permissions('admin.manage')
  @ApiOperation({ summary: "Change a user's role within an organization" })
  updateMembershipRole(
    @CurrentUser('sub') adminId: string,
    @Param('id') membershipId: string,
    @Body() body: AdminUpdateMembershipRoleDto,
  ) {
    return this.admin.updateMembershipRole(adminId, membershipId, body.roleId);
  }

  @Get('organizations')
  @Roles(RoleCode.SUPER_ADMIN)
  @Permissions('admin.manage')
  @ApiOperation({ summary: 'List all organizations' })
  listOrganizations(@Query() query: AdminListOrganizationsDto) {
    return this.admin.listOrganizations({
      page: Number(query.page) || 1,
      limit: Number(query.limit) || 20,
      type: query.type as any,
      status: query.status,
      search: query.search,
    });
  }

  @Get('organizations/:id')
  @Roles(RoleCode.SUPER_ADMIN)
  @Permissions('admin.manage')
  @ApiOperation({ summary: 'Get organization details' })
  getOrganization(@Param('id') id: string) {
    return this.admin.getOrganization(id);
  }

  @Post('organizations/:id/verify')
  @Roles(RoleCode.SUPER_ADMIN)
  @Permissions('admin.manage')
  @ApiOperation({ summary: 'Verify an organization' })
  verifyOrganization(
    @CurrentUser('sub') adminId: string,
    @Param('id') orgId: string,
    @Body() body: AdminVerifyOrganizationDto,
  ) {
    return this.admin.verifyOrganization(adminId, orgId, body.notes);
  }

  @Post('organizations/:id/reject')
  @Roles(RoleCode.SUPER_ADMIN)
  @Permissions('admin.manage')
  @ApiOperation({ summary: 'Reject an organization' })
  rejectOrganization(
    @CurrentUser('sub') adminId: string,
    @Param('id') orgId: string,
    @Body() body: AdminRejectOrganizationDto,
  ) {
    return this.admin.rejectOrganization(adminId, orgId, body.reason || 'Rejected by admin');
  }

  @Post('organizations/:id/suspend')
  @Roles(RoleCode.SUPER_ADMIN)
  @Permissions('admin.manage')
  @ApiOperation({ summary: 'Suspend an organization' })
  suspendOrganization(
    @CurrentUser('sub') adminId: string,
    @Param('id') orgId: string,
    @Body() body: AdminSuspendOrganizationDto,
  ) {
    return this.admin.suspendOrganization(adminId, orgId, body.reason);
  }

  @Post('organizations/:id/restore')
  @Roles(RoleCode.SUPER_ADMIN)
  @Permissions('admin.manage')
  @ApiOperation({ summary: 'Restore a suspended organization' })
  restoreOrganization(@CurrentUser('sub') adminId: string, @Param('id') orgId: string) {
    return this.admin.restoreOrganization(adminId, orgId);
  }

  @Get('couriers')
  @Roles(RoleCode.SUPER_ADMIN)
  @Permissions('admin.manage')
  @ApiOperation({ summary: 'List all couriers' })
  listCouriers(@Query() query: AdminListCouriersDto) {
    return this.admin.listCouriers({
      page: Number(query.page) || 1,
      limit: Number(query.limit) || 20,
      status: query.status as any,
      organizationId: query.organizationId,
      search: query.search,
    });
  }

  @Get('couriers/:id')
  @Roles(RoleCode.SUPER_ADMIN)
  @Permissions('admin.manage')
  @ApiOperation({ summary: 'Get courier details' })
  getCourier(@Param('id') id: string) {
    return this.admin.getCourier(id);
  }

  @Post('couriers/:id/suspend')
  @Roles(RoleCode.SUPER_ADMIN)
  @Permissions('admin.manage')
  @ApiOperation({ summary: 'Suspend a courier' })
  suspendCourier(
    @CurrentUser('sub') adminId: string,
    @Param('id') courierId: string,
    @Body() body: { reason?: string },
  ) {
    return this.admin.suspendCourier(adminId, courierId, body.reason);
  }

  @Post('couriers/:id/restore')
  @Roles(RoleCode.SUPER_ADMIN)
  @Permissions('admin.manage')
  @ApiOperation({ summary: 'Restore a suspended courier' })
  restoreCourier(@CurrentUser('sub') adminId: string, @Param('id') courierId: string) {
    return this.admin.restoreCourier(adminId, courierId);
  }

  @Get('search')
  @Roles(RoleCode.SUPER_ADMIN)
  @Permissions('admin.manage')
  @ApiOperation({ summary: 'Global search across platform' })
  search(@Query() query: AdminSearchDto) {
    return this.admin.search(
      query.query || '',
      query.type,
      Number(query.page) || 1,
      Number(query.limit) || 20,
    );
  }

  @Get('audit-logs')
  @Roles(RoleCode.SUPER_ADMIN)
  @Permissions('admin.manage')
  @ApiOperation({ summary: 'List audit logs' })
  listAuditLogs(@Query() query: AdminListAuditLogsDto) {
    return this.admin.listAuditLogs({
      page: Number(query.page) || 1,
      limit: Number(query.limit) || 50,
      actorId: query.actorId,
      action: query.action,
      entityType: query.entityType,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      result: query.result,
    });
  }

  @Get('shipments')
  @Roles(RoleCode.SUPER_ADMIN)
  @Permissions('admin.manage')
  @ApiOperation({ summary: 'List all shipments' })
  listShipments(@Query() query: AdminListShipmentsDto) {
    return this.admin.listShipments({
      page: Number(query.page) || 1,
      limit: Number(query.limit) || 20,
      status: query.status as any,
      priority: query.priority,
      sourceOrganizationId: query.sourceOrganizationId,
      destinationOrganizationId: query.destinationOrganizationId,
    });
  }

  @Get('shipments/:id')
  @Roles(RoleCode.SUPER_ADMIN)
  @Permissions('admin.manage')
  @ApiOperation({ summary: 'Get shipment details' })
  getShipment(@Param('id') id: string) {
    return this.admin.getShipment(id);
  }

  @Get('blood-requests')
  @Roles(RoleCode.SUPER_ADMIN)
  @Permissions('admin.manage')
  @ApiOperation({ summary: 'List all blood requests' })
  listBloodRequests(@Query() query: AdminListBloodRequestsDto) {
    return this.admin.listBloodRequests({
      page: Number(query.page) || 1,
      limit: Number(query.limit) || 20,
      status: query.status as any,
      priority: query.priority,
      bloodType: query.bloodType,
      organizationId: query.organizationId,
    });
  }

  @Get('emergencies')
  @Roles(RoleCode.SUPER_ADMIN)
  @Permissions('admin.manage')
  @ApiOperation({ summary: 'List all emergency SOS requests' })
  listEmergencies(@Query() query: AdminListEmergenciesDto) {
    return this.admin.listEmergencies({
      page: Number(query.page) || 1,
      limit: Number(query.limit) || 20,
      status: query.status as any,
      bloodType: query.bloodType,
    });
  }

  @Get('inventory/overview')
  @Roles(RoleCode.SUPER_ADMIN)
  @Permissions('admin.manage')
  @ApiOperation({ summary: 'Get platform inventory overview' })
  getInventoryOverview() {
    return this.admin.getInventoryOverview();
  }

  @Get('alerts')
  @Roles(RoleCode.SUPER_ADMIN)
  @Permissions('admin.manage')
  @ApiOperation({ summary: 'List all alerts' })
  listAlerts(@Query() query: AdminListAlertsDto) {
    return this.admin.listAlerts({
      page: Number(query.page) || 1,
      limit: Number(query.limit) || 50,
      severity: query.severity,
      category: query.category,
      acknowledged: query.acknowledged === 'true' ? true : query.acknowledged === 'false' ? false : undefined,
    });
  }

  @Post('alerts/:id/acknowledge')
  @Roles(RoleCode.SUPER_ADMIN)
  @Permissions('admin.manage')
  @ApiOperation({ summary: 'Acknowledge an alert' })
  acknowledgeAlert(
    @CurrentUser('sub') adminId: string,
    @Param('id') alertId: string,
    @Body() body: AdminAcknowledgeAlertDto,
  ) {
    return this.admin.acknowledgeAlert(adminId, alertId, body.notes);
  }

  @Get('health')
  @Roles(RoleCode.SUPER_ADMIN)
  @Permissions('admin.manage')
  @ApiOperation({ summary: 'Get system health status' })
  getSystemHealth() {
    return this.admin.getSystemHealth();
  }
}
