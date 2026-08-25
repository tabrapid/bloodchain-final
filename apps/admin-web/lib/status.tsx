import { StatusBadge, type StatusVariant } from '@donor/ui/components';

export function StatusBadgeWrapper({ status }: { status: string }) {
  const variantMap: Record<string, StatusVariant> = {
    ACTIVE: 'success',
    PENDING_APPROVAL: 'warning',
    SUSPENDED: 'danger',
    DEACTIVATED: 'default',
    AVAILABLE: 'success',
    BUSY: 'warning',
    OFFLINE: 'default',
    COMPLETED: 'success',
    IN_TRANSIT: 'info',
    DELIVERED: 'success',
    FAILED: 'danger',
    CANCELLED: 'default',
    LOW_STOCK: 'warning',
    EXPIRING_SOON: 'warning',
    CRITICAL: 'danger',
    ROUTINE: 'default',
    URGENT: 'warning',
    PENDING: 'warning',
    REVIEWED: 'info',
    DISMISSED: 'default',
    ACTIONED: 'success',
    HIDDEN: 'warning',
    REMOVED: 'danger',
  };

  const variant = variantMap[status.toUpperCase()] || 'default';

  return <StatusBadge variant={variant}>{status.replace(/_/g, ' ')}</StatusBadge>;
}
