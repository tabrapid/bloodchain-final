/**
 * Why a screening action was refused, as codes a client can branch on.
 *
 * Same contract as `clinical-release.reasons.ts`: prose is translated and
 * edited, codes are not. Every refusal below reaches the consoles as a code and
 * is rendered from a translation file, never from the English here.
 */
export const ScreeningReason = {
  /**
   * No approved clinical release policy is in force, so there is nothing to
   * order screening against. Screening exists to satisfy a policy's
   * requirements; ordering it with no policy would produce results nobody can
   * say the meaning of.
   */
  POLICY_NOT_CONFIGURED: 'SCREENING_POLICY_NOT_CONFIGURED',
  /** The policy in force lists no requirements, so there is nothing to test. */
  POLICY_HAS_NO_REQUIREMENTS: 'SCREENING_POLICY_HAS_NO_REQUIREMENTS',
  /**
   * The donation has not been completed. A sample is not a donation and an
   * order is not a result: screening is ordered against blood that was actually
   * collected, never against an intention to collect it.
   */
  DONATION_NOT_COMPLETED: 'SCREENING_DONATION_NOT_COMPLETED',
  /** An open order already covers this donation. */
  ORDER_ALREADY_OPEN: 'SCREENING_ORDER_ALREADY_OPEN',
  /** The order is cancelled or completed and cannot take further results. */
  ORDER_NOT_OPEN: 'SCREENING_ORDER_NOT_OPEN',
  /** The requirement code is not one the order's pinned policy version lists. */
  REQUIREMENT_NOT_IN_POLICY: 'SCREENING_REQUIREMENT_NOT_IN_POLICY',
  /**
   * The sample cannot satisfy anything: it was rejected, or it belongs to
   * another donation.
   */
  SAMPLE_UNUSABLE: 'SCREENING_SAMPLE_UNUSABLE',
  /**
   * Entry is not review. The person who recorded a result may not be the person
   * who reviews it, whatever roles they hold.
   */
  REVIEWER_IS_PERFORMER: 'SCREENING_REVIEWER_IS_PERFORMER',
  /**
   * The actor holds no role that reviews screening results. Platform
   * administration is not clinical review, so SUPER_ADMIN is refused here like
   * anybody else without a clinical role.
   */
  NOT_A_CLINICAL_REVIEWER: 'SCREENING_NOT_A_CLINICAL_REVIEWER',
  /**
   * A live result already answers this requirement.
   *
   * Refused rather than accepted as a second opinion. The release gate reads
   * the NEWEST live result for a requirement, so a second one silently
   * overrides the first -- including overriding a blocking result with a
   * clearing one, with no reason recorded, no revision row, no recall
   * evaluation, and nothing visible to the reviewer who has to sign it off.
   * Repeating a test is a correction, and the correction path is where it
   * belongs.
   */
  REQUIREMENT_ALREADY_ANSWERED: 'SCREENING_REQUIREMENT_ALREADY_ANSWERED',
  /** The result has already been superseded by a correction. */
  RESULT_SUPERSEDED: 'SCREENING_RESULT_SUPERSEDED',
  /** The result has already been reviewed. */
  RESULT_ALREADY_REVIEWED: 'SCREENING_RESULT_ALREADY_REVIEWED',
  /** A correction has to say what it corrects to, and why. */
  CORRECTION_IS_NOT_A_CHANGE: 'SCREENING_CORRECTION_IS_NOT_A_CHANGE',
  /** The order still has requirements with no non-superseded result. */
  ORDER_INCOMPLETE: 'SCREENING_ORDER_INCOMPLETE',
} as const;

export type ScreeningReasonCode = (typeof ScreeningReason)[keyof typeof ScreeningReason];

/** Operator-facing English. The consoles localise from the code, not from this. */
export const SCREENING_MESSAGES: Record<ScreeningReasonCode, string> = {
  [ScreeningReason.POLICY_NOT_CONFIGURED]:
    'No approved clinical release policy is in force for this organization, so there is nothing to order screening against.',
  [ScreeningReason.POLICY_HAS_NO_REQUIREMENTS]:
    'The clinical release policy in force lists no requirements. An empty requirement set is an unanswered question, not an instruction to test nothing.',
  [ScreeningReason.DONATION_NOT_COMPLETED]:
    'Screening is ordered against a completed donation. This donation has not been completed.',
  [ScreeningReason.ORDER_ALREADY_OPEN]:
    'An open screening order already covers this donation.',
  [ScreeningReason.ORDER_NOT_OPEN]:
    'This screening order is no longer open, so it cannot take further results.',
  [ScreeningReason.REQUIREMENT_NOT_IN_POLICY]:
    'This requirement is not listed by the policy version the order was raised under. Results are recorded against what was actually required at the time.',
  [ScreeningReason.SAMPLE_UNUSABLE]:
    'This sample cannot satisfy a screening requirement. A rejected sample, or one belonging to another donation, needs replacing before testing can proceed.',
  [ScreeningReason.REVIEWER_IS_PERFORMER]:
    'The person who recorded a screening result cannot be the person who reviews it. Recording a result and reviewing it are two different acts.',
  [ScreeningReason.NOT_A_CLINICAL_REVIEWER]:
    'This account holds no clinical role at this organization, so it cannot review screening results. Administering the platform is not reviewing a result.',
  [ScreeningReason.REQUIREMENT_ALREADY_ANSWERED]:
    'A result is already recorded for this requirement. Correct it rather than recording a second one.',
  [ScreeningReason.RESULT_SUPERSEDED]:
    'This result has been superseded by a correction. Act on the correction instead.',
  [ScreeningReason.RESULT_ALREADY_REVIEWED]:
    'This result has already been reviewed.',
  [ScreeningReason.CORRECTION_IS_NOT_A_CHANGE]:
    'A correction has to change the recorded result. Recording the same value again is not a correction.',
  [ScreeningReason.ORDER_INCOMPLETE]:
    'This screening order still has requirements with no result recorded against them.',
};
