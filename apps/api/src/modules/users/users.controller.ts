import { Body, Controller, Get, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { RoleCode } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UsersService } from './users.service';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'User profile' })
  @ApiResponse({ status: 404, description: 'User not found' })
  getProfile(@CurrentUser('sub') userId: string) {
    return this.users.getProfile(userId);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({ status: 200, description: 'Profile updated' })
  @ApiResponse({ status: 404, description: 'User not found' })
  updateProfile(
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdateUserProfileDto,
    @Req() req: Request,
  ) {
    const data = {
      firstName: dto.firstName,
      lastName: dto.lastName,
      displayName: dto.displayName,
      phone: dto.phone,
      dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
    };
    return this.users.updateProfile(userId, data, req.headers['x-forwarded-for'] as string);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.HOSPITAL_ADMIN, RoleCode.BLOOD_CENTER_ADMIN)
  @ApiOperation({ summary: 'List users (administrators)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Paginated user list' })
  list(@Query('page') page = '1', @Query('limit') limit = '20') {
    return this.users.findMany(Number(page), Number(limit));
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(RoleCode.SUPER_ADMIN, RoleCode.HOSPITAL_ADMIN, RoleCode.BLOOD_CENTER_ADMIN)
  @ApiOperation({ summary: 'Get a user by ID (administrators)' })
  @ApiResponse({ status: 200, description: 'User found' })
  @ApiResponse({ status: 404, description: 'User not found' })
  findOne(@Param('id') id: string) {
    return this.users.findById(id);
  }
}