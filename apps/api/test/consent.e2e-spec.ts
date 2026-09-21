import { INestApplication } from '@nestjs/common';
import { ConsentDocumentStatus, ConsentPurpose, ConsentRequirementMode } from '@prisma/client';

import { PrismaService } from '../src/database/prisma.service';
import { ConsentReason } from '../src/modules/consent/consent.decision';
import { ConsentService } from '../src/modules/consent/consent.service';
import {
  SEEDED,
  TestDonor,
  createTestApp,
  createTestDonor,
  seededOrganizations,
} from './utils/e2e';

/**
 * The consent architecture, against the real database.
 *
 * No legal wording is authored here or anywhere in the module, and none ships.
 * What is asserted is the machinery around it: that a version cannot be
 * approved by accident, that an acceptance binds to exact wording, that
 * withdrawal is recorded rather than erased, and above all that a purpose with
 * no approved document fails closed instead of being offered on the strength of
 * text nobody wrote.
 */
describe('Consent documents, acceptances and the gate', () => {
  let app: INestApplication;
  let db: PrismaService;
  let consent: ConsentService;
  let donor: TestDonor;
  let organizationId: string;
  /** A real user id: AuditLog.actorId is a foreign key. */
  let actorId: string;

  /** A purpose this suite owns outright, so it cannot collide with the seeded posture. */
  const PURPOSE = ConsentPurpose.HEALTHCARE_SHARING;
  const LOCALE = 'en-TEST';

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(PrismaService);
    consent = app.get(ConsentService);

    const organizations = await seededOrganizations(app);
    organizationId = organizations.bloodCenter.id;
    donor = await createTestDonor(app, { label: 'consent', organizationId });

    const admin = await db.user.findUniqueOrThrow({ where: { email: SEEDED.superAdmin } });
    actorId = admin.id;
  });

  afterAll(async () => {
    await db.consentAcceptance.deleteMany({ where: { userId: donor.id } });
    await db.consentDocument.deleteMany({ where: { locale: LOCALE } });
    await db.consentRequirement.deleteMany({ where: { featureKey: 'consent-e2e' } });
    await donor.cleanup();
    await app.close();
  });

  const requirement = async (mode: ConsentRequirementMode) => {
    await db.consentRequirement.deleteMany({ where: { featureKey: 'consent-e2e' } });
    await db.consentRequirement.create({
      data: { purpose: PURPOSE, scopeKey: organizationId, featureKey: 'consent-e2e', mode },
    });
  };

  it('creates every document as DRAFT, whatever the caller asks for', async () => {
    const created = await consent.createDocument(actorId, {
      purpose: PURPOSE,
      locale: LOCALE,
      content: 'PLACEHOLDER WORDING. Not legal text. Supplied by counsel before any pilot.',
    });

    expect(created.data.status).toBe(ConsentDocumentStatus.DRAFT);
    expect(created.data.version).toBe(1);
    // The hash is what an acceptance binds to, so it must exist from creation.
    expect(created.data.contentHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('refuses to record an acceptance while only a draft exists', async () => {
    // Fail closed. This is the production rule, and it holds here too: a test
    // fixture must never be able to masquerade as legal approval.
    await expect(
      consent.accept(donor.id, { purpose: PURPOSE, locale: LOCALE, organizationId }),
    ).rejects.toMatchObject({
      response: { code: ConsentReason.NO_APPROVED_DOCUMENT },
    });

    expect(await db.consentAcceptance.count({ where: { userId: donor.id } })).toBe(0);
  });

  it('refuses the feature entirely when it is required and nothing is approved', async () => {
    await requirement(ConsentRequirementMode.REQUIRED_FOR_FEATURE);

    const decision = await consent.check(donor.id, PURPOSE, organizationId);
    expect(decision).toEqual({ allowed: false, reason: ConsentReason.NO_APPROVED_DOCUMENT });

    await expect(consent.assertAllowed(donor.id, PURPOSE, organizationId)).rejects.toThrow();
  });

  it('records an acceptance once a version is deliberately approved', async () => {
    const draft = await db.consentDocument.findFirstOrThrow({
      where: { purpose: PURPOSE, locale: LOCALE, version: 1 },
    });

    const approved = await consent.approveDocument(actorId, draft.id);
    expect(approved.data.status).toBe(ConsentDocumentStatus.APPROVED);
    expect(approved.data.approvedAt).not.toBeNull();

    const acceptance = await consent.accept(donor.id, {
      purpose: PURPOSE,
      locale: LOCALE,
      organizationId,
    });
    expect(acceptance.data.purpose).toBe(PURPOSE);

    const row = await db.consentAcceptance.findFirstOrThrow({ where: { userId: donor.id } });
    // Bound to the exact wording, not merely to the document row.
    expect(row.contentHash).toBe(draft.contentHash);
    expect(row.documentVersion).toBe(1);
    expect(row.locale).toBe(LOCALE);

    expect(await consent.check(donor.id, PURPOSE, organizationId)).toEqual({
      allowed: true,
      reason: null,
    });
  });

  it('retires the previous version when a new one is approved, so what is in force is never ambiguous', async () => {
    const second = await consent.createDocument(actorId, {
      purpose: PURPOSE,
      locale: LOCALE,
      content: 'PLACEHOLDER WORDING, revised. Still not legal text.',
    });
    expect(second.data.version).toBe(2);

    await consent.approveDocument(actorId, second.data.id);

    const versions = await db.consentDocument.findMany({
      where: { purpose: PURPOSE, locale: LOCALE },
      orderBy: { version: 'asc' },
    });
    expect(versions.map((v) => v.status)).toEqual([
      ConsentDocumentStatus.RETIRED,
      ConsentDocumentStatus.APPROVED,
    ]);

    // The earlier acceptance still says what it said: version 1, and the hash
    // of the wording that was actually shown.
    const row = await db.consentAcceptance.findFirstOrThrow({ where: { userId: donor.id } });
    expect(row.documentVersion).toBe(1);
    expect(row.contentHash).toBe(versions[0].contentHash);
  });

  it('refuses to approve a document twice', async () => {
    const approved = await db.consentDocument.findFirstOrThrow({
      where: { purpose: PURPOSE, locale: LOCALE, status: ConsentDocumentStatus.APPROVED },
    });

    await expect(consent.approveDocument(actorId, approved.id)).rejects.toThrow();
  });

  it('records a withdrawal without erasing the evidence of the acceptance', async () => {
    await consent.withdraw(donor.id, PURPOSE);

    const row = await db.consentAcceptance.findFirstOrThrow({ where: { userId: donor.id } });
    expect(row.withdrawnAt).not.toBeNull();
    // Still there. "Did this person ever consent, and when did they change
    // their mind" has to stay answerable.
    expect(row.acceptedAt).not.toBeNull();

    expect(await consent.check(donor.id, PURPOSE, organizationId)).toEqual({
      allowed: false,
      reason: ConsentReason.WITHDRAWN,
    });
  });

  it('refuses a DISABLED purpose even for someone who accepted it', async () => {
    await requirement(ConsentRequirementMode.DISABLED);

    const decision = await consent.check(donor.id, PURPOSE, organizationId);
    expect(decision.reason).toBe(ConsentReason.DISABLED);
  });

  it('refuses a purpose this deployment has not configured at all', async () => {
    await db.consentRequirement.deleteMany({ where: { featureKey: 'consent-e2e' } });

    // EMERGENCY_MATCHING is seeded at PLATFORM scope by the reference seed, so
    // this uses a purpose the seed leaves alone to prove the unconfigured case.
    const decision = await consent.check(donor.id, ConsentPurpose.CROSS_BORDER_PROCESSING, organizationId);
    expect([ConsentReason.NOT_CONFIGURED, ConsentReason.DISABLED]).toContain(decision.reason);
    expect(decision.allowed).toBe(false);
  });

  it('keeps the wording itself out of the audit log', async () => {
    const entries = await db.auditLog.findMany({
      where: { entityType: { in: ['ConsentDocument', 'ConsentAcceptance'] } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      const metadata = JSON.stringify(entry.metadata ?? {});
      expect(metadata).not.toContain('PLACEHOLDER WORDING');
      // The hash is recorded instead: it identifies the wording without
      // reproducing it.
      expect(metadata).toMatch(/contentHash|purpose/);
    }
  });
});
