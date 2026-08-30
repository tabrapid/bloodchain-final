'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  Clock,
  MapPin,
  Package,
  RefreshCw,
  Settings,
  Truck,
  Users,
  XCircle,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import {
  EmptyState,
  StatCard,
  StatusBadge,
} from '@bloodchain/ui/components';
import type { MapMarker } from '@bloodchain/ui/map';
import { logout as logoutApi, me, isAuthenticated, MeResponse } from '../../../lib/auth';
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

const STATUS_CONFIG: Record<string, { label: string; variant: 'success' | 'warning' | 'info' | 'default' | 'danger' }> = {
  CREATED: { label: 'Created', variant: 'default' },
  COURIER_ASSIGNED: { label: 'Assigned', variant: 'info' },
  COURIER_ACCEPTED: { label: 'Accepted', variant: 'info' },
  COURIER_DECLINED: { label: 'Declined', variant: 'warning' },
  PICKUP_STARTED: { label: 'Pickup Started', variant: 'warning' },
  PICKED_UP: { label: 'Picked Up', variant: 'warning' },
  IN_TRANSIT: { label: 'In Transit', variant: 'info' },
  ARRIVED_AT_HOSPITAL: { label: 'Arrived', variant: 'info' },
  DELIVERED: { label: 'Delivered', variant: 'success' },
  FAILED: { label: 'Failed', variant: 'danger' },
  CANCELLED: { label: 'Cancelled', variant: 'danger' },
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
        title="Loading..."
        subtitle="BLOOD CENTER CONSOLE"
        organizationName="RedCross Blood Center (Development)"
        organizationType="Blood Center workspace"
        userName="Loading..."
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
        title="Shipment Not Found"
        subtitle="BLOOD CENTER CONSOLE"
        organizationName="RedCross Blood Center (Development)"
        organizationType="Blood Center workspace"
        userName={user ? `${user.firstName} ${user.lastName}` : 'Guest'}
      >
        <div className="flex flex-col items-center justify-center bc-glass rounded-card p-12">
          <XCircle className="mb-4 text-donor-primary" size={48} />
          <h2 className="mb-2 font-display text-2xl font-semibold text-donor-text">
            Shipment Not Found
          </h2>
          <button
            onClick={() => router.push('/shipments')}
            className="mt-4 rounded-lg bg-donor-primary px-4 py-2 font-semibold text-white"
          >
            Back to Shipments
          </button>
        </div>
      </AppShell>
    );
  }

  const status = STATUS_CONFIG[shipment.status] || { label: shipment.status, variant: 'default' as const };

  return (
    <AppShell
      title={shipment.shipmentReference}
      subtitle="SHIPMENT DETAILS"
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
          Back to Shipments
        </button>

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-display text-2xl font-semibold text-donor-text">
                {shipment.shipmentReference}
              </h1>
              <StatusBadge variant={status.variant}>{status.label}</StatusBadge>
            </div>
            <p className="mt-1 text-sm text-donor-muted">
              Created {new Date(shipment.createdAt).toLocaleString()}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {canAssignCourier && (
              <button
                onClick={() => setShowAssignModal(true)}
                className="flex items-center gap-2 rounded-lg bg-donor-primary px-4 py-2 font-semibold text-white transition-colors hover:bg-donor-primary/80"
              >
                <Users size={16} />
                {shipment?.status === 'FAILED' ? 'Reassign Courier' : 'Assign Courier'}
              </button>
            )}
            {canCancel && (
              <button
                onClick={() => setShowCancelModal(true)}
                className="flex items-center gap-2 rounded-lg border border-donor-danger/50 bg-donor-dangerMuted px-4 py-2 font-semibold text-donor-onDangerMuted transition-colors hover:bg-donor-dangerMuted/70"
              >
                <XCircle size={16} />
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="bc-glass rounded-card p-5">
            <h3 className="mb-4 text-sm font-semibold text-donor-text">Shipment Information</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs text-donor-muted">Units</p>
                <p className="text-lg font-semibold text-donor-text">{shipment.units?.length || 0}</p>
              </div>
              {shipment.courier && (
                <>
                  <div>
                    <p className="text-xs text-donor-muted">Courier</p>
                    <p className="text-lg font-semibold text-donor-text">{shipment.courier.displayName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-donor-muted">Courier Phone</p>
                    <p className="text-lg font-semibold text-donor-text">{shipment.courier.phone || 'N/A'}</p>
                  </div>
                </>
              )}
              {shipment.pickupAddress && (
                <div>
                  <p className="text-xs text-donor-muted">Pickup Address</p>
                  <p className="text-sm text-donor-text">{shipment.pickupAddress}</p>
                </div>
              )}
              {shipment.destinationAddress && (
                <div>
                  <p className="text-xs text-donor-muted">Destination</p>
                  <p className="text-sm text-donor-text">{shipment.destinationAddress}</p>
                </div>
              )}
            </div>
          </div>

          {tracking && (tracking.currentLocation || courierLocation || tracking.source.coordinates || tracking.destination.coordinates) && (
            <div className="bc-glass rounded-card p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-donor-text">Live Map</h3>
                <span className={`flex items-center gap-1.5 text-xs ${connected ? 'text-donor-success' : 'text-donor-muted'}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-donor-success' : 'bg-donor-muted'}`} />
                  {connected ? 'Live' : 'Offline'}
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
                          sublabel: 'Pickup location',
                          ...tracking.source.coordinates,
                        }
                      : null,
                    courierLocation
                      ? {
                          id: 'courier',
                          variant: 'courier',
                          label: tracking.courier?.name ?? 'Courier',
                          sublabel: `Updated ${new Date(courierLocation.recordedAt).toLocaleTimeString()}`,
                          latitude: courierLocation.latitude,
                          longitude: courierLocation.longitude,
                        }
                      : tracking.currentLocation
                        ? {
                            id: 'courier',
                            variant: 'courier',
                            label: tracking.courier?.name ?? 'Courier',
                            sublabel: `Updated ${new Date(tracking.currentLocation.recordedAt).toLocaleTimeString()}`,
                            ...tracking.currentLocation,
                          }
                        : null,
                    tracking.destination.coordinates
                      ? {
                          id: 'destination',
                          variant: 'destination',
                          label: tracking.destination.name,
                          sublabel: 'Delivery destination',
                          ...tracking.destination.coordinates,
                        }
                      : null,
                  ] as (MapMarker | null)[]
                ).filter((m): m is MapMarker => m !== null)}
              />
            </div>
          )}

          <div className="bc-glass rounded-card p-5">
            <h3 className="mb-4 text-sm font-semibold text-donor-text">Timeline</h3>
            {timeline.length === 0 ? (
              <p className="text-sm text-donor-muted">No events recorded</p>
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
            <h3 className="mb-4 text-sm font-semibold text-donor-text">Status Timeline</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-donor-muted">Created</span>
                <span className="text-donor-text">
                  {shipment.createdAt ? new Date(shipment.createdAt).toLocaleString() : '-'}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-donor-muted">Assigned</span>
                <span className="text-donor-text">
                  {shipment.assignedAt ? new Date(shipment.assignedAt).toLocaleString() : '-'}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-donor-muted">Accepted</span>
                <span className="text-donor-text">
                  {shipment.acceptedAt ? new Date(shipment.acceptedAt).toLocaleString() : '-'}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-donor-muted">Picked Up</span>
                <span className="text-donor-text">
                  {shipment.pickedUpAt ? new Date(shipment.pickedUpAt).toLocaleString() : '-'}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-donor-muted">In Transit</span>
                <span className="text-donor-text">
                  {shipment.inTransitAt ? new Date(shipment.inTransitAt).toLocaleString() : '-'}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-donor-muted">Arrived</span>
                <span className="text-donor-text">
                  {shipment.arrivedAt ? new Date(shipment.arrivedAt).toLocaleString() : '-'}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-donor-muted">Delivered</span>
                <span className="text-donor-text">
                  {shipment.deliveredAt ? new Date(shipment.deliveredAt).toLocaleString() : '-'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md bc-glass rounded-card p-6">
            <h3 className="mb-4 font-display text-lg font-semibold text-donor-text">
              {shipment?.status === 'FAILED' ? 'Reassign Courier' : 'Assign Courier'}
            </h3>
            <div className="mb-4">
              <label className="mb-2 block text-sm text-donor-muted">Select Courier</label>
              <select
                value={selectedCourierId}
                onChange={(e) => setSelectedCourierId(e.target.value)}
                className="w-full rounded-lg border border-donor-border bg-donor-bg px-3 py-2 text-donor-text"
              >
                <option value="">Choose a courier...</option>
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
                Cancel
              </button>
              <button
                onClick={handleAssignCourier}
                disabled={!selectedCourierId || actionLoading}
                className="rounded-lg bg-donor-primary px-4 py-2 font-semibold text-white disabled:opacity-50"
              >
                {actionLoading
                  ? shipment?.status === 'FAILED' ? 'Reassigning...' : 'Assigning...'
                  : shipment?.status === 'FAILED' ? 'Reassign' : 'Assign'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md bc-glass rounded-card p-6">
            <h3 className="mb-4 font-display text-lg font-semibold text-donor-text">Cancel Shipment</h3>
            <div className="mb-4">
              <label className="mb-2 block text-sm text-donor-muted">Reason (optional)</label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full rounded-lg border border-donor-border bg-donor-bg px-3 py-2 text-donor-text"
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                className="rounded-lg border border-donor-border px-4 py-2 text-donor-text"
              >
                Back
              </button>
              <button
                onClick={handleCancelShipment}
                className="rounded-lg bg-donor-danger px-4 py-2 font-semibold text-white"
              >
                Cancel Shipment
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
