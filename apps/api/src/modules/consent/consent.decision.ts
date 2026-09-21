import { ConsentDocumentStatus, ConsentRequirementMode } from '@prisma/client';

/**
 * Whether a purpose may be exercised, decided as a pure function.
 *
 * Separated from the service, and from the database, for the same reason
 * `checkProductionConfig` was: every branch here is a refusal somebody will one
 * day want to argue with, and a decision that can only be observed by booting
 * an application and holding it in a particular state is a decision nobody
 * tests exhaustively. This one is a table.
 */

/** Why a purpose was refused. Codes, so a client branches without reading prose. */
export const ConsentReason = {
  /**
   * No requirement row says what this deployment does with this purpose.
   *
   * Refused rather than allowed. An unconfigured purpose is an unanswered
   * question, not a permission -- the same reading `ClinicalReleaseService`
   * gives an empty requirement set.
   */
  NOT_CONFIGURED: 'CONSENT_REQUIREMENT_NOT_CONFIGURED',
  /**
   * The purpose is required for this feature, and no APPROVED document exists
   * for it. Nobody can consent to a document that has not been approved, so the
   * feature cannot be offered.
   */
  NO_APPROVED_DOCUMENT: 'CONSENT_NO_APPROVED_DOCUMENT',
  /** Required, an approved document exists, and this person has not accepted it. */
  NOT_ACCEPTED: 'CONSENT_NOT_ACCEPTED',
  /** Accepted once, and since withdrawn. */
  WITHDRAWN: 'CONSENT_WITHDRAWN',
  /** The deployment has switched this purpose off entirely. */
  DISABLED: 'CONSENT_PURPOSE_DISABLED',
  /** A document that is not APPROVED cannot carry a legally meaningful acceptance. */
  DOCUMENT_NOT_APPROVED: 'CONSENT_DOCUMENT_NOT_APPROVED',
} as const;

export type ConsentReasonCode = (typeof ConsentReason)[keyof typeof ConsentReason];

export interface ConsentState {
  /** The configured mode, or null when nothing is configured. */
  mode: ConsentRequirementMode | null;
  /** Whether an APPROVED document exists for this purpose in this scope. */
  hasApprovedDocument: boolean;
  /** Whether this person has a live acceptance of it. */
  accepted: boolean;
  /** Whether their acceptance has been withdrawn. */
  withdrawn: boolean;
}

export interface ConsentDecision {
  allowed: boolean;
  reason: ConsentReasonCode | null;
}

const ALLOW: ConsentDecision = { allowed: true, reason: null };
const refuse = (reason: ConsentReasonCode): ConsentDecision => ({ allowed: false, reason });

/**
 * May this person's data be processed for this purpose?
 *
 * The order of these branches is the policy:
 *
 * 1. Nothing configured refuses. Absence of a rule is not permission.
 * 2. DISABLED refuses, whatever anybody has accepted. A deployment that has
 *    switched cross-border processing off does not start doing it because a
 *    donor once tapped yes.
 * 3. NOTICE_ONLY and OPTIONAL allow. They are not gates: a notice is shown, and
 *    an optional purpose is a preference the feature reads for itself rather
 *    than a condition of being served at all.
 * 4. REQUIRED_FOR_FEATURE needs an APPROVED document AND a live acceptance.
 *
 * A DRAFT document never satisfies (4), in any environment. That is the rule
 * the product owner set, and it holds here rather than only in production
 * because a development/production divergence in a consent gate is precisely
 * the kind of difference that is discovered by a regulator.
 */
export function decideConsent(state: ConsentState): ConsentDecision {
  if (state.mode === null) return refuse(ConsentReason.NOT_CONFIGURED);
  if (state.mode === ConsentRequirementMode.DISABLED) return refuse(ConsentReason.DISABLED);

  if (
    state.mode === ConsentRequirementMode.NOTICE_ONLY ||
    state.mode === ConsentRequirementMode.OPTIONAL
  ) {
    return ALLOW;
  }

  // REQUIRED_FOR_FEATURE from here.
  if (!state.hasApprovedDocument) return refuse(ConsentReason.NO_APPROVED_DOCUMENT);
  if (state.withdrawn) return refuse(ConsentReason.WITHDRAWN);
  if (!state.accepted) return refuse(ConsentReason.NOT_ACCEPTED);

  return ALLOW;
}

/**
 * May an acceptance be recorded against a document in this state?
 *
 * One rule, and it is absolute: only an APPROVED document. An acceptance is
 * evidence that a person agreed to specific wording somebody with authority
 * had signed off; against a DRAFT it is evidence of nothing, and a test fixture
 * must never be able to masquerade as legal approval.
 */
export function canAccept(status: ConsentDocumentStatus): ConsentDecision {
  return status === ConsentDocumentStatus.APPROVED
    ? ALLOW
    : refuse(ConsentReason.DOCUMENT_NOT_APPROVED);
}
