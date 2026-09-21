import { INestApplication } from '@nestjs/common';
import {
  DonorReviewResolution,
  DonorStatus,
  SafetyDisposition,
  ScreeningOrderStatus,
} from '@prisma/client';
import request from 'supertest';

import { PrismaService } from './../src/database/prisma.service';
import {
  API,
  SEEDED,
  createTestApp,
  createTestDonor,
  seededOrganizations,
  tokenFor,
  type TestDonor,
} from './utils/e2e';

/**
 * Sprint 10's chain, one link at a time, against the real application.
 *
 * The rule the whole sprint is built around is that none of these facts implies
 * the next:
 *
 *   donor eligible -> donation completed -> sample collected ->
 *   screening completed -> screening reviewed -> component released ->
 *   component transfused
 *
 * Every plausible-looking shortcut between two of those is a way to put
 * unscreened blood into a patient, and each one has a test below whose failure
 * is the shortcut. The suite drives real HTTP through the real guards and owns
 * every row it creates.
 */
describe('Blood-bank screening, release, recall and hemovigilance (e2e)', () => {
  let app: INestApplication;
  let db: PrismaService;

  let bloodCenterId: string;
  let hospitalId: string;
  /** Records results. Never reviews them. */
  let technicianToken: string;
  /** Reviews results. Never the same person as the technician. */
  let reviewerToken: string;
  let hospitalToken: string;
  let superAdminToken: string;
  let technicianId: string;
  let donor: TestDonor;

  /** The production policy this suite puts in force for the blood centre. */
  let policyId: string;
  let requirementCode: string;

  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const createdUnitIds: string[] = [];
  const createdDonationIds: string[] = [];

  const PASS = 'E2E-CODE-PASS';
  const BLOCK = 'E2E-CODE-BLOCK';
  const UNMAPPED = 'E2E-CODE-NOBODY-MAPPED-THIS';
  const CONFIDENTIAL = 'CONFIDENTIAL-SCREENING-MARKER: clinician-only text.';

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(PrismaService);

    const organizations = await seededOrganizations(app);
    bloodCenterId = organizations.bloodCenter.id;
    hospitalId = organizations.hospital.id;

    technicianToken = await tokenFor(app, SEEDED.bloodCenterStaff);
    reviewerToken = await tokenFor(app, SEEDED.bloodCenterAdmin);
    hospitalToken = await tokenFor(app, SEEDED.hospitalStaff);
    superAdminToken = await tokenFor(app, SEEDED.superAdmin);

    technicianId = (await db.user.findUniqueOrThrow({ where: { email: SEEDED.bloodCenterStaff } }))
      .id;

    donor = await createTestDonor(app, { label: 'screening', organizationId: bloodCenterId });

    requirementCode = `E2E-REQ-${stamp}`;

    // An organisation-scoped production policy, which wins over the seed's
    // platform-wide development stand-in without touching global state.
    //
    // The disposition rules are this suite's own and exist only for the length
    // of it. NOTHING CLINICAL IS ENCODED: the requirement is named after the
    // test run and the result codes are nonsense strings, because what is being
    // proved is the machinery, not any assay rule.
    const policy = await db.clinicalReleasePolicy.create({
      data: {
        organizationId: bloodCenterId,
        scopeKey: bloodCenterId,
        version: 1,
        status: 'APPROVED',
        kind: 'PRODUCTION',
        title: `E2E screening policy ${stamp}`,
        approvedAt: new Date(),
        requiresResultReview: true,
        requirements: { create: [{ code: requirementCode, description: 'E2E only' }] },
        dispositionRules: {
          create: [
            { requirementCode, resultCode: PASS, disposition: SafetyDisposition.CLEAR },
            { requirementCode, resultCode: BLOCK, disposition: SafetyDisposition.BLOCK },
          ],
        },
      },
    });
    policyId = policy.id;
  });

  afterAll(async () => {
    const donationIds = { in: createdDonationIds };

    await db.hemovigilanceEvent.deleteMany({ where: { bloodUnitId: { in: createdUnitIds } } });
    await db.recallAcknowledgement.deleteMany({
      where: { recallCase: { donationId: donationIds } },
    });
    await db.screeningResultRevision.deleteMany({
      where: { originalResult: { screeningOrder: { donationId: donationIds } } },
    });
    await db.recallAffectedComponent.deleteMany({
      where: { bloodUnitId: { in: createdUnitIds } },
    });
    await db.recallCase.deleteMany({ where: { donationId: donationIds } });
    await db.donorReviewTrigger.deleteMany({ where: { donorId: donor.id } });
    await db.screeningResult.deleteMany({
      where: { screeningOrder: { donationId: donationIds } },
    });
    await db.screeningOrder.deleteMany({ where: { donationId: donationIds } });
    await db.donationSample.deleteMany({ where: { donationId: donationIds } });
    await db.releaseDecision.deleteMany({ where: { bloodUnitId: { in: createdUnitIds } } });
    await db.inventoryMovement.deleteMany({ where: { bloodUnitId: { in: createdUnitIds } } });
    await db.bloodUnitHold.deleteMany({ where: { bloodUnitId: { in: createdUnitIds } } });
    await db.bloodUnitDisposition.deleteMany({ where: { bloodUnitId: { in: createdUnitIds } } });
    await db.bloodUnit.deleteMany({ where: { id: { in: createdUnitIds } } });
    await db.donation.deleteMany({ where: { id: { in: createdDonationIds } } });
    await db.screeningDispositionRule.deleteMany({ where: { policyId } });
    await db.clinicalReleaseRequirement.deleteMany({ where: { policyId } });
    await db.clinicalReleasePolicy.deleteMany({ where: { id: policyId } });
    await db.donorDeferral.deleteMany({ where: { donorId: donor.id } });
    await donor.cleanup();
    await app.close();
  });

  /**
   * A completed donation and one collected component, exactly as
   * `completeDonation` leaves them -- except for the expiry, which is given a
   * recorded provenance so these tests are about screening and not about the
   * shelf-life refusal that Sprint 7 already proves.
   */
  async function collectedComponent() {
    const donation = await db.donation.create({
      data: {
        donationReference: `E2E-SCR-${stamp}-${createdDonationIds.length}`,
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
        unitReference: `E2E-SCR-UNIT-${stamp}-${createdUnitIds.length}`,
        donationId: donation.id,
        organizationId: bloodCenterId,
        componentType: 'RED_CELLS',
        bloodType: 'AB',
        rhFactor: 'NEGATIVE',
        volumeMl: 280,
        status: 'COLLECTED',
        collectedAt: new Date(),
        bloodGroupSource: 'DONOR_PROFILE_COPY',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        expirySource: 'STAFF_RECORDED',
      },
    });
    createdUnitIds.push(unit.id);

    return { donation, unit };
  }

  const post = (path: string, token: string, body: Record<string, unknown> = {}) =>
    request(app.getHttpServer())
      .post(`${API}${path}`)
      .set('Authorization', `Bearer ${token}`)
      .send(body);

  const get = (path: string, token: string) =>
    request(app.getHttpServer()).get(`${API}${path}`).set('Authorization', `Bearer ${token}`);

  const release = (unitId: string, token = technicianToken) =>
    post(`/organizations/${bloodCenterId}/inventory/units/${unitId}/release`, token, {
      reason: 'e2e',
    });

  const raiseOrder = (donationId: string) =>
    post(`/organizations/${bloodCenterId}/screening/donations/${donationId}/orders`, technicianToken);

  const recordResult = (orderId: string, body: Record<string, unknown>) =>
    post(`/organizations/${bloodCenterId}/screening/orders/${orderId}/results`, technicianToken, {
      requirementCode,
      ...body,
    });

  const reviewResult = (resultId: string, token = reviewerToken) =>
    post(`/organizations/${bloodCenterId}/screening/results/${resultId}/review`, token);

  /** Drive one component all the way to "released", and hand back the pieces. */
  async function releasedComponent() {
    const { donation, unit } = await collectedComponent();
    const order = await raiseOrder(donation.id);
    const orderId = order.body.data.id;

    const result = await recordResult(orderId, { resultCode: PASS });
    await reviewResult(result.body.data.id);

    const released = await release(unit.id);
    expect(released.status).toBe(201);

    return { donation, unit, orderId, resultId: result.body.data.id };
  }

  // ===================================================================
  // The chain, one link at a time
  // ===================================================================
  describe('none of these facts implies the next', () => {
    it('a completed donation with no screening order at all is refused release', async () => {
      const { unit } = await collectedComponent();

      const response = await release(unit.id);

      expect(response.status).toBe(409);
      expect(response.body.error?.code ?? response.body.code).toBe(
        'CLINICAL_RELEASE_REQUIREMENTS_NOT_MET',
      );
      const after = await db.bloodUnit.findUniqueOrThrow({ where: { id: unit.id } });
      expect(after.status).toBe('COLLECTED');
      expect(after.clinicalReleasedAt).toBeNull();
    });

    it('raising a screening order does not satisfy anything', async () => {
      const { donation, unit } = await collectedComponent();

      const order = await raiseOrder(donation.id);
      expect(order.status).toBe(201);
      expect(order.body.data.status).toBe(ScreeningOrderStatus.OPEN);
      // The pinned version is a column on the order, not a lookup.
      expect(order.body.data.policyVersion).toBe(1);

      const response = await release(unit.id);
      expect(response.status).toBe(409);
      expect(
        response.body.error?.details?.unmetRequirements ?? response.body.details?.unmetRequirements,
      ).toEqual([requirementCode]);
    });

    it('collecting a sample does not satisfy anything either', async () => {
      const { donation, unit } = await collectedComponent();
      const order = await raiseOrder(donation.id);

      const sample = await post(
        `/organizations/${bloodCenterId}/screening/donations/${donation.id}/samples`,
        technicianToken,
        { sampleType: 'E2E-TUBE', orderId: order.body.data.id },
      );
      expect(sample.status).toBe(201);

      expect((await release(unit.id)).status).toBe(409);
    });

    it('a recorded but unreviewed result does not satisfy a policy that requires review', async () => {
      const { donation, unit } = await collectedComponent();
      const order = await raiseOrder(donation.id);

      const result = await recordResult(order.body.data.id, { resultCode: PASS });
      expect(result.status).toBe(201);
      expect(result.body.data.disposition).toBe(SafetyDisposition.CLEAR);
      expect(result.body.data.satisfiesRequirement).toBe(true);

      // Satisfying the requirement is not the same as being an answer. The
      // order is AWAITING_REVIEW and the component is still refused.
      const after = await db.screeningOrder.findUniqueOrThrow({ where: { id: order.body.data.id } });
      expect(after.status).toBe(ScreeningOrderStatus.AWAITING_REVIEW);
      expect((await release(unit.id)).status).toBe(409);
    });

    it('the person who recorded the result cannot review it', async () => {
      const { donation } = await collectedComponent();
      const order = await raiseOrder(donation.id);
      const result = await recordResult(order.body.data.id, { resultCode: PASS });

      const response = await reviewResult(result.body.data.id, technicianToken);

      expect(response.status).toBe(403);
      expect(response.body.error?.code ?? response.body.code).toBe(
        'SCREENING_REVIEWER_IS_PERFORMER',
      );
    });

    it('a platform administrator is not a clinical reviewer', async () => {
      const { donation } = await collectedComponent();
      const order = await raiseOrder(donation.id);
      const result = await recordResult(order.body.data.id, { resultCode: PASS });

      const response = await reviewResult(result.body.data.id, superAdminToken);

      expect(response.status).toBe(403);
    });

    it('a reviewed CLEAR result is what finally releases the component', async () => {
      const { donation, unit } = await collectedComponent();
      const order = await raiseOrder(donation.id);
      const result = await recordResult(order.body.data.id, { resultCode: PASS });

      const reviewed = await reviewResult(result.body.data.id);
      expect(reviewed.status).toBe(201);

      const response = await release(unit.id);
      expect(response.status).toBe(201);

      const after = await db.bloodUnit.findUniqueOrThrow({ where: { id: unit.id } });
      expect(after.status).toBe('AVAILABLE');
      expect(after.clinicalReleasedAt).not.toBeNull();

      // The order completes because review completed it, not because results
      // arrived.
      const finished = await db.screeningOrder.findUniqueOrThrow({
        where: { id: order.body.data.id },
      });
      expect(finished.status).toBe(ScreeningOrderStatus.COMPLETED);
    });

    it('released is not transfused', async () => {
      const { unit } = await releasedComponent();

      const after = await db.bloodUnit.findUniqueOrThrow({
        where: { id: unit.id },
        include: { disposition: true },
      });
      expect(after.clinicalReleasedAt).not.toBeNull();
      expect(after.disposition).toBeNull();
      expect(after.status).toBe('AVAILABLE');
    });
  });

  // ===================================================================
  // Fail-closed
  // ===================================================================
  describe('absence of an answer is never permission', () => {
    it('never lets a result code no rule describes satisfy a requirement', async () => {
      const { donation, unit } = await collectedComponent();
      const order = await raiseOrder(donation.id);

      const result = await recordResult(order.body.data.id, { resultCode: UNMAPPED });

      expect(result.body.data.disposition).toBe(SafetyDisposition.REVIEW_REQUIRED);
      // Said out loud: the system defaulted, nobody decided.
      expect(result.body.data.dispositionMapped).toBe(false);
      expect(result.body.data.dispositionPolicyVersion).toBeNull();
      expect(result.body.data.satisfiesRequirement).toBe(false);

      // Reviewing it changes nothing: a review confirms a result was seen, not
      // that an uninterpretable code means the blood is safe.
      await reviewResult(result.body.data.id);
      expect((await release(unit.id)).status).toBe(409);
    });

    it('does not put the donor under medical review for a code nobody mapped', async () => {
      const { donation } = await collectedComponent();
      const order = await raiseOrder(donation.id);

      const result = await recordResult(order.body.data.id, { resultCode: UNMAPPED });

      expect(result.body.data.medicalReviewOpened).toBe(false);
      const profile = await db.donorProfile.findUniqueOrThrow({ where: { userId: donor.id } });
      expect(profile.donorStatus).toBe(DonorStatus.ACTIVE);
    });

    it('refuses a result recorded against a requirement the policy does not list', async () => {
      const { donation } = await collectedComponent();
      const order = await raiseOrder(donation.id);

      const response = await post(
        `/organizations/${bloodCenterId}/screening/orders/${order.body.data.id}/results`,
        technicianToken,
        { requirementCode: 'E2E-REQ-INVENTED', resultCode: PASS },
      );

      expect(response.status).toBe(409);
      expect(response.body.error?.code ?? response.body.code).toBe(
        'SCREENING_REQUIREMENT_NOT_IN_POLICY',
      );
    });

    it('refuses a result recorded against a rejected sample', async () => {
      const { donation } = await collectedComponent();
      const order = await raiseOrder(donation.id);
      const sample = await post(
        `/organizations/${bloodCenterId}/screening/donations/${donation.id}/samples`,
        technicianToken,
        { sampleType: 'E2E-TUBE' },
      );

      const rejected = await post(
        `/organizations/${bloodCenterId}/screening/samples/${sample.body.data.id}/reject`,
        technicianToken,
        { rejectionReason: 'E2E-HAEMOLYSED-PLACEHOLDER' },
      );
      expect(rejected.status).toBe(201);

      const response = await recordResult(order.body.data.id, {
        resultCode: PASS,
        sampleId: sample.body.data.id,
      });

      expect(response.status).toBe(409);
      expect(response.body.error?.code ?? response.body.code).toBe('SCREENING_SAMPLE_UNUSABLE');
    });
  });

  // ===================================================================
  // The donor side of a blocking result
  // ===================================================================
  describe('a result about blood is not a diagnosis about a donor', () => {
    let triggerId: string;

    beforeAll(async () => {
      const { donation } = await collectedComponent();
      const order = await raiseOrder(donation.id);
      const result = await recordResult(order.body.data.id, {
        resultCode: BLOCK,
        confidentialComment: CONFIDENTIAL,
      });
      expect(result.body.data.medicalReviewOpened).toBe(true);

      const trigger = await db.donorReviewTrigger.findFirstOrThrow({
        where: { donorId: donor.id, status: 'OPEN' },
      });
      triggerId = trigger.id;
    });

    it('puts the donor under medical review and creates no deferral', async () => {
      const profile = await db.donorProfile.findUniqueOrThrow({ where: { userId: donor.id } });
      expect(profile.donorStatus).toBe(DonorStatus.MEDICAL_REVIEW_REQUIRED);

      // Not a deferral. Not a diagnosis. Nothing was decided about this person.
      expect(await db.donorDeferral.count({ where: { donorId: donor.id } })).toBe(0);
      expect(profile.donorStatus).not.toBe(DonorStatus.DEFERRED);
    });

    it('stops the donor booking their next donation', async () => {
      const slot = await db.appointmentSlot.findFirst({
        where: {
          organizationId: bloodCenterId,
          appointmentType: 'BLOOD_DONATION',
          status: 'AVAILABLE',
          startAt: { gt: new Date(Date.now() + 60 * 60 * 1000) },
        },
        orderBy: { startAt: 'asc' },
      });
      if (!slot) throw new Error('No bookable slot in the seeded database.');

      const response = await request(app.getHttpServer())
        .post(`${API}/appointments`)
        .set('Authorization', `Bearer ${donor.token}`)
        .send({ slotId: slot.id, appointmentType: 'BLOOD_DONATION' });

      expect(response.status).toBe(409);
      expect(response.body.error?.code ?? response.body.code).toBe(
        'DONOR_MEDICAL_REVIEW_REQUIRED',
      );
    });

    it('tells the donor a review is required, with no clinical wording at all', async () => {
      const response = await get('/donors/me/medical-review', donor.token);

      expect(response.status).toBe(200);
      expect(response.body.data.medicalReviewRequired).toBe(true);
      const serialised = JSON.stringify(response.body);
      expect(serialised).not.toContain(CONFIDENTIAL);
      expect(serialised).not.toContain(BLOCK);
      expect(serialised).not.toMatch(/disposition|screening|reactive|positive|infect/i);
    });

    it('refuses to let anyone but an authorized clinician resolve it', async () => {
      const response = await post(
        `/organizations/${bloodCenterId}/donor-reviews/${triggerId}/resolve`,
        superAdminToken,
        { resolution: DonorReviewResolution.RETURNED_TO_ACTIVE },
      );

      expect(response.status).toBe(403);
    });

    it('does not return the donor to ACTIVE while a second review is still open', async () => {
      // The silent failure: nothing errors, a donor simply becomes bookable
      // while a clinician still has an unanswered question about them.
      const second = await db.donorReviewTrigger.create({
        data: {
          donorId: donor.id,
          organizationId: bloodCenterId,
          sourceKind: 'E2E_SECOND_TRIGGER',
          triggerDisposition: SafetyDisposition.REVIEW_REQUIRED,
          systemRaised: false,
        },
      });

      const response = await post(
        `/organizations/${bloodCenterId}/donor-reviews/${triggerId}/resolve`,
        reviewerToken,
        { resolution: DonorReviewResolution.RETURNED_TO_ACTIVE, note: 'E2E' },
      );

      expect(response.status).toBe(201);
      expect(response.body.data.resultingDonorStatus).toBe(DonorStatus.MEDICAL_REVIEW_REQUIRED);

      const profile = await db.donorProfile.findUniqueOrThrow({ where: { userId: donor.id } });
      expect(profile.donorStatus).toBe(DonorStatus.MEDICAL_REVIEW_REQUIRED);

      // And resolving the last one does return them.
      const last = await post(
        `/organizations/${bloodCenterId}/donor-reviews/${second.id}/resolve`,
        reviewerToken,
        { resolution: DonorReviewResolution.RETURNED_TO_ACTIVE, note: 'E2E' },
      );
      expect(last.body.data.resultingDonorStatus).toBe(DonorStatus.ACTIVE);
      expect(
        (await db.donorProfile.findUniqueOrThrow({ where: { userId: donor.id } })).donorStatus,
      ).toBe(DonorStatus.ACTIVE);
      expect(await db.donorDeferral.count({ where: { donorId: donor.id } })).toBe(0);
    });
  });

  // ===================================================================
  // Concurrency
  // ===================================================================
  describe('two hands on the same component', () => {
    it('releases it exactly once, and tells the loser why', async () => {
      const { donation, unit } = await collectedComponent();
      const order = await raiseOrder(donation.id);
      const result = await recordResult(order.body.data.id, { resultCode: PASS });
      await reviewResult(result.body.data.id);

      const [first, second] = await Promise.all([release(unit.id), release(unit.id)]);
      const statuses = [first.status, second.status].sort();

      expect(statuses).toEqual([201, 409]);

      // One release, and the component says so once.
      const decisions = await db.releaseDecision.findMany({
        where: { bloodUnitId: unit.id, outcome: 'RELEASED' },
      });
      expect(decisions).toHaveLength(1);

      const movements = await db.inventoryMovement.findMany({
        where: { bloodUnitId: unit.id, type: 'RELEASED' },
      });
      expect(movements).toHaveLength(1);
    });

    it('records only one result as live when the same correction is attempted twice', async () => {
      const { donation } = await collectedComponent();
      const order = await raiseOrder(donation.id);
      const result = await recordResult(order.body.data.id, { resultCode: PASS });
      await reviewResult(result.body.data.id);

      const correct = () =>
        post(
          `/organizations/${bloodCenterId}/screening/results/${result.body.data.id}/correct`,
          reviewerToken,
          { resultCode: BLOCK, reason: 'E2E concurrent correction' },
        );

      const responses = await Promise.all([correct(), correct()]);
      expect(responses.filter((response) => response.status === 201)).toHaveLength(1);

      const live = await db.screeningResult.findMany({
        where: { screeningOrderId: order.body.data.id, superseded: false },
      });
      expect(live).toHaveLength(1);
      expect(live[0]!.resultCode).toBe(BLOCK);
    });
  });

  // ===================================================================
  // Correction after release
  // ===================================================================
  describe('a correction that arrives too late', () => {
    /** The component the recall below quarantines. Used by the two tests after it. */
    let recalledUnitId: string;

    it('opens a recall, quarantines the component, and does not rewrite its status', async () => {
      const { donation, unit, resultId } = await releasedComponent();
      recalledUnitId = unit.id;

      const response = await post(
        `/organizations/${bloodCenterId}/screening/results/${resultId}/correct`,
        reviewerToken,
        {
          resultCode: BLOCK,
          reason: 'E2E: transcription error found on review.',
          confidentialComment: CONFIDENTIAL,
        },
      );

      expect(response.status).toBe(201);
      expect(response.body.data.recallOpened).toBe(true);
      expect(response.body.data.releasedComponentsAtCorrection).toBeGreaterThan(0);

      // The original result is still exactly what it was, marked superseded.
      const original = await db.screeningResult.findUniqueOrThrow({ where: { id: resultId } });
      expect(original.resultCode).toBe(PASS);
      expect(original.superseded).toBe(true);

      const revision = await db.screeningResultRevision.findFirstOrThrow({
        where: { originalResultId: resultId },
      });
      expect(revision.originalResultCode).toBe(PASS);
      expect(revision.correctedResultCode).toBe(BLOCK);
      expect(revision.recallCaseId).toBe(response.body.data.recallCaseId);

      // The component's own status is untouched. A hold is what stops it.
      const after = await db.bloodUnit.findUniqueOrThrow({
        where: { id: unit.id },
        include: { holds: true },
      });
      expect(after.status).toBe('AVAILABLE');
      expect(after.clinicalReleasedAt).not.toBeNull();
      expect(after.holds.filter((hold) => hold.status === 'ACTIVE')).toHaveLength(1);
      expect(after.holds[0]!.kind).toBe('QUALITY_HOLD');

      const affected = await db.recallAffectedComponent.findFirstOrThrow({
        where: { bloodUnitId: unit.id },
      });
      expect(affected.state).toBe('QUARANTINED');
      // The snapshot, beside the live status, never instead of it.
      expect(affected.statusAtRecall).toBe('AVAILABLE');

      void donation;
    });

    it('stops the quarantined component being reserved for a patient', async () => {
      // The seventh hold bypass, and this test is what found it. Sprint 9
      // closed every path that put a held unit back INTO stock; reserving takes
      // one the other way, out of stock and committed to a named patient, so it
      // read as the safe direction and was left unguarded. A recall raises a
      // hold and changes nothing else about the unit, so a recalled component
      // could still be reserved for somebody.
      const response = await post(
        `/organizations/${bloodCenterId}/inventory/units/${recalledUnitId}/reserve`,
        technicianToken,
        { reason: 'e2e' },
      );

      expect(response.status).toBe(409);
      expect(response.body.error?.code ?? response.body.code).toBe('BLOOD_UNIT_ON_HOLD');

      const after = await db.bloodUnit.findUniqueOrThrow({ where: { id: recalledUnitId } });
      expect(after.status).toBe('AVAILABLE');
    });

    it('stops the quarantined component being issued', async () => {
      // The eighth, and the worse of the two: issuing is the last point at
      // which software can refuse, and until now the only thing it refused on
      // was the release decision -- which a hold deliberately does not touch.
      // A component under an open recall left the building.
      const response = await post(
        `/organizations/${bloodCenterId}/inventory/units/${recalledUnitId}/issue`,
        technicianToken,
        { reason: 'e2e' },
      );

      expect(response.status).toBe(409);
      expect(response.body.error?.code ?? response.body.code).toBe('BLOOD_UNIT_ON_HOLD');

      const after = await db.bloodUnit.findUniqueOrThrow({
        where: { id: recalledUnitId },
        include: { disposition: true },
      });
      expect(after.status).toBe('AVAILABLE');
      expect(after.disposition).toBeNull();
    });

    it('opens no recall when the correction lands before anything was released', async () => {
      const { donation } = await collectedComponent();
      const order = await raiseOrder(donation.id);
      const result = await recordResult(order.body.data.id, { resultCode: PASS });

      const response = await post(
        `/organizations/${bloodCenterId}/screening/results/${result.body.data.id}/correct`,
        reviewerToken,
        { resultCode: BLOCK, reason: 'E2E: caught in time.' },
      );

      expect(response.status).toBe(201);
      // Reported rather than left to be inferred.
      expect(response.body.data.recallOpened).toBe(false);
      expect(response.body.data.releasedComponentsAtCorrection).toBe(0);
      expect(await db.recallCase.count({ where: { donationId: donation.id } })).toBe(0);
    });
  });

  // ===================================================================
  // Organization isolation
  // ===================================================================
  describe('what another organization may see', () => {
    it('does not let a hospital read the blood centre\'s screening worklist', async () => {
      const response = await get(`/organizations/${bloodCenterId}/screening/orders`, hospitalToken);

      expect(response.status).toBe(403);
    });

    it('does not let a hospital resolve the blood centre\'s medical reviews', async () => {
      const response = await get(`/organizations/${bloodCenterId}/donor-reviews`, hospitalToken);

      expect(response.status).toBe(403);
    });

    it('keeps the screening confidential comment out of every audit entry', async () => {
      const entries = await db.auditLog.findMany({
        where: {
          entityType: { in: ['ScreeningResult', 'ScreeningOrder', 'RecallCase', 'DonorReviewTrigger'] },
        },
        orderBy: { createdAt: 'desc' },
        take: 200,
      });

      expect(entries.length).toBeGreaterThan(0);
      for (const entry of entries) {
        expect(JSON.stringify(entry.metadata ?? {})).not.toContain(CONFIDENTIAL);
      }
    });

    it('records the acts that matter, as their own audit entries', async () => {
      const actions = (
        await db.auditLog.findMany({
          where: {
            action: {
              in: [
                'SCREENING_ORDER_RAISED',
                'SCREENING_RESULT_RECORDED',
                'SCREENING_RESULT_REVIEWED',
                'SCREENING_RESULT_CORRECTED',
                'RECALL_CASE_OPENED',
              ],
            },
          },
          select: { action: true },
          take: 500,
        })
      ).map((entry) => entry.action);

      for (const action of [
        'SCREENING_ORDER_RAISED',
        'SCREENING_RESULT_RECORDED',
        'SCREENING_RESULT_REVIEWED',
        'SCREENING_RESULT_CORRECTED',
        'RECALL_CASE_OPENED',
      ]) {
        expect(actions).toContain(action);
      }
    });
  });

  // ===================================================================
  // Traceability
  // ===================================================================
  describe('look-back and traceback', () => {
    it('shows the collecting organization everything the donation produced', async () => {
      const donationId = createdDonationIds[0]!;

      const response = await get(
        `/organizations/${bloodCenterId}/traceability/donations/${donationId}/forward`,
        technicianToken,
      );

      expect(response.status).toBe(200);
      expect(response.body.data.donation.isCollectingOrganization).toBe(true);
      expect(Array.isArray(response.body.data.components)).toBe(true);
      // Released and transfused are reported separately, with no inference in
      // either direction.
      for (const component of response.body.data.components) {
        expect(component).toHaveProperty('clinicallyReleased');
        expect(component).toHaveProperty('transfused');
      }
    });

    it('refuses a look-back to an organization that holds nothing from the donation', async () => {
      const donationId = createdDonationIds[0]!;

      const response = await get(
        `/organizations/${hospitalId}/traceability/donations/${donationId}/forward`,
        hospitalToken,
      );

      expect(response.status).toBe(403);
    });

    it('names the donation on a traceback, and never the donor', async () => {
      const unitId = createdUnitIds[0]!;

      const response = await get(
        `/organizations/${bloodCenterId}/traceability/units/${unitId}/back`,
        technicianToken,
      );

      expect(response.status).toBe(200);
      expect(response.body.data.donation.donationReference).toContain('E2E-SCR-');
      const serialised = JSON.stringify(response.body);
      expect(serialised).not.toContain(donor.id);
      expect(serialised).not.toContain(donor.email);
      expect(response.body.data.donation).not.toHaveProperty('donorId');
    });
  });
});
