import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ConflictException } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';
import { ClinicalReleaseService } from './clinical-release.service';
import { ClinicalReleaseReason } from './clinical-release.reasons';

/**
 * The fail-closed properties of the release gate.
 *
 * Each of these is a way the gate could quietly permit something, and every one
 * of them has a plausible-looking implementation that gets it wrong: an empty
 * requirement list read as "nothing required", a development policy honoured
 * because it is the only one configured, a missing expiry defaulted to some
 * sensible-looking number. The point of the suite is that none of those
 * mistakes can be made without a test going red.
 */

function makeUnit(overrides: Record<string, unknown> = {}) {
  return {
    id: 'unit-1',
    unitReference: 'BU-2026-000001',
    organizationId: 'org-1',
    // Sprint 10: the gate reads screening against the parent donation, so the
    // fixture has to name one. A unit with no donation is not a thing that
    // exists.
    donationId: 'donation-1',
    componentType: 'WHOLE_BLOOD' as const,
    collectedAt: new Date('2026-09-01T00:00:00.000Z'),
    expiresAt: null,
    expirySource: 'UNKNOWN' as const,
    clinicalReleasedAt: null,
    ...overrides,
  };
}

function makePolicy(overrides: Record<string, unknown> = {}) {
  return {
    id: 'policy-1',
    organizationId: null,
    scopeKey: 'PLATFORM',
    version: 3,
    status: 'APPROVED',
    kind: 'PRODUCTION',
    title: 'Policy',
    sourceReference: null,
    approvedBy: 'clinician-1',
    approvedAt: new Date('2026-01-01T00:00:00.000Z'),
    effectiveFrom: null,
    effectiveUntil: null,
    developmentShelfLifeDays: null,
    createdBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    requiresResultReview: true,
    sopReference: null,
    requirements: [],
    // Sprint 10. Ships empty, exactly as the repository does: with no rule,
    // no raw result code means CLEAR, so no requirement can be satisfied.
    dispositionRules: [],
    ...overrides,
  };
}

describe('ClinicalReleaseService', () => {
  let service: ClinicalReleaseService;
  let prisma: any;
  let nodeEnv: string;

  async function build() {
    prisma = {
      clinicalReleasePolicy: { findFirst: jest.fn().mockResolvedValue(null) },
      releaseDecision: { findMany: jest.fn().mockResolvedValue([]) },
      // Sprint 10. The default is "nothing recorded", which is the state a
      // freshly collected unit is actually in.
      screeningResult: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClinicalReleaseService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: { get: jest.fn((key: string) => (key === 'NODE_ENV' ? nodeEnv : undefined)) },
        },
      ],
    }).compile();

    service = module.get(ClinicalReleaseService);
  }

  beforeEach(async () => {
    nodeEnv = 'development';
    await build();
  });

  /** Sprint 7 safety test 1. */
  it('refuses release when no approved policy is configured', async () => {
    prisma.clinicalReleasePolicy.findFirst.mockResolvedValue(null);

    const result = await service.evaluate(makeUnit());

    expect(result.permitted).toBe(false);
    expect((result as any).reasonCode).toBe(ClinicalReleaseReason.POLICY_NOT_CONFIGURED);
  });

  it('does not treat a DRAFT policy as in force', async () => {
    await service.getPolicyInForce('org-1');

    // Both lookups -- organisation-scoped, then platform-wide -- filter to
    // APPROVED. A draft is by definition something nobody has signed.
    for (const call of prisma.clinicalReleasePolicy.findFirst.mock.calls) {
      expect(call[0].where.status).toBe('APPROVED');
    }
  });

  it('prefers an organisation policy over the platform-wide one', async () => {
    const scoped = makePolicy({ id: 'policy-org', organizationId: 'org-1', requirements: [] });
    prisma.clinicalReleasePolicy.findFirst.mockResolvedValueOnce(scoped);

    const policy = await service.getPolicyInForce('org-1');

    expect(policy?.id).toBe('policy-org');
    // The platform-wide lookup never runs once the scoped one answers.
    expect(prisma.clinicalReleasePolicy.findFirst).toHaveBeenCalledTimes(1);
  });

  /**
   * Sprint 7 safety test 2 — the one most likely to be got wrong.
   *
   * "Every requirement is satisfied" is vacuously true of an empty list, so the
   * obvious implementation permits everything the moment a clinician approves a
   * policy they have not finished writing.
   */
  it('refuses release when an approved production policy lists no requirements', async () => {
    prisma.clinicalReleasePolicy.findFirst.mockResolvedValue(makePolicy({ requirements: [] }));

    const result = await service.evaluate(makeUnit());

    expect(result.permitted).toBe(false);
    expect((result as any).reasonCode).toBe(ClinicalReleaseReason.POLICY_HAS_NO_REQUIREMENTS);
  });

  it('refuses release when a production policy has requirements the unit does not satisfy', async () => {
    prisma.clinicalReleasePolicy.findFirst.mockResolvedValue(
      makePolicy({
        requirements: [
          { id: 'r1', policyId: 'policy-1', code: 'REQ_A', description: 'a', componentType: null },
          { id: 'r2', policyId: 'policy-1', code: 'REQ_B', description: 'b', componentType: null },
        ],
      }),
    );

    const result = await service.evaluate(makeUnit());

    expect(result.permitted).toBe(false);
    expect((result as any).reasonCode).toBe(ClinicalReleaseReason.REQUIREMENTS_NOT_MET);
    // The refusal names what is missing rather than saying "no".
    expect((result as any).unmetRequirements).toEqual(['REQ_A', 'REQ_B']);
  });

  it('ignores requirements scoped to a different component type', async () => {
    prisma.clinicalReleasePolicy.findFirst.mockResolvedValue(
      makePolicy({
        requirements: [
          { id: 'r1', policyId: 'policy-1', code: 'PLASMA_ONLY', description: 'p', componentType: 'PLASMA' },
        ],
      }),
    );

    const result = await service.evaluate(makeUnit({ componentType: 'WHOLE_BLOOD' }));

    // No requirement applies to whole blood, which is an empty applicable set --
    // and an empty set still refuses rather than clearing the unit.
    expect(result.permitted).toBe(false);
    expect((result as any).reasonCode).toBe(ClinicalReleaseReason.POLICY_HAS_NO_REQUIREMENTS);
  });

  /** Sprint 7 safety test 3. */
  it('refuses a development-only policy in production', async () => {
    nodeEnv = 'production';
    await build();
    prisma.clinicalReleasePolicy.findFirst.mockResolvedValue(
      makePolicy({ kind: 'DEVELOPMENT_ONLY', developmentShelfLifeDays: 3650 }),
    );

    const result = await service.evaluate(makeUnit());

    expect(result.permitted).toBe(false);
    expect((result as any).reasonCode).toBe(ClinicalReleaseReason.POLICY_DEVELOPMENT_ONLY);
  });

  it('permits under a development-only policy outside production, and says it is development', async () => {
    prisma.clinicalReleasePolicy.findFirst.mockResolvedValue(
      makePolicy({ kind: 'DEVELOPMENT_ONLY', developmentShelfLifeDays: 10 }),
    );

    const result = await service.evaluate(makeUnit());

    expect(result.permitted).toBe(true);
    // The flag the consoles read so a development clearance is never displayed
    // as a clinical one.
    expect((result as any).developmentOnly).toBe(true);
    expect((result as any).policyVersion).toBe(3);
    expect((result as any).expirySource).toBe('DEVELOPMENT_POLICY');
    expect((result as any).expiresAt).toEqual(new Date('2026-09-11T00:00:00.000Z'));
  });

  /** Sprint 7 safety test 11. */
  it('refuses release when the unit has no known expiry and the policy states no shelf life', async () => {
    prisma.clinicalReleasePolicy.findFirst.mockResolvedValue(
      makePolicy({ kind: 'DEVELOPMENT_ONLY', developmentShelfLifeDays: null }),
    );

    const result = await service.evaluate(makeUnit({ expiresAt: null, expirySource: 'UNKNOWN' }));

    expect(result.permitted).toBe(false);
    expect((result as any).reasonCode).toBe(ClinicalReleaseReason.EXPIRY_UNKNOWN);
  });

  it('refuses an expiry date whose provenance is unknown', async () => {
    prisma.clinicalReleasePolicy.findFirst.mockResolvedValue(
      makePolicy({ kind: 'DEVELOPMENT_ONLY', developmentShelfLifeDays: null }),
    );

    // A date is present. Where it came from is not, and a date nobody can
    // account for is not evidence of a shelf life.
    const result = await service.evaluate(
      makeUnit({ expiresAt: new Date('2027-01-01T00:00:00.000Z'), expirySource: 'UNKNOWN' }),
    );

    expect(result.permitted).toBe(false);
    expect((result as any).reasonCode).toBe(ClinicalReleaseReason.EXPIRY_UNKNOWN);
  });

  it('accepts an expiry whose provenance is recorded', async () => {
    prisma.clinicalReleasePolicy.findFirst.mockResolvedValue(
      makePolicy({ kind: 'DEVELOPMENT_ONLY', developmentShelfLifeDays: null }),
    );

    const result = await service.evaluate(
      makeUnit({ expiresAt: new Date('2027-01-01T00:00:00.000Z'), expirySource: 'STAFF_RECORDED' }),
    );

    expect(result.permitted).toBe(true);
    expect((result as any).expirySource).toBe('STAFF_RECORDED');
  });

  it('never reads a development shelf life from a production policy', async () => {
    // A shelf life on a PRODUCTION policy is not a route around CL-04: the
    // column exists for development stand-ins and is not consulted otherwise.
    prisma.clinicalReleasePolicy.findFirst.mockResolvedValue(
      makePolicy({
        kind: 'PRODUCTION',
        developmentShelfLifeDays: 42,
        requirements: [
          { id: 'r1', policyId: 'policy-1', code: 'REQ_A', description: 'a', componentType: null },
        ],
      }),
    );

    const result = await service.evaluate(makeUnit());

    // Refused on requirements first; the shelf life never gets a chance to
    // matter, and if requirements were ever satisfied the expiry check would
    // still find nothing.
    expect(result.permitted).toBe(false);
    expect((result as any).reasonCode).toBe(ClinicalReleaseReason.REQUIREMENTS_NOT_MET);
  });

  /**
   * Sprint 7 safety test 6, at the unit level: the evaluation takes no actor.
   *
   * There is no parameter for who is asking, so no role can be special-cased
   * here however the caller is authenticated. The API-level half of this --
   * that a SUPER_ADMIN's HTTP request is refused too, and that no force-release
   * route exists -- is in clinical-safety.e2e-spec.ts.
   */
  it('takes no actor, so no role can be privileged by it', () => {
    // Structural, and deliberately so: the claim is not "SUPER_ADMIN is
    // checked and refused", it is that there is nothing here to check against.
    // A future edit that adds a caller to this signature should have to delete
    // this test to do it.
    const parameters = /\(([^)]*)\)/.exec(service.evaluate.toString())?.[1] ?? '';

    expect(parameters).not.toMatch(/user|actor|role|admin|requesting/i);
  });

  describe('assertReleased', () => {
    /** Sprint 7 safety tests 4 and 5, at the unit level. */
    it('throws for a unit with no release decision', () => {
      expect(() =>
        service.assertReleased({ clinicalReleasedAt: null, unitReference: 'BU-1' }),
      ).toThrow(ConflictException);
    });

    it('carries a machine-readable code', () => {
      try {
        service.assertReleased({ clinicalReleasedAt: null, unitReference: 'BU-1' });
        throw new Error('expected a refusal');
      } catch (error) {
        expect((error as ConflictException).getResponse()).toMatchObject({
          code: ClinicalReleaseReason.DECISION_MISSING,
        });
      }
    });

    it('permits a unit that carries one', () => {
      expect(() =>
        service.assertReleased({ clinicalReleasedAt: new Date(), unitReference: 'BU-1' }),
      ).not.toThrow();
    });
  });

  describe('getPolicyStatus', () => {
    it('reports an unconfigured organisation as unconfigured', async () => {
      const status = await service.getPolicyStatus('org-1');
      expect(status.configured).toBe(false);
      expect(status.policy).toBeNull();
    });

    it('reports a development policy as development, and unusable in production', async () => {
      nodeEnv = 'production';
      await build();
      prisma.clinicalReleasePolicy.findFirst.mockResolvedValue(
        makePolicy({ kind: 'DEVELOPMENT_ONLY' }),
      );

      const status = await service.getPolicyStatus('org-1');

      expect(status.configured).toBe(false);
      expect(status.policy?.developmentOnly).toBe(true);
    });
  });
  /**
   * Sprint 10: the seam Sprint 7 left open.
   *
   * `unmetRequirements` used to return every applicable requirement code
   * unconditionally, because no screening subsystem existed and pretending one
   * did would have been the more dangerous lie. These are the properties of
   * what replaced it, and each of them is a way the gate could quietly permit
   * something.
   */
  describe('screening, as the thing that satisfies a requirement', () => {
    const REQUIREMENT = { id: 'req-1', code: 'REQ-A', description: null, componentType: null };

    function policyWith(rules: { resultCode: string; disposition: string }[], overrides = {}) {
      return makePolicy({
        requirements: [REQUIREMENT],
        dispositionRules: rules.map((rule, index) => ({
          id: `rule-${index}`,
          policyId: 'policy-1',
          requirementCode: REQUIREMENT.code,
          resultCode: rule.resultCode,
          disposition: rule.disposition,
          note: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
        ...overrides,
      });
    }

    function result(overrides: Record<string, unknown> = {}) {
      return {
        requirementCode: REQUIREMENT.code,
        resultCode: 'CODE-PASS',
        reviewedAt: new Date('2026-09-02T00:00:00.000Z'),
        createdAt: new Date('2026-09-02T00:00:00.000Z'),
        ...overrides,
      };
    }

    it('refuses when no result has been recorded against the requirement', async () => {
      prisma.clinicalReleasePolicy.findFirst.mockResolvedValue(
        policyWith([{ resultCode: 'CODE-PASS', disposition: 'CLEAR' }]),
      );
      prisma.screeningResult.findMany.mockResolvedValue([]);

      const evaluation = await service.evaluate(makeUnit());

      expect(evaluation.permitted).toBe(false);
      expect((evaluation as any).reasonCode).toBe(ClinicalReleaseReason.REQUIREMENTS_NOT_MET);
      expect((evaluation as any).unmetRequirements).toEqual(['REQ-A']);
    });

    it('refuses a result the policy in force has no rule for', async () => {
      // The state a fresh installation is in: results exist, no rule describes
      // them, nothing is satisfied. A code that READS like a pass is still not
      // one -- the gate never interprets a string on its own.
      prisma.clinicalReleasePolicy.findFirst.mockResolvedValue(policyWith([]));
      prisma.screeningResult.findMany.mockResolvedValue([result({ resultCode: 'NEGATIVE' })]);

      const evaluation = await service.evaluate(makeUnit());

      expect(evaluation.permitted).toBe(false);
      expect((evaluation as any).unmetRequirements).toEqual(['REQ-A']);
    });

    it('refuses a result the policy maps to BLOCK', async () => {
      prisma.clinicalReleasePolicy.findFirst.mockResolvedValue(
        policyWith([{ resultCode: 'CODE-BLOCK', disposition: 'BLOCK' }]),
      );
      prisma.screeningResult.findMany.mockResolvedValue([result({ resultCode: 'CODE-BLOCK' })]);

      const evaluation = await service.evaluate(makeUnit());

      expect(evaluation.permitted).toBe(false);
    });

    it('refuses a result the policy maps to REVIEW_REQUIRED, which is not a pass with a note', async () => {
      prisma.clinicalReleasePolicy.findFirst.mockResolvedValue(
        policyWith([{ resultCode: 'CODE-REVIEW', disposition: 'REVIEW_REQUIRED' }]),
      );
      prisma.screeningResult.findMany.mockResolvedValue([result({ resultCode: 'CODE-REVIEW' })]);

      const evaluation = await service.evaluate(makeUnit());

      expect(evaluation.permitted).toBe(false);
    });

    it('permits when every requirement has a CLEAR, reviewed result', async () => {
      prisma.clinicalReleasePolicy.findFirst.mockResolvedValue(
        policyWith([{ resultCode: 'CODE-PASS', disposition: 'CLEAR' }], {
          // An expiry the unit itself carries with a known provenance, so this
          // test is about screening and not about shelf life.
        }),
      );
      prisma.screeningResult.findMany.mockResolvedValue([result()]);

      const evaluation = await service.evaluate(
        makeUnit({
          expiresAt: new Date('2026-10-01T00:00:00.000Z'),
          expirySource: 'STORAGE_POLICY',
        }),
      );

      expect(evaluation.permitted).toBe(true);
    });

    it('refuses an unreviewed result when the policy requires review', async () => {
      // Entry is not review. A measurement nobody has signed off is not an
      // answer, whatever it says.
      prisma.clinicalReleasePolicy.findFirst.mockResolvedValue(
        policyWith([{ resultCode: 'CODE-PASS', disposition: 'CLEAR' }], {
          requiresResultReview: true,
        }),
      );
      prisma.screeningResult.findMany.mockResolvedValue([result({ reviewedAt: null })]);

      const evaluation = await service.evaluate(
        makeUnit({ expiresAt: new Date('2026-10-01T00:00:00.000Z'), expirySource: 'STORAGE_POLICY' }),
      );

      expect(evaluation.permitted).toBe(false);
      expect((evaluation as any).unmetRequirements).toEqual(['REQ-A']);
    });

    it('permits an unreviewed result only when the policy says review is not required', async () => {
      prisma.clinicalReleasePolicy.findFirst.mockResolvedValue(
        policyWith([{ resultCode: 'CODE-PASS', disposition: 'CLEAR' }], {
          requiresResultReview: false,
        }),
      );
      prisma.screeningResult.findMany.mockResolvedValue([result({ reviewedAt: null })]);

      const evaluation = await service.evaluate(
        makeUnit({ expiresAt: new Date('2026-10-01T00:00:00.000Z'), expirySource: 'STORAGE_POLICY' }),
      );

      expect(evaluation.permitted).toBe(true);
    });

    it('re-derives the meaning under the policy in force, not from what was stored', async () => {
      // The version-bump case. The laboratory recorded CODE-PASS and the policy
      // of the day called it CLEAR; the policy now in force has no rule for it.
      // A component still in the fridge must not go out on the old answer, and
      // the stored row must not be rewritten either -- so the gate asks the
      // current policy what the RAW code means, every time.
      //
      // `disposition` is deliberately absent from what the gate selects: if it
      // were read, this test would pass for the wrong reason.
      prisma.clinicalReleasePolicy.findFirst.mockResolvedValue(
        policyWith([{ resultCode: 'CODE-SOMETHING-ELSE', disposition: 'CLEAR' }], { version: 4 }),
      );
      prisma.screeningResult.findMany.mockResolvedValue([
        result({ resultCode: 'CODE-PASS', disposition: 'CLEAR' }),
      ]);

      const evaluation = await service.evaluate(makeUnit());

      expect(evaluation.permitted).toBe(false);
      expect((evaluation as any).unmetRequirements).toEqual(['REQ-A']);
    });

    it('reads only live results, from this donation, at this organisation, from orders that are not cancelled', async () => {
      // Four separate ways the gate could be fed evidence it must not use, all
      // of them in one `where`. Asserted on the query rather than through
      // behaviour, because a missing predicate here fails open.
      prisma.clinicalReleasePolicy.findFirst.mockResolvedValue(
        policyWith([{ resultCode: 'CODE-PASS', disposition: 'CLEAR' }]),
      );
      prisma.screeningResult.findMany.mockResolvedValue([]);

      await service.evaluate(makeUnit());

      const where = prisma.screeningResult.findMany.mock.calls[0][0].where;
      expect(where.superseded).toBe(false);
      expect(where.screeningOrder.donationId).toBe('donation-1');
      expect(where.screeningOrder.organizationId).toBe('org-1');
      expect(where.screeningOrder.status).toEqual({ not: 'CANCELLED' });
    });

    it('takes the newest result for a requirement, so a repeat supersedes an earlier attempt', async () => {
      prisma.clinicalReleasePolicy.findFirst.mockResolvedValue(
        policyWith([{ resultCode: 'CODE-PASS', disposition: 'CLEAR' }]),
      );
      // Ordered newest first by the query; the gate takes the first match.
      prisma.screeningResult.findMany.mockResolvedValue([
        result({ resultCode: 'CODE-PASS', createdAt: new Date('2026-09-05T00:00:00.000Z') }),
        result({ resultCode: 'CODE-UNKNOWN', createdAt: new Date('2026-09-02T00:00:00.000Z') }),
      ]);

      const evaluation = await service.evaluate(
        makeUnit({ expiresAt: new Date('2026-10-01T00:00:00.000Z'), expirySource: 'STORAGE_POLICY' }),
      );

      expect(evaluation.permitted).toBe(true);
      expect(prisma.screeningResult.findMany.mock.calls[0][0].orderBy).toEqual({
        createdAt: 'desc',
      });
    });

    it('is not satisfied by a result recorded against a different requirement', async () => {
      prisma.clinicalReleasePolicy.findFirst.mockResolvedValue(
        policyWith([{ resultCode: 'CODE-PASS', disposition: 'CLEAR' }]),
      );
      prisma.screeningResult.findMany.mockResolvedValue([
        result({ requirementCode: 'REQ-SOMETHING-ELSE' }),
      ]);

      const evaluation = await service.evaluate(makeUnit());

      expect(evaluation.permitted).toBe(false);
      expect((evaluation as any).unmetRequirements).toEqual(['REQ-A']);
    });

    it('names every unsatisfied requirement, not just the first', async () => {
      prisma.clinicalReleasePolicy.findFirst.mockResolvedValue(
        makePolicy({
          requirements: [
            REQUIREMENT,
            { id: 'req-2', code: 'REQ-B', description: null, componentType: null },
          ],
          dispositionRules: [],
        }),
      );
      prisma.screeningResult.findMany.mockResolvedValue([]);

      const evaluation = await service.evaluate(makeUnit());

      expect((evaluation as any).unmetRequirements).toEqual(['REQ-A', 'REQ-B']);
    });

    it('still takes no actor, so no role satisfies a requirement', async () => {
      prisma.clinicalReleasePolicy.findFirst.mockResolvedValue(policyWith([]));
      prisma.screeningResult.findMany.mockResolvedValue([result()]);

      // The signature is the proof: there is nowhere to pass one.
      expect(service.evaluate.length).toBeLessThanOrEqual(2);
      const evaluation = await service.evaluate(makeUnit());
      expect(evaluation.permitted).toBe(false);
    });
  });
});
