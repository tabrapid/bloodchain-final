import {
  IsEnum,
  IsOptional,
  IsString,
  IsInt,
  IsDateString,
  IsArray,
  IsNotEmpty,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  RoleCode,
  UserStatus,
  OrganizationStatus,
  ContentReportStatus,
  ContentReportReason,
} from '@prisma/client';
import { OptionalBooleanField } from '../../../common/decorators/strict-boolean.decorator';

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

  @OptionalBooleanField()
  aiHealthInsightsEnabled?: boolean;

  @OptionalBooleanField()
  sosEmergencyEnabled?: boolean;

  @OptionalBooleanField()
  gamificationEnabled?: boolean;

  @OptionalBooleanField()
  pushNotificationsEnabled?: boolean;

  @OptionalBooleanField('When enabled, only SUPER_ADMIN accounts can sign in')
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

export class AdminListContentReportsDto {
  @ApiPropertyOptional({ default: '1' })
  @IsOptional()
  @IsString()
  page?: string;

  @ApiPropertyOptional({ default: '20' })
  @IsOptional()
  @IsString()
  limit?: string;

  @ApiPropertyOptional({ enum: ContentReportStatus })
  @IsOptional()
  @IsEnum(ContentReportStatus)
  status?: ContentReportStatus;

  @ApiPropertyOptional({ enum: ContentReportReason })
  @IsOptional()
  @IsEnum(ContentReportReason)
  reason?: ContentReportReason;
}

export class AdminResolveContentReportDto {
  @ApiProperty({ enum: ['DISMISS', 'HIDE', 'REMOVE'] })
  @IsEnum(['DISMISS', 'HIDE', 'REMOVE'])
  action!: 'DISMISS' | 'HIDE' | 'REMOVE';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  resolution?: string;
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
