import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OrganizationStatus, OrganizationType, PhoneVerificationPurpose, RoleCode } from '@prisma/client';
import * as argon2 from 'argon2';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../../database/prisma.service';
import { EmailService } from '../email/email.service';
import { PermissionsService } from '../permissions/permissions.service';
import { RegisterDto } from './dto/register.dto';
import { RegisterOrganizationDto } from './dto/register-organization.dto';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { PhoneVerificationService } from './phone-verification.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  SECURITY_EVENT,
  type SecurityEventPayload,
} from '../notifications/operational-notification.events';
import { AuthErrorCode, authError } from './auth-error-codes';
import { maskPhone, normalizePhone } from '../../common/utils/phone.util';
import { hasVerifiedContact } from '../../common/utils/contact-verification.util';
import { RegisterWithPhoneDto } from './dto/phone-auth.dto';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/**
 * The stored form of a reset token.
 *
 * SHA-256 rather than a password hash: the input is 32 bytes of CSPRNG output,
 * so there is nothing to brute-force and no salt to add -- and the lookup has
 * to be a single indexed equality read, which a deliberately slow hash cannot
 * give. Argon2 is for low-entropy secrets chosen by people.
 */
function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * How long proof-of-phone-ownership stays good for.
 *
 * Long enough to type a name and choose a password without being rushed; short
 * enough that a ticket left in a log or a crash report is worthless by the time
 * anyone reads it.
 */
const PHONE_TICKET_TTL_SECONDS = 15 * 60;

/** Marks a token as proof of a verified phone, and as nothing else. */
const PHONE_TICKET_TYPE = 'phone_verification';

/**
 * What a client tells us about the device it is signing in from.
 *
 * Read from the request rather than the body: a device name a caller could
 * choose is a label on someone else's session list, and the point of that list
 * is to be trustworthy.
 */
export interface DeviceContext {
  ipAddress?: string;
  userAgent?: string;
  deviceName?: string;
  deviceType?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly db: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditLogsService,
    private readonly permissions: PermissionsService,
    private readonly email: EmailService,
    private readonly platformSettings: PlatformSettingsService,
    private readonly phoneVerification: PhoneVerificationService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Tell the account holder that something security-relevant happened to it.
   *
   * The notification module has listened for this since it was written and
   * nothing emitted it, so a password change, a revoked session and a
   * sign-out-everywhere all left an audit-log row and told the person nothing.
   * A failure here must not fail the action it describes -- the password has
   * already changed by the time this runs.
   */
  private notifySecurityEvent(payload: SecurityEventPayload) {
    try {
      this.eventEmitter.emit(SECURITY_EVENT, payload);
    } catch (error) {
      this.logger.error(`Could not raise security notification for ${payload.userId}`, error);
    }
  }

  async register(input: RegisterDto, ipAddress?: string) {
    const email = input.email.toLowerCase().trim();
    const existing = await this.db.user.findUnique({ where: { email } });
    if (existing) {
      throw new BadRequestException(
        authError(AuthErrorCode.EMAIL_TAKEN, 'Email is already registered.'),
      );
    }

    // The DTO already normalised it; normalise again rather than trust the
    // caller, because this method is also reachable from tests and scripts and
    // a raw spelling here would break the uniqueness the column promises.
    const phone = normalizePhone(input.phone);
    if (input.phone && !phone) {
      throw new BadRequestException(
        authError(AuthErrorCode.PHONE_INVALID, 'That phone number is not valid.'),
      );
    }
    if (phone) {
      const phoneTaken = await this.db.user.findUnique({ where: { phone } });
      if (phoneTaken) {
        throw new BadRequestException(
          authError(AuthErrorCode.PHONE_TAKEN, 'That phone number is already registered.'),
        );
      }
    }

    const donorRole = await this.db.role.findUnique({ where: { code: RoleCode.DONOR } });
    if (!donorRole) {
      throw new NotFoundException('DONOR role not found. Run seed script.');
    }

    const user = await this.db.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email,
          passwordHash: await argon2.hash(input.password),
          firstName: input.firstName.trim(),
          lastName: input.lastName.trim(),
          phone,
          status: 'PENDING_VERIFICATION',
          emailVerified: false,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          status: true,
        },
      });

      await tx.donorProfile.create({
        data: { userId: newUser.id },
      });

      // Every role grant runs through an OrganizationMembership, so donors —
      // who have no real affiliated hospital/blood center — need somewhere
      // to point that required FK. Use a singleton SYSTEM-type org rather
      // than a fake HOSPITAL, so donor accounts never show up as a bogus
      // "hospital" in admin/discovery listings that filter or count by type.
      let donorOrg = await tx.organization.findFirst({
        where: { type: OrganizationType.SYSTEM },
      });
      if (!donorOrg) {
        donorOrg = await tx.organization.create({
          data: {
            type: OrganizationType.SYSTEM,
            name: 'Donor Accounts (System)',
            status: 'ACTIVE',
          },
        });
      }

      await tx.organizationMembership.create({
        data: {
          userId: newUser.id,
          organizationId: donorOrg.id,
          roleId: donorRole.id,
          status: 'ACTIVE',
        },
      });

      return newUser;
    });

    await this.audit.log({
      actorId: user.id,
      action: 'USER_REGISTERED',
      entityType: 'User',
      entityId: user.id,
      ipAddress,
    });

    try {
      const rawToken = await this.createEmailVerificationToken(user.id);
      const { verifyUrl, deepLink } = this.buildVerificationLinks(rawToken);
      await this.email.sendVerificationEmail(user.email, user.firstName, verifyUrl, deepLink);
    } catch (error) {
      // Registration must still succeed even if the verification email fails
      // to send — the user can always request a new one via resend-verification.
      this.logger.error(
        `Failed to send verification email to ${user.email}: ${(error as Error).message}`,
      );
    }

    return { data: user };
  }

  async registerOrganization(input: RegisterOrganizationDto, ipAddress?: string) {
    const email = input.adminEmail.toLowerCase().trim();
    const existing = await this.db.user.findUnique({ where: { email } });
    if (existing) {
      throw new BadRequestException(
        authError(AuthErrorCode.EMAIL_TAKEN, 'Email is already registered.'),
      );
    }

    const adminPhone = normalizePhone(input.adminPhone);
    if (input.adminPhone && !adminPhone) {
      throw new BadRequestException(
        authError(AuthErrorCode.PHONE_INVALID, 'That phone number is not valid.'),
      );
    }
    if (adminPhone && (await this.db.user.findUnique({ where: { phone: adminPhone } }))) {
      throw new BadRequestException(
        authError(AuthErrorCode.PHONE_TAKEN, 'That phone number is already registered.'),
      );
    }

    const adminRoleCode =
      input.organizationType === OrganizationType.HOSPITAL
        ? RoleCode.HOSPITAL_ADMIN
        : RoleCode.BLOOD_CENTER_ADMIN;
    const adminRole = await this.db.role.findUnique({ where: { code: adminRoleCode } });
    if (!adminRole) {
      throw new NotFoundException(`${adminRoleCode} role not found. Run seed script.`);
    }

    const { user, organization } = await this.db.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          type: input.organizationType,
          name: input.organizationName.trim(),
          legalName: input.legalName?.trim(),
          email: input.organizationEmail?.toLowerCase().trim(),
          phone: input.organizationPhone?.trim(),
          address: input.address?.trim(),
          latitude: input.latitude,
          longitude: input.longitude,
          status: OrganizationStatus.PENDING_APPROVAL,
          ...(input.organizationType === OrganizationType.HOSPITAL
            ? { hospital: { create: {} } }
            : { bloodCenter: { create: {} } }),
        },
      });

      const newUser = await tx.user.create({
        data: {
          email,
          passwordHash: await argon2.hash(input.adminPassword),
          firstName: input.adminFirstName.trim(),
          lastName: input.adminLastName.trim(),
          phone: adminPhone,
          status: 'PENDING_VERIFICATION',
          emailVerified: false,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          status: true,
        },
      });

      await tx.organizationMembership.create({
        data: {
          userId: newUser.id,
          organizationId: organization.id,
          roleId: adminRole.id,
          status: 'ACTIVE',
        },
      });

      return { user: newUser, organization };
    });

    await this.audit.log({
      actorId: user.id,
      action: 'ORGANIZATION_REGISTERED',
      entityType: 'Organization',
      entityId: organization.id,
      organizationId: organization.id,
      metadata: { organizationType: organization.type, organizationName: organization.name },
      ipAddress,
    });

    try {
      const rawToken = await this.createEmailVerificationToken(user.id);
      const { verifyUrl, deepLink } = this.buildVerificationLinks(rawToken);
      await this.email.sendVerificationEmail(user.email, user.firstName, verifyUrl, deepLink);
    } catch (error) {
      this.logger.error(
        `Failed to send verification email to ${user.email}: ${(error as Error).message}`,
      );
    }

    return {
      data: {
        user,
        organization: { id: organization.id, name: organization.name, status: organization.status },
      },
    };
  }

  /**
   * Step one of phone-first sign-up and of phone recovery: send a code.
   *
   * The response is identical whether or not the number has an account. That is
   * the entire security property of this endpoint: a caller who can tell the
   * two apart can walk the number space and learn who donates blood here, which
   * is medical information about a person, not a UX detail.
   *
   * The message differs, though, because the person holding that phone is not
   * the attacker and deserves the truth: a number that already has an account
   * is told to sign in rather than left waiting for a code. A number with no
   * account, asking to reset a password, is sent nothing at all -- an SMS about
   * a service they do not use is noise. Either way the rate-limit budget and
   * the cooldown are spent exactly as they would have been.
   */
  async requestPhoneCode(
    phone: string,
    purpose: PhoneVerificationPurpose,
    options: { ipAddress?: string; locale?: string } = {},
  ) {
    const normalized = normalizePhone(phone);
    if (!normalized) {
      throw new BadRequestException(
        authError(AuthErrorCode.PHONE_INVALID, 'That phone number is not valid.'),
      );
    }

    const existing = await this.db.user.findUnique({
      where: { phone: normalized },
      select: { id: true, status: true },
    });

    let messageFor: 'code' | 'existing-account' | 'none' = 'code';
    if (purpose === PhoneVerificationPurpose.REGISTRATION && existing) {
      messageFor = 'existing-account';
    }
    if (purpose === PhoneVerificationPurpose.PASSWORD_RESET && (!existing || existing.status !== 'ACTIVE')) {
      messageFor = 'none';
    }

    const result = await this.phoneVerification.requestCode(normalized, purpose, {
      ipAddress: options.ipAddress,
      locale: options.locale,
      messageFor,
    });

    return { data: result };
  }

  /**
   * Step two: spend the code and hand back proof of it.
   *
   * For sign-up the proof is a short-lived signed ticket. It is signed because
   * the alternative -- answering `{ verified: true }` and trusting the client to
   * be honest at the next step -- is not proof of anything: anyone can POST
   * that. The number is *inside* the ticket, so the account that gets created
   * is necessarily for the number that was verified.
   *
   * For recovery the proof is a real `PasswordResetToken`, the same row the
   * email flow mints. Reusing it rather than inventing a phone-shaped variant
   * is what keeps the two paths equally strong: single use, the same expiry,
   * and every session revoked on success.
   */
  async verifyPhoneCode(
    phone: string,
    purpose: PhoneVerificationPurpose,
    code: string,
    ipAddress?: string,
  ) {
    const normalized = normalizePhone(phone);
    if (!normalized) {
      throw new BadRequestException(
        authError(AuthErrorCode.PHONE_INVALID, 'That phone number is not valid.'),
      );
    }

    await this.phoneVerification.verifyCode(normalized, purpose, code, ipAddress);

    if (purpose === PhoneVerificationPurpose.REGISTRATION) {
      return {
        data: {
          verificationToken: await this.signPhoneTicket(normalized),
          expiresInSeconds: PHONE_TICKET_TTL_SECONDS,
        },
      };
    }

    // Recovery. The code has been spent either way -- a number with no account
    // could never have received one, so reaching here means the account exists.
    const user = await this.db.user.findUnique({
      where: { phone: normalized },
      select: { id: true, status: true },
    });

    if (!user || user.status !== 'ACTIVE') {
      await this.audit.log({
        action: 'PASSWORD_RESET_FAILED',
        entityType: 'User',
        metadata: { reason: 'phone_not_active', phone: maskPhone(normalized) },
        ipAddress,
      });
      throw new BadRequestException(
        authError(AuthErrorCode.RESET_TOKEN_INVALID, 'This reset request is no longer valid.'),
      );
    }

    const rawToken = randomBytes(32).toString('hex');
    const ttlMinutes = this.config.get<number>('PASSWORD_RESET_TTL_MINUTES', 60);
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

    await this.db.passwordResetToken.upsert({
      where: { userId: user.id },
      create: { userId: user.id, tokenHash: hashResetToken(rawToken), expiresAt, requestedIp: ipAddress },
      update: { tokenHash: hashResetToken(rawToken), expiresAt, usedAt: null, requestedIp: ipAddress },
    });

    await this.audit.log({
      actorId: user.id,
      action: 'PASSWORD_RESET_REQUESTED',
      entityType: 'User',
      entityId: user.id,
      metadata: { via: 'phone', matched: true, phone: maskPhone(normalized) },
      ipAddress,
    });

    return { data: { resetToken: rawToken, expiresInMinutes: ttlMinutes } };
  }

  /**
   * Step three: the account itself.
   *
   * Nothing here trusts the client about the phone number. The ticket carries
   * it, signed, and a ticket that does not verify is refused -- which is what
   * stops someone from verifying a number they control and then registering
   * their neighbour's.
   *
   * The account is created ACTIVE with `phoneVerified: true`, because the
   * verification that a PENDING_VERIFICATION account is waiting for has already
   * happened. An email, if given, is stored unverified and gets its own link.
   */
  async registerWithPhone(input: RegisterWithPhoneDto, ipAddress?: string) {
    const phone = await this.readPhoneTicket(input.verificationToken);

    const existingPhone = await this.db.user.findUnique({ where: { phone } });
    if (existingPhone) {
      throw new BadRequestException(
        authError(AuthErrorCode.PHONE_TAKEN, 'That phone number is already registered.'),
      );
    }

    const email = input.email?.toLowerCase().trim();
    if (email) {
      const existingEmail = await this.db.user.findUnique({ where: { email } });
      if (existingEmail) {
        throw new BadRequestException(
          authError(AuthErrorCode.EMAIL_TAKEN, 'Email is already registered.'),
        );
      }
    }

    const donorRole = await this.db.role.findUnique({ where: { code: RoleCode.DONOR } });
    if (!donorRole) {
      throw new NotFoundException('DONOR role not found. Run seed script.');
    }

    const passwordHash = await argon2.hash(input.password);

    const user = await this.db.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          // A donor without an email still needs the column filled: it is
          // unique and NOT NULL. A reserved, obviously-synthetic local address
          // keeps the row valid while making it unmistakable in any listing
          // that this account has no real address -- and `emailVerified` stays
          // false, so nothing treats it as a way to reach anyone.
          email: email ?? `${phone.replace('+', '')}@phone.bloodchain.local`,
          phone,
          passwordHash,
          firstName: input.firstName.trim(),
          lastName: input.lastName.trim(),
          status: 'ACTIVE',
          emailVerified: false,
          phoneVerified: true,
        },
        select: { id: true, email: true, phone: true, firstName: true, lastName: true, status: true },
      });

      await tx.donorProfile.create({ data: { userId: newUser.id } });

      let donorOrg = await tx.organization.findFirst({
        where: { type: OrganizationType.SYSTEM },
      });
      if (!donorOrg) {
        donorOrg = await tx.organization.create({
          data: { type: OrganizationType.SYSTEM, name: 'Donor Accounts (System)', status: 'ACTIVE' },
        });
      }

      await tx.organizationMembership.create({
        data: {
          userId: newUser.id,
          organizationId: donorOrg.id,
          roleId: donorRole.id,
          status: 'ACTIVE',
        },
      });

      return newUser;
    });

    await this.audit.log({
      actorId: user.id,
      action: 'USER_REGISTERED',
      entityType: 'User',
      entityId: user.id,
      metadata: { via: 'phone', phone: maskPhone(phone), hasEmail: Boolean(email) },
      ipAddress,
    });

    // A real address, if they gave one, still gets a verification link -- it is
    // how they will recover the account from a laptop, and how receipts reach
    // them. It is not required to sign in.
    if (email) {
      try {
        const rawToken = await this.createEmailVerificationToken(user.id);
        const { verifyUrl, deepLink } = this.buildVerificationLinks(rawToken);
        await this.email.sendVerificationEmail(email, user.firstName, verifyUrl, deepLink);
      } catch (error) {
        this.logger.error(
          `Failed to send verification email to ${email}: ${(error as Error).message}`,
        );
      }
    }

    // Signed in immediately: they have just proved they hold the number, and
    // sending them to a sign-in form to retype the password they set ten
    // seconds ago is a step that exists only to be abandoned.
    return this.buildAuthResponse(user.id);
  }

  async verifyEmail(token: string, ipAddress?: string) {
    const record = await this.db.emailVerificationToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!record) {
      throw new BadRequestException('Invalid or expired verification link.');
    }

    if (record.usedAt) {
      // Idempotent: a link that was already consumed (e.g. an email client's
      // link-scanner pre-fetching it) still succeeds for the real user as
      // long as the account ended up verified.
      if (record.user.emailVerified) {
        return this.buildAuthResponse(record.userId);
      }
      throw new BadRequestException('This verification link has already been used.');
    }

    if (record.expiresAt < new Date()) {
      throw new BadRequestException('This verification link has expired. Request a new one.');
    }

    const nextStatus = record.user.status === 'PENDING_VERIFICATION' ? 'ACTIVE' : record.user.status;

    await this.db.$transaction([
      this.db.user.update({
        where: { id: record.userId },
        data: { emailVerified: true, status: nextStatus },
      }),
      this.db.emailVerificationToken.update({
        where: { userId: record.userId },
        data: { usedAt: new Date() },
      }),
    ]);

    await this.audit.log({
      actorId: record.userId,
      action: 'EMAIL_VERIFIED',
      entityType: 'User',
      entityId: record.userId,
      ipAddress,
    });

    return this.buildAuthResponse(record.userId);
  }

  async resendVerification(email: string, ipAddress?: string) {
    const normalized = email.toLowerCase().trim();
    const user = await this.db.user.findUnique({ where: { email: normalized } });

    // Do not reveal whether an account exists for this email.
    if (!user || user.emailVerified) {
      return { data: { success: true } };
    }

    try {
      const rawToken = await this.createEmailVerificationToken(user.id);
      const { verifyUrl, deepLink } = this.buildVerificationLinks(rawToken);
      await this.email.sendVerificationEmail(user.email, user.firstName, verifyUrl, deepLink);
    } catch (error) {
      this.logger.error(
        `Failed to resend verification email to ${user.email}: ${(error as Error).message}`,
      );
    }

    await this.audit.log({
      actorId: user.id,
      action: 'EMAIL_VERIFICATION_RESENT',
      entityType: 'User',
      entityId: user.id,
      ipAddress,
    });

    return { data: { success: true } };
  }

  /**
   * Signs in with an email address or a phone number.
   *
   * One method, because it is one account: the same password, the same lockout
   * counter, the same sessions and the same audit trail whichever way the
   * person named themselves. A second sign-in path for phones would be a second
   * place for every one of those rules to drift out of step.
   */
  async login(
    identifier: { email?: string; phone?: string },
    password: string,
    ipAddress?: string,
    device?: DeviceContext,
  ) {
    const email = identifier.email?.toLowerCase().trim();
    const phone = normalizePhone(identifier.phone);

    if (!email && !phone) {
      throw new BadRequestException(
        authError(AuthErrorCode.INVALID_CREDENTIALS, 'Provide an email address or a phone number.'),
      );
    }

    const user = await this.db.user.findUnique({
      where: email ? { email } : { phone: phone! },
      include: {
        memberships: {
          where: { status: 'ACTIVE' },
          include: { role: true },
        },
      },
    });

    // One message whichever half was wrong, and whichever identifier was used:
    // "no account with that number" is how you find out who is a donor here,
    // and for a blood service that is medical information about a person.
    const invalidCredentials = new UnauthorizedException(
      authError(
        AuthErrorCode.INVALID_CREDENTIALS,
        email ? 'Email or password is incorrect.' : 'Phone number or password is incorrect.',
      ),
    );

    if (!user) {
      await this.audit.log({
        action: 'LOGIN_FAILED',
        entityType: 'User',
        metadata: {
          identifier: email ?? maskPhone(phone),
          via: email ? 'email' : 'phone',
          reason: 'user_not_found',
        },
        ipAddress,
      });
      throw invalidCredentials;
    }

    const isSuperAdmin = user.memberships.some((m) => m.role.code === RoleCode.SUPER_ADMIN);
    if (!isSuperAdmin && (await this.platformSettings.isMaintenanceMode())) {
      await this.audit.log({
        actorId: user.id,
        action: 'LOGIN_FAILED',
        entityType: 'User',
        entityId: user.id,
        metadata: { reason: 'maintenance_mode' },
        ipAddress,
      });
      throw new ForbiddenException(
        authError(
          AuthErrorCode.MAINTENANCE_MODE,
          'The platform is temporarily down for maintenance. Please try again later.',
        ),
      );
    }

    if (user.lockoutUntil && user.lockoutUntil > new Date()) {
      const remainingMinutes = Math.ceil((user.lockoutUntil.getTime() - Date.now()) / 60000);
      await this.audit.log({
        actorId: user.id,
        action: 'LOGIN_FAILED',
        entityType: 'User',
        entityId: user.id,
        metadata: { reason: 'account_locked', remainingMinutes },
        ipAddress,
      });
      throw new ForbiddenException(
        authError(
          AuthErrorCode.ACCOUNT_LOCKED,
          `Account is locked. Try again in ${remainingMinutes} minute(s).`,
          { remainingMinutes },
        ),
      );
    }

    if (user.status === 'SUSPENDED') {
      await this.audit.log({
        actorId: user.id,
        action: 'LOGIN_FAILED',
        entityType: 'User',
        entityId: user.id,
        metadata: { reason: 'account_suspended' },
        ipAddress,
      });
      throw new ForbiddenException(
        authError(
          AuthErrorCode.ACCOUNT_SUSPENDED,
          'Your account has been suspended. Contact support.',
        ),
      );
    }

    if (user.status === 'DEACTIVATED') {
      await this.audit.log({
        actorId: user.id,
        action: 'LOGIN_FAILED',
        entityType: 'User',
        entityId: user.id,
        metadata: { reason: 'account_deactivated' },
        ipAddress,
      });
      throw new ForbiddenException(
        authError(AuthErrorCode.ACCOUNT_DEACTIVATED, 'Your account has been deactivated.'),
      );
    }

    // What this gate is actually for is "we have confirmed a way to reach this
    // person" -- it was written as `emailVerified` only because email was the
    // only way to confirm anything. A donor who proved they hold their phone
    // has met the same bar, and holding them at an email they may not have is
    // the barrier this sprint exists to remove.
    if (user.status === 'PENDING_VERIFICATION' && !hasVerifiedContact(user)) {
      await this.audit.log({
        actorId: user.id,
        action: 'LOGIN_FAILED',
        entityType: 'User',
        entityId: user.id,
        metadata: { reason: 'contact_not_verified' },
        ipAddress,
      });
      throw new ForbiddenException(
        authError(
          AuthErrorCode.CONTACT_NOT_VERIFIED,
          'Please confirm your email address or phone number before signing in.',
        ),
      );
    }

    if (!(await argon2.verify(user.passwordHash, password))) {
      const newFailedAttempts = user.failedLoginAttempts + 1;
      const lockoutUntil = newFailedAttempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;

      await this.db.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: newFailedAttempts,
          lockoutUntil,
        },
      });

      await this.audit.log({
        actorId: user.id,
        action: 'LOGIN_FAILED',
        entityType: 'User',
        entityId: user.id,
        metadata: {
          reason: 'invalid_password',
          failedAttempts: newFailedAttempts,
          locked: !!lockoutUntil,
        },
        ipAddress,
      });

      if (lockoutUntil) {
        throw new ForbiddenException(
          authError(
            AuthErrorCode.ACCOUNT_LOCKED,
            'Too many failed attempts. Account locked for 15 minutes.',
            { remainingMinutes: 15 },
          ),
        );
      }

      throw invalidCredentials;
    }

    if (user.failedLoginAttempts > 0 || user.lockoutUntil) {
      await this.db.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: 0,
          lockoutUntil: null,
        },
      });
    }

    const roles = user.memberships.map((m) => m.role.code) as RoleCode[];
    const permissions = await this.permissions.getUserPermissions(user.id);

    await this.db.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = await this.createTokenPair(user.id, roles, permissions, {
      ipAddress,
      ...device,
    });

    await this.audit.log({
      actorId: user.id,
      action: 'LOGIN_SUCCESS',
      entityType: 'User',
      entityId: user.id,
      ipAddress,
    });

    return {
      data: {
        ...tokens,
        user: {
          id: user.id,
          email: user.email,
          phone: user.phone,
          firstName: user.firstName,
          lastName: user.lastName,
          displayName: user.displayName,
          status: user.status,
          roles,
          permissions,
        },
      },
    };
  }

  async refresh(rawRefreshToken: string, ipAddress?: string) {
    const tokenHash = this.hashRefreshToken(rawRefreshToken);
    const stored = await this.db.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          include: { memberships: { where: { status: 'ACTIVE' }, include: { role: true } } },
        },
      },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Session expired. Please sign in again.');
    }

    if (stored.user.status === 'SUSPENDED' || stored.user.status === 'DEACTIVATED') {
      throw new ForbiddenException('Your account is not active.');
    }

    const roles = stored.user.memberships.map((m) => m.role.code) as RoleCode[];
    const permissions = await this.permissions.getUserPermissions(stored.user.id);

    await this.db.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date(), lastUsedAt: new Date() },
    });

    // The session this refresh token belongs to, if any. Tokens minted before
    // sessions were written have none, and that is not an error -- the next
    // pair simply opens one.
    const existingSession = await this.db.session.findUnique({
      where: { tokenHash },
      select: { id: true, revokedAt: true },
    });

    if (existingSession?.revokedAt) {
      throw new UnauthorizedException('Session expired. Please sign in again.');
    }

    await this.audit.log({
      actorId: stored.user.id,
      action: 'TOKEN_REFRESHED',
      entityType: 'RefreshToken',
      entityId: stored.id,
      ipAddress,
    });

    const tokens = await this.createTokenPair(
      stored.user.id,
      roles,
      permissions,
      { ipAddress },
      existingSession?.id,
    );

    return {
      data: {
        ...tokens,
        user: {
          id: stored.user.id,
          email: stored.user.email,
          firstName: stored.user.firstName,
          lastName: stored.user.lastName,
          displayName: stored.user.displayName,
          status: stored.user.status,
          roles,
          permissions,
        },
      },
    };
  }

  async logout(rawRefreshToken: string, userId?: string, ipAddress?: string) {
    const tokenHash = this.hashRefreshToken(rawRefreshToken);
    const stored = await this.db.refreshToken.findUnique({ where: { tokenHash } });
    if (stored && !stored.revokedAt) {
      await this.db.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date() },
      });

      // Signing out has to close the session too, or the device stays listed
      // as active on the Security screen after the person has left it.
      await this.db.session.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      await this.audit.log({
        actorId: userId,
        action: 'LOGOUT',
        entityType: 'RefreshToken',
        entityId: stored.id,
        ipAddress,
      });
    }
    return { data: { success: true } };
  }

  async me(userId: string) {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          where: { status: 'ACTIVE' },
          include: {
            role: true,
            organization: { select: { id: true, name: true, type: true, status: true } },
          },
        },
        donorProfile: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const permissions = await this.permissions.getUserPermissions(userId);

    return {
      data: {
        id: user.id,
        email: user.email,
        // The number is part of who this account is now, not a detail buried in
        // settings: a phone-first donor signs in with it, and a profile that
        // reports `phoneVerified: true` without saying *which* number is
        // verified tells them nothing they can check.
        phone: user.phone,
        firstName: user.firstName,
        lastName: user.lastName,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        status: user.status,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified,
        lastLoginAt: user.lastLoginAt,
        roles: user.memberships.map((m) => m.role.code),
        organizations: user.memberships.map((m) => ({
          membershipId: m.id,
          organizationId: m.organization.id,
          name: m.organization.name,
          type: m.organization.type,
          role: m.role.code,
          status: m.status,
          organizationStatus: m.organization.status,
        })),
        donorProfile: user.donorProfile
          ? {
              id: user.donorProfile.id,
              bloodType: user.donorProfile.bloodType,
              rhFactor: user.donorProfile.rhFactor,
              city: user.donorProfile.city,
              donorStatus: user.donorProfile.donorStatus,
              verificationStatus: user.donorProfile.verificationStatus,
              dateOfBirth: user.donorProfile.dateOfBirth,
            }
          : null,
        permissions,
      },
    };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    ipAddress?: string,
  ) {
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found.');
    }

    if (!(await argon2.verify(user.passwordHash, currentPassword))) {
      await this.audit.log({
        actorId: userId,
        action: 'PASSWORD_CHANGE_FAILED',
        entityType: 'User',
        entityId: userId,
        metadata: { reason: 'invalid_current_password' },
        ipAddress,
      });
      throw new UnauthorizedException('Current password is incorrect.');
    }

    await this.db.user.update({
      where: { id: userId },
      data: { passwordHash: await argon2.hash(newPassword) },
    });

    await this.db.refreshToken.updateMany({
      where: { userId },
      data: { revokedAt: new Date() },
    });

    const audited = await this.audit.log({
      actorId: userId,
      action: 'PASSWORD_CHANGED',
      entityType: 'User',
      entityId: userId,
      ipAddress,
    });

    this.notifySecurityEvent({
      userId,
      eventType: 'PASSWORD_CHANGED',
      details:
        'Your password was changed. Every signed-in device was signed out. If this was not you, reset your password now.',
      // The audit row's id is unique per change, so a second password change
      // is a second notification rather than a duplicate of the first.
      occurrenceId: audited?.id ?? `PASSWORD_CHANGED:${userId}:${Date.now()}`,
    });

    return { data: { success: true } };
  }

  /**
   * This account's signed-in devices, with the caller's own marked.
   *
   * `currentSessionId` comes from the access token's `sid`, so the list can say
   * which row is the device being read on -- without which "revoke" is a
   * button nobody can safely press.
   */
  async getSessions(userId: string, currentSessionId?: string) {
    const sessions = await this.db.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastUsedAt: 'desc' },
    });

    return {
      data: sessions.map((s) => ({
        id: s.id,
        deviceName: s.deviceName,
        deviceType: s.deviceType,
        ipAddress: s.ipAddress,
        lastUsedAt: s.lastUsedAt,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
        isCurrent: Boolean(currentSessionId) && s.id === currentSessionId,
      })),
    };
  }

  async revokeSession(sessionId: string, userId: string, ipAddress?: string) {
    const session = await this.db.session.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.userId !== userId) {
      throw new NotFoundException('Session not found.');
    }

    await this.db.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });

    await this.audit.log({
      actorId: userId,
      action: 'SESSION_REVOKED',
      entityType: 'Session',
      entityId: sessionId,
      ipAddress,
    });

    this.notifySecurityEvent({
      userId,
      eventType: 'SESSION_REVOKED',
      details: `A signed-in device was signed out${session.deviceName ? `: ${session.deviceName}` : ''}.`,
      // One session can only be revoked once, so its id is the occurrence.
      occurrenceId: sessionId,
    });

    return { data: { success: true } };
  }

  async revokeAllSessions(userId: string, ipAddress?: string) {
    await this.db.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.db.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    const auditedRevokeAll = await this.audit.log({
      actorId: userId,
      action: 'ALL_SESSIONS_REVOKED',
      entityType: 'User',
      entityId: userId,
      ipAddress,
    });

    this.notifySecurityEvent({
      userId,
      eventType: 'ALL_SESSIONS_REVOKED',
      details: 'Every signed-in device was signed out of your account.',
      occurrenceId: auditedRevokeAll?.id ?? `ALL_SESSIONS_REVOKED:${userId}:${Date.now()}`,
    });

    return { data: { success: true } };
  }

  /**
   * Starts account recovery, and says nothing about whether the account exists.
   *
   * The response is identical for a registered address, an unregistered one and
   * a suspended account. Anything else turns this endpoint into a way to test
   * whether a given person is a donor here -- which, for a blood service, is
   * medical information about them.
   */
  async requestPasswordReset(email: string, ipAddress?: string) {
    const normalisedEmail = email.trim().toLowerCase();
    const user = await this.db.user.findUnique({
      where: { email: normalisedEmail },
      // Roles come along so the link can point at the console this person
      // actually signs in to, rather than whichever origin happens to be first.
      include: {
        memberships: { where: { status: 'ACTIVE' }, include: { role: true } },
      },
    });

    // Log the attempt whether or not it matched, so a burst against many
    // addresses is visible in the audit trail rather than only the successes.
    await this.audit.log({
      actorId: user?.id,
      action: 'PASSWORD_RESET_REQUESTED',
      entityType: 'User',
      entityId: user?.id,
      metadata: { matched: Boolean(user), email: normalisedEmail },
      ipAddress,
    });

    if (user && user.status === 'ACTIVE') {
      const existing = await this.db.passwordResetToken.findUnique({ where: { userId: user.id } });
      // Per-account cooldown on top of the per-IP throttle. The throttle alone
      // does not stop someone cycling addresses to flood one person's inbox.
      const cooldownMs = this.config.get<number>('PASSWORD_RESET_COOLDOWN_SECONDS', 60) * 1000;
      const withinCooldown =
        existing !== null &&
        existing.usedAt === null &&
        existing.createdAt.getTime() > Date.now() - cooldownMs;

      if (!withinCooldown) {
        const rawToken = randomBytes(32).toString('hex');
        const ttlMinutes = this.config.get<number>('PASSWORD_RESET_TTL_MINUTES', 60);
        const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

        await this.db.passwordResetToken.upsert({
          where: { userId: user.id },
          create: { userId: user.id, tokenHash: hashResetToken(rawToken), expiresAt, requestedIp: ipAddress },
          update: { tokenHash: hashResetToken(rawToken), expiresAt, usedAt: null, requestedIp: ipAddress },
        });

        const { resetUrl, deepLink } = this.buildPasswordResetLinks(
          rawToken,
          user.memberships.map((membership) => membership.role.code),
        );
        const ttlDescription = `${ttlMinutes} minutes`;
        try {
          await this.email.sendPasswordResetEmail(
            user.email,
            user.firstName,
            resetUrl,
            deepLink,
            ttlDescription,
          );
        } catch (error) {
          // A mail failure must not tell the caller the address was real.
          this.logger.error({ userId: user.id, err: String(error) }, 'password reset email failed');
        }
      }
    }

    return {
      data: {
        success: true,
        message: 'If an account exists for that address, a password reset link has been sent.',
      },
    };
  }

  /**
   * Completes account recovery.
   *
   * Every session is revoked on success, not just the one in use. A reset is
   * often the response to a suspected compromise, so leaving other refresh
   * tokens alive would leave the intruder signed in behind the new password.
   */
  async resetPassword(token: string, newPassword: string, ipAddress?: string) {
    const record = await this.db.passwordResetToken.findUnique({
      where: { tokenHash: hashResetToken(token) },
      include: { user: true },
    });

    // One message for every failure mode -- unknown, expired, already used --
    // so a caller cannot probe which tokens ever existed.
    const invalid = new BadRequestException('This password reset link is invalid or has expired.');

    if (!record || record.usedAt !== null || record.expiresAt.getTime() <= Date.now()) {
      await this.audit.log({
        actorId: record?.userId,
        action: 'PASSWORD_RESET_FAILED',
        entityType: 'User',
        entityId: record?.userId,
        metadata: {
          reason: !record ? 'unknown_token' : record.usedAt ? 'already_used' : 'expired',
        },
        ipAddress,
      });
      throw invalid;
    }

    if (record.user.status !== 'ACTIVE') {
      await this.audit.log({
        actorId: record.userId,
        action: 'PASSWORD_RESET_FAILED',
        entityType: 'User',
        entityId: record.userId,
        metadata: { reason: 'account_not_active' },
        ipAddress,
      });
      throw invalid;
    }

    const passwordHash = await argon2.hash(newPassword);

    // One transaction: the token must be spent in the same commit that changes
    // the password, or a retry could reuse it.
    await this.db.$transaction([
      this.db.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      this.db.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      this.db.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    await this.audit.log({
      actorId: record.userId,
      action: 'PASSWORD_RESET_COMPLETED',
      entityType: 'User',
      entityId: record.userId,
      metadata: { sessionsRevoked: true },
      ipAddress,
    });

    return {
      data: {
        success: true,
        message: 'Your password has been reset. Please sign in with your new password.',
      },
    };
  }

  /**
   * The console a given set of roles signs in to.
   *
   * Each is optional and falls back to the first `WEB_URL` entry, so a
   * deployment that serves every console from one origin needs no extra
   * configuration and behaves exactly as before. Nothing here hardcodes a host:
   * the fallback is whatever `WEB_URL` is set to, and that is required
   * configuration in every environment.
   *
   * A donor has no web console. Their link falls back too, but the email also
   * carries the deep link, which is the one their phone opens.
   */
  private resolvePortalUrl(roles: RoleCode[]): string {
    const fallback = this.config.get<string>('WEB_URL', 'http://localhost:3000').split(',')[0]!.trim();
    const portal = (key: string) => this.config.get<string>(key)?.trim() || fallback;

    // Ordered, because one person can hold several roles: an admin who is also
    // hospital staff manages the platform, so the admin console wins.
    if (roles.includes(RoleCode.SUPER_ADMIN)) return portal('WEB_URL_ADMIN');
    if (roles.some((role) => role === RoleCode.HOSPITAL_ADMIN || role === RoleCode.HOSPITAL_STAFF)) {
      return portal('WEB_URL_HOSPITAL');
    }
    const bloodCentreRoles: RoleCode[] = [
      RoleCode.BLOOD_CENTER_ADMIN,
      RoleCode.BLOOD_CENTER_STAFF,
      // The laboratory lives inside a blood centre, and its staff sign in to
      // that console.
      RoleCode.LAB_ADMIN,
      RoleCode.LAB_REVIEWER,
      RoleCode.LAB_TECHNICIAN,
    ];
    if (roles.some((role) => bloodCentreRoles.includes(role))) {
      return portal('WEB_URL_BLOOD_CENTER');
    }
    return fallback;
  }

  private buildPasswordResetLinks(
    token: string,
    roles: RoleCode[] = [],
  ): { resetUrl: string; deepLink: string } {
    const webUrl = this.resolvePortalUrl(roles);
    const deepLinkBase = this.config.get<string>('MOBILE_DEEP_LINK', 'donor://');
    return {
      resetUrl: `${webUrl}/reset-password?token=${token}`,
      deepLink: `${deepLinkBase}reset-password?token=${token}`,
    };
  }

  private async createEmailVerificationToken(userId: string): Promise<string> {
    const rawToken = randomBytes(32).toString('hex');
    const ttlHours = this.config.get<number>('EMAIL_VERIFICATION_TTL_HOURS', 24);
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

    await this.db.emailVerificationToken.upsert({
      where: { userId },
      create: { userId, token: rawToken, expiresAt },
      update: { token: rawToken, expiresAt, usedAt: null },
    });

    return rawToken;
  }

  private buildVerificationLinks(token: string): { verifyUrl: string; deepLink: string } {
    const apiUrl = this.config.get<string>('API_URL', 'http://localhost:3001');
    const deepLinkBase = this.config.get<string>('MOBILE_DEEP_LINK', 'donor://');
    return {
      verifyUrl: `${apiUrl}/api/v1/auth/verify-email?token=${token}`,
      deepLink: `${deepLinkBase}verify-email?token=${token}`,
    };
  }

  private async buildAuthResponse(userId: string) {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      include: { memberships: { where: { status: 'ACTIVE' }, include: { role: true } } },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const roles = user.memberships.map((m) => m.role.code) as RoleCode[];
    const permissions = await this.permissions.getUserPermissions(user.id);
    const tokens = await this.createTokenPair(user.id, roles, permissions);

    await this.db.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      data: {
        ...tokens,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          displayName: user.displayName,
          status: user.status,
          roles,
          permissions,
        },
      },
    };
  }

  /**
   * One signed-in device.
   *
   * The `Session` table has existed since the first migration and nothing ever
   * wrote a row to it, so `GET /auth/sessions` always answered with an empty
   * list and the app's Security screen permanently read "no other sessions" --
   * including on the device you were reading it from. A session is now created
   * alongside the refresh token, carried into the access token as `sid`, and
   * revoked when that refresh token is.
   *
   * `previousSessionId` continues an existing session across a refresh rather
   * than opening a second one for the same device.
   */
  private async createTokenPair(
    userId: string,
    roles: RoleCode[],
    permissions: string[],
    device?: DeviceContext,
    previousSessionId?: string,
  ): Promise<TokenPair> {
    const rawRefresh = randomBytes(48).toString('hex');
    const tokenHash = this.hashRefreshToken(rawRefresh);
    const sessionTimeoutMinutes = await this.platformSettings.getSessionTimeoutMinutes();
    const expiresAt = new Date(Date.now() + sessionTimeoutMinutes * 60 * 1000);

    await this.db.refreshToken.create({
      data: { userId, tokenHash, expiresAt },
    });

    const session = previousSessionId
      ? await this.db.session.update({
          where: { id: previousSessionId },
          // The hash moves with the refresh token it identifies; the row, and
          // so the "this device" marker, survives.
          data: { tokenHash, expiresAt, lastUsedAt: new Date() },
        })
      : await this.db.session.create({
          data: {
            userId,
            tokenHash,
            expiresAt,
            lastUsedAt: new Date(),
            deviceName: device?.deviceName ?? null,
            deviceType: device?.deviceType ?? null,
            ipAddress: device?.ipAddress ?? null,
            userAgent: device?.userAgent ?? null,
          },
        });

    const accessToken = await this.jwt.signAsync(
      // `sid` is what lets `GET /auth/sessions` say which row is the caller's
      // own device. It identifies a session, never authorises anything.
      { sub: userId, roles, permissions, sid: session.id },
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expiresIn: this.config.get<string>('JWT_ACCESS_EXPIRES_IN', '15m') as any,
      },
    );

    return { accessToken, refreshToken: rawRefresh };
  }

  private hashRefreshToken(token: string): string {
    const secret = this.config.getOrThrow<string>('JWT_REFRESH_SECRET');
    return createHmac('sha256', secret).update(token).digest('hex');
  }

  /**
   * The secret that signs proof-of-phone tickets.
   *
   * Deliberately not `JWT_ACCESS_SECRET`. A ticket signed with the access
   * secret is a string that the bearer-token path would at least attempt to
   * parse, and "it fails later for an unrelated reason" is not a security
   * boundary. Falling back to the refresh secret keeps deployments working
   * without new configuration while staying off the access path entirely.
   */
  private phoneTicketSecret(): string {
    // `?.trim() ||` rather than `??`: an unset variable in a .env file arrives
    // as an empty string, not undefined, and `??` would sign tickets with "".
    return (
      this.config.get<string>('PHONE_TICKET_SECRET')?.trim() ||
      this.config.getOrThrow<string>('JWT_REFRESH_SECRET')
    );
  }

  private async signPhoneTicket(phone: string): Promise<string> {
    return this.jwt.signAsync(
      { typ: PHONE_TICKET_TYPE, phone },
      { secret: this.phoneTicketSecret(), expiresIn: PHONE_TICKET_TTL_SECONDS },
    );
  }

  /** The verified number inside a ticket, or a refusal. */
  private async readPhoneTicket(token: string): Promise<string> {
    const rejected = new BadRequestException(
      authError(
        AuthErrorCode.VERIFICATION_TICKET_INVALID,
        'Phone verification has expired. Request a new code.',
      ),
    );

    let payload: { typ?: string; phone?: string };
    try {
      payload = await this.jwt.verifyAsync(token, { secret: this.phoneTicketSecret() });
    } catch {
      throw rejected;
    }

    // The type claim is checked, not assumed. Without it, any token this secret
    // ever signs would be accepted here as proof of a phone number.
    if (payload.typ !== PHONE_TICKET_TYPE) throw rejected;

    const phone = normalizePhone(payload.phone);
    if (!phone) throw rejected;

    return phone;
  }
}
