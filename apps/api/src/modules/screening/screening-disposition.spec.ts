import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { SafetyDisposition } from '@prisma/client';

import {
  requiresDonorReview,
  resolveDisposition,
  satisfiesRequirement,
} from './screening-disposition';

/**
 * The one place a raw laboratory string becomes something the application acts
 * on. What matters here is what it refuses to decide.
 */
describe('screening disposition', () => {
  const rule = (requirementCode: string, resultCode: string, disposition: SafetyDisposition) => ({
    id: `rule-${requirementCode}-${resultCode}`,
    requirementCode,
    resultCode,
    disposition,
  });

  describe('with no rules configured, which is how the repository ships', () => {
    it('refuses to interpret anything', () => {
      const resolution = resolveDisposition('ANY-REQUIREMENT', 'NON-REACTIVE', [], 1);

      expect(resolution.mapped).toBe(false);
      expect(resolution.disposition).toBe(SafetyDisposition.REVIEW_REQUIRED);
      // Null is the marker that nobody decided this. It is what stops the row
      // being read back later as a clinical judgement.
      expect(resolution.policyVersion).toBeNull();
      expect(resolution.ruleId).toBeNull();
    });

    it('does not let a result that looks reassuring satisfy a requirement', () => {
      // The failure this guards against is a plausible-looking code being
      // treated as a pass because it reads like one. `NEGATIVE` means nothing
      // to this function and must not.
      for (const code of ['NEGATIVE', 'NON-REACTIVE', 'CLEAR', 'PASS', 'OK', '0']) {
        expect(satisfiesRequirement(resolveDisposition('REQ', code, [], 1))).toBe(false);
      }
    });

    it('does not put the donor under medical review either', () => {
      // A code no policy describes is a configuration gap, not a signal about
      // a person -- and with the rule table empty, the alternative would place
      // every donor who ever gave blood under review on their first result.
      expect(requiresDonorReview(resolveDisposition('REQ', 'ANYTHING', [], 1))).toBe(false);
    });
  });

  describe('when the policy has spoken', () => {
    const rules = [
      rule('REQ-A', 'NON-REACTIVE', SafetyDisposition.CLEAR),
      rule('REQ-A', 'REACTIVE', SafetyDisposition.BLOCK),
      rule('REQ-A', 'INDETERMINATE', SafetyDisposition.REVIEW_REQUIRED),
      rule('REQ-B', 'NON-REACTIVE', SafetyDisposition.REVIEW_REQUIRED),
    ];

    it('returns what the rule says, with the version that said it', () => {
      const resolution = resolveDisposition('REQ-A', 'NON-REACTIVE', rules, 7);

      expect(resolution.disposition).toBe(SafetyDisposition.CLEAR);
      expect(resolution.mapped).toBe(true);
      expect(resolution.policyVersion).toBe(7);
      expect(satisfiesRequirement(resolution)).toBe(true);
    });

    it('keeps requirements apart, so a rule for one marker cannot answer another', () => {
      // REQ-B maps the same result code to a different consequence. Reading
      // across requirements is the shape of a very bad bug.
      const resolution = resolveDisposition('REQ-B', 'NON-REACTIVE', rules, 7);

      expect(resolution.disposition).toBe(SafetyDisposition.REVIEW_REQUIRED);
      expect(satisfiesRequirement(resolution)).toBe(false);
    });

    it('treats a blocked result as blocking and as a reason for a clinician to look', () => {
      const resolution = resolveDisposition('REQ-A', 'REACTIVE', rules, 7);

      expect(resolution.disposition).toBe(SafetyDisposition.BLOCK);
      expect(satisfiesRequirement(resolution)).toBe(false);
      expect(requiresDonorReview(resolution)).toBe(true);
    });

    it('treats REVIEW_REQUIRED as unsatisfied, not as a pass with a note', () => {
      const resolution = resolveDisposition('REQ-A', 'INDETERMINATE', rules, 7);

      expect(satisfiesRequirement(resolution)).toBe(false);
      expect(requiresDonorReview(resolution)).toBe(true);
    });

    it('normalises case and surrounding space, and nothing else', () => {
      expect(resolveDisposition('req-a', '  non-reactive ', rules, 7).disposition).toBe(
        SafetyDisposition.CLEAR,
      );

      // Not prefix matching, not "contains", not a synonym list. A rule names
      // an exact code or it does not apply.
      for (const near of ['NON', 'NONREACTIVE', 'NON REACTIVE', 'NON-REACTIVE-REPEAT']) {
        expect(resolveDisposition('REQ-A', near, rules, 7).mapped).toBe(false);
      }
    });
  });

  describe('what the module does not contain', () => {
    it('names no marker, assay, analyser or threshold', () => {
      // Read as source rather than asserted through behaviour, because the
      // failure mode is somebody adding a "sensible default" rule set later --
      // and a rule set is data, which no behavioural assertion over this pure
      // function can see until it is already there.
      const source = readFileSync(join(__dirname, 'screening-disposition.ts'), 'utf8');

      for (const forbidden of [/\bHIV\b/, /\bHBV\b/, /\bHCV\b/, /\bHBsAg\b/i, /\bsyphilis\b/i, /\bNAT\b/]) {
        expect(source).not.toMatch(forbidden);
      }
    });
  });
});
