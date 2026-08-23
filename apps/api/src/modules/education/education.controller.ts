import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RoleCode } from '@prisma/client';
import { EducationService } from './education.service';
import {
  CreateEducationalContentDto,
  UpdateEducationalContentDto,
  GetEducationalContentDto,
  EducationalContentResponseDto,
  EducationalContentListResponseDto,
  EducationProgressResponseDto,
} from './dto/education.dto';

@ApiTags('Education')
@Controller('education')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class EducationController {
  constructor(private readonly educationService: EducationService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.HOSPITAL_ADMIN, RoleCode.BLOOD_CENTER_ADMIN)
  @ApiOperation({ summary: 'Create educational content (admin only)' })
  @ApiResponse({ status: 201, description: 'Content created successfully', type: EducationalContentResponseDto })
  async createContent(@Body() dto: CreateEducationalContentDto) {
    return this.educationService.createContent(dto);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.HOSPITAL_ADMIN, RoleCode.BLOOD_CENTER_ADMIN)
  @ApiOperation({ summary: 'Update educational content (admin only)' })
  @ApiResponse({ status: 200, description: 'Content updated successfully', type: EducationalContentResponseDto })
  async updateContent(
    @Param('id') id: string,
    @Body() dto: UpdateEducationalContentDto,
  ) {
    return this.educationService.updateContent(id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all educational content' })
  @ApiResponse({ status: 200, description: 'Content retrieved successfully', type: EducationalContentListResponseDto })
  async getContent(@Query() query: GetEducationalContentDto) {
    return this.educationService.getContent(
      query.page,
      query.limit,
      query.type,
      query.category,
    );
  }

  @Get('my/progress')
  @ApiOperation({ summary: 'Get my education progress' })
  @ApiResponse({ status: 200, description: 'Progress retrieved successfully' })
  async getUserProgress(
    @CurrentUser('sub') userId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    return this.educationService.getUserProgress(userId, page, limit);
  }

  @Get('my/stats')
  @ApiOperation({ summary: 'Get my education statistics' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  async getUserStats(@CurrentUser('sub') userId: string) {
    return this.educationService.getUserStats(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get educational content by ID' })
  @ApiResponse({ status: 200, description: 'Content retrieved successfully', type: EducationalContentResponseDto })
  async getContentById(@Param('id') id: string) {
    return this.educationService.getContentById(id);
  }

  @Post(':id/start')
  @ApiOperation({ summary: 'Start educational content' })
  @ApiResponse({ status: 201, description: 'Content started successfully', type: EducationProgressResponseDto })
  async startContent(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.educationService.startContent(userId, id);
  }

  @Post(':id/complete')
  @ApiOperation({ summary: 'Complete educational content' })
  @ApiResponse({ status: 200, description: 'Content completed successfully', type: EducationProgressResponseDto })
  async completeContent(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.educationService.completeContent(userId, id);
  }
}
