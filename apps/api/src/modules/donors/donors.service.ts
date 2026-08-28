import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BloodType,
  DonorStatus,
  Prisma,
  RhFactor,
  VerificationSource,
  VerificationStatus,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

export interface ProfileCompletion {
  percentage: number;
  completed: string[];
  missing: string[];
}

@Injectable()
export class DonorsService {
  constructor(
    private readonly db: PrismaService,
    private readonly audit: AuditLogsService,
  ) {}

  async getProfile(userId: string) {
    const profile = await this.db.donorProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            displayName: true,
            avatarUrl: true,
            dateOfBirth: true,
          },
        },
      },
    });

    if (!profile) {
      throw new NotFoundException('Donor profile not found.');
    }

    return {
      data: {
        id: profile.id,
        userId: profile.userId,
        bloodType: profile.bloodType,
        rhFactor: profile.rhFactor,
        bloodTypeVerifiedAt: profile.bloodTypeVerifiedAt,
        bloodTypeSource: profile.bloodTypeSource,
        city: profile.city,
        district: profile.district,
        donorStatus: profile.donorStatus,
        verificationStatus: profile.verificationStatus,
        dateOfBirth: profile.dateOfBirth,
        consentLocation: profile.consentLocation,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
        user: profile.user,
      },
    };
  }

  async updateProfile(
    userId: string,
    data: {
      bloodType?: BloodType;
      rhFactor?: RhFactor;
      city?: string;
      district?: string;
      donorStatus?: DonorStatus;
      dateOfBirth?: Date;
      consentLocation?: boolean;
      latitude?: number;
      longitude?: number;
    },
  ) {
    const profile = await this.db.donorProfile.findUnique({ where: { userId } });
    if (!profile) {
      throw new NotFoundException('Donor profile not found.');
    }

    // Only the fields verifyBloodType actually vouches for should knock
    // verification back to REQUIRES_REVIEW, and only when they're actually
    // changing -- resubmitting the same value (or updating unrelated fields
    // like city/dateOfBirth/location) shouldn't undo a staff verification.
    const bloodTypeChanged =
      (data.bloodType !== undefined && data.bloodType !== profile.bloodType) ||
      (data.rhFactor !== undefined && data.rhFactor !== profile.rhFactor);

    const updated = await this.db.donorProfile.update({
      where: { userId },
      data: {
        ...data,
        ...(bloodTypeChanged ? { verificationStatus: VerificationStatus.REQUIRES_REVIEW } : {}),
      },
    });

    await this.audit.log({
      actorId: userId,
      action: 'DONOR_PROFILE_UPDATED',
      entityType: 'DonorProfile',
      entityId: profile.id,
    });

    return { data: updated };
  }

  async getProfileCompletion(userId: string): Promise<{ data: ProfileCompletion }> {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      include: { donorProfile: true },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const completed: string[] = [];
    const missing: string[] = [];

    if (user.firstName && user.lastName) {
      completed.push('basic_identity');
    } else {
      missing.push('basic_identity');
    }

    if (user.emailVerified) {
      completed.push('email_verified');
    } else {
      missing.push('email_verified');
    }

    if (user.phone && user.phoneVerified) {
      completed.push('phone_verified');
    } else if (user.phone) {
      completed.push('phone_provided');
    } else {
      missing.push('phone_provided');
    }

    if (user.donorProfile) {
      const dp = user.donorProfile;

      if (dp.bloodType && dp.rhFactor) {
        completed.push('blood_type_provided');
      } else {
        missing.push('blood_type_provided');
      }

      if (dp.dateOfBirth) {
        completed.push('date_of_birth');
      } else {
        missing.push('date_of_birth');
      }

      if (dp.city) {
        completed.push('location');
      } else {
        missing.push('location');
      }
    } else {
      missing.push('blood_type_provided');
      missing.push('date_of_birth');
      missing.push('location');
    }

    const totalFields = completed.length + missing.length;
    const percentage = Math.round((completed.length / totalFields) * 100);

    return { data: { percentage, completed, missing } };
  }

  async verifyBloodType(
    donorId: string,
    requestingUserId: string,
    data: {
      bloodType: BloodType;
      rhFactor: RhFactor;
      source: VerificationSource;
      note?: string;
    },
    ipAddress?: string,
  ) {
    const requestingUser = await this.db.user.findUnique({
      where: { id: requestingUserId },
      include: {
        memberships: {
          where: { status: 'ACTIVE' },
          include: { organization: true, role: true },
        },
      },
    });

    if (!requestingUser) {
      throw new NotFoundException('User not found.');
    }

    const isHospitalStaff = requestingUser.memberships.some(
      (m) =>
        m.organization.type === 'HOSPITAL' &&
        ['HOSPITAL_ADMIN', 'HOSPITAL_STAFF'].includes(m.role.code),
    );

    const isBloodCenterStaff = requestingUser.memberships.some(
      (m) =>
        m.organization.type === 'BLOOD_CENTER' &&
        ['BLOOD_CENTER_ADMIN', 'BLOOD_CENTER_STAFF'].includes(m.role.code),
    );

    if (!isHospitalStaff && !isBloodCenterStaff) {
      throw new ForbiddenException('Only authorized staff can verify blood types.');
    }

    const donorProfile = await this.db.donorProfile.findUnique({
      where: { userId: donorId },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
    });

    if (!donorProfile) {
      throw new NotFoundException('Donor profile not found.');
    }

    const updated = await this.db.donorProfile.update({
      where: { userId: donorId },
      data: {
        bloodType: data.bloodType,
        rhFactor: data.rhFactor,
        verificationStatus: VerificationStatus.VERIFIED,
        bloodTypeVerifiedAt: new Date(),
        bloodTypeVerifiedBy: requestingUserId,
        bloodTypeSource: data.source,
        bloodTypeNote: data.note,
      },
    });

    const organization = requestingUser.memberships.find(
      (m) =>
        (m.organization.type === 'HOSPITAL' || m.organization.type === 'BLOOD_CENTER') &&
        ['HOSPITAL_ADMIN', 'HOSPITAL_STAFF', 'BLOOD_CENTER_ADMIN', 'BLOOD_CENTER_STAFF'].includes(
          m.role.code,
        ),
    );

    await this.audit.log({
      actorId: requestingUserId,
      action: 'BLOOD_TYPE_VERIFIED',
      entityType: 'DonorProfile',
      entityId: donorProfile.id,
      organizationId: organization?.organizationId,
      metadata: {
        donorId,
        previousBloodType: donorProfile.bloodType,
        previousRhFactor: donorProfile.rhFactor,
        newBloodType: data.bloodType,
        newRhFactor: data.rhFactor,
        source: data.source,
      },
      ipAddress,
    });

    return { data: updated };
  }

  async getDonorById(donorId: string, requestingUserId: string) {
    const requestingUser = await this.db.user.findUnique({
      where: { id: requestingUserId },
      include: {
        memberships: { where: { status: 'ACTIVE' }, include: { organization: true, role: true } },
      },
    });

    if (!requestingUser) {
      throw new NotFoundException('User not found.');
    }

    const isHospitalStaff = requestingUser.memberships.some(
      (m) =>
        m.organization.type === 'HOSPITAL' &&
        ['HOSPITAL_ADMIN', 'HOSPITAL_STAFF'].includes(m.role.code),
    );

    const isBloodCenterStaff = requestingUser.memberships.some(
      (m) =>
        m.organization.type === 'BLOOD_CENTER' &&
        ['BLOOD_CENTER_ADMIN', 'BLOOD_CENTER_STAFF'].includes(m.role.code),
    );

    if (!isHospitalStaff && !isBloodCenterStaff && requestingUserId !== donorId) {
      throw new ForbiddenException('You can only view your own donor profile.');
    }

    const profile = await this.db.donorProfile.findUnique({
      where: { userId: donorId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            displayName: true,
          },
        },
      },
    });

    if (!profile) {
      throw new NotFoundException('Donor profile not found.');
    }

    return { data: profile };
  }

  async listDonors(
    page = 1,
    limit = 20,
    filters?: {
      bloodType?: BloodType;
      donorStatus?: DonorStatus;
      city?: string;
    },
  ) {
    const where: Prisma.DonorProfileWhereInput = {};
    if (filters?.bloodType) where.bloodType = filters.bloodType;
    if (filters?.donorStatus) where.donorStatus = filters.donorStatus;
    if (filters?.city) where.city = { contains: filters.city, mode: 'insensitive' };

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.db.donorProfile.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
      }),
      this.db.donorProfile.count({ where }),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
}