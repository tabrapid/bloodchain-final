import { apiRequest, ApiRequestError } from './api-client';

export { ApiRequestError };

/**
 * The blood-bank screening console's data layer.
 *
 * One rule runs through every type here: nothing is computed on this side that
 * the server already decides. `disposition`, `dispositionMapped`,
 * `satisfiesRequirement` and `developmentOnly` all arrive resolved, because a
 * second implementation of a safety rule in a React component is one that
 * drifts away from the one the gate uses, and the gate is the one that is
 * right.
 */

export type SafetyDisposition = 'CLEAR' | 'BLOCK' | 'REVIEW_REQUIRED';

export type ScreeningOrderStatus =
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'AWAITING_REVIEW'
  | 'COMPLETED'
  | 'CANCELLED';

export interface ScreeningOrderSummary {
  id: string;
  orderReference: string;
  status: ScreeningOrderStatus;
  donationId: string;
  donationReference: string;
  sample: { id: string; sampleReference: string; status: string } | null;
  policyId: string;
  /** The version the order was raised under. A column, not a lookup. */
  policyVersion: number;
  policyTitle: string;
  developmentOnly: boolean;
  requestedAt: string;
  systemRaised: boolean;
  completedAt: string | null;
  reviewedAt: string | null;
  resultCount: number;
  reviewedResultCount: number;
}

export interface ScreeningRequirementView {
  code: string;
  description: string | null;
  componentType: string | null;
  screeningTestCode: string | null;
  result: {
    id: string;
    resultCode: string;
    resultValue: string | null;
    disposition: SafetyDisposition;
    /**
     * Null when no rule in the approved policy described this result code, so
     * the system defaulted to requiring a person. Rendered as its own state,
     * never as a clinical answer.
     */
    dispositionPolicyVersion: number | null;
    source: string;
    performedAt: string | null;
    performedByName: string | null;
    reviewedAt: string | null;
    reviewedByName: string | null;
    comment: string | null;
  } | null;
}

export interface ScreeningOrderDetail {
  id: string;
  orderReference: string;
  status: ScreeningOrderStatus;
  donation: { id: string; donationReference: string; donorId: string; completedAt: string | null };
  sample: {
    id: string;
    sampleReference: string;
    sampleType: string | null;
    status: string;
    collectedAt: string;
    rejectedAt: string | null;
    rejectionReason: string | null;
  } | null;
  policy: {
    id: string;
    title: string;
    kind: string;
    developmentOnly: boolean;
    currentVersion: number;
    requiresResultReview: boolean;
  };
  policyVersion: number;
  requestedAt: string;
  systemRaised: boolean;
  completedAt: string | null;
  reviewedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  requirements: ScreeningRequirementView[];
  supersededResults: {
    id: string;
    requirementCode: string;
    resultCode: string;
    disposition: SafetyDisposition;
    supersededAt: string | null;
  }[];
}

export interface RecordedScreeningResult {
  id: string;
  requirementCode: string;
  resultCode: string;
  disposition: SafetyDisposition;
  dispositionPolicyVersion: number | null;
  dispositionMapped: boolean;
  satisfiesRequirement: boolean;
  performedAt: string | null;
  reviewedAt: string | null;
  medicalReviewOpened: boolean;
}

export interface CorrectedScreeningResult {
  id: string;
  supersededResultId: string;
  resultCode: string;
  disposition: SafetyDisposition;
  dispositionMapped: boolean;
  recallOpened: boolean;
  recallCaseId: string | null;
  releasedComponentsAtCorrection: number;
  medicalReviewOpened: boolean;
}

export function getScreeningOrders(
  organizationId: string,
  params: { status?: ScreeningOrderStatus; donationId?: string } = {},
): Promise<ScreeningOrderSummary[]> {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.donationId) query.set('donationId', params.donationId);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return apiRequest(`/organizations/${organizationId}/screening/orders${suffix}`);
}

export function getScreeningOrder(
  organizationId: string,
  orderId: string,
): Promise<ScreeningOrderDetail> {
  return apiRequest(`/organizations/${organizationId}/screening/orders/${orderId}`);
}

export function collectSample(
  organizationId: string,
  donationId: string,
  body: { sampleType?: string; notes?: string; orderId?: string },
) {
  return apiRequest(`/organizations/${organizationId}/screening/donations/${donationId}/samples`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export interface RecordResultBody {
  requirementCode: string;
  resultCode: string;
  resultValue?: string;
  sampleId?: string;
  source?: 'MANUAL' | 'ANALYZER' | 'EXTERNAL_LAB';
  methodReference?: string;
  reagentReference?: string;
  reagentLot?: string;
  reagentExpiresAt?: string;
  analyzerReference?: string;
  performedAt?: string;
  comment?: string;
}

export function recordScreeningResult(
  organizationId: string,
  orderId: string,
  body: RecordResultBody,
): Promise<RecordedScreeningResult> {
  return apiRequest(`/organizations/${organizationId}/screening/orders/${orderId}/results`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function reviewScreeningResult(
  organizationId: string,
  resultId: string,
  body: { note?: string } = {},
) {
  return apiRequest(`/organizations/${organizationId}/screening/results/${resultId}/review`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function correctScreeningResult(
  organizationId: string,
  resultId: string,
  body: { resultCode: string; resultValue?: string; reason: string; comment?: string },
): Promise<CorrectedScreeningResult> {
  return apiRequest(`/organizations/${organizationId}/screening/results/${resultId}/correct`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

// --- medical review --------------------------------------------------------

export type DonorReviewResolution =
  | 'RETURNED_TO_ACTIVE'
  | 'TEMPORARY_DEFERRAL'
  | 'INDEFINITE_DEFERRAL'
  | 'REMAINS_UNDER_REVIEW';

export interface DonorReviewSummary {
  id: string;
  donorId: string;
  donorName: string;
  status: 'OPEN' | 'RESOLVED';
  sourceKind: string;
  triggerDisposition: SafetyDisposition;
  screeningOrderId: string | null;
  screeningOrderReference: string | null;
  raisedAt: string;
  systemRaised: boolean;
  resolvedAt: string | null;
  resolution: DonorReviewResolution | null;
}

export function getDonorReviews(
  organizationId: string,
  status: 'OPEN' | 'RESOLVED' = 'OPEN',
): Promise<DonorReviewSummary[]> {
  return apiRequest(`/organizations/${organizationId}/donor-reviews?status=${status}`);
}

export function resolveDonorReview(
  organizationId: string,
  triggerId: string,
  body: {
    resolution: DonorReviewResolution;
    note?: string;
    deferralReasonCode?: string;
    deferralEndsAt?: string;
    confidentialNote?: string;
  },
): Promise<{
  id: string;
  resolution: DonorReviewResolution;
  /** What the donor's status actually became, decided by the server. */
  resultingDonorStatus: string;
  deferralId: string | null;
}> {
  return apiRequest(`/organizations/${organizationId}/donor-reviews/${triggerId}/resolve`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

// --- recall ----------------------------------------------------------------

export type RecallCaseStatus = 'OPEN' | 'ACKNOWLEDGED' | 'CLOSED';

export interface RecallCaseSummary {
  id: string;
  recallReference: string;
  status: RecallCaseStatus;
  triggerKind: string;
  reasonCode: string | null;
  /** Safe for every affected organization to read: what they must do. */
  operationalReason: string | null;
  /**
   * Present only for the organization that opened the case. Absent as a key
   * otherwise, so a console cannot render "withheld" and tell a reader that
   * clinical detail exists.
   */
  confidentialDetail?: string | null;
  openedAt: string;
  closedAt: string | null;
  isOpener: boolean;
  myComponentCount: number;
  acknowledged: boolean;
}

export function getRecalls(
  organizationId: string,
  status?: RecallCaseStatus,
): Promise<RecallCaseSummary[]> {
  const suffix = status ? `?status=${status}` : '';
  return apiRequest(`/organizations/${organizationId}/recalls${suffix}`);
}

export function acknowledgeRecall(
  organizationId: string,
  recallCaseId: string,
  body: { responseNote?: string } = {},
) {
  return apiRequest(`/organizations/${organizationId}/recalls/${recallCaseId}/acknowledge`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
