import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { PrismaService } from './../src/database/prisma.service';
import { API, SEEDED, createTestApp, seededOrganizations, tokenFor } from './utils/e2e';

/**
 * Blood-type verification, end to end against a real database.
 *
 * A donor's blood group starts as something they typed about themselves. Two
 * parts of this product treat it as a medical fact: emergency matching, which
 * calls people out at night for a group they may not have, and donation
 * completion, which stamps the group onto a bag of blood that ends up in
 * someone's arm. Both are gated on `VerificationStatus.VERIFIED`, so the
 * question of who is allowed to move a profile into that state, and what
 * happens to it when the donor edits it afterwards, is the whole safety
 * property. This suite exercises it over HTTP.
 */
describe('Blood-type verification (e2e)', () => {
  let app: INestApplication;
  let db: PrismaService;

  const DONOR_EMAIL = 's3.verify.donor@e2e.local';

  let donorToken: string;
  let hospitalToken: string;
  let centerToken: string;
  let courierToken: string;
  let hospitalStaffId: string;

  let donorUserId: string;
  let hospitalId: string;
  let emergencyId: string;

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(PrismaService);

    const orgs = await seededOrganizations(app);
    hospitalId = orgs.hospital.id;

    hospitalToken = await tokenFor(app, SEEDED.hospitalStaff);
    centerToken = await tokenFor(app, SEEDED.bloodCenterStaff);
    courierToken = await tokenFor(app, SEEDED.courier);

    const staff = await db.user.findUniqueOrThrow({ where: { email: SEEDED.hospitalStaff } });
    hospitalStaffId = staff.id;

    // This suite's own donor, because it mutates the profile's verification
    // state repeatedly and must not disturb the seeded demo donor.
    const donorRole = await db.role.findUniqueOrThrow({ where: { code: 'DONOR' } });
    await db.user.deleteMany({ where: { email: DONOR_EMAIL } });
    const donor = await db.user.create({
      data: {
        email: DONOR_EMAIL,
        firstName: 'Verification',
        lastName: 'Subject',
        passwordHash: 'not-used-tokens-are-minted-directly',
        status: 'ACTIVE',
        emailVerified: true,
        donorProfile: {
          create: {
            // What the donor said about themselves, and nothing more.
            bloodType: 'AB',
            rhFactor: 'NEGATIVE',
            donorStatus: 'ACTIVE',
            verificationStatus: 'UNVERIFIED',
          },
        },
        memberships: {
          create: { organizationId: hospitalId, roleId: donorRole.id, status: 'ACTIVE' },
        },
      },
    });
    donorUserId = donor.id;
    donorToken = await tokenFor(app, DONOR_EMAIL);
  });

  afterAll(async () => {
    if (emergencyId) {
      await db.emergencyRequest.deleteMany({ where: { id: emergencyId } });
    }
    // Profile and membership cascade off the user.
    await db.user.deleteMany({ where: { id: donorUserId } });
    await app.close();
  });

  const verifyAs = (token: string, id = donorUserId) =>
    request(app.getHttpServer())
      .post(`${API}/donors/${id}/verify-blood-type`)
      .set('Authorization', `Bearer ${token}`);

  describe('1. Who may verify a blood type', () => {
    it('refuses an unauthenticated request', async () => {
      await request(app.getHttpServer())
        .post(`${API}/donors/${donorUserId}/verify-blood-type`)
        .send({ bloodType: 'O', rhFactor: 'POSITIVE', source: 'LABORATORY' })
        .expect(401);
    });

    it('refuses the donor verifying their own blood type', async () => {
      await verifyAs(donorToken)
        .send({ bloodType: 'O', rhFactor: 'POSITIVE', source: 'LABORATORY' })
        .expect(403);
    });

    it('refuses a courier', async () => {
      await verifyAs(courierToken)
        .send({ bloodType: 'O', rhFactor: 'POSITIVE', source: 'LABORATORY' })
        .expect(403);
    });

    it('leaves the profile untouched after every refusal', async () => {
      const profile = await db.donorProfile.findUniqueOrThrow({ where: { userId: donorUserId } });

      expect(profile.verificationStatus).toBe('UNVERIFIED');
      expect(profile.bloodType).toBe('AB');
      expect(profile.bloodTypeVerifiedBy).toBeNull();
    });

    it('rejects a blood group that is not one', async () => {
      await verifyAs(hospitalToken)
        .send({ bloodType: 'Z', rhFactor: 'POSITIVE', source: 'LABORATORY' })
        .expect(400);
    });
  });

  describe('2. Authorized staff verify, and the server records who', () => {
    it('hospital staff can correct the donor\'s self-reported group', async () => {
      const res = await verifyAs(hospitalToken)
        .send({
          bloodType: 'O',
          rhFactor: 'POSITIVE',
          source: 'LABORATORY',
          note: 'Typed on arrival, lab slip 4471',
        })
        .expect(200);

      expect(res.body.data.verificationStatus).toBe('VERIFIED');
      expect(res.body.data.bloodType).toBe('O');
    });

    it('records the provenance server-side rather than taking it from the request', async () => {
      const profile = await db.donorProfile.findUniqueOrThrow({ where: { userId: donorUserId } });

      expect(profile.verificationStatus).toBe('VERIFIED');
      expect(profile.bloodType).toBe('O');
      expect(profile.rhFactor).toBe('POSITIVE');
      // Not a field the client can set: it comes from the caller's token.
      expect(profile.bloodTypeVerifiedBy).toBe(hospitalStaffId);
      expect(profile.bloodTypeVerifiedAt).toBeInstanceOf(Date);
      expect(profile.bloodTypeSource).toBe('LABORATORY');
    });

    it('writes an audit entry naming the actor and both groups', async () => {
      const entry = await db.auditLog.findFirstOrThrow({
        where: { action: 'BLOOD_TYPE_VERIFIED', actorId: hospitalStaffId },
        orderBy: { createdAt: 'desc' },
      });

      expect(entry.metadata).toEqual(
        expect.objectContaining({
          donorId: donorUserId,
          previousBloodType: 'AB',
          newBloodType: 'O',
          source: 'LABORATORY',
        }),
      );
    });
  });

  describe('3. A verified donor is matchable for an emergency', () => {
    it('the activated emergency matches this donor', async () => {
      const created = await request(app.getHttpServer())
        .post(`${API}/organizations/${hospitalId}/emergencies`)
        .set('Authorization', `Bearer ${hospitalToken}`)
        .send({
          bloodType: 'O',
          rhFactor: 'POSITIVE',
          unitsRequired: 1,
          urgencyLevel: 'CRITICAL',
          description: 'e2e verification matching',
        })
        .expect(201);
      emergencyId = created.body.data?.id ?? created.body.id;

      await request(app.getHttpServer())
        .post(`${API}/organizations/${hospitalId}/emergencies/${emergencyId}/activate`)
        .set('Authorization', `Bearer ${hospitalToken}`)
        .send({})
        .expect(201);

      const match = await db.emergencyMatch.findFirst({
        where: { emergencyRequestId: emergencyId, donorId: donorUserId },
      });

      expect(match).not.toBeNull();
    });
  });

  describe('4. A donor editing their blood type undoes the verification', () => {
    it('moves the profile back to REQUIRES_REVIEW', async () => {
      await request(app.getHttpServer())
        .put(`${API}/donors/profile`)
        .set('Authorization', `Bearer ${donorToken}`)
        .send({ bloodType: 'B', rhFactor: 'NEGATIVE' })
        .expect(200);

      const profile = await db.donorProfile.findUniqueOrThrow({ where: { userId: donorUserId } });

      expect(profile.verificationStatus).toBe('REQUIRES_REVIEW');
      expect(profile.bloodType).toBe('B');
    });

    it('does not let the donor re-verify what they just changed', async () => {
      await verifyAs(donorToken)
        .send({ bloodType: 'B', rhFactor: 'NEGATIVE', source: 'LABORATORY' })
        .expect(403);
    });

    it('leaves a REQUIRES_REVIEW donor out of a new emergency match', async () => {
      const created = await request(app.getHttpServer())
        .post(`${API}/organizations/${hospitalId}/emergencies`)
        .set('Authorization', `Bearer ${hospitalToken}`)
        .send({
          bloodType: 'B',
          rhFactor: 'NEGATIVE',
          unitsRequired: 1,
          urgencyLevel: 'CRITICAL',
          description: 'e2e unverified must not match',
        })
        .expect(201);
      const reviewEmergencyId = created.body.data?.id ?? created.body.id;

      await request(app.getHttpServer())
        .post(`${API}/organizations/${hospitalId}/emergencies/${reviewEmergencyId}/activate`)
        .set('Authorization', `Bearer ${hospitalToken}`)
        .send({})
        .expect(201);

      const match = await db.emergencyMatch.findFirst({
        where: { emergencyRequestId: reviewEmergencyId, donorId: donorUserId },
      });

      expect(match).toBeNull();

      await db.emergencyRequest.deleteMany({ where: { id: reviewEmergencyId } });
    });
  });

  describe('5. Finding the donor to verify', () => {
    it('finds them by surname', async () => {
      const res = await request(app.getHttpServer())
        .get(`${API}/donors?search=Subject&limit=20`)
        .set('Authorization', `Bearer ${hospitalToken}`)
        .expect(200);

      const rows: { userId: string }[] = res.body.data ?? [];
      expect(rows.some((d) => d.userId === donorUserId)).toBe(true);
    });

    it('finds them by email, case-insensitively', async () => {
      const res = await request(app.getHttpServer())
        .get(`${API}/donors?search=S3.VERIFY&limit=20`)
        .set('Authorization', `Bearer ${hospitalToken}`)
        .expect(200);

      const rows: { userId: string }[] = res.body.data ?? [];
      expect(rows.some((d) => d.userId === donorUserId)).toBe(true);
    });

    it('narrows to the donors still awaiting review', async () => {
      const res = await request(app.getHttpServer())
        .get(`${API}/donors?verificationStatus=REQUIRES_REVIEW&limit=100`)
        .set('Authorization', `Bearer ${hospitalToken}`)
        .expect(200);

      const rows: { verificationStatus: string }[] = res.body.data ?? [];
      expect(rows.every((d) => d.verificationStatus === 'REQUIRES_REVIEW')).toBe(true);
    });

    it('refuses a filter value that is not one, rather than failing at the database', async () => {
      await request(app.getHttpServer())
        .get(`${API}/donors?bloodType=Z`)
        .set('Authorization', `Bearer ${hospitalToken}`)
        .expect(400);
    });

    it('keeps the directory closed to donors', async () => {
      await request(app.getHttpServer())
        .get(`${API}/donors?search=Subject`)
        .set('Authorization', `Bearer ${donorToken}`)
        .expect(403);
    });
  });

  describe('6. Staff can verify again, from either kind of organization', () => {
    it('blood-centre staff can move REQUIRES_REVIEW back to VERIFIED', async () => {
      const res = await verifyAs(centerToken)
        .send({ bloodType: 'B', rhFactor: 'NEGATIVE', source: 'BLOOD_CENTER' })
        .expect(200);

      expect(res.body.data.verificationStatus).toBe('VERIFIED');

      const profile = await db.donorProfile.findUniqueOrThrow({ where: { userId: donorUserId } });
      expect(profile.bloodTypeSource).toBe('BLOOD_CENTER');
      expect(profile.bloodTypeVerifiedBy).not.toBe(hospitalStaffId);
    });

    it('an unrelated profile edit does not undo that verification', async () => {
      await request(app.getHttpServer())
        .put(`${API}/donors/profile`)
        .set('Authorization', `Bearer ${donorToken}`)
        .send({ city: 'Jizzakh' })
        .expect(200);

      const profile = await db.donorProfile.findUniqueOrThrow({ where: { userId: donorUserId } });

      expect(profile.verificationStatus).toBe('VERIFIED');
    });
  });
});
