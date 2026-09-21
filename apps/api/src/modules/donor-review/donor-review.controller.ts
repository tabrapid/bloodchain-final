import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleCode } from '@prisma/client';
import { Request } from 'express';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { DonorReviewService } from './donor-review.service';
import { ListDonorReviewsDto, ResolveDonorReviewDto } from './dto/donor-review.dto';

/**
 * Staff routes for medical review.
 *
 * SUPER_ADMIN is absent from both role lists. It is not an omission: resolving
 * a medical review is a clinical decision about a person, and the service
 * refuses a platform administrator a second time even if a future edit to this
 * decorator lets one through.
 */
@ApiTags('Donor medical review')
@Controller('organizations/:organizationId/donor-reviews')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DonorReviewController {
  constructor(private readonly reviews: DonorReviewService) {}

  @Get()
  @Roles(RoleCode.BLOOD_CENTER_ADMIN, RoleCode.BLOOD_CENTER_STAFF)
  @ApiOperation({ summary: 'Medical reviews awaiting a clinician at this organization' })
  list(
    @Param('organizationId') organizationId: string,
    @Query() query: ListDonorReviewsDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.reviews.listForOrganization(organizationId, userId, { status: query.status });
  }

  @Post(':triggerId/resolve')
  @Roles(RoleCode.BLOOD_CENTER_ADMIN, RoleCode.BLOOD_CENTER_STAFF)
  @ApiOperation({ summary: 'Resolve a medical review (authorized clinician only)' })
  resolve(
    @Param('organizationId') organizationId: string,
    @Param('triggerId') triggerId: string,
    @Body() dto: ResolveDonorReviewDto,
    @CurrentUser('sub') userId: string,
    @Req() req: Request,
  ) {
    return this.reviews.resolve(
      organizationId,
      triggerId,
      userId,
      dto,
      req.headers['x-forwarded-for'] as string,
    );
  }
}

/**
 * The donor's own view: one boolean and one sentence.
 *
 * Separate controller because it is a different audience with a different
 * guard, and keeping them apart is what stops a staff projection being reused
 * on a donor route by accident.
 */
@ApiTags('Donor medical review')
@Controller('donors/me')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DonorReviewSelfController {
  constructor(private readonly reviews: DonorReviewService) {}

  @Get('medical-review')
  @ApiOperation({ summary: 'Whether a medical review stands before this donor may donate again' })
  async mine(@CurrentUser('sub') userId: string) {
    return { data: await this.reviews.getDonorFacingStatus(userId) };
  }
}
