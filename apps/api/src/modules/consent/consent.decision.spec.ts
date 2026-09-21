import { ConsentDocumentStatus, ConsentRequirementMode } from '@prisma/client';

import { ConsentReason, ConsentState, canAccept, decideConsent } from './consent.decision';

/**
 * The consent gate, exhaustively.
 *
 * Every branch here is a refusal somebody will one day want to argue with, and
 * the point of the decision being a pure function over a small record is that
 * the whole table can be asserted without booting anything or holding a
 * database in a particular state.
 */
describe('decideConsent', () => {
  const state = (overrides: Partial<ConsentState> = {}): ConsentState => ({
    mode: ConsentRequirementMode.REQUIRED_FOR_FEATURE,
    hasApprovedDocument: true,
    accepted: true,
    withdrawn: false,
    ...overrides,
  });

  it('refuses a purpose nobody has configured', () => {
    // Absence of a rule is not permission. The same reading the clinical
    // release gate gives an empty requirement set.
    expect(decideConsent(state({ mode: null }))).toEqual({
      allowed: false,
      reason: ConsentReason.NOT_CONFIGURED,
    });
  });

  it('refuses a disabled purpose even when the person accepted it', () => {
    // A deployment that has switched cross-border processing off does not start
    // doing it because a donor once tapped yes.
    expect(
      decideConsent(state({ mode: ConsentRequirementMode.DISABLED, accepted: true })),
    ).toEqual({ allowed: false, reason: ConsentReason.DISABLED });
  });

  it('refuses a disabled purpose even with an approved document', () => {
    expect(
      decideConsent(
        state({ mode: ConsentRequirementMode.DISABLED, hasApprovedDocument: true, accepted: true }),
      ).allowed,
    ).toBe(false);
  });

  it('allows an optional purpose that was never accepted', () => {
    // OPTIONAL is a preference the feature reads for itself, not a condition of
    // being served at all.
    expect(
      decideConsent(
        state({ mode: ConsentRequirementMode.OPTIONAL, accepted: false, hasApprovedDocument: false }),
      ),
    ).toEqual({ allowed: true, reason: null });
  });

  it('allows a notice-only purpose', () => {
    expect(
      decideConsent(
        state({
          mode: ConsentRequirementMode.NOTICE_ONLY,
          accepted: false,
          hasApprovedDocument: false,
        }),
      ).allowed,
    ).toBe(true);
  });

  it('refuses a required purpose when no approved document exists', () => {
    // The production fail-closed case. Nobody can agree to wording that has not
    // been approved, so the feature cannot be offered on the strength of it.
    expect(decideConsent(state({ hasApprovedDocument: false }))).toEqual({
      allowed: false,
      reason: ConsentReason.NO_APPROVED_DOCUMENT,
    });
  });

  it('refuses a required purpose the person has not accepted', () => {
    expect(decideConsent(state({ accepted: false }))).toEqual({
      allowed: false,
      reason: ConsentReason.NOT_ACCEPTED,
    });
  });

  it('refuses a required purpose after withdrawal', () => {
    expect(decideConsent(state({ accepted: false, withdrawn: true }))).toEqual({
      allowed: false,
      reason: ConsentReason.WITHDRAWN,
    });
  });

  it('allows a required purpose with an approved document and a live acceptance', () => {
    expect(decideConsent(state())).toEqual({ allowed: true, reason: null });
  });

  it('reports the missing document before the missing acceptance', () => {
    // Order matters for the operator: "nobody has approved the wording" is a
    // problem the deployment fixes, and "this donor has not agreed" is not.
    expect(
      decideConsent(state({ hasApprovedDocument: false, accepted: false })).reason,
    ).toBe(ConsentReason.NO_APPROVED_DOCUMENT);
  });
});

describe('canAccept', () => {
  it('accepts only an approved document', () => {
    expect(canAccept(ConsentDocumentStatus.APPROVED)).toEqual({ allowed: true, reason: null });
  });

  it('refuses a draft, which is what keeps a test fixture from counting as legal approval', () => {
    expect(canAccept(ConsentDocumentStatus.DRAFT)).toEqual({
      allowed: false,
      reason: ConsentReason.DOCUMENT_NOT_APPROVED,
    });
  });

  it('refuses a retired document', () => {
    expect(canAccept(ConsentDocumentStatus.RETIRED).allowed).toBe(false);
  });

  it('holds in every environment, not only production', () => {
    // Deliberately uniform. A development/production divergence in a consent
    // gate is exactly the kind of difference that is discovered by a regulator
    // rather than by a test.
    const original = process.env.NODE_ENV;
    try {
      for (const environment of ['development', 'test', 'production']) {
        process.env.NODE_ENV = environment;
        expect(canAccept(ConsentDocumentStatus.DRAFT).allowed).toBe(false);
      }
    } finally {
      process.env.NODE_ENV = original;
    }
  });
});
