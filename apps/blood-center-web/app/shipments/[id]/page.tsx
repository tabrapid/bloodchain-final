'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  RefreshCw,
  Truck,
  Users,
  XCircle,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import {
  Modal,
  StatusBadge,
} from '@bloodchain/ui/components';
import type { MapMarker } from '@bloodchain/ui/map';
import { me, isAuthenticated, MeResponse } from '../../../lib/auth';
import {
  getShipment,
  getShipmentTimeline,
  getShipmentTracking,
  getAvailableCouriers,
  assignCourier,
  cancelShipment,
  reassignShipment,
  Shipment,
} from '../../../lib/shipments';

const LocationMap = dynamic(() => import('@bloodchain/ui/map').then((mod) => mod.LocationMap), {
  ssr: false,
});

type TrackingInfo = Awaited<ReturnType<typeof getShipmentTracking>>;
import { useShipmentTracking } from '../../../lib/useShipmentTracking';
import { AppShell } from '../../../components/AppShell';
import { useTranslation } from '@bloodchain/ui/i18n';

/**
 * Badge colour per status. The wording is not here on purpose: a label
 * written into a module-level map is fixed in one language, so the words
 * come from `t('status.shipment.<STATUS>')` at render instead.
 */
const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'info' | 'default' | 'danger'> = {
  CREATED: 'default',
  COURIER_ASSIGNED: 'info',
  COURIER_ACCEPTED: 'info',
  COURIER_DECLINED: 'warning',
  PICKUP_STARTED: 'warning',
  PICKED_UP: 'warning',
  IN_TRANSIT: 'info',
  ARRIVED_AT_HOSPITAL: 'info',
  DELIVERED: 'success',
  FAILED: 'danger',
  CANCELLED: 'danger',
};

interface TimelineEvent {
  id: string;
  type: string;
  timestamp: string;
  actor: string;
  organization?: string;
  metadata?: Record<string, unknown>;
}

export default function ShipmentDetailPage() {
  const { t } = useTranslation();
  const params = useParams();
  const router = useRouter();
  const shipmentId = params.id as string;

  const [user, setUser] = useState<MeResponse | null>(null);
  const [organizationId, setOrganizationId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [tracking, setTracking] = useState<TrackingInfo | null>(null);
  const [availableCouriers, setAvailableCouriers] = useState<any[]>([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [selectedCourierId, setSelectedCourierId] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const { courierLocation, statusUpdate, connected } = useShipmentTracking(shipmentId || null);

  const loadShipment = useCallback(async () => {
    if (!organizationId || !shipmentId) return;
    try {
      const [shipmentData, timelineData, trackingData] = await Promise.all([
        getShipment(organizationId, shipmentId),
        getShipmentTimeline(shipmentId),
        getShipmentTracking(shipmentId).catch(() => null),
      ]);
      setShipment(shipmentData);
      setTimeline(timelineData.timeline);
      setTracking(trackingData);
    } catch (err) {
      console.error('Failed to load shipment:', err);
    }
  }, [organizationId, shipmentId]);

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
    if (organizationId) {
      loadShipment();
      loadAvailableCouriers();
    }
  }, [organizationId, loadShipment]);

  useEffect(() => {
    if (statusUpdate) {
      loadShipment();
    }
  }, [statusUpdate, loadShipment]);

  const loadAvailableCouriers = async () => {
    if (!organizationId) return;
    try {
      const couriers = await getAvailableCouriers(organizationId);
      setAvailableCouriers(couriers);
    } catch (err) {
      console.error('Failed to load couriers:', err);
    }
  };

  const handleAssignCourier = async () => {
    if (!organizationId || !shipmentId || !selectedCourierId) return;
    setActionLoading(true);
    try {
      // A shipment that already had a courier (FAILED -- the courier
      // reported a problem and was released back to AVAILABLE) needs
      // reassignCourier, which records the retry against the shipment's
      // history (previousCourierId, a REASSIGNED event); assignCourier is
      // for a shipment that has never had one (CREATED / COURIER_DECLINED).
      if (shipment?.status === 'FAILED') {
        await reassignShipment(organizationId, shipmentId, selectedCourierId);
      } else {
        await assignCourier(organizationId, shipmentId, selectedCourierId);
      }
      setShowAssignModal(false);
      setSelectedCourierId('');
      await loadShipment();
    } catch (err) {
      console.error('Failed to assign courier:', err);
      alert('Failed to assign courier');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelShipment = async () => {
    if (!organizationId || !shipmentId) return;
    setActionLoading(true);
    try {
      await cancelShipment(organizationId, shipmentId, cancelReason);
      setShowCancelModal(false);
      setCancelReason('');
      await loadShipment();
    } catch (err) {
      console.error('Failed to cancel shipment:', err);
      alert('Failed to cancel shipment');
    } finally {
      setActionLoading(false);
    }
  };

  // FAILED is a real, reachable state (a courier reports a problem mid-delivery
  // via the mobile app's "Report a Problem" flow) and the backend explicitly
  // allows retrying it with a new courier -- ShipmentStateMachine's transition
  // map lists FAILED alongside CREATED/COURIER_DECLINED as valid sources for
  // COURIER_ASSIGNED. Without this, a failed delivery had no recovery path in
  // this UI at all except cancelling it outright.
  const canAssignCourier =
    shipment?.status === 'CREATED' ||
    shipment?.status === 'COURIER_DECLINED' ||
    shipment?.status === 'FAILED';
  const canCancel = shipment && !['DELIVERED', 'CANCELLED'].includes(shipment.status);

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
          <Truck className="animate-spin text-donor-primary" size={32} />
        </div>
      </AppShell>
    );
  }

  if (!user || !shipment) {
    return (
      <AppShell
        title={t('ops.shipments.notFound')}
        subtitle={t('portal.bloodCenter.console')}
        organizationName="RedCross Blood Center (Development)"
        organizationType="Blood Center workspace"
        userName={user ? `${user.firstName} ${user.lastName}` : 'Guest'}
      >
        <div className="flex flex-col items-center justify-center bc-glass rounded-card p-12">
          <XCircle className="mb-4 text-donor-primary" size={48} />
          <h2 className="mb-2 font-display text-2xl font-semibold text-donor-text">
            {t('ops.shipments.notFound')}
          </h2>
          <button
            onClick={() => router.push('/shipments')}
            className="mt-4 rounded-lg bg-donor-primary px-4 py-2 font-semibold text-white"
          >
            {t('ops.common.backToShipments')}
          </button>
        </div>
      </AppShell>
    );
  }

  const statusVariant = STATUS_VARIANT[shipment.status] ?? 'default';

  return (
    <AppShell
      title={shipment.shipmentReference}
      subtitle={t('ops.shipments.details')}
      organizationName="RedCross Blood Center (Development)"
      organizationType="Blood Center Console"
      userName={`${user.firstName} ${user.lastName}`}
    >
      <div className="mb-6">
        <button
          onClick={() => router.push('/shipments')}
          className="mb-4 flex items-center gap-2 text-sm text-donor-muted hover:text-donor-text"
        >
          <ArrowLeft size={16} />
          {t('ops.common.backToShipments')}
        </button>

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-display text-2xl font-semibold text-donor-text">
                {shipment.shipmentReference}
              </h1>
              <StatusBadge variant={statusVariant}>{t(`status.shipment.${shipment.status}`)}</StatusBadge>
            </div>
            <p className="mt-1 text-sm text-donor-muted">
              Created {new Date(shipment.createdAt).toLocaleString()}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => loadShipment()}
              className="flex items-center gap-2 rounded-lg bc-solid px-3 py-2 text-sm text-donor-text transition-colors hover:bg-donor-elevated"
            >
              <RefreshCw size={14} />
              {t('actions.refresh')}
            </button>
            {canAssignCourier && (
              <button
                onClick={() => setShowAssignModal(true)}
                className="flex items-center gap-2 rounded-lg bg-donor-primary px-4 py-2 font-semibold text-white transition-colors hover:bg-donor-primary/80"
              >
                <Users size={16} />
                {shipment?.status === 'FAILED'
                  ? t('ops.shipments.reassignCourier')
                  : t('ops.shipments.assignCourier')}
              </button>
            )}
            {canCancel && (
              <button
                onClick={() => setShowCancelModal(true)}
                className="flex items-center gap-2 rounded-lg border border-donor-danger/50 bg-donor-dangerMuted px-4 py-2 font-semibold text-donor-onDangerMuted transition-colors hover:bg-donor-dangerMuted/70"
              >
                <XCircle size={16} />
                {t('actions.cancel')}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="bc-glass rounded-card p-5">
            <h3 className="mb-4 text-sm font-semibold text-donor-text">{t('ops.shipments.information')}</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs text-donor-muted">{t('table.units')}</p>
                <p className="text-lg font-semibold text-donor-text">{shipment.units?.length || 0}</p>
              </div>
              {shipment.courier && (
                <>
                  <div>
                    <p className="text-xs text-donor-muted">{t('table.courier')}</p>
                    <p className="text-lg font-semibold text-donor-text">{shipment.courier.displayName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-donor-muted">{t('ops.shipments.courierPhone')}</p>
                    <p className="text-lg font-semibold text-donor-text">{shipment.courier.phone || 'N/A'}</p>
                  </div>
                </>
              )}
              {shipment.pickupAddress && (
                <div>
                  <p className="text-xs text-donor-muted">{t('ops.shipments.pickupAddress')}</p>
                  <p className="text-sm text-donor-text">{shipment.pickupAddress}</p>
                </div>
              )}
              {shipment.destinationAddress && (
                <div>
                  <p className="text-xs text-donor-muted">{t('ops.shipments.destination')}</p>
                  <p className="text-sm text-donor-text">{shipment.destinationAddress}</p>
                </div>
              )}
            </div>
          </div>

          {tracking && (tracking.currentLocation || courierLocation || tracking.source.coordinates || tracking.destination.coordinates) && (
            <div className="bc-glass rounded-card p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-donor-text">{t('ops.shipments.liveMap')}</h3>
                <span className={`flex items-center gap-1.5 text-xs ${connected ? 'text-donor-success' : 'text-donor-muted'}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-donor-success' : 'bg-donor-muted'}`} />
                  {connected ? t('ops.common.live') : t('ops.common.offline')}
                </span>
              </div>
              {tracking.eta && (
                <p className="mb-4 text-sm text-donor-muted">
                  ETA{' '}
                  <span className="font-semibold text-donor-text">
                    {tracking.eta.etaMinutes < 60
                      ? `${tracking.eta.etaMinutes} min`
                      : `${Math.round(tracking.eta.etaMinutes / 60)} hr ${tracking.eta.etaMinutes % 60} min`}
                  </span>
                  {' · '}
                  {tracking.eta.distanceKm} km away
                </p>
              )}
              <LocationMap
                showRoute
                markers={(
                  [
                    tracking.source.coordinates
                      ? {
                          id: 'source',
                          variant: 'origin',
                          label: tracking.source.name,
                          sublabel: t('ops.shipments.pickupLocation'),
                          ...tracking.source.coordinates,
                        }
                      : null,
                    courierLocation
                      ? {
                          id: 'courier',
                          variant: 'courier',
                          label: tracking.courier?.name ?? t('table.courier'),
                          sublabel: `Updated ${new Date(courierLocation.recordedAt).toLocaleTimeString()}`,
                          latitude: courierLocation.latitude,
                          longitude: courierLocation.longitude,
                        }
                      : tracking.currentLocation
                        ? {
                            id: 'courier',
                            variant: 'courier',
                            label: tracking.courier?.name ?? t('table.courier'),
                            sublabel: `Updated ${new Date(tracking.currentLocation.recordedAt).toLocaleTimeString()}`,
                            ...tracking.currentLocation,
                          }
                        : null,
                    tracking.destination.coordinates
                      ? {
                          id: 'destination',
                          variant: 'destination',
                          label: tracking.destination.name,
                          sublabel: t('ops.shipments.deliveryDestination'),
                          ...tracking.destination.coordinates,
                        }
                      : null,
                  ] as (MapMarker | null)[]
                ).filter((m): m is MapMarker => m !== null)}
              />
            </div>
          )}

          <div className="bc-glass rounded-card p-5">
            <h3 className="mb-4 text-sm font-semibold text-donor-text">{t('ops.shipments.timeline')}</h3>
            {timeline.length === 0 ? (
              <p className="text-sm text-donor-muted">{t('ops.shipments.noEvents')}</p>
            ) : (
              <div className="space-y-4">
                {timeline.map((event) => (
                  <div key={event.id} className="flex items-start gap-3">
                    <div className="mt-1 h-2 w-2 rounded-full bg-donor-primary" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-donor-text">{t(`status.shipmentEvent.${event.type}`)}</p>
                        <span className="text-xs text-donor-muted">
                          {new Date(event.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs text-donor-muted">
                        {event.actor} {event.organization && `(${event.organization})`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bc-glass rounded-card p-5">
            <h3 className="mb-4 text-sm font-semibold text-donor-text">{t('ops.shipments.statusTimeline')}</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-donor-muted">{t('table.created')}</span>
                <span className="text-donor-text">
                  {shipment.createdAt ? new Date(shipment.createdAt).toLocaleString() : '-'}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-donor-muted">{t('ops.common.assigned')}</span>
                <span className="text-donor-text">
                  {shipment.assignedAt ? new Date(shipment.assignedAt).toLocaleString() : '-'}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-donor-muted">{t('status.shipment.COURIER_ACCEPTED')}</span>
                <span className="text-donor-text">
                  {shipment.acceptedAt ? new Date(shipment.acceptedAt).toLocaleString() : '-'}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-donor-muted">{t('status.shipment.PICKED_UP')}</span>
                <span className="text-donor-text">
                  {shipment.pickedUpAt ? new Date(shipment.pickedUpAt).toLocaleString() : '-'}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-donor-muted">{t('status.shipment.IN_TRANSIT')}</span>
                <span className="text-donor-text">
                  {shipment.inTransitAt ? new Date(shipment.inTransitAt).toLocaleString() : '-'}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-donor-muted">{t('status.shipment.ARRIVED_AT_HOSPITAL')}</span>
                <span className="text-donor-text">
                  {shipment.arrivedAt ? new Date(shipment.arrivedAt).toLocaleString() : '-'}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-donor-muted">{t('status.shipment.DELIVERED')}</span>
                <span className="text-donor-text">
                  {shipment.deliveredAt ? new Date(shipment.deliveredAt).toLocaleString() : '-'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Modal
        open={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        title={
          shipment?.status === 'FAILED'
            ? t('ops.shipments.reassignCourier')
            : t('ops.shipments.assignCourier')
        }
      >
        <div className="mb-4">
          <label className="mb-2 block text-sm text-donor-muted">{t('ops.shipments.selectCourier')}</label>
          <select
            value={selectedCourierId}
            onChange={(e) => setSelectedCourierId(e.target.value)}
            className="w-full rounded-lg border border-donor-border bc-solid px-3 py-2 text-donor-text"
          >
            <option value="">{t('ops.shipments.chooseCourier')}</option>
            {availableCouriers.map((courier) => (
              <option key={courier.id} value={courier.id}>
                {courier.displayName} - {courier.activeShipments} active shipments
              </option>
            ))}
          </select>
        </div>
        <div className="flex justify-end gap-3">
          <button
            onClick={() => setShowAssignModal(false)}
            className="rounded-lg border border-donor-border px-4 py-2 text-donor-text"
          >
            {t('actions.cancel')}
          </button>
          <button
            onClick={handleAssignCourier}
            disabled={!selectedCourierId || actionLoading}
            className="rounded-lg bg-donor-primary px-4 py-2 font-semibold text-white disabled:opacity-50"
          >
            {actionLoading
              ? shipment?.status === 'FAILED'
                ? t('ops.common.reassigning')
                : t('ops.common.assigning')
              : shipment?.status === 'FAILED'
                ? t('actions.assign')
                : t('actions.assign')}
          </button>
        </div>
      </Modal>

      <Modal
        open={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        title={t('ops.shipments.cancelShipment')}
      >
        <div className="mb-4">
          <label className="mb-2 block text-sm text-donor-muted">{t('ops.common.reasonOptional')}</label>
          <textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            className="w-full rounded-lg border border-donor-border bc-solid px-3 py-2 text-donor-text"
            rows={3}
          />
        </div>
        <div className="flex justify-end gap-3">
          <button
            onClick={() => setShowCancelModal(false)}
            className="rounded-lg border border-donor-border px-4 py-2 text-donor-text"
          >
            {t('actions.back')}
          </button>
          <button
            onClick={handleCancelShipment}
            className="rounded-lg bg-donor-danger px-4 py-2 font-semibold text-white"
          >
            {t('ops.shipments.cancelShipment')}
          </button>
        </div>
      </Modal>
    </AppShell>
  );
}
