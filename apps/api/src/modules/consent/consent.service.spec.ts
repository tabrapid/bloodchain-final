import { ConsentDocumentStatus, ConsentPurpose, ConsentRequirementMode } from '@prisma/client';
import { ConsentReason } from './consent.decision';
import { ConsentService } from './consent.service';

describe('ConsentService document and scope binding', () => {
  const purpose = ConsentPurpose.HEALTHCARE_SHARING;
  const document = {
    id: 'document-v2', version: 2, contentHash: 'current-hash', locale: 'ru',
    status: ConsentDocumentStatus.APPROVED,
  };
  const accepted = {
    id: 'acceptance', documentId: document.id, documentVersion: document.version,
    contentHash: document.contentHash, locale: document.locale, withdrawnAt: null,
  };
  let db: any;
  let service: ConsentService;

  beforeEach(() => {
    db = {
      consentRequirement: { findFirst: jest.fn().mockResolvedValue({ mode: ConsentRequirementMode.REQUIRED_FOR_FEATURE }) },
      consentAcceptance: { findFirst: jest.fn().mockResolvedValue(accepted) },
      consentDocument: {
        findFirst: jest.fn().mockResolvedValue(document),
        create: jest.fn(async ({ data }) => ({ id: 'new-document', ...data })),
      },
    };
    service = new ConsentService(db, { log: jest.fn() } as any);
  });

  it('accepts only the current document in the accepted language and exact organization scope', async () => {
    expect(await service.check('donor', purpose, 'org-a')).toEqual({ allowed: true, reason: null });
    expect(db.consentAcceptance.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'donor', purpose, organizationId: 'org-a' },
    }));
    expect(db.consentDocument.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ scopeKey: 'org-a', locale: 'ru' }),
    }));
  });

  it.each([
    { documentId: 'retired-document' },
    { documentVersion: 1 },
    { contentHash: 'tampered-hash' },
    { locale: 'en' },
  ])('refuses a mismatched acceptance: %j', async (change) => {
    db.consentAcceptance.findFirst.mockResolvedValue({ ...accepted, ...change });
    expect(await service.check('donor', purpose, 'org-a')).toEqual({
      allowed: false, reason: ConsentReason.NOT_ACCEPTED,
    });
  });

  it('does not reuse platform or another organization acceptance for the requested organization', async () => {
    db.consentAcceptance.findFirst.mockResolvedValue(null);
    expect(await service.check('donor', purpose, 'org-b')).toEqual({ allowed: false, reason: ConsentReason.NOT_ACCEPTED });
    expect(db.consentAcceptance.findFirst.mock.calls[0][0].where.organizationId).toBe('org-b');
  });

  it('limits platform acceptance queries to platform scope', async () => {
    await service.check('donor', purpose);
    expect(db.consentAcceptance.findFirst.mock.calls[0][0].where.organizationId).toBeNull();
  });

  it('honors withdrawal even when the old document has been superseded', async () => {
    db.consentAcceptance.findFirst.mockResolvedValue({ ...accepted, documentVersion: 1, withdrawnAt: new Date() });
    expect(await service.check('donor', purpose, 'org-a')).toEqual({ allowed: false, reason: ConsentReason.WITHDRAWN });
  });

  it('checks effective dates and organization precedence when no acceptance exists', async () => {
    db.consentAcceptance.findFirst.mockResolvedValue(null);
    db.consentDocument.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(document);
    await service.check('donor', purpose, 'org-a');
    const queries = db.consentDocument.findFirst.mock.calls.map(([q]: any[]) => q.where);
    expect(queries.map((q: any) => q.scopeKey)).toEqual(['org-a', 'PLATFORM']);
    for (const query of queries) {
      expect(query.OR).toEqual([{ effectiveAt: null }, { effectiveAt: { lte: expect.any(Date) } }]);
    }
  });

  it('refuses an external document with no content digest', async () => {
    await expect(service.createDocument('reviewer', {
      purpose, locale: 'uz', contentReference: 'https://example.invalid/consent-v1',
    })).rejects.toThrow('SHA-256');
    expect(db.consentDocument.create).not.toHaveBeenCalled();
  });

  it('stores the external wording digest rather than hashing its URL', async () => {
    const hash = 'a'.repeat(64);
    await service.createDocument('reviewer', {
      purpose, locale: 'uz', contentReference: 'https://example.invalid/consent-v1', contentHash: hash,
    });
    expect(db.consentDocument.create.mock.calls[0][0].data.contentHash).toBe(hash);
    expect(db.consentDocument.create.mock.calls[0][0].data.status).toBe(ConsentDocumentStatus.DRAFT);
  });

  it('rejects ambiguous inline and external wording', async () => {
    await expect(service.createDocument('reviewer', {
      purpose, locale: 'uz', content: 'synthetic test wording', contentReference: 'https://example.invalid/consent-v1',
    })).rejects.toThrow('exactly one');
  });
});
