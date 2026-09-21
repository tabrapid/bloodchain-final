import { INestApplication } from '@nestjs/common';
import { DeferralKind, DeferralSource } from '@prisma/client';
import request from 'supertest';

import { PrismaService } from '../src/database/prisma.service';
import {
  API,
  SEEDED,
  TestDonor,
  createTestApp,
  createTestDonor,
  seededOrganizations,
  tokenFor,
} from './utils/e2e';

/**
 * A deferral note is a clinician's verbatim account of why they turned a donor
 * away, and it belongs to the organisation whose clinician wrote it.
 *
 * Before Sprint 9 it did not behave that way. `DonorDeferral.reasonText` was
 * filled from the assessing staff member's free-text notes, the staff-facing
 * history query filtered on the donor and not on the organisation, and the
 * serialiser returned the column to whoever asked. Any staff member of any
 * organisation could read any donor's clinical notes, and a second defect found
 * while fixing it let them lift another organisation's deferral as well.
 *
 * What must still cross the boundary is the fact of the deferral. A donor
 * deferred at one centre must not be able to donate at the next one down the
 * road, so kind, structured reason code and dates stay visible everywhere.
 * These tests hold both halves of that line.
 */
describe('Deferral confidentiality across organizations', () => {
  let app: INestApplication;
  let db: PrismaService;
  let donor: TestDonor;
  let bloodCenterId: string;
  let hospitalId: string;
  let deferralId: string;

  /** What must never appear outside the organisation that recorded it. */
  const CONFIDENTIAL_NOTE =
    'CONFIDENTIAL-ANAMNESIS-MARKER: verbatim clinician note recorded at the chair.';

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(PrismaService);

    const organizations = await seededOrganizations(app);
    bloodCenterId = organizations.bloodCenter.id;
    hospitalId = organizations.hospital.id;

    donor = await createTestDonor(app, {
      label: 'deferral-confidentiality',
      organizationId: bloodCenterId,
    });

    const deferral = await db.donorDeferral.create({
      data: {
        donorId: donor.id,
        organizationId: bloodCenterId,
        kind: DeferralKind.TEMPORARY,
        reasonCode: 'TEST_ONLY_STRUCTURED_CODE',
        confidentialNote: CONFIDENTIAL_NOTE,
        startsAt: new Date(Date.now() - 60_000),
        endsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        source: DeferralSource.STAFF_DECISION,
      },
    });
    deferralId = deferral.id;
  });

  afterAll(async () => {
    await db.donorDeferral.deleteMany({ where: { donorId: donor.id } });
    await donor.cleanup();
    await app.close();
  });

  const historyFor = async (organizationId: string, email: string) => {
    const token = await tokenFor(app, email);
    return request(app.getHttpServer())
      .get(`${API}/organizations/${organizationId}/donors/${donor.id}/deferrals`)
      .set('Authorization', `Bearer ${token}`);
  };

  it('lets the organization that raised it read its own clinical note', async () => {
    const response = await historyFor(bloodCenterId, SEEDED.bloodCenterStaff);

    expect(response.status).toBe(200);
    const raised = response.body.data.history.find((row: any) => row.id === deferralId);
    expect(raised).toBeDefined();
    expect(raised.confidentialNote).toBe(CONFIDENTIAL_NOTE);
  });

  it('does not give an unrelated organization the clinical note', async () => {
    const response = await historyFor(hospitalId, SEEDED.hospitalStaff);

    expect(response.status).toBe(200);
    const raised = response.body.data.history.find((row: any) => row.id === deferralId);
    expect(raised).toBeDefined();
    expect(raised.confidentialNote).toBeUndefined();

    // Nowhere else in the payload either -- not in a nested object, not in a
    // field somebody added later. The whole response is searched as text,
    // because that is the only assertion that survives a future projection
    // change.
    expect(JSON.stringify(response.body)).not.toContain(CONFIDENTIAL_NOTE);
  });

  it('still tells an unrelated organization the donor is deferred, and why in structured terms', async () => {
    // The safety half of the line. Withholding this would be its own defect:
    // it is what stops a donor deferred at one centre donating at the next.
    const response = await historyFor(hospitalId, SEEDED.hospitalStaff);

    const raised = response.body.data.history.find((row: any) => row.id === deferralId);
    expect(raised.kind).toBe(DeferralKind.TEMPORARY);
    expect(raised.reasonCode).toBe('TEST_ONLY_STRUCTURED_CODE');
    expect(raised.startsAt).toBeDefined();
    expect(raised.active).toBe(true);

    expect(response.body.data.active).not.toBeNull();
  });

  it('does not treat a platform administrator as a clinical reader', async () => {
    // A SUPER_ADMIN may reach these routes -- they administer the platform --
    // but administering a platform is not assessing a donor. Acting for the
    // hospital, they see what the hospital sees.
    const response = await historyFor(hospitalId, SEEDED.superAdmin);

    expect(response.status).toBe(200);
    expect(JSON.stringify(response.body)).not.toContain(CONFIDENTIAL_NOTE);
  });

  it('refuses to let another organization lift the deferral', async () => {
    const token = await tokenFor(app, SEEDED.hospitalStaff);

    const response = await request(app.getHttpServer())
      .post(`${API}/organizations/${hospitalId}/donors/${donor.id}/deferrals/${deferralId}/lift`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Attempting to lift another organization\'s clinical decision.' });

    expect(response.status).toBe(403);

    // And it really did not happen.
    const after = await db.donorDeferral.findUniqueOrThrow({ where: { id: deferralId } });
    expect(after.liftedAt).toBeNull();
  });

  it('does not leak the note to the donor themselves', async () => {
    const response = await request(app.getHttpServer())
      .get(`${API}/donors/me/deferral`)
      .set('Authorization', `Bearer ${donor.token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.deferred).toBe(true);
    expect(JSON.stringify(response.body)).not.toContain(CONFIDENTIAL_NOTE);
    expect(response.body.data.canLift).toBe(false);
  });

  it('does not leak the note through the booking refusal a donor sees', async () => {
    // The refusal a deferred donor's own client receives. It carries the code
    // and the dates so the app can explain the situation, and no clinical
    // reason at all: "why" is a conversation with staff.
    const slot = await db.appointmentSlot.findFirst({
      where: {
        organizationId: bloodCenterId,
        appointmentType: 'BLOOD_DONATION',
        status: 'AVAILABLE',
        // Future only: a slot whose time has passed is refused for being in the
        // past, which would mask the refusal this test is about.
        startAt: { gt: new Date(Date.now() + 60 * 60 * 1000) },
      },
      orderBy: { startAt: 'asc' },
    });

    if (!slot) {
      throw new Error('No bookable slot in the seeded database.');
    }

    const response = await request(app.getHttpServer())
      .post(`${API}/appointments`)
      .set('Authorization', `Bearer ${donor.token}`)
      .send({ slotId: slot.id, appointmentType: 'BLOOD_DONATION' });

    expect(response.status).toBe(409);
    expect(response.body.code ?? response.body.error?.code).toBe('DONOR_DEFERRED');
    expect(JSON.stringify(response.body)).not.toContain(CONFIDENTIAL_NOTE);
    expect(JSON.stringify(response.body)).not.toContain('TEST_ONLY_STRUCTURED_CODE');
  });

  it('keeps the note out of the audit log', async () => {
    // §11: audit logs must never carry confidential questionnaire text. The
    // deferral services record the kind and the structured code and stop there.
    const entries = await db.auditLog.findMany({
      where: { entityType: 'DonorDeferral' },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    for (const entry of entries) {
      expect(JSON.stringify(entry.metadata ?? {})).not.toContain(CONFIDENTIAL_NOTE);
    }
  });
});
