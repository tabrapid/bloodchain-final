/**
 * Why a clinical release was refused, as codes a client can branch on.
 *
 * Prose changes with translation and with editing; these do not. Every refusal
 * the gate produces carries one of these, the same string reaches the
 * `ReleaseDecision` row, and the three consoles map them to their own wording.
 */
export const ClinicalReleaseReason = {
  /** Nobody has recorded an approved clinical release policy. The default state. */
  POLICY_NOT_CONFIGURED: 'CLINICAL_RELEASE_POLICY_NOT_CONFIGURED',
  /**
   * The only policy in force is a development stand-in, and this is production.
   * Refused rather than honoured: a development policy is not a clinical one at
   * any time, and least of all where real blood is involved.
   */
  POLICY_DEVELOPMENT_ONLY: 'CLINICAL_RELEASE_POLICY_DEVELOPMENT_ONLY',
  /**
   * An approved production policy exists and lists nothing that must be
   * satisfied. Read as "nobody has said what must be tested", never as "nothing
   * must be tested" -- an empty requirement set is an unanswered question.
   */
  POLICY_HAS_NO_REQUIREMENTS: 'CLINICAL_RELEASE_POLICY_HAS_NO_REQUIREMENTS',
  /** One or more of the policy's requirements is not satisfied for this unit. */
  REQUIREMENTS_NOT_MET: 'CLINICAL_RELEASE_REQUIREMENTS_NOT_MET',
  /**
   * The unit's shelf life is unknown, and an unknown shelf life is not a safe
   * one. No component shelf life is encoded in this repository (CL-04).
   */
  EXPIRY_UNKNOWN: 'CLINICAL_RELEASE_EXPIRY_UNKNOWN',
  /**
   * The unit carries no clinical release decision, so it may not be reserved,
   * issued or shipped. What every pre-gate unit answers.
   */
  DECISION_MISSING: 'CLINICAL_RELEASE_DECISION_MISSING',
} as const;

export type ClinicalReleaseReasonCode =
  (typeof ClinicalReleaseReason)[keyof typeof ClinicalReleaseReason];

/** Operator-facing English. The consoles localise from the code, not from this. */
export const CLINICAL_RELEASE_MESSAGES: Record<ClinicalReleaseReasonCode, string> = {
  [ClinicalReleaseReason.POLICY_NOT_CONFIGURED]:
    'No approved clinical release policy is configured, so this unit cannot be released into transfusable stock. A policy has to be recorded and approved before any unit can be released.',
  [ClinicalReleaseReason.POLICY_DEVELOPMENT_ONLY]:
    'The only clinical release policy in force is marked development-only, which cannot release a unit in production. A production policy has to be recorded and approved.',
  [ClinicalReleaseReason.POLICY_HAS_NO_REQUIREMENTS]:
    'The approved clinical release policy lists no requirements. An empty requirement set is not an approval to release: the policy has to state what must be satisfied.',
  [ClinicalReleaseReason.REQUIREMENTS_NOT_MET]:
    'This unit does not satisfy every requirement of the clinical release policy in force.',
  [ClinicalReleaseReason.EXPIRY_UNKNOWN]:
    'This unit has no known expiry date, and an unknown shelf life cannot be treated as safe for clinical release.',
  [ClinicalReleaseReason.DECISION_MISSING]:
    'This unit carries no clinical release decision, so it is not transfusable stock and cannot be reserved, issued or shipped.',
};
