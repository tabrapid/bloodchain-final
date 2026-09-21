import { SafetyDisposition, ScreeningDispositionRule } from '@prisma/client';

/**
 * What a laboratory's raw result code means for the SAFETY of the blood.
 *
 * A pure function over rows, deliberately -- the same reason
 * `component-label.ts` is one. This is the single place where an uninterpreted
 * string from an analyser becomes something the application acts on, and the
 * interesting property is not what it decides but what it refuses to decide
 * without being told. That is only testable if deciding needs nothing but data.
 *
 * NO ASSAY RULE IS ENCODED HERE. Which markers must be tested, what any
 * particular result implies, whether a repeat is required, whether a second
 * method is mandatory: all of it is clinical and regulatory content nobody has
 * validated for this project (CR-01..CR-03), and none of it appears in this
 * file or anywhere else in the repository -- not as a rule, and not as an
 * example in a comment. The mapping lives in `ScreeningDispositionRule` rows on
 * an approved policy, and the repository ships without a single one.
 *
 * The consequence is that on a fresh installation EVERY result is unmapped, and
 * every unmapped result fails closed. That is the intended behaviour, not a gap
 * to be papered over with a default rule set.
 */

/** What the policy said, and whether it said anything at all. */
export interface DispositionResolution {
  disposition: SafetyDisposition;
  /**
   * The policy version whose rule produced `disposition`, or null when no rule
   * matched. Null is the marker that the system defaulted rather than being
   * told, and it is what stops an unmapped result being read later as a
   * clinical judgement somebody made.
   */
  policyVersion: number | null;
  ruleId: string | null;
  /** False when no rule matched the (requirement, result code) pair. */
  mapped: boolean;
}

/**
 * Resolve one raw result code against the rules of one policy version.
 *
 * Matching is exact on both the requirement code and the result code, and
 * case-insensitive only in the sense that codes are normalised to upper case
 * before comparison -- laboratories write `reactive`, `REACTIVE` and `Reactive`
 * for the same thing, and treating those as three different unmapped codes
 * would be a trap rather than a safeguard. Nothing else is normalised: no
 * prefix matching, no synonyms, no "contains". A rule either names this exact
 * code or it does not.
 *
 * ## Why an unmapped code is REVIEW_REQUIRED and not BLOCK
 *
 * BLOCK is an assertion: this result means the blood is unsafe. The system is
 * not entitled to make that assertion about a code no approved policy
 * describes, and doing so would be exactly the donor-diagnosis-from-screening
 * that Sprint 10 forbids. REVIEW_REQUIRED says the honest thing instead: the
 * system does not know what this means and a person must decide.
 *
 * Safety does not depend on the choice between the two, because neither
 * satisfies a release requirement. Only CLEAR does, and an unmapped code is
 * never CLEAR under any policy, in any environment, for any actor.
 */
export function resolveDisposition(
  requirementCode: string,
  resultCode: string,
  rules: Pick<ScreeningDispositionRule, 'id' | 'requirementCode' | 'resultCode' | 'disposition'>[],
  policyVersion: number,
): DispositionResolution {
  const wantedRequirement = normalise(requirementCode);
  const wantedResult = normalise(resultCode);

  const rule = rules.find(
    (candidate) =>
      normalise(candidate.requirementCode) === wantedRequirement &&
      normalise(candidate.resultCode) === wantedResult,
  );

  if (!rule) {
    return {
      disposition: SafetyDisposition.REVIEW_REQUIRED,
      policyVersion: null,
      ruleId: null,
      mapped: false,
    };
  }

  return {
    disposition: rule.disposition,
    policyVersion,
    ruleId: rule.id,
    mapped: true,
  };
}

/**
 * Whether a disposition satisfies a release requirement.
 *
 * One line, and it exists as a named function rather than as `=== CLEAR` at
 * four call sites so that "what counts as satisfied" has one definition that a
 * test can pin. REVIEW_REQUIRED does not satisfy anything: a result waiting for
 * a person is not a result.
 */
export function satisfiesRequirement(resolution: DispositionResolution): boolean {
  return resolution.mapped && resolution.disposition === SafetyDisposition.CLEAR;
}

/**
 * Whether a disposition is one the policy produced and which obliges a
 * clinician to look at the DONOR.
 *
 * Note what is absent: an unmapped result. A code no policy describes is a
 * configuration gap, not a signal about a person, and raising
 * `MEDICAL_REVIEW_REQUIRED` from one would mean that on a fresh installation --
 * where the rule table ships empty -- every donor who ever gave blood would be
 * placed under medical review by their first result. A flag that fires on
 * everything is a flag nobody reads, and it would be a clinical claim the
 * system has no basis for. The component is still refused either way; that is
 * where the unmapped code is answered.
 */
export function requiresDonorReview(resolution: DispositionResolution): boolean {
  return (
    resolution.mapped &&
    (resolution.disposition === SafetyDisposition.BLOCK ||
      resolution.disposition === SafetyDisposition.REVIEW_REQUIRED)
  );
}

function normalise(code: string): string {
  return code.trim().toUpperCase();
}
