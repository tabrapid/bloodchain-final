import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleCode } from '@prisma/client';
import { Request } from 'express';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  CancelScreeningOrderDto,
  CollectSampleDto,
  CorrectScreeningResultDto,
  ListScreeningOrdersDto,
  RecordScreeningResultDto,
  RejectSampleDto,
  ReviewScreeningResultDto,
} from './dto/screening.dto';
import { ScreeningOrdersService } from './screening-orders.service';
import { ScreeningResultsService } from './screening-results.service';

/**
 * Blood-bank screening routes.
 *
 * SUPER_ADMIN appears in no role list on this controller. Screening is a
 * laboratory act performed at an organisation, and the services refuse a
 * platform administrator a second time regardless of what these decorators say.
 */
@ApiTags('Blood bank screening')
@Controller('organizations/:organizationId/screening')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ScreeningController {
  constructor(
    private readonly orders: ScreeningOrdersService,
    private readonly results: ScreeningResultsService,
  ) {}

  @Get('orders')
  @Roles(RoleCode.BLOOD_CENTER_ADMIN, RoleCode.BLOOD_CENTER_STAFF)
  @ApiOperation({ summary: 'The screening worklist' })
  listOrders(
    @Param('organizationId') organizationId: string,
    @Query() query: ListScreeningOrdersDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.orders.listOrders(organizationId, userId, query);
  }

  @Get('orders/:orderId')
  @Roles(RoleCode.BLOOD_CENTER_ADMIN, RoleCode.BLOOD_CENTER_STAFF)
  @ApiOperation({ summary: 'One screening order, with the requirements it was raised under' })
  getOrder(
    @Param('organizationId') organizationId: string,
    @Param('orderId') orderId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.orders.getOrder(organizationId, orderId, userId);
  }

  @Post('donations/:donationId/orders')
  @Roles(RoleCode.BLOOD_CENTER_ADMIN, RoleCode.BLOOD_CENTER_STAFF)
  @ApiOperation({ summary: 'Raise a screening order for a completed donation' })
  createOrder(
    @Param('organizationId') organizationId: string,
    @Param('donationId') donationId: string,
    @CurrentUser('sub') userId: string,
    @Req() req: Request,
  ) {
    return this.orders.createForDonation(
      organizationId,
      donationId,
      userId,
      req.headers['x-forwarded-for'] as string,
    );
  }

  @Post('donations/:donationId/samples')
  @Roles(RoleCode.BLOOD_CENTER_ADMIN, RoleCode.BLOOD_CENTER_STAFF)
  @ApiOperation({ summary: 'Record that a sample was collected' })
  collectSample(
    @Param('organizationId') organizationId: string,
    @Param('donationId') donationId: string,
    @Body() dto: CollectSampleDto,
    @CurrentUser('sub') userId: string,
    @Req() req: Request,
  ) {
    return this.orders.collectSample(
      organizationId,
      donationId,
      userId,
      dto,
      req.headers['x-forwarded-for'] as string,
    );
  }

  @Post('samples/:sampleId/reject')
  @Roles(RoleCode.BLOOD_CENTER_ADMIN, RoleCode.BLOOD_CENTER_STAFF)
  @ApiOperation({ summary: 'Mark a sample unusable' })
  rejectSample(
    @Param('organizationId') organizationId: string,
    @Param('sampleId') sampleId: string,
    @Body() dto: RejectSampleDto,
    @CurrentUser('sub') userId: string,
    @Req() req: Request,
  ) {
    return this.orders.rejectSample(
      organizationId,
      sampleId,
      userId,
      dto,
      req.headers['x-forwarded-for'] as string,
    );
  }

  @Post('orders/:orderId/cancel')
  @Roles(RoleCode.BLOOD_CENTER_ADMIN, RoleCode.BLOOD_CENTER_STAFF)
  @ApiOperation({ summary: 'Cancel a screening order' })
  cancelOrder(
    @Param('organizationId') organizationId: string,
    @Param('orderId') orderId: string,
    @Body() dto: CancelScreeningOrderDto,
    @CurrentUser('sub') userId: string,
    @Req() req: Request,
  ) {
    return this.orders.cancelOrder(
      organizationId,
      orderId,
      userId,
      dto,
      req.headers['x-forwarded-for'] as string,
    );
  }

  @Post('orders/:orderId/results')
  @Roles(RoleCode.BLOOD_CENTER_ADMIN, RoleCode.BLOOD_CENTER_STAFF)
  @ApiOperation({ summary: 'Record a screening result, with its provenance' })
  recordResult(
    @Param('organizationId') organizationId: string,
    @Param('orderId') orderId: string,
    @Body() dto: RecordScreeningResultDto,
    @CurrentUser('sub') userId: string,
    @Req() req: Request,
  ) {
    return this.results.recordResult(
      organizationId,
      orderId,
      userId,
      dto,
      req.headers['x-forwarded-for'] as string,
    );
  }

  @Post('results/:resultId/review')
  @Roles(RoleCode.BLOOD_CENTER_ADMIN, RoleCode.BLOOD_CENTER_STAFF)
  @ApiOperation({ summary: 'Review a screening result (never the person who recorded it)' })
  reviewResult(
    @Param('organizationId') organizationId: string,
    @Param('resultId') resultId: string,
    @Body() dto: ReviewScreeningResultDto,
    @CurrentUser('sub') userId: string,
    @Req() req: Request,
  ) {
    return this.results.reviewResult(
      organizationId,
      resultId,
      userId,
      dto,
      req.headers['x-forwarded-for'] as string,
    );
  }

  @Post('results/:resultId/correct')
  @Roles(RoleCode.BLOOD_CENTER_ADMIN, RoleCode.BLOOD_CENTER_STAFF)
  @ApiOperation({
    summary: 'Correct a screening result. Never overwrites; may open a recall.',
  })
  correctResult(
    @Param('organizationId') organizationId: string,
    @Param('resultId') resultId: string,
    @Body() dto: CorrectScreeningResultDto,
    @CurrentUser('sub') userId: string,
    @Req() req: Request,
  ) {
    return this.results.correctResult(
      organizationId,
      resultId,
      userId,
      dto,
      req.headers['x-forwarded-for'] as string,
    );
  }
}
