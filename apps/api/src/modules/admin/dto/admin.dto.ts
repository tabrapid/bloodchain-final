import {
  IsEnum,
  IsOptional,
  IsString,
  IsBoolean,
  IsInt,
  IsNumber,
  IsDateString,
  IsArray,
  IsNotEmpty,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RoleCode, UserStatus, OrganizationStatus } from '@prisma/client';

export class AdminUpdateRolePermissionsDto {
  @ApiProperty({ type: [String], example: ['organization.read', 'shipment.manage'] })
  @IsArray()
  @IsString({ each: true })
  permissionCodes!: string[];
}

export class AdminUpdateMembershipRoleDto {
  @ApiProperty({ description: 'The Role id to move this membership to' })
  @IsString()
  @IsNotEmpty()
  roleId!: string;
}

export class AdminUpdatePlatformSettingsDto {
  @ApiPropertyOptional({ minimum: 15, maximum: 43200, description: 'How long a session stays valid before requiring re-login' })
  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(43200)
  sessionTimeoutMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  aiHealthInsightsEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  sosEmergencyEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  gamificationEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  pushNotificationsEnabled?: boolean;

  @ApiPropertyOptional({ description: 'When enabled, only SUPER_ADMIN accounts can sign in' })
  @IsOptional()
  @IsBoolean()
  maintenanceMode?: boolean;
}

export class AdminListUsersDto {
  @ApiPropertyOptional({ default: '1' })
  @IsOptional()
  @IsString()
  page?: string;

  @ApiPropertyOptional({ default: '20' })
  @IsOptional()
  @IsString()
  limit?: string;

  @ApiPropertyOptional({ enum: RoleCode })
  @IsOptional()
  @IsEnum(RoleCode)
  role?: RoleCode;

  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  organizationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}

export class AdminListOrganizationsDto {
  @ApiPropertyOptional({ default: '1' })
  @IsOptional()
  @IsString()
  page?: string;

  @ApiPropertyOptional({ default: '20' })
  @IsOptional()
  @IsString()
  limit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ enum: OrganizationStatus })
  @IsOptional()
  @IsEnum(OrganizationStatus)
  status?: OrganizationStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}

export class AdminListCouriersDto {
  @ApiPropertyOptional({ default: '1' })
  @IsOptional()
  @IsString()
  page?: string;

  @ApiPropertyOptional({ default: '20' })
  @IsOptional()
  @IsString()
  limit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  organizationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}

export class AdminSuspendUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class AdminVerifyOrganizationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class AdminRejectOrganizationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

export class AdminSuspendOrganizationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

export class AdminVerifyCourierDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class AdminRejectCourierDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

export class AdminSuspendCourierDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

export class AdminSearchDto {
  @ApiPropertyOptional({ default: '1' })
  @IsOptional()
  @IsString()
  page?: string;

  @ApiPropertyOptional({ default: '20' })
  @IsOptional()
  @IsString()
  limit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  query?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  type?: string;
}

export class AdminListAuditLogsDto {
  @ApiPropertyOptional({ default: '1' })
  @IsOptional()
  @IsString()
  page?: string;

  @ApiPropertyOptional({ default: '50' })
  @IsOptional()
  @IsString()
  limit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  actorId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  action?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  entityType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  result?: string;
}

export class AdminListSupportTicketsDto {
  @ApiPropertyOptional({ default: '1' })
  @IsOptional()
  @IsString()
  page?: string;

  @ApiPropertyOptional({ default: '20' })
  @IsOptional()
  @IsString()
  limit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  priority?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;
}

export class AdminAssignTicketDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  adminId?: string;
}

export class AdminUpdateTicketDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  priority?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  resolution?: string;
}

export class AdminCreateTicketDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  priority?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

export class AdminListAlertsDto {
  @ApiPropertyOptional({ default: '1' })
  @IsOptional()
  @IsString()
  page?: string;

  @ApiPropertyOptional({ default: '50' })
  @IsOptional()
  @IsString()
  limit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  severity?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  acknowledged?: string;
}

export class AdminAcknowledgeAlertDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class AdminListFeatureFlagsDto {
  @ApiPropertyOptional({ default: '1' })
  @IsOptional()
  @IsString()
  page?: string;

  @ApiPropertyOptional({ default: '50' })
  @IsOptional()
  @IsString()
  limit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  enabled?: string;
}

export class AdminUpdateFeatureFlagDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class AdminListAnnouncementsDto {
  @ApiPropertyOptional({ default: '1' })
  @IsOptional()
  @IsString()
  page?: string;

  @ApiPropertyOptional({ default: '20' })
  @IsOptional()
  @IsString()
  limit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  active?: string;
}

export class AdminCreateAnnouncementDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  body?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetRoles?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  startsAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  endsAt?: string;
}

export class AdminUpdateAnnouncementDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  body?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetRoles?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  startsAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  endsAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class AdminListShipmentsDto {
  @ApiPropertyOptional({ default: '1' })
  @IsOptional()
  @IsString()
  page?: string;

  @ApiPropertyOptional({ default: '20' })
  @IsOptional()
  @IsString()
  limit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  priority?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sourceOrganizationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  destinationOrganizationId?: string;
}

export class AdminListBloodRequestsDto {
  @ApiPropertyOptional({ default: '1' })
  @IsOptional()
  @IsString()
  page?: string;

  @ApiPropertyOptional({ default: '20' })
  @IsOptional()
  @IsString()
  limit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  priority?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bloodType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  organizationId?: string;
}

export class AdminListEmergenciesDto {
  @ApiPropertyOptional({ default: '1' })
  @IsOptional()
  @IsString()
  page?: string;

  @ApiPropertyOptional({ default: '20' })
  @IsOptional()
  @IsString()
  limit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bloodType?: string;
}

export class AdminPlatformStatsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class AdminUpdateSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  maintenanceMode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  sosEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  courierEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  gamificationEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  aiInsightsEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  platformName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  supportEmail?: string;
}
