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
  XCircle,
} from 'lucide-react';
import {
  DashboardShell,
  StatusBadge,
} from '@donor/ui/components';
import { logout as logoutApi, me, isAuthenticated, MeResponse } from '../../../lib/auth';
import {
  getShipment,
  getShipmentTracking,
  getShipmentTimeline,
  confirmDelivery,
  Shipment,
  TrackingInfo,
  TimelineEvent,
} from '../../../lib/shipments';

const sidebarItems = [
  { id: 'dashboard', label: 'Dashboard', icon: Activity },
  { id: 'emergency', label: 'Emergency', icon: AlertCircle },
  { id: 'donors', label: 'Donors', icon: Package, disabled: true },
  { id: 'appointments', label: 'Appointments', icon: Clock, disabled: true },
  { id: 'inventory', label: 'Inventory', icon: Package, disabled: true },
  { id: 'analytics', label: 'Analytics', icon: Activity },
  { id: 'shipments', label: 'Shipments', icon: Truck },
  { id: 'settings', label: 'Settings', icon: AlertCircle, disabled: true },
];

const STATUS_CONFIG: Record<string, { label: string; variant: 'success' | 'warning' | 'info' | 'default' | 'danger' }> = {
  CREATED: { label: 'Created', variant: 'default' },
  COURIER_ASSIGNED: { label: 'Assigned', variant: 'info' },
  COURIER_ACCEPTED: { label: 'Accepted', variant: 'info' },
  COURIER_DECLINED: { label: 'Declined', variant: 'warning' },
  PICKUP_STARTED: { label: 'Pickup Started', variant: 'warning' },
  PICKED_UP: { label: 'Picked Up', variant: 'warning' },
  IN_TRANSIT: { label: 'In Transit', variant: 'info' },
  ARRIVED_AT_HOSPITAL: { label: 'Arrived', variant: 'success' },
  DELIVERED: { label: 'Delivered', variant: 'success' },
  FAILED: { label: 'Failed', variant: 'danger' },
  CANCELLED: { label: 'Cancelled', variant: 'danger' },
};

export default function ShipmentDetailPage() {
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
      <DashboardShell
        title="Loading..."
        subtitle="HOSPITAL CONSOLE"
        activeItem="shipments"
        sidebarItems={sidebarItems}
        organizationName="Northstar Hospital (Development)"
        organizationType="Hospital workspace"
        userName="Loading..."
        onNotifications={() => {}}
        onLogout={() => {}}
      >
        <div className="flex items-center justify-center p-12">
          <Truck className="animate-spin text-donor-primary" size={32} />
        </div>
      </DashboardShell>
    );
  }

  if (!user || !shipment) {
    return (
      <DashboardShell
        title="Shipment Not Found"
        subtitle="HOSPITAL CONSOLE"
        activeItem="shipments"
        sidebarItems={sidebarItems}
        organizationName="Northstar Hospital (Development)"
        organizationType="Hospital workspace"
        userName={user ? `${user.firstName} ${user.lastName}` : 'Guest'}
        onNotifications={() => {}}
        onLogout={() => {}}
      >
        <div className="flex flex-col items-center justify-center rounded-2xl border border-donor-border bg-donor-surface p-12">
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
      </DashboardShell>
    );
  }

  const status = STATUS_CONFIG[shipment.status] || { label: shipment.status, variant: 'default' as const };
  const totalUnits = shipment.units?.length || 0;

  return (
    <DashboardShell
      title={shipment.shipmentReference}
      subtitle="SHIPMENT TRACKING"
      activeItem="shipments"
      sidebarItems={sidebarItems}
      organizationName="Northstar Hospital (Development)"
      organizationType="Hospital Console"
      userName={`${user.firstName} ${user.lastName}`}
      onNotifications={() => {}}
      onLogout={logoutApi}
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
              {totalUnits} units
              {shipment.courier && <> • Courier: {shipment.courier.displayName}</>}
            </p>
          </div>
          {canConfirmDelivery && (
            <button
              onClick={() => setShowDeliveryModal(true)}
              className="flex items-center gap-2 rounded-lg bg-green-500 px-4 py-2 font-semibold text-white transition-colors hover:bg-green-600"
            >
              <CheckCircle size={16} />
              Confirm Delivery
            </button>
          )}
        </div>
      </div>

      {shipment.status === 'ARRIVED_AT_HOSPITAL' && (
        <div className="mb-6 rounded-xl border border-green-500/30 bg-green-500/10 p-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="text-green-400" size={24} />
            <div>
              <h3 className="font-semibold text-green-400">Courier Has Arrived</h3>
              <p className="text-sm text-donor-muted">
                The courier has arrived at your location. Please confirm the delivery below.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {tracking?.eta && (
            <div className="rounded-2xl border border-donor-border bg-donor-surface p-5">
              <h3 className="mb-4 text-sm font-semibold text-donor-text">Tracking Information</h3>
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
                  <p className="text-xs text-donor-muted">Distance</p>
                  <p className="text-lg font-semibold text-donor-text">{tracking.eta.distanceKm} km</p>
                </div>
                <div>
                  <p className="text-xs text-donor-muted">Last Update</p>
                  <p className="text-lg font-semibold text-donor-text">
                    {tracking.lastUpdated ? new Date(tracking.lastUpdated).toLocaleTimeString() : '-'}
                  </p>
                </div>
              </div>
              {tracking.currentLocation && (
                <div className="mt-4 rounded-lg bg-donor-border p-3">
                  <p className="text-xs text-donor-muted">Current Location</p>
                  <p className="text-sm text-donor-text">
                    {tracking.currentLocation.latitude.toFixed(6)}, {tracking.currentLocation.longitude.toFixed(6)}
                  </p>
                  <p className="text-xs text-donor-muted">
                    Updated {new Date(tracking.currentLocation.recordedAt).toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="rounded-2xl border border-donor-border bg-donor-surface p-5">
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
          <div className="rounded-2xl border border-donor-border bg-donor-surface p-5">
            <h3 className="mb-4 text-sm font-semibold text-donor-text">Shipment Details</h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-donor-muted">Units in Shipment</p>
                <p className="text-lg font-semibold text-donor-text">{totalUnits}</p>
              </div>
              {shipment.courier && (
                <>
                  <div>
                    <p className="text-xs text-donor-muted">Courier</p>
                    <p className="text-lg font-semibold text-donor-text">{shipment.courier.displayName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-donor-muted">Courier Phone</p>
                    <p className="text-sm text-donor-text">{shipment.courier.phone || 'N/A'}</p>
                  </div>
                </>
              )}
              {shipment.destinationAddress && (
                <div>
                  <p className="text-xs text-donor-muted">Delivery Address</p>
                  <p className="text-sm text-donor-text">{shipment.destinationAddress}</p>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-donor-border bg-donor-surface p-5">
            <h3 className="mb-4 text-sm font-semibold text-donor-text">Status Timeline</h3>
            <div className="space-y-3">
              {[
                { label: 'Created', time: shipment.createdAt },
                { label: 'Assigned', time: shipment.assignedAt },
                { label: 'Accepted', time: shipment.acceptedAt },
                { label: 'Picked Up', time: shipment.pickedUpAt },
                { label: 'In Transit', time: shipment.inTransitAt },
                { label: 'Arrived', time: shipment.arrivedAt },
                { label: 'Delivered', time: shipment.deliveredAt },
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

      {showDeliveryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-donor-border bg-donor-surface p-6">
            <h3 className="mb-4 font-display text-lg font-semibold text-donor-text">Confirm Delivery</h3>
            <div className="mb-4 space-y-4">
              <div>
                <label className="mb-2 block text-sm text-donor-muted">Units Received</label>
                <input
                  type="number"
                  min={0}
                  max={totalUnits}
                  value={unitsReceived}
                  onChange={(e) => setUnitsReceived(parseInt(e.target.value) || 0)}
                  className="w-full rounded-lg border border-donor-border bg-donor-bg px-3 py-2 text-donor-text"
                />
                <p className="mt-1 text-xs text-donor-muted">
                  Total units shipped: {totalUnits}
                </p>
              </div>
              <div>
                <label className="mb-2 block text-sm text-donor-muted">Condition</label>
                <select
                  value={deliveryCondition}
                  onChange={(e) => setDeliveryCondition(e.target.value)}
                  className="w-full rounded-lg border border-donor-border bg-donor-bg px-3 py-2 text-donor-text"
                >
                  <option value="GOOD">Good</option>
                  <option value="DAMAGED">Damaged</option>
                  <option value="PARTIAL">Partial</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm text-donor-muted">Notes (optional)</label>
                <textarea
                  value={deliveryNotes}
                  onChange={(e) => setDeliveryNotes(e.target.value)}
                  className="w-full rounded-lg border border-donor-border bg-donor-bg px-3 py-2 text-donor-text"
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
                    className="w-full rounded-lg border border-donor-border bg-donor-bg px-3 py-2 text-donor-text"
                    rows={2}
                    placeholder="Explain why fewer units were received..."
                  />
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeliveryModal(false)}
                className="rounded-lg border border-donor-border px-4 py-2 text-donor-text"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelivery}
                disabled={actionLoading || unitsReceived < 0 || unitsReceived > totalUnits}
                className="rounded-lg bg-green-500 px-4 py-2 font-semibold text-white disabled:opacity-50"
              >
                {actionLoading ? 'Confirming...' : 'Confirm Delivery'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
