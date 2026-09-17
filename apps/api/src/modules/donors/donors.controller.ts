import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RoleCode } from '@prisma/client';
import { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { DonorsService } from './donors.service';
import { UpdateDonorProfileDto } from './dto/update-donor-profile.dto';
import { ListDonorsQueryDto } from './dto/list-donors.dto';
import { VerifyBloodTypeDto } from './dto/verify-blood-type.dto';

@ApiTags('Donors')
@Controller('donors')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DonorsController {
  constructor(private readonly donors: DonorsService) {}

  @Get('profile')
  @Roles(RoleCode.DONOR)
  @ApiOperation({ summary: 'Get own donor profile' })
  @ApiResponse({ status: 200, description: 'Donor profile' })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  getProfile(@CurrentUser('sub') userId: string) {
    return this.donors.getProfile(userId);
  }

  @Put('profile')
  @Roles(RoleCode.DONOR)
  @ApiOperation({ summary: 'Update own donor profile' })
  @ApiResponse({ status: 200, description: 'Profile updated' })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  updateProfile(@CurrentUser('sub') userId: string, @Body() dto: UpdateDonorProfileDto) {
    const data: Parameters<DonorsService['updateProfile']>[1] = {
      ...dto,
      dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
    };
    return this.donors.updateProfile(userId, data);
  }

  @Get('profile/completion')
  @Roles(RoleCode.DONOR)
  @ApiOperation({ summary: 'Get profile completion percentage' })
  @ApiResponse({ status: 200, description: 'Profile completion data' })
  getProfileCompletion(@CurrentUser('sub') userId: string) {
    return this.donors.getProfileCompletion(userId);
  }

  @Post(':id/verify-blood-type')
  @HttpCode(HttpStatus.OK)
  @UseGuards(PermissionsGuard)
  @Permissions('donor.verify')
  @ApiOperation({ summary: 'Verify donor blood type (staff only)' })
  @ApiResponse({ status: 200, description: 'Blood type verified' })
  @ApiResponse({ status: 403, description: 'Not authorized' })
  @ApiResponse({ status: 404, description: 'Donor not found' })
  verifyBloodType(
    @Param('id') id: string,
    @Body() dto: VerifyBloodTypeDto,
    @CurrentUser('sub') userId: string,
    @Req() req: Request,
  ) {
    return this.donors.verifyBloodType(id, userId, dto, req.headers['x-forwarded-for'] as string);
  }

  @Get(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('donor.read.self')
  @ApiOperation({ summary: 'Get donor by ID' })
  @ApiResponse({ status: 200, description: 'Donor profile' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Donor not found' })
  getDonor(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.donors.getDonorById(id, userId);
  }

  @Get()
  @Roles(
    RoleCode.SUPER_ADMIN,
    RoleCode.HOSPITAL_ADMIN,
    RoleCode.HOSPITAL_STAFF,
    RoleCode.BLOOD_CENTER_ADMIN,
    RoleCode.BLOOD_CENTER_STAFF,
  )
  @ApiOperation({ summary: 'List donors (staff only)' })
  @ApiResponse({ status: 200, description: 'Paginated donor list' })
  @ApiResponse({ status: 400, description: 'Unusable filter value' })
  listDonors(@Query() query: ListDonorsQueryDto) {
    const { page = 1, limit = 20, ...filters } = query;
    return this.donors.listDonors(page, limit, filters);
  }
}