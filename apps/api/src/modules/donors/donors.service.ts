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
import { hasVerifiedContact } from '../../common/utils/contact-verification.util';
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

    // Each channel is still reported on its own -- a donor who has confirmed
    // one and not the other should see which -- but only the pair is required.
    // Listing `email_verified` as missing for a phone-verified donor told them
    // to fix something the product no longer asks of them, and dragged their
    // completion score down for it.
    if (user.emailVerified) {
      completed.push('email_verified');
    }

    if (user.phone && user.phoneVerified) {
      completed.push('phone_verified');
    } else if (user.phone) {
      completed.push('phone_provided');
    }

    if (!hasVerifiedContact(user)) {
      missing.push('contact_verified');
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

    // A verification is one person vouching for another's blood group. Staff
    // who also donate here hold `donor.verify`, so without this a staff member
    // could sign off on their own profile and it would look identical in the
    // audit log to a real verification.
    if (requestingUserId === donorId) {
      throw new ForbiddenException('A blood type cannot be verified by the donor it belongs to.');
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

    const isStaff = isHospitalStaff || isBloodCenterStaff;

    const profile = await this.db.donorProfile.findUnique({
      where: { userId: donorId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            phone: true,
            firstName: true,
            lastName: true,
            displayName: true,
            emailVerified: true,
            phoneVerified: true,
            status: true,
            createdAt: true,
          },
        },
        region: { select: { id: true, nameUz: true, nameRu: true, nameEn: true } },
        districtRef: { select: { id: true, nameUz: true, nameRu: true, nameEn: true } },
      },
    });

    if (!profile) {
      throw new NotFoundException('Donor profile not found.');
    }

    // A donor reading their own profile gets what they always got. The extra
    // below is the operational picture a desk needs before it lets someone
    // donate, and it is deliberately gated on the staff check above rather
    // than being sent to every caller.
    if (!isStaff) {
      return { data: profile };
    }

    const [verifier, donationStats, recentDonations, lastDonation] = await Promise.all([
      profile.bloodTypeVerifiedBy
        ? this.db.user.findUnique({
            where: { id: profile.bloodTypeVerifiedBy },
            select: { id: true, firstName: true, lastName: true },
          })
        : Promise.resolve(null),

      this.db.donation.aggregate({
        where: { donorId, status: 'COMPLETED' },
        _count: { _all: true },
        _sum: { volumeMl: true },
      }),

      // A short history, not the whole record: enough for the desk to see the
      // pattern without turning this into a medical file.
      this.db.donation.findMany({
        where: { donorId, status: 'COMPLETED' },
        orderBy: { completedAt: 'desc' },
        take: 5,
        select: {
          id: true,
          donationReference: true,
          completedAt: true,
          volumeMl: true,
          organization: { select: { id: true, name: true } },
        },
      }),

      this.db.donation.findFirst({
        where: { donorId, status: 'COMPLETED' },
        orderBy: { completedAt: 'desc' },
        select: { completedAt: true },
      }),
    ]);

    return {
      data: {
        ...profile,
        // Who vouched for the blood group, alongside when and from what source
        // the profile already carried. A verification with no visible verifier
        // is not provenance, it is a timestamp.
        bloodTypeVerifier: verifier,
        // Whether this person can be reached at all, without exposing the
        // verification tokens themselves.
        contact: {
          hasVerifiedContact: hasVerifiedContact(profile.user),
          emailVerified: profile.user.emailVerified,
          phoneVerified: profile.user.phoneVerified,
        },
        donationSummary: {
          completedCount: donationStats._count._all,
          totalVolumeMl: donationStats._sum.volumeMl ?? 0,
          lastDonationAt: lastDonation?.completedAt ?? null,
        },
        recentDonations,
      },
    };
  }

  async listDonors(
    page = 1,
    limit = 20,
    filters?: {
      bloodType?: BloodType;
      donorStatus?: DonorStatus;
      verificationStatus?: VerificationStatus;
      city?: string;
      search?: string;
    },
  ) {
    const where: Prisma.DonorProfileWhereInput = {};
    if (filters?.bloodType) where.bloodType = filters.bloodType;
    if (filters?.donorStatus) where.donorStatus = filters.donorStatus;
    if (filters?.verificationStatus) where.verificationStatus = filters.verificationStatus;
    if (filters?.city) where.city = { contains: filters.city, mode: 'insensitive' };

    // Staff verifying a blood type have a person in front of them, not a city:
    // they need to find that one donor by the name or the address they gave.
    const search = filters?.search?.trim();
    if (search) {
      where.user = {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

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