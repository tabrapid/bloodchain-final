'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle,
  RefreshCw,
  Truck,
  XCircle,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import {
  Modal,
  StatusBadge,
} from '@bloodchain/ui/components';
import type { MapMarker } from '@bloodchain/ui/map';

const LocationMap = dynamic(() => import('@bloodchain/ui/map').then((mod) => mod.LocationMap), {
  ssr: false,
});
import { me, isAuthenticated, MeResponse } from '../../../lib/auth';
import {
  getShipment,
  getShipmentTracking,
  getShipmentTimeline,
  confirmDelivery,
  Shipment,
  TrackingInfo,
  TimelineEvent,
} from '../../../lib/shipments';
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
  ARRIVED_AT_HOSPITAL: 'success',
  DELIVERED: 'success',
  FAILED: 'danger',
  CANCELLED: 'danger',
};

export default function ShipmentDetailPage() {
  const { t } = useTranslation();
  const params = useParams();
  const router = useRouter();
  const shipmentId = params.id as string;

  const [user, setUser] = useState<MeResponse | null>(null);
  const [organizationId, setOrganizationId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [tracking, setTracking] = useState<TrackingInfo | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [unitsReceived, setUnitsReceived] = useState<number>(0);
  const [deliveryCondition, setDeliveryCondition] = useState<string>('GOOD');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [discrepancyReason, setDiscrepancyReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const { courierLocation, statusUpdate, connected } = useShipmentTracking(shipmentId || null);

  const loadShipment = useCallback(async () => {
    if (!organizationId || !shipmentId) return;
    try {
      const [shipmentData, trackingData, timelineData] = await Promise.all([
        getShipment(organizationId, shipmentId),
        getShipmentTracking(shipmentId),
        getShipmentTimeline(shipmentId),
      ]);
      setShipment(shipmentData);
      setTracking(trackingData);
      setTimeline(timelineData.timeline);
      setUnitsReceived(shipmentData.units?.length || 0);
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
          const hospitalOrg = userData.organizations.find(
            (org) => org.type === 'HOSPITAL'
          );
          if (hospitalOrg) {
            setOrganizationId(hospitalOrg.organizationId);
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
    }
  }, [organizationId, loadShipment]);

  useEffect(() => {
    if (statusUpdate) {
      loadShipment();
    }
  }, [statusUpdate, loadShipment]);

  const handleConfirmDelivery = async () => {
    if (!organizationId || !shipmentId) return;
    const totalUnits = shipment?.units?.length || 0;
    const hasDiscrepancy = unitsReceived < totalUnits;

    if (hasDiscrepancy && !discrepancyReason) {
      alert('Please provide a reason for the discrepancy');
      return;
    }

    setActionLoading(true);
    try {
      await confirmDelivery(organizationId, shipmentId, {
        unitsReceived,
        condition: deliveryCondition,
        notes: deliveryNotes,
        discrepancyReason: hasDiscrepancy ? discrepancyReason : undefined,
      });
      setShowDeliveryModal(false);
      await loadShipment();
    } catch (err) {
      console.error('Failed to confirm delivery:', err);
      alert('Failed to confirm delivery');
    } finally {
      setActionLoading(false);
    }
  };

  const canConfirmDelivery = shipment?.status === 'ARRIVED_AT_HOSPITAL';

  if (isLoading) {
    return (
      <AppShell
        title={t('ops.common.loadingEllipsis')}
        subtitle={t('portal.hospital.console')}
        organizationName="Hospital Console"
        organizationType="Hospital workspace"
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
        subtitle={t('portal.hospital.console')}
        organizationName={user?.organizations.find((org) => org.type === 'HOSPITAL')?.name ?? 'Hospital Console'}
        organizationType="Hospital workspace"
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
  const totalUnits = shipment.units?.length || 0;

  return (
    <AppShell
      title={shipment.shipmentReference}
      subtitle={t('ops.shipments.trackingTitle')}
      organizationName={user.organizations.find((org) => org.type === 'HOSPITAL')?.name ?? 'Hospital Console'}
      organizationType="Hospital Console"
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
              {totalUnits} units
              {shipment.courier && <> • Courier: {shipment.courier.displayName}</>}
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
            {canConfirmDelivery && (
              <button
                onClick={() => setShowDeliveryModal(true)}
                className="flex items-center gap-2 rounded-lg bg-donor-success px-4 py-2 font-semibold text-white transition-colors hover:bg-donor-success/85"
              >
                <CheckCircle size={16} />
                {t('ops.shipments.confirmDelivery')}
              </button>
            )}
          </div>
        </div>
      </div>

      {shipment.status === 'ARRIVED_AT_HOSPITAL' && (
        <div className="mb-6 rounded-xl border border-donor-success/30 bg-donor-successMuted p-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="text-donor-onSuccessMuted" size={24} />
            <div>
              <h3 className="font-semibold text-donor-onSuccessMuted">{t('ops.shipments.courierArrived')}</h3>
              <p className="text-sm text-donor-muted">
                {t('ops.couriers.arrivedNotice')}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {tracking?.eta && (
            <div className="bc-glass rounded-card p-5">
              <h3 className="mb-4 text-sm font-semibold text-donor-text">{t('ops.shipments.tracking')}</h3>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <p className="text-xs text-donor-muted">ETA</p>
                  <p className="text-lg font-semibold text-donor-text">
                    {tracking.eta.etaMinutes < 60
                      ? `${tracking.eta.etaMinutes} min`
                      : `${Math.round(tracking.eta.etaMinutes / 60)} hr ${tracking.eta.etaMinutes % 60} min`}
                  </p>
                  <p className="text-xs text-donor-muted">{tracking.eta.note}</p>
                </div>
                <div>
                  <p className="text-xs text-donor-muted">{t('ops.shipments.distance')}</p>
                  <p className="text-lg font-semibold text-donor-text">{tracking.eta.distanceKm} km</p>
                </div>
                <div>
                  <p className="text-xs text-donor-muted">{t('ops.shipments.lastUpdate')}</p>
                  <p className="text-lg font-semibold text-donor-text">
                    {tracking.lastUpdated ? new Date(tracking.lastUpdated).toLocaleTimeString() : '-'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {tracking && (tracking.currentLocation || courierLocation || tracking.source.coordinates || tracking.destination.coordinates) && (
            <div className="bc-glass rounded-card p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-donor-text">{t('ops.shipments.liveMap')}</h3>
                <span className={`flex items-center gap-1.5 text-xs ${connected ? 'text-donor-success' : 'text-donor-muted'}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-donor-success' : 'bg-donor-muted'}`} />
                  {connected ? 'Live' : 'Offline'}
                </span>
              </div>
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
                        <p className="text-sm font-medium text-donor-text">{event.type.replace(/_/g, ' ')}</p>
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
            <h3 className="mb-4 text-sm font-semibold text-donor-text">{t('ops.shipments.details')}</h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-donor-muted">{t('ops.shipments.unitsInShipment')}</p>
                <p className="text-lg font-semibold text-donor-text">{totalUnits}</p>
              </div>
              {shipment.courier && (
                <>
                  <div>
                    <p className="text-xs text-donor-muted">{t('table.courier')}</p>
                    <p className="text-lg font-semibold text-donor-text">{shipment.courier.displayName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-donor-muted">{t('ops.shipments.courierPhone')}</p>
                    <p className="text-sm text-donor-text">{shipment.courier.phone || 'N/A'}</p>
                  </div>
                </>
              )}
              {shipment.destinationAddress && (
                <div>
                  <p className="text-xs text-donor-muted">{t('ops.requests.deliveryAddress')}</p>
                  <p className="text-sm text-donor-text">{shipment.destinationAddress}</p>
                </div>
              )}
            </div>
          </div>

          <div className="bc-glass rounded-card p-5">
            <h3 className="mb-4 text-sm font-semibold text-donor-text">{t('ops.shipments.statusTimeline')}</h3>
            <div className="space-y-3">
              {[
                { label: t('table.created'), time: shipment.createdAt },
                { label: t('ops.common.assigned'), time: shipment.assignedAt },
                { label: t('status.shipment.COURIER_ACCEPTED'), time: shipment.acceptedAt },
                { label: t('status.shipment.PICKED_UP'), time: shipment.pickedUpAt },
                { label: t('status.shipment.IN_TRANSIT'), time: shipment.inTransitAt },
                { label: t('status.shipment.ARRIVED_AT_HOSPITAL'), time: shipment.arrivedAt },
                { label: t('status.shipment.DELIVERED'), time: shipment.deliveredAt },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between text-sm">
                  <span className={item.time ? 'text-donor-text' : 'text-donor-muted'}>{item.label}</span>
                  <span className={item.time ? 'text-donor-text' : 'text-donor-muted'}>
                    {item.time ? new Date(item.time).toLocaleString() : '-'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <Modal
        open={showDeliveryModal}
        onClose={() => setShowDeliveryModal(false)}
        title={t('ops.shipments.confirmDelivery')}
      >
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm text-donor-muted">{t('ops.shipments.unitsReceived')}</label>
            <input
              type="number"
              min={0}
              max={totalUnits}
              value={unitsReceived}
              onChange={(e) => setUnitsReceived(parseInt(e.target.value) || 0)}
              className="w-full rounded-lg border border-donor-border bc-solid px-3 py-2 text-donor-text"
            />
            <p className="mt-1 text-xs text-donor-muted">
              Total units shipped: {totalUnits}
            </p>
          </div>
          <div>
            <label className="mb-2 block text-sm text-donor-muted">{t('ops.shipments.condition')}</label>
            <select
              value={deliveryCondition}
              onChange={(e) => setDeliveryCondition(e.target.value)}
              className="w-full rounded-lg border border-donor-border bc-solid px-3 py-2 text-donor-text"
            >
              <option value="GOOD">{t('ops.shipments.conditionGood')}</option>
              <option value="DAMAGED">{t('ops.shipments.conditionDamaged')}</option>
              <option value="PARTIAL">{t('ops.shipments.conditionPartial')}</option>
              <option value="OTHER">{t('medical.components.OTHER')}</option>
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm text-donor-muted">Notes (optional)</label>
            <textarea
              value={deliveryNotes}
              onChange={(e) => setDeliveryNotes(e.target.value)}
              className="w-full rounded-lg border border-donor-border bc-solid px-3 py-2 text-donor-text"
              rows={2}
            />
          </div>
          {unitsReceived < totalUnits && (
            <div>
              <label className="mb-2 block text-sm text-donor-muted">
                Discrepancy Reason (required when units received &lt; units shipped)
              </label>
              <textarea
                value={discrepancyReason}
                onChange={(e) => setDiscrepancyReason(e.target.value)}
                className="w-full rounded-lg border border-donor-border bc-solid px-3 py-2 text-donor-text"
                rows={2}
                placeholder={t('ops.shipments.shortfallReason')}
              />
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setShowDeliveryModal(false)}
              className="rounded-lg border border-donor-border px-4 py-2 text-donor-text"
            >
              {t('actions.cancel')}
            </button>
            <button
              onClick={handleConfirmDelivery}
              disabled={actionLoading || unitsReceived < 0 || unitsReceived > totalUnits}
              className="rounded-lg bg-donor-success px-4 py-2 font-semibold text-white disabled:opacity-50"
            >
              {actionLoading ? 'Confirming...' : t('ops.shipments.confirmDelivery')}
            </button>
          </div>
        </div>
      </Modal>
    </AppShell>
  );
}
