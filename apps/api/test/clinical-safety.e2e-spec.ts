import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { PrismaService } from './../src/database/prisma.service';
import {
  API,
  SEEDED,
  createTestApp,
  createTestDonor,
  seededOrganizations,
  tokenFor,
  recordFixtureReleaseDecision,
  releasedUnitFields,
  type TestDonor,
} from './utils/e2e';

/**
 * Sprint 7's safety properties, proved the way an attacker or a buggy client
 * would test them: real HTTP requests to the real application, through the real
 * guards, with no service mocked.
 *
 * The thirteen properties Sprint 7 names are the headings below. Each of them
 * describes a way this system could hand somebody a bag of blood it had no
 * business clearing, or send a deferred donor to a chair, and each has an
 * implementation that looks correct and gets it wrong -- an empty requirement
 * list read as "nothing required", a development policy honoured because it is
 * the only one there, a deferral recorded against a donation and never reaching
 * the donor.
 *
 * The suite owns every row it creates and puts the database back exactly as it
 * found it, so it can run repeatedly with no reset between runs.
 */
describe('Clinical safety: release gate and donor deferral (e2e)', () => {
  let app: INestApplication;
  let db: PrismaService;

  let bloodCenterId: string;
  let hospitalId: string;
  let staffToken: string;
  let superAdminToken: string;
  let donor: TestDonor;

  /** The development policy the seed installs, and which the gate honours here. */
  let developmentPolicyId: string;

  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const createdUnitIds: string[] = [];
  const createdDonationIds: string[] = [];
  const createdPolicyIds: string[] = [];

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(PrismaService);

    const organizations = await seededOrganizations(app);
    bloodCenterId = organizations.bloodCenter.id;
    hospitalId = organizations.hospital.id;

    staffToken = await tokenFor(app, SEEDED.bloodCenterStaff);
    superAdminToken = await tokenFor(app, SEEDED.superAdmin);

    donor = await createTestDonor(app, {
      label: 'clinical-safety',
      organizationId: bloodCenterId,
    });

    const policy = await db.clinicalReleasePolicy.findFirstOrThrow({
      where: { kind: 'DEVELOPMENT_ONLY', status: 'APPROVED' },
    });
    developmentPolicyId = policy.id;
  });

  afterAll(async () => {
    await db.releaseDecision.deleteMany({ where: { bloodUnitId: { in: createdUnitIds } } });
    await db.bloodUnitDisposition.deleteMany({ where: { bloodUnitId: { in: createdUnitIds } } });
    await db.inventoryMovement.deleteMany({ where: { bloodUnitId: { in: createdUnitIds } } });
    await db.bloodUnitReservation.deleteMany({ where: { bloodUnitId: { in: createdUnitIds } } });
    await db.bloodUnit.deleteMany({ where: { id: { in: createdUnitIds } } });
    await db.donation.deleteMany({ where: { id: { in: createdDonationIds } } });
    await db.clinicalReleaseRequirement.deleteMany({ where: { policyId: { in: createdPolicyIds } } });
    await db.clinicalReleasePolicy.deleteMany({ where: { id: { in: createdPolicyIds } } });
    await db.inventoryThreshold.deleteMany({
      where: { organizationId: { in: [bloodCenterId, hospitalId] }, scopeKey: { startsWith: 'TYPE:AB' } },
    });
    await donor.cleanup();
    await app.close();
  });

  /** A collected unit, exactly as `completeDonation` would leave it. */
  async function collectedUnit(overrides: Record<string, unknown> = {}) {
    const donation = await db.donation.create({
      data: {
        donationReference: `E2E-CS-${stamp}-${createdDonationIds.length}`,
        donorId: donor.id,
        organizationId: bloodCenterId,
        donationType: 'WHOLE_BLOOD',
        status: 'COMPLETED',
        volumeMl: 450,
        completedAt: new Date(),
      },
    });
    createdDonationIds.push(donation.id);

    const unit = await db.bloodUnit.create({
      data: {
        unitReference: `E2E-CS-UNIT-${stamp}-${createdUnitIds.length}`,
        donationId: donation.id,
        organizationId: bloodCenterId,
        componentType: 'WHOLE_BLOOD',
        bloodType: 'AB',
        rhFactor: 'NEGATIVE',
        volumeMl: 450,
        status: 'COLLECTED',
        collectedAt: new Date(),
        bloodGroupSource: 'DONOR_PROFILE_COPY',
        expirySource: 'UNKNOWN',
        ...overrides,
      },
    });
    createdUnitIds.push(unit.id);
    return unit;
  }

  /**
   * Put a policy in force for the blood centre for the duration of one test.
   *
   * Organisation-scoped, because the seed's development policy is platform-wide
   * and an organisation policy wins over it -- which is how a test can make the
   * gate see "an approved production policy" without touching global state that
   * every other suite reads.
   */
  async function withOrganizationPolicy(
    data: {
      kind: 'PRODUCTION' | 'DEVELOPMENT_ONLY';
      status?: 'DRAFT' | 'APPROVED' | 'RETIRED';
      requirements?: { code: string; description: string }[];
      developmentShelfLifeDays?: number | null;
    },
    run: () => Promise<void>,
  ) {
    const policy = await db.clinicalReleasePolicy.create({
      data: {
        organizationId: bloodCenterId,
        scopeKey: bloodCenterId,
        version: 1,
        status: data.status ?? 'APPROVED',
        kind: data.kind,
        title: `E2E policy ${stamp}`,
        approvedAt: new Date(),
        developmentShelfLifeDays: data.developmentShelfLifeDays ?? null,
        requirements: data.requirements ? { create: data.requirements } : undefined,
      },
    });
    createdPolicyIds.push(policy.id);

    try {
      await run();
    } finally {
      await db.clinicalReleaseRequirement.deleteMany({ where: { policyId: policy.id } });
      await db.clinicalReleasePolicy.deleteMany({ where: { id: policy.id } });
    }
  }

  const release = (unitId: string, token: string) =>
    request(app.getHttpServer())
      .post(`${API}/organizations/${bloodCenterId}/inventory/units/${unitId}/release`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'e2e' });

  // =====================================================================
  // 1. No approved release policy -> release refused
  // =====================================================================
  it('1. refuses release when no approved policy covers the organisation', async () => {
    const unit = await collectedUnit();

    // The seed's platform-wide development policy is what would otherwise
    // answer, so it is retired for the length of this test and put back after.
    await db.clinicalReleasePolicy.update({
      where: { id: developmentPolicyId },
      data: { status: 'RETIRED' },
    });

    try {
      const response = await release(unit.id, staffToken);

      expect(response.status).toBe(409);
      expect(response.body.error?.code ?? response.body.code).toBe(
        'CLINICAL_RELEASE_POLICY_NOT_CONFIGURED',
      );

      const after = await db.bloodUnit.findUniqueOrThrow({ where: { id: unit.id } });
      expect(after.status).toBe('COLLECTED');
      expect(after.clinicalReleasedAt).toBeNull();

      // The refusal is on the record, not just in the response.
      const decisions = await db.releaseDecision.findMany({ where: { bloodUnitId: unit.id } });
      expect(decisions).toHaveLength(1);
      expect(decisions[0]!.outcome).toBe('REFUSED');
      expect(decisions[0]!.reasonCode).toBe('CLINICAL_RELEASE_POLICY_NOT_CONFIGURED');
    } finally {
      await db.clinicalReleasePolicy.update({
        where: { id: developmentPolicyId },
        data: { status: 'APPROVED' },
      });
    }
  });

  // =====================================================================
  // 2. Empty requirement set is not an approval
  // =====================================================================
  it('2. refuses release under an approved production policy that lists no requirements', async () => {
    const unit = await collectedUnit();

    await withOrganizationPolicy({ kind: 'PRODUCTION', requirements: [] }, async () => {
      const response = await release(unit.id, staffToken);

      expect(response.status).toBe(409);
      expect(response.body.error?.code ?? response.body.code).toBe(
        'CLINICAL_RELEASE_POLICY_HAS_NO_REQUIREMENTS',
      );

      const after = await db.bloodUnit.findUniqueOrThrow({ where: { id: unit.id } });
      expect(after.clinicalReleasedAt).toBeNull();
    });
  });

  it('2b. refuses release when the policy names requirements the unit does not satisfy', async () => {
    const unit = await collectedUnit();

    await withOrganizationPolicy(
      {
        kind: 'PRODUCTION',
        requirements: [
          { code: 'E2E_REQ_ONE', description: 'Something a clinician will one day specify.' },
          { code: 'E2E_REQ_TWO', description: 'And something else.' },
        ],
      },
      async () => {
        const response = await release(unit.id, staffToken);

        expect(response.status).toBe(409);
        expect(response.body.error?.code ?? response.body.code).toBe(
          'CLINICAL_RELEASE_REQUIREMENTS_NOT_MET',
        );

        const decision = await db.releaseDecision.findFirstOrThrow({
          where: { bloodUnitId: unit.id },
          orderBy: { decidedAt: 'desc' },
        });
        // The decision names what was missing, and under which version.
        expect(decision.unmetRequirements.sort()).toEqual(['E2E_REQ_ONE', 'E2E_REQ_TWO']);
        expect(decision.policyVersion).toBe(1);
      },
    );
  });

  // =====================================================================
  // 3. A development policy cannot clear a unit in production
  // =====================================================================
  it('3. records a development release as development, never as clinical clearance', async () => {
    const unit = await collectedUnit();

    // This process is NODE_ENV=test, so the development policy is honoured --
    // which is the only reason any of the flows in this repository work. What
    // must be true is that the clearance is labelled for what it is everywhere
    // it is read back. The production refusal itself is proved without a live
    // server in clinical-release.service.spec.ts, because NODE_ENV cannot be
    // changed underneath a booted Nest application.
    const response = await release(unit.id, staffToken);

    expect(response.status).toBe(201);
    expect(response.body.data.developmentOnly).toBe(true);
    expect(response.body.data.releasePolicyKind).toBe('DEVELOPMENT_ONLY');

    const decision = await db.releaseDecision.findFirstOrThrow({
      where: { bloodUnitId: unit.id, outcome: 'RELEASED' },
    });
    expect(decision.policyKind).toBe('DEVELOPMENT_ONLY');

    // And the console is told, at the top of the screen, before anybody clicks.
    const policyView = await request(app.getHttpServer())
      .get(`${API}/organizations/${bloodCenterId}/inventory/clinical-release/policy`)
      .set('Authorization', `Bearer ${staffToken}`);

    expect(policyView.status).toBe(200);
    expect(policyView.body.data.policy.developmentOnly).toBe(true);
  });

  // =====================================================================
  // 4. No release decision -> reserve refused
  // =====================================================================
  it('4. refuses to reserve a unit that carries no release decision', async () => {
    // AVAILABLE in the database, cleared by nobody. Exactly the state every
    // unit in this system was in before Sprint 7.
    const unit = await collectedUnit({ status: 'AVAILABLE', clinicalReleasedAt: null });

    const response = await request(app.getHttpServer())
      .post(`${API}/organizations/${bloodCenterId}/inventory/units/${unit.id}/reserve`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ reason: 'e2e' });

    expect(response.status).toBe(409);
    expect(response.body.error?.code ?? response.body.code).toBe('CLINICAL_RELEASE_DECISION_MISSING');

    const after = await db.bloodUnit.findUniqueOrThrow({ where: { id: unit.id } });
    expect(after.status).toBe('AVAILABLE');
  });

  // =====================================================================
  // 5. No release decision -> issue refused
  // =====================================================================
  it('5. refuses to issue a unit that carries no release decision', async () => {
    const unit = await collectedUnit({ status: 'AVAILABLE', clinicalReleasedAt: null });

    const response = await request(app.getHttpServer())
      .post(`${API}/organizations/${bloodCenterId}/inventory/units/${unit.id}/issue`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ reason: 'e2e' });

    expect(response.status).toBe(409);
    expect(response.body.error?.code ?? response.body.code).toBe('CLINICAL_RELEASE_DECISION_MISSING');

    const after = await db.bloodUnit.findUniqueOrThrow({ where: { id: unit.id } });
    expect(after.status).toBe('AVAILABLE');
  });

  // =====================================================================
  // 6. SUPER_ADMIN cannot bypass
  // =====================================================================
  describe('6. a platform administrator has no clinical authority', () => {
    it('is refused the same release a staff member is refused', async () => {
      const unit = await collectedUnit();

      await withOrganizationPolicy({ kind: 'PRODUCTION', requirements: [] }, async () => {
        const staffResponse = await release(unit.id, staffToken);
        const adminResponse = await release(unit.id, superAdminToken);

        expect(staffResponse.status).toBe(409);
        expect(adminResponse.status).toBe(409);
        // Identical, not merely both refused: the gate cannot see the
        // difference between them, which is the property that matters.
        expect(adminResponse.body.error?.code ?? adminResponse.body.code).toBe(
          staffResponse.body.error?.code ?? staffResponse.body.code,
        );

        const after = await db.bloodUnit.findUniqueOrThrow({ where: { id: unit.id } });
        expect(after.clinicalReleasedAt).toBeNull();
      });
    });

    it('cannot reserve or issue an uncleared unit either', async () => {
      const unit = await collectedUnit({ status: 'AVAILABLE', clinicalReleasedAt: null });

      const reserve = await request(app.getHttpServer())
        .post(`${API}/organizations/${bloodCenterId}/inventory/units/${unit.id}/reserve`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ reason: 'e2e' });
      const issue = await request(app.getHttpServer())
        .post(`${API}/organizations/${bloodCenterId}/inventory/units/${unit.id}/issue`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ reason: 'e2e' });

      expect(reserve.status).toBe(409);
      expect(issue.status).toBe(409);
    });

    it('has no force-release route to call', async () => {
      const unit = await collectedUnit();

      // Every spelling somebody reaching for an override would try.
      for (const path of [
        `${API}/organizations/${bloodCenterId}/inventory/units/${unit.id}/force-release`,
        `${API}/organizations/${bloodCenterId}/inventory/units/${unit.id}/release/force`,
        `${API}/organizations/${bloodCenterId}/inventory/units/${unit.id}/override`,
        `${API}/admin/inventory/units/${unit.id}/release`,
      ]) {
        const response = await request(app.getHttpServer())
          .post(path)
          .set('Authorization', `Bearer ${superAdminToken}`)
          .send({ reason: 'e2e', force: true });

        expect(response.status).toBe(404);
      }
    });

    it('cannot smuggle an override through the release body', async () => {
      const unit = await collectedUnit();

      await withOrganizationPolicy({ kind: 'PRODUCTION', requirements: [] }, async () => {
        const response = await request(app.getHttpServer())
          .post(`${API}/organizations/${bloodCenterId}/inventory/units/${unit.id}/release`)
          .set('Authorization', `Bearer ${superAdminToken}`)
          .send({ reason: 'e2e', force: true, override: true, skipClinicalRelease: true });

        // 400, as it happens: the global validation pipe strips unknown fields
        // and refuses the body outright, so the override never reaches the
        // handler. Asserted as "not a success" rather than as one exact status,
        // because what matters is the unit, not which layer said no.
        expect(response.status).toBeGreaterThanOrEqual(400);

        const after = await db.bloodUnit.findUniqueOrThrow({ where: { id: unit.id } });
        expect(after.status).toBe('COLLECTED');
        expect(after.clinicalReleasedAt).toBeNull();
      });
    });
  });

  // =====================================================================
  // 7. Active deferral -> booking refused
  // =====================================================================
  describe('7. an actively deferred donor cannot book', () => {
    let deferredDonor: TestDonor;
    let deferralId: string;

    beforeAll(async () => {
      deferredDonor = await createTestDonor(app, {
        label: 'deferred-booking',
        organizationId: bloodCenterId,
      });
      const deferral = await db.donorDeferral.create({
        data: {
          donorId: deferredDonor.id,
          organizationId: bloodCenterId,
          kind: 'INDEFINITE',
          source: 'STAFF_DECISION',
          startsAt: new Date(Date.now() - 60_000),
        },
      });
      deferralId = deferral.id;
    });

    afterAll(async () => {
      await deferredDonor.cleanup();
    });

    it('refuses the booking with DONOR_DEFERRED', async () => {
      const slot = await db.appointmentSlot.findFirstOrThrow({
        where: {
          organizationId: bloodCenterId,
          appointmentType: 'BLOOD_DONATION',
          status: 'AVAILABLE',
          startAt: { gt: new Date() },
        },
        orderBy: { startAt: 'asc' },
      });

      const response = await request(app.getHttpServer())
        .post(`${API}/appointments`)
        .set('Authorization', `Bearer ${deferredDonor.token}`)
        .send({ slotId: slot.id, appointmentType: 'BLOOD_DONATION' });

      expect(response.status).toBe(409);
      expect(response.body.error?.code ?? response.body.code).toBe('DONOR_DEFERRED');

      const booked = await db.appointment.count({ where: { donorId: deferredDonor.id } });
      expect(booked).toBe(0);
    });

    it('lets the donor see that they are deferred, and never that they may lift it', async () => {
      const response = await request(app.getHttpServer())
        .get(`${API}/donors/me/deferral`)
        .set('Authorization', `Bearer ${deferredDonor.token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.deferred).toBe(true);
      expect(response.body.data.canLift).toBe(false);
    });

    it('has no route by which a donor could lift their own deferral', async () => {
      const response = await request(app.getHttpServer())
        .post(`${API}/organizations/${bloodCenterId}/donors/${deferredDonor.id}/deferrals/${deferralId}/lift`)
        .set('Authorization', `Bearer ${deferredDonor.token}`)
        .send({ reason: 'I feel fine' });

      expect(response.status).toBe(403);

      const still = await db.donorDeferral.findUniqueOrThrow({ where: { id: deferralId } });
      expect(still.liftedAt).toBeNull();
    });
  });

  // =====================================================================
  // 8. Active deferral -> excluded from SOS matching
  // =====================================================================
  it('8. excludes an actively deferred donor from emergency matching', async () => {
    const matchable = await createTestDonor(app, {
      label: 'sos-matchable',
      organizationId: hospitalId,
      bloodType: 'O',
      rhFactor: 'NEGATIVE',
    });
    const deferred = await createTestDonor(app, {
      label: 'sos-deferred',
      organizationId: hospitalId,
      bloodType: 'O',
      rhFactor: 'NEGATIVE',
    });

    try {
      await db.donorDeferral.create({
        data: {
          donorId: deferred.id,
          organizationId: bloodCenterId,
          kind: 'INDEFINITE',
          source: 'DONATION_ASSESSMENT',
          startsAt: new Date(Date.now() - 60_000),
        },
      });

      // The profile flag is left ACTIVE on purpose. Matching used to read only
      // that flag, so a deferral the flag had not caught up with was invisible
      // to it; this proves the deferral rows are the authority.
      await db.donorProfile.updateMany({
        where: { userId: deferred.id },
        data: { donorStatus: 'ACTIVE' },
      });

      const hospitalStaffToken = await tokenFor(app, SEEDED.hospitalStaff);

      const created = await request(app.getHttpServer())
        .post(`${API}/organizations/${hospitalId}/emergencies`)
        .set('Authorization', `Bearer ${hospitalStaffToken}`)
        .send({
          bloodType: 'O',
          rhFactor: 'NEGATIVE',
          unitsRequired: 1,
          urgencyLevel: 'HIGH',
          description: 'e2e clinical safety',
        });
      expect(created.status).toBe(201);
      const emergencyId = created.body.data.id;

      try {
        const activated = await request(app.getHttpServer())
          .post(`${API}/organizations/${hospitalId}/emergencies/${emergencyId}/activate`)
          .set('Authorization', `Bearer ${hospitalStaffToken}`)
          .send({});
        expect(activated.status).toBe(201);

        const matchedDonorIds = (
          await db.emergencyMatch.findMany({
            where: { emergencyRequestId: emergencyId },
            select: { donorId: true },
          })
        ).map((match) => match.donorId);

        expect(matchedDonorIds).toContain(matchable.id);
        expect(matchedDonorIds).not.toContain(deferred.id);
      } finally {
        await db.emergencyMatch.deleteMany({ where: { emergencyRequestId: emergencyId } });
        await db.emergencyRequest.deleteMany({ where: { id: emergencyId } });
      }
    } finally {
      await matchable.cleanup();
      await deferred.cleanup();
    }
  });

  // =====================================================================
  // 9. A lifted or expired deferral stops applying
  // =====================================================================
  describe('9. the predicate is right about time and about lifting', () => {
    it('does not defer a donor whose deferral has been lifted', async () => {
      const lifted = await createTestDonor(app, { label: 'lifted', organizationId: bloodCenterId });
      try {
        await db.donorDeferral.create({
          data: {
            donorId: lifted.id,
            organizationId: bloodCenterId,
            kind: 'INDEFINITE',
            source: 'STAFF_DECISION',
            startsAt: new Date(Date.now() - 86_400_000),
            liftedAt: new Date(Date.now() - 3_600_000),
            liftReason: 'resolved',
          },
        });

        const response = await request(app.getHttpServer())
          .get(`${API}/donors/me/deferral`)
          .set('Authorization', `Bearer ${lifted.token}`);

        expect(response.body.data.deferred).toBe(false);
      } finally {
        await lifted.cleanup();
      }
    });

    it('does not defer a donor whose temporary deferral has ended', async () => {
      const expired = await createTestDonor(app, { label: 'expired', organizationId: bloodCenterId });
      try {
        await db.donorDeferral.create({
          data: {
            donorId: expired.id,
            organizationId: bloodCenterId,
            kind: 'TEMPORARY',
            source: 'STAFF_DECISION',
            startsAt: new Date(Date.now() - 86_400_000 * 10),
            endsAt: new Date(Date.now() - 86_400_000),
          },
        });

        const response = await request(app.getHttpServer())
          .get(`${API}/donors/me/deferral`)
          .set('Authorization', `Bearer ${expired.token}`);

        expect(response.body.data.deferred).toBe(false);
      } finally {
        await expired.cleanup();
      }
    });

    it('does not defer a donor whose deferral has not started yet', async () => {
      const future = await createTestDonor(app, { label: 'future', organizationId: bloodCenterId });
      try {
        await db.donorDeferral.create({
          data: {
            donorId: future.id,
            organizationId: bloodCenterId,
            kind: 'TEMPORARY',
            source: 'STAFF_DECISION',
            startsAt: new Date(Date.now() + 86_400_000),
            endsAt: new Date(Date.now() + 86_400_000 * 30),
          },
        });

        const response = await request(app.getHttpServer())
          .get(`${API}/donors/me/deferral`)
          .set('Authorization', `Bearer ${future.token}`);

        expect(response.body.data.deferred).toBe(false);
      } finally {
        await future.cleanup();
      }
    });

    it('does defer a donor inside an open temporary window', async () => {
      const current = await createTestDonor(app, { label: 'current', organizationId: bloodCenterId });
      try {
        await db.donorDeferral.create({
          data: {
            donorId: current.id,
            organizationId: bloodCenterId,
            kind: 'TEMPORARY',
            source: 'STAFF_DECISION',
            startsAt: new Date(Date.now() - 86_400_000),
            endsAt: new Date(Date.now() + 86_400_000),
          },
        });

        const response = await request(app.getHttpServer())
          .get(`${API}/donors/me/deferral`)
          .set('Authorization', `Bearer ${current.token}`);

        expect(response.body.data.deferred).toBe(true);
      } finally {
        await current.cleanup();
      }
    });
  });

  // =====================================================================
  // 10. Assessment recorded as DEFERRED creates an active deferral
  // =====================================================================
  it('10. deferring a donor at the chair defers the donor', async () => {
    const chairDonor = await createTestDonor(app, {
      label: 'chair-deferral',
      organizationId: bloodCenterId,
    });

    try {
      const slot = await db.appointmentSlot.findFirstOrThrow({
        where: {
          organizationId: bloodCenterId,
          appointmentType: 'BLOOD_DONATION',
          status: 'AVAILABLE',
          startAt: { gt: new Date() },
        },
        orderBy: { startAt: 'asc' },
      });

      const booking = await request(app.getHttpServer())
        .post(`${API}/appointments`)
        .set('Authorization', `Bearer ${chairDonor.token}`)
        .send({ slotId: slot.id, appointmentType: 'BLOOD_DONATION' });
      expect(booking.status).toBe(201);
      const appointmentId = booking.body.data.id;

      const checkIn = await request(app.getHttpServer())
        .post(`${API}/organizations/${bloodCenterId}/donations/check-in/${appointmentId}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({});
      expect(checkIn.status).toBe(201);
      const donationId = checkIn.body.data.id;

      const assessment = await request(app.getHttpServer())
        .post(`${API}/organizations/${bloodCenterId}/donations/${donationId}/assessment`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ decision: 'DEFERRED', reasonCategory: 'E2E_REASON', notes: 'e2e' });
      expect(assessment.status).toBe(201);

      // The deferral exists, is active, and says where it came from.
      const deferrals = await db.donorDeferral.findMany({ where: { donorId: chairDonor.id } });
      expect(deferrals).toHaveLength(1);
      expect(deferrals[0]!.kind).toBe('INDEFINITE');
      expect(deferrals[0]!.source).toBe('DONATION_ASSESSMENT');
      expect(deferrals[0]!.sourceDonationId).toBe(donationId);
      expect(deferrals[0]!.liftedAt).toBeNull();

      // And -- the thing that did not happen before Sprint 7 -- the donor
      // cannot simply book again.
      const nextSlot = await db.appointmentSlot.findFirstOrThrow({
        where: {
          organizationId: bloodCenterId,
          appointmentType: 'BLOOD_DONATION',
          status: 'AVAILABLE',
          startAt: { gt: new Date() },
          id: { not: slot.id },
        },
        orderBy: { startAt: 'asc' },
      });

      const rebooking = await request(app.getHttpServer())
        .post(`${API}/appointments`)
        .set('Authorization', `Bearer ${chairDonor.token}`)
        .send({ slotId: nextSlot.id, appointmentType: 'BLOOD_DONATION' });

      expect(rebooking.status).toBe(409);
      expect(rebooking.body.error?.code ?? rebooking.body.code).toBe('DONOR_DEFERRED');

      // Staff can see it and lift it, with a reason on the record.
      const staffView = await request(app.getHttpServer())
        .get(`${API}/organizations/${bloodCenterId}/donors/${chairDonor.id}/deferrals`)
        .set('Authorization', `Bearer ${staffToken}`);
      expect(staffView.status).toBe(200);
      expect(staffView.body.data.active).not.toBeNull();

      const lift = await request(app.getHttpServer())
        .post(
          `${API}/organizations/${bloodCenterId}/donors/${chairDonor.id}/deferrals/${deferrals[0]!.id}/lift`,
        )
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ reason: 'Reviewed and cleared' });
      expect(lift.status).toBe(201);

      // Lifted, not deleted.
      const after = await db.donorDeferral.findUniqueOrThrow({ where: { id: deferrals[0]!.id } });
      expect(after.liftedAt).not.toBeNull();
      expect(after.liftReason).toBe('Reviewed and cleared');
    } finally {
      await db.donationEvent.deleteMany({ where: { donation: { donorId: chairDonor.id } } });
      await chairDonor.cleanup();
    }
  });

  // =====================================================================
  // 11. Unknown expiry -> release refused
  // =====================================================================
  it('11. refuses release when the shelf life is unknown and no policy supplies one', async () => {
    const unit = await collectedUnit({ expiresAt: null, expirySource: 'UNKNOWN' });

    // A development policy that states no shelf life. There is then nothing,
    // anywhere, that says when this unit stops being safe.
    await withOrganizationPolicy(
      { kind: 'DEVELOPMENT_ONLY', developmentShelfLifeDays: null },
      async () => {
        const response = await release(unit.id, staffToken);

        expect(response.status).toBe(409);
        expect(response.body.error?.code ?? response.body.code).toBe(
          'CLINICAL_RELEASE_EXPIRY_UNKNOWN',
        );

        const after = await db.bloodUnit.findUniqueOrThrow({ where: { id: unit.id } });
        expect(after.clinicalReleasedAt).toBeNull();
      },
    );
  });

  it('11b. records where a released unit’s expiry came from', async () => {
    const unit = await collectedUnit();

    const response = await release(unit.id, staffToken);
    expect(response.status).toBe(201);

    const after = await db.bloodUnit.findUniqueOrThrow({ where: { id: unit.id } });
    expect(after.expiresAt).not.toBeNull();
    // Not a clinical shelf life, and the column says so rather than leaving the
    // date to speak for itself.
    expect(after.expirySource).toBe('DEVELOPMENT_POLICY');
  });

  // =====================================================================
  // 12. Low-stock thresholds are per organisation
  // =====================================================================
  it('12. keeps low-stock thresholds organisation-specific', async () => {
    const bcAdmin = await tokenFor(app, SEEDED.bloodCenterAdmin);
    const hospitalAdmin = await tokenFor(app, SEEDED.hospitalAdmin);

    const setFor = (organizationId: string, token: string, lowStockThreshold: number) =>
      request(app.getHttpServer())
        .put(`${API}/organizations/${organizationId}/inventory/thresholds`)
        .set('Authorization', `Bearer ${token}`)
        .send({ bloodType: 'AB', rhFactor: 'NEGATIVE', lowStockThreshold });

    expect((await setFor(bloodCenterId, bcAdmin, 12)).status).toBe(200);
    expect((await setFor(hospitalId, hospitalAdmin, 3)).status).toBe(200);

    const bcList = await request(app.getHttpServer())
      .get(`${API}/organizations/${bloodCenterId}/inventory/thresholds`)
      .set('Authorization', `Bearer ${bcAdmin}`);
    const hospitalList = await request(app.getHttpServer())
      .get(`${API}/organizations/${hospitalId}/inventory/thresholds`)
      .set('Authorization', `Bearer ${hospitalAdmin}`);

    const bcRow = bcList.body.data.thresholds.find((t: any) => t.scopeKey === 'TYPE:AB:NEGATIVE');
    const hospitalRow = hospitalList.body.data.thresholds.find(
      (t: any) => t.scopeKey === 'TYPE:AB:NEGATIVE',
    );

    expect(bcRow.lowStockThreshold).toBe(12);
    expect(hospitalRow.lowStockThreshold).toBe(3);

    // Neither organisation's list contains the other's row.
    expect(bcList.body.data.thresholds.every((t: any) => t.lowStockThreshold !== 3)).toBe(true);

    // Ordinary staff can see alerts; only an administrator sets the number that
    // produces them.
    const staffAttempt = await setFor(bloodCenterId, staffToken, 99);
    expect(staffAttempt.status).toBe(403);
  });

  // =====================================================================
  // 13. Cross-organisation authorisation is still denied
  // =====================================================================
  describe('13. one organisation cannot reach into another', () => {
    it('refuses a blood-centre staff member the hospital’s thresholds', async () => {
      const response = await request(app.getHttpServer())
        .get(`${API}/organizations/${hospitalId}/inventory/thresholds`)
        .set('Authorization', `Bearer ${await tokenFor(app, SEEDED.bloodCenterAdmin)}`);

      expect(response.status).toBe(403);
    });

    it('refuses a hospital staff member the blood centre’s release queue', async () => {
      const response = await request(app.getHttpServer())
        .get(`${API}/organizations/${bloodCenterId}/inventory/clinical-release/awaiting`)
        .set('Authorization', `Bearer ${await tokenFor(app, SEEDED.hospitalStaff)}`);

      // Hospital staff are not on the role list for the release queue at all.
      expect(response.status).toBe(403);
    });

    it("refuses another organisation's staff a unit's traceability chain", async () => {
      const unit = await collectedUnit();

      const response = await request(app.getHttpServer())
        .get(`${API}/organizations/${hospitalId}/inventory/units/${unit.id}/traceability`)
        .set('Authorization', `Bearer ${await tokenFor(app, SEEDED.hospitalStaff)}`);

      // The unit belongs to the blood centre; asking for it under the
      // hospital's path finds nothing rather than leaking it.
      expect(response.status).toBe(404);
    });

    it("refuses another organisation's staff the right to defer a donor", async () => {
      const response = await request(app.getHttpServer())
        .post(`${API}/organizations/${bloodCenterId}/donors/${donor.id}/deferrals`)
        .set('Authorization', `Bearer ${await tokenFor(app, SEEDED.hospitalStaff)}`)
        .send({ kind: 'INDEFINITE', reasonText: 'should not work' });

      expect(response.status).toBe(403);

      const deferrals = await db.donorDeferral.count({ where: { donorId: donor.id } });
      expect(deferrals).toBe(0);
    });
  });

  // =====================================================================
  // Traceability and provenance
  // =====================================================================
  describe('traceability', () => {
    it('answers the whole chain for a unit, and is honest about the parts that do not exist yet', async () => {
      const unit = await collectedUnit();
      await release(unit.id, staffToken);

      const issued = await request(app.getHttpServer())
        .post(`${API}/organizations/${bloodCenterId}/inventory/units/${unit.id}/issue`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ reason: 'e2e', recipientReference: 'WARD-7' });
      expect(issued.status).toBe(201);

      const chain = await request(app.getHttpServer())
        .get(`${API}/organizations/${bloodCenterId}/inventory/units/${unit.id}/traceability`)
        .set('Authorization', `Bearer ${staffToken}`);

      expect(chain.status).toBe(200);
      const data = chain.body.data;

      expect(data.donor.id).toBe(donor.id);
      expect(data.donation.donationReference).toBeTruthy();
      expect(data.clinicalRelease.released).toBe(true);
      expect(data.clinicalRelease.decisions.length).toBeGreaterThan(0);
      expect(data.disposition.type).toBe('ISSUED');
      expect(data.disposition.recipient.reference).toBe('WARD-7');
      // The chain says what nobody has decided rather than implying it has been.
      expect(data.disposition.recipient.identityPolicy).toBe('UNDEFINED');

      // A group copied from the donor is never presented as a typed unit.
      expect(data.bloodGroup.provenance).toBe('DONOR_PROFILE_COPY');
      expect(data.bloodGroup.typedFromUnit).toBe(false);
    });
  });
});
