'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  Clock,
  Droplet,
  Truck,
  XCircle,
} from 'lucide-react';
import { Modal, StatusBadge } from '@bloodchain/ui/components';
import { me, isAuthenticated, MeResponse } from '../../../lib/auth';
import {
  getBloodRequest,
  approveBloodRequest,
  rejectBloodRequest,
  markReadyForPickup,
  createShipment,
  BloodRequest,
} from '../../../lib/shipments';
import type { InventoryReservation } from '../../../lib/inventory';
import { AppShell } from '../../../components/AppShell';
import { useTranslation } from '@bloodchain/ui/i18n';

/**
 * Badge colour per status. The wording is not here on purpose: a label
 * written into a module-level map is fixed in one language, so the words
 * come from `t('status.request.<STATUS>')` at render instead.
 */
const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'info' | 'default' | 'danger'> = {
  DRAFT: 'default',
  SUBMITTED: 'info',
  UNDER_REVIEW: 'info',
  APPROVED: 'success',
  PARTIALLY_APPROVED: 'warning',
  REJECTED: 'danger',
  CANCELLED: 'danger',
  READY_FOR_PICKUP: 'warning',
  IN_TRANSIT: 'info',
  DELIVERED: 'success',
  PARTIALLY_DELIVERED: 'warning',
};

export default function BloodRequestDetailPage() {
  const { t } = useTranslation();
  const params = useParams();
  const router = useRouter();
  const requestId = params.id as string;

  const [user, setUser] = useState<MeResponse | null>(null);
  const [organizationId, setOrganizationId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [request, setRequest] = useState<BloodRequest | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [reservations, setReservations] = useState<InventoryReservation[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);

  const [showReviewModal, setShowReviewModal] = useState(false);
  const [approvals, setApprovals] = useState<Record<string, number>>({});
  const [reviewNotes, setReviewNotes] = useState('');

  const loadRequest = useCallback(async () => {
    if (!organizationId || !requestId) return;
    try {
      const data = await getBloodRequest(organizationId, requestId);
      setRequest(data);
    } catch (err) {
      console.error('Failed to load blood request:', err);
    }
  }, [organizationId, requestId]);

  useEffect(() => {
    async function checkAuth() {
      try {
        if (isAuthenticated()) {
          const userData = await me();
          setUser(userData);
          const org = userData.organizations.find(
            (o) => o.type === 'BLOOD_CENTER' || o.type === 'BLOOD_CENTER_ADMIN'
          );
          if (org) {
            setOrganizationId(org.organizationId);
          } else if (userData.organizations.length > 0) {
            setOrganizationId(userData.organizations[0]?.organizationId || '');
          }
        }
      } catch (err) {
        console.error('Auth check failed:', err);
      } finally {
        setIsLoading(false);
      }
    }
    checkAuth();
  }, []);

  useEffect(() => {
    if (organizationId) loadRequest();
  }, [organizationId, loadRequest]);

  /**
   * The units this request is actually holding.
   *
   * Approving a request reserves inventory in the same transaction -- oldest
   * collected first -- and nothing in the console showed the result, so staff
   * approved units and then had to go to the inventory page and read reasons
   * to find out which ones. The reservations carry the request reference,
   * which is what identifies them here.
   */
  const loadReservations = useCallback(async () => {
    if (!organizationId || !request) return;
    try {
      const { getReservations } = await import('../../../lib/inventory');
      const page = await getReservations(organizationId, { status: 'ACTIVE', limit: 100 });
      setReservations(
        page.data.filter((reservation) =>
          reservation.reason?.includes(request.requestReference),
        ),
      );
    } catch (err) {
      // A missing reservation list must not take the request page down with
      // it; the request itself is the point of this screen.
      console.error('Failed to load reservations for request:', err);
    }
  }, [organizationId, request]);

  useEffect(() => {
    if (request && ['APPROVED', 'PARTIALLY_APPROVED', 'READY_FOR_PICKUP'].includes(request.status)) {
      void loadReservations();
    }
  }, [request, loadReservations]);

  const openReviewModal = () => {
    if (!request) return;
    const defaults: Record<string, number> = {};
    request.items.forEach((item) => {
      defaults[item.id] = item.unitsRequested;
    });
    setApprovals(defaults);
    setReviewNotes('');
    setActionError(null);
    setShowReviewModal(true);
  };

  /**
   * Approve, or decline, on the route that means what it says.
   *
   * Declining used to be an approval of zero units on every item -- the server
   * inferred REJECTED from the totals, which meant the record said the request
   * had been reviewed and approved for nothing, with no reason attached and no
   * word to the hospital. Rejection is now its own route, and the reason is
   * required because it is what the hospital is shown.
   */
  const submitReview = async (mode: 'approve' | 'reject') => {
    if (!request || !organizationId) return;

    if (mode === 'reject' && !reviewNotes.trim()) {
      setActionError(t('ops.requests.rejectReasonRequired'));
      return;
    }

    setActionLoading(true);
    setActionError(null);
    try {
      if (mode === 'reject') {
        await rejectBloodRequest(organizationId, requestId, reviewNotes.trim());
      } else {
        const items = request.items.map((item) => ({
          itemId: item.id,
          unitsApproved: Math.max(0, approvals[item.id] ?? 0),
        }));
        await approveBloodRequest(organizationId, requestId, {
          items,
          notes: reviewNotes.trim() || undefined,
        });
      }
      setShowReviewModal(false);
      await loadRequest();
    } catch (err) {
      console.error('Failed to review blood request:', err);
      setActionError(err instanceof Error ? err.message : t('ops.laboratory.submitReviewFailed'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkReady = async () => {
    if (!organizationId || !requestId) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await markReadyForPickup(organizationId, requestId);
      await loadRequest();
    } catch (err) {
      console.error('Failed to mark ready for pickup:', err);
      setActionError(err instanceof Error ? err.message : t('ops.shipments.markReadyFailed'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateShipment = async () => {
    if (!organizationId || !requestId) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const shipment = await createShipment(organizationId, requestId);
      router.push(`/shipments/${shipment.id}`);
    } catch (err) {
      console.error('Failed to create shipment:', err);
      setActionError(err instanceof Error ? err.message : t('ops.shipments.createFailed'));
      setActionLoading(false);
    }
  };

  if (isLoading) {
    return (
      <AppShell
        title={t('ops.common.loadingEllipsis')}
        subtitle={t('portal.bloodCenter.console')}
        organizationName="RedCross Blood Center (Development)"
        organizationType="Blood Center workspace"
        userName={t('ops.common.loadingEllipsis')}
      >
        <div className="flex items-center justify-center p-12">
          <Droplet className="animate-spin text-donor-primary" size={32} />
        </div>
      </AppShell>
    );
  }

  if (!user || !request) {
    return (
      <AppShell
        title={t('ops.requests.notFound')}
        subtitle={t('portal.bloodCenter.console')}
        organizationName="RedCross Blood Center (Development)"
        organizationType="Blood Center workspace"
        userName={user ? `${user.firstName} ${user.lastName}` : 'Guest'}
      >
        <div className="flex flex-col items-center justify-center bc-glass rounded-card p-12">
          <XCircle className="mb-4 text-donor-primary" size={48} />
          <h2 className="mb-2 font-display text-2xl font-semibold text-donor-text">
            {t('ops.requests.notFound')}
          </h2>
          <button
            onClick={() => router.push('/requests')}
            className="mt-4 rounded-lg bg-donor-primary px-4 py-2 font-semibold text-white"
          >
            {t('ops.common.backToRequests')}
          </button>
        </div>
      </AppShell>
    );
  }

  const statusVariant = STATUS_VARIANT[request.status] ?? 'default';
  const totalRequested = request.items.reduce((sum, i) => sum + i.unitsRequested, 0);
  const totalApproved = request.items.reduce((sum, i) => sum + i.unitsApproved, 0);

  const canReview = ['SUBMITTED', 'UNDER_REVIEW'].includes(request.status);
  const canMarkReady =
    ['APPROVED', 'PARTIALLY_APPROVED'].includes(request.status) && totalApproved > 0;
  const canCreateShipment = request.status === 'READY_FOR_PICKUP' && !request.shipment;

  return (
    <AppShell
      title={request.requestReference}
      subtitle={t('ops.requests.detailsTitle')}
      organizationName="RedCross Blood Center (Development)"
      organizationType="Blood Center Console"
      userName={`${user.firstName} ${user.lastName}`}
    >
      <button
        onClick={() => router.push('/requests')}
        className="mb-4 flex items-center gap-2 text-sm text-donor-muted hover:text-donor-text"
      >
        <ArrowLeft size={16} />
        {t('ops.common.backToRequests')}
      </button>

      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl font-semibold text-donor-text">
              {request.requestReference}
            </h1>
            <StatusBadge variant={statusVariant}>{t(`status.request.${request.status}`)}</StatusBadge>
          </div>
          <p className="mt-1 text-sm text-donor-muted">
            From {request.requestingOrganization.name} — {new Date(request.createdAt).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {request.shipment && (
            <a
              href={`/shipments/${request.shipment.id}`}
              className="flex items-center gap-2 rounded-lg border border-donor-border px-4 py-2 text-sm font-semibold text-donor-text transition-colors hover:bg-donor-elevated"
            >
              <Truck size={16} />
              {t('ops.common.viewShipment')}
            </a>
          )}
          {canReview && (
            <button
              onClick={openReviewModal}
              className="flex items-center gap-2 rounded-lg bg-donor-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-donor-primary/80"
            >
              <CheckCircle size={16} />
              {t('ops.requests.reviewRequest')}
            </button>
          )}
          {canMarkReady && (
            <button
              onClick={handleMarkReady}
              disabled={actionLoading}
              className="flex items-center gap-2 rounded-lg bg-donor-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-donor-primary/80 disabled:opacity-50"
            >
              <CheckCircle size={16} />
              {actionLoading ? 'Working...' : 'Mark Ready for Pickup'}
            </button>
          )}
          {canCreateShipment && (
            <button
              onClick={handleCreateShipment}
              disabled={actionLoading}
              className="flex items-center gap-2 rounded-lg bg-donor-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-donor-primary/80 disabled:opacity-50"
            >
              <Truck size={16} />
              {actionLoading ? 'Creating...' : 'Create Shipment'}
            </button>
          )}
        </div>
      </div>

      {actionError && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-donor-danger/30 bg-donor-dangerMuted px-4 py-3 text-sm text-donor-onDangerMuted">
          <AlertCircle size={16} />
          {actionError}
        </div>
      )}

      {request.rejectionReason && (
        <div className="mb-6 rounded-card border border-donor-danger/40 bg-donor-dangerMuted p-5">
          <div className="flex items-start gap-3">
            <XCircle size={18} className="mt-0.5 shrink-0 text-donor-onDangerMuted" />
            <div>
              <p className="text-sm font-semibold text-donor-onDangerMuted">
                {t('ops.requests.rejected')}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-donor-text">
                {request.rejectionReason}
              </p>
              {request.rejectedAt && (
                <p className="mt-2 text-xs text-donor-muted">
                  {new Date(request.rejectedAt).toLocaleString()}
                  {request.fulfillingOrganization
                    ? ` \u00b7 ${request.fulfillingOrganization.name}`
                    : ''}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="bc-glass rounded-card p-5">
            <h3 className="mb-4 text-sm font-semibold text-donor-text">{t('ops.requests.requestedUnits')}</h3>
            <div className="space-y-3">
              {request.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-lg border border-donor-border/60 px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <Droplet size={18} className="text-donor-primary" />
                    <span className="text-sm font-medium text-donor-text">
                      {item.bloodType}
                      {item.rhFactor === 'POSITIVE' ? '+' : item.rhFactor === 'NEGATIVE' ? '-' : ''}
                      {' '}
                      {item.componentType.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <span className="text-donor-muted">{t('ops.requests.requestedLabel')} <span className="text-donor-text">{item.unitsRequested}</span></span>
                    <span className="text-donor-muted">{t('ops.requests.approvedLabel')} <span className="text-donor-text">{item.unitsApproved}</span></span>
                    <span className="text-donor-muted">{t('ops.requests.fulfilledLabel')} <span className="text-donor-text">{item.unitsFulfilled}</span></span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end gap-6 text-sm text-donor-muted">
              <span>{t('ops.requests.totalRequested')} <span className="font-semibold text-donor-text">{totalRequested}</span></span>
              <span>{t('ops.requests.totalApproved')} <span className="font-semibold text-donor-text">{totalApproved}</span></span>
            </div>
          </div>

          {reservations.length > 0 && (
            <div className="bc-glass rounded-card p-5">
              <h3 className="mb-4 text-sm font-semibold text-donor-text">
                {t('ops.requests.reservedUnits')}
              </h3>
              <div className="space-y-2">
                {reservations.map((reservation) => (
                  <div
                    key={reservation.id}
                    className="flex items-center justify-between rounded-lg border border-donor-border/60 px-4 py-2.5 text-sm"
                  >
                    <span className="font-mono text-xs text-donor-text">
                      {reservation.bloodUnit?.unitReference ?? reservation.bloodUnitId}
                    </span>
                    <span className="text-donor-text">
                      {reservation.bloodUnit
                        ? `${reservation.bloodUnit.bloodType}${
                            reservation.bloodUnit.rhFactor === 'POSITIVE' ? '+' : '-'
                          } \u00b7 ${reservation.bloodUnit.volumeMl} ml`
                        : ''}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-donor-muted">
                {t('ops.requests.reservedUnitsHint')}
              </p>
            </div>
          )}

          {request.events && request.events.length > 0 && (
            <div className="bc-glass rounded-card p-5">
              <h3 className="mb-4 text-sm font-semibold text-donor-text">{t('healthTrends.history')}</h3>
              <div className="space-y-4">
                {request.events.map((event) => (
                  <div key={event.id} className="flex items-start gap-3">
                    <div className="mt-1 h-2 w-2 rounded-full bg-donor-primary" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-donor-text">{event.eventType.replace(/_/g, ' ')}</p>
                        <span className="text-xs text-donor-muted">
                          {new Date(event.createdAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bc-glass rounded-card p-5">
            <h3 className="mb-4 text-sm font-semibold text-donor-text">{t('table.details')}</h3>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-donor-muted">{t('ops.requests.requestingHospital')}</p>
                <p className="text-donor-text">{request.requestingOrganization.name}</p>
              </div>
              <div>
                <p className="text-xs text-donor-muted">{t('table.priority')}</p>
                <p className="text-donor-text">{request.priority}</p>
              </div>
              {request.expectedDeliveryDate && (
                <div>
                  <p className="text-xs text-donor-muted">{t('ops.requests.neededBy')}</p>
                  <p className="text-donor-text">{new Date(request.expectedDeliveryDate).toLocaleDateString()}</p>
                </div>
              )}
              {request.deliveryAddress && (
                <div>
                  <p className="text-xs text-donor-muted">{t('ops.requests.deliveryAddress')}</p>
                  <p className="text-donor-text">{request.deliveryAddress}</p>
                </div>
              )}
              {request.deliveryPhone && (
                <div>
                  <p className="text-xs text-donor-muted">{t('ops.requests.deliveryPhone')}</p>
                  <p className="text-donor-text">{request.deliveryPhone}</p>
                </div>
              )}
              {request.notes && (
                <div>
                  <p className="text-xs text-donor-muted">{t('table.notes')}</p>
                  <p className="whitespace-pre-wrap text-donor-text">{request.notes}</p>
                </div>
              )}
              <div className="flex items-center gap-2 pt-2 text-xs text-donor-muted">
                <Clock size={12} />
                Submitted {new Date(request.createdAt).toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Modal
        open={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        title={t('ops.requests.reviewRequest')}
        description={t('ops.requests.reviewHint')}
      >
        <div className="max-h-64 space-y-3 overflow-y-auto pr-1">
          {request.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-4 rounded-lg border border-donor-border/60 px-3 py-2">
              <span className="text-sm text-donor-text">
                {item.bloodType}
                {item.rhFactor === 'POSITIVE' ? '+' : item.rhFactor === 'NEGATIVE' ? '-' : ''}
                {' '}
                {item.componentType.replace('_', ' ')}
                <span className="ml-2 text-xs text-donor-muted">requested {item.unitsRequested}</span>
              </span>
              <input
                type="number"
                min={0}
                max={item.unitsRequested}
                value={approvals[item.id] ?? 0}
                onChange={(e) =>
                  setApprovals((prev) => ({
                    ...prev,
                    [item.id]: Math.max(0, Math.min(item.unitsRequested, Number(e.target.value) || 0)),
                  }))
                }
                className="w-20 rounded-lg border border-donor-border bc-solid px-2 py-1 text-sm text-donor-text"
              />
            </div>
          ))}
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-xs text-donor-muted">
            {t('ops.requests.reviewNotesLabel')}
          </label>
          <textarea
            value={reviewNotes}
            onChange={(e) => setReviewNotes(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-donor-border bc-solid px-3 py-2 text-sm text-donor-text"
          />
        </div>

        {actionError && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-donor-danger/30 bg-donor-dangerMuted px-3 py-2 text-xs text-donor-onDangerMuted">
            <AlertCircle size={14} />
            {actionError}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-3">
          <button
            onClick={() => setShowReviewModal(false)}
            disabled={actionLoading}
            className="rounded-lg border border-donor-border px-4 py-2 text-sm text-donor-text disabled:opacity-50"
          >
            {t('actions.cancel')}
          </button>
          <button
            onClick={() => submitReview('reject')}
            disabled={actionLoading}
            className="rounded-lg border border-donor-danger/50 bg-donor-dangerMuted px-4 py-2 text-sm font-semibold text-donor-onDangerMuted transition-colors hover:bg-donor-dangerMuted/70 disabled:opacity-50"
          >
            {t('actions.reject')}
          </button>
          <button
            onClick={() => submitReview('approve')}
            disabled={actionLoading}
            className="rounded-lg bg-donor-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {actionLoading ? 'Submitting...' : 'Approve'}
          </button>
        </div>
      </Modal>
    </AppShell>
  );
}
