import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { RoleCode } from '@prisma/client';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { DonorDeferralsService } from './donor-deferrals.service';
import { CreateDeferralDto, LiftDeferralDto } from './dto/donor-deferrals.dto';

/**
 * Staff routes. Every one of them is organisation-scoped and role-guarded, and
 * DONOR is absent from every role list here: a donor cannot raise a deferral,
 * and — the part that matters — cannot lift one.
 */
@ApiTags('Donor deferrals')
@Controller('organizations/:organizationId/donors/:donorId/deferrals')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DonorDeferralsController {
  constructor(private readonly deferrals: DonorDeferralsService) {}

  @Get()
  @Roles(
    RoleCode.SUPER_ADMIN,
    RoleCode.BLOOD_CENTER_ADMIN,
    RoleCode.BLOOD_CENTER_STAFF,
    RoleCode.HOSPITAL_ADMIN,
    RoleCode.HOSPITAL_STAFF,
  )
  @ApiOperation({ summary: 'Active deferral and full deferral history for a donor' })
  list(
    @Param('organizationId') organizationId: string,
    @Param('donorId') donorId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.deferrals.listForDonor(organizationId, donorId, userId);
  }

  @Post()
  @Roles(
    RoleCode.SUPER_ADMIN,
    RoleCode.BLOOD_CENTER_ADMIN,
    RoleCode.BLOOD_CENTER_STAFF,
    RoleCode.HOSPITAL_ADMIN,
    RoleCode.HOSPITAL_STAFF,
  )
  @ApiOperation({ summary: 'Defer a donor' })
  create(
    @Param('organizationId') organizationId: string,
    @Param('donorId') donorId: string,
    @Body() dto: CreateDeferralDto,
    @CurrentUser('sub') userId: string,
    @Req() req: Request,
  ) {
    return this.deferrals.createForDonor(
      organizationId,
      donorId,
      userId,
      dto,
      req.headers['x-forwarded-for'] as string,
    );
  }

  @Post(':deferralId/lift')
  @Roles(
    RoleCode.SUPER_ADMIN,
    RoleCode.BLOOD_CENTER_ADMIN,
    RoleCode.BLOOD_CENTER_STAFF,
    RoleCode.HOSPITAL_ADMIN,
    RoleCode.HOSPITAL_STAFF,
  )
  @ApiOperation({ summary: 'Lift a deferral (authorized staff, with a reason)' })
  lift(
    @Param('organizationId') organizationId: string,
    @Param('deferralId') deferralId: string,
    @Body() dto: LiftDeferralDto,
    @CurrentUser('sub') userId: string,
    @Req() req: Request,
  ) {
    return this.deferrals.liftDeferral(
      organizationId,
      deferralId,
      userId,
      dto.reason,
      req.headers['x-forwarded-for'] as string,
    );
  }
}

/**
 * What a donor may see about their own deferral: that there is one, and until
 * when. Read-only by construction — there is no write route on this controller,
 * so "donor cannot lift their own deferral" is a property of the routing table
 * rather than a check somebody has to remember.
 */
@ApiTags('Donor deferrals')
@Controller('donors/me/deferral')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DonorDeferralsSelfController {
  constructor(private readonly deferrals: DonorDeferralsService) {}

  @Get()
  @Roles(RoleCode.DONOR)
  @ApiOperation({ summary: "The signed-in donor's own deferral status" })
  getOwn(@CurrentUser('sub') userId: string) {
    return this.deferrals.getOwnDeferral(userId);
  }
}
