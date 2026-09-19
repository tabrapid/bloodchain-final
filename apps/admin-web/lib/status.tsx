'use client';

import { StatusBadge, type StatusVariant } from '@bloodchain/ui/components';
import { useTranslation } from '@bloodchain/ui/i18n';

/**
 * Which set of words a status belongs to.
 *
 * The badge used to take a bare string and render `status.replace(/_/g, ' ')`,
 * so every admin table showed `PENDING APPROVAL`, `COURIER ASSIGNED`,
 * `READY FOR PICKUP` -- database enums with the underscores knocked out, in
 * English, in all three languages. The domain is what turns the enum into a
 * word, and it has to be named at the call site because the same value means
 * different things in different tables: `ACTIVE` is a live emergency in one and
 * an approved organisation in another.
 */
export type StatusDomain =
  | 'alert'
  | 'courier'
  | 'emergency'
  | 'moderation'
  | 'organization'
  | 'request'
  | 'shipment'
  | 'user';

/**
 * One translator call per domain, written out rather than assembled from the
 * domain string. The i18n coverage test reads these sources and can only check
 * a key whose namespace is spelled out, so interpolating the domain into the
 * key would compile, render, and silently stop being verified.
 */
const LABEL: Record<StatusDomain, (t: (key: string) => string, status: string) => string> = {
  alert: (t, status) => t(`status.alert.${status}`),
  courier: (t, status) => t(`status.courier.${status}`),
  emergency: (t, status) => t(`status.emergency.${status}`),
  moderation: (t, status) => t(`status.moderation.${status}`),
  organization: (t, status) => t(`status.organization.${status}`),
  request: (t, status) => t(`status.request.${status}`),
  shipment: (t, status) => t(`status.shipment.${status}`),
  user: (t, status) => t(`status.user.${status}`),
};

const VARIANTS: Record<string, StatusVariant> = {
  ACTIVE: 'success',
  PENDING_APPROVAL: 'warning',
  SUSPENDED: 'danger',
  DEACTIVATED: 'default',
  PENDING_VERIFICATION: 'warning',
  AVAILABLE: 'success',
  BUSY: 'warning',
  OFFLINE: 'default',
  COMPLETED: 'success',
  IN_TRANSIT: 'info',
  DELIVERED: 'success',
  FAILED: 'danger',
  CANCELLED: 'default',
  EXPIRED: 'default',
  LOW_STOCK: 'warning',
  EXPIRING_SOON: 'warning',
  QUARANTINED: 'danger',
  CRITICAL: 'danger',
  ROUTINE: 'default',
  URGENT: 'warning',
  PENDING: 'warning',
  REVIEWED: 'info',
  DISMISSED: 'default',
  ACTIONED: 'success',
  HIDDEN: 'warning',
  REMOVED: 'danger',
  SUBMITTED: 'info',
  UNDER_REVIEW: 'info',
  APPROVED: 'success',
  PARTIALLY_APPROVED: 'warning',
  REJECTED: 'danger',
  READY_FOR_PICKUP: 'info',
  MATCHING: 'info',
  DONOR_CONFIRMED: 'success',
};

export function StatusBadgeWrapper({
  status,
  domain,
}: {
  status: string;
  domain: StatusDomain;
}) {
  const { t } = useTranslation();
  const variant = VARIANTS[status.toUpperCase()] ?? 'default';

  return <StatusBadge variant={variant}>{LABEL[domain](t, status)}</StatusBadge>;
}
