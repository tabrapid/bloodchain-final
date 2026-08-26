import { ForbiddenException } from '@nestjs/common';
import { OrganizationStatus } from '@prisma/client';

/**
 * Throws unless the organization is ACTIVE. Every org-scoped mutation this
 * session found (shipments, blood requests, inventory, appointments,
 * emergencies) only ever checked role/membership, never whether the
 * organization itself is PENDING_APPROVAL/SUSPENDED/DEACTIVATED - so a
 * not-yet-approved or suspended org's staff could act on any endpoint a
 * direct API call could reach, bypassing the dashboard's client-side gate
 * entirely. Callers should skip this check for SUPER_ADMIN, who manages
 * organizations regardless of their status.
 */
export function assertOrganizationActive(organization: { status: OrganizationStatus } | null | undefined): void {
  if (!organization || organization.status !== OrganizationStatus.ACTIVE) {
    throw new ForbiddenException('This organization is not active.');
  }
}
