'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Bell,
  CheckCircle,
  Clock,
  MapPin,
  Package,
  RefreshCw,
  Settings,
  Truck,
} from 'lucide-react';
import {
  DashboardShell,
  EmptyState,
  StatCard,
  StatusBadge,
} from '@donor/ui/components';
import { logout as logoutApi, me, isAuthenticated, MeResponse } from '../../lib/auth';
import {
  getIncomingShipments,
  Shipment,
} from '../../lib/shipments';

const sidebarItems = [
  { id: 'dashboard', label: 'Dashboard', icon: Activity },
  { id: 'emergency', label: 'Emergency', icon: AlertTriangle },
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

export default function ShipmentsPage() {
  const [user, setUser] = useState<MeResponse | null>(null);
  const [organizationId, setOrganizationId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [refreshing, setRefreshing] = useState(false);

  const loadShipments = useCallback(async () => {
    if (!organizationId) return;
    try {
      setRefreshing(true);
      const filters: { status?: string } = {};
      if (statusFilter) filters.status = statusFilter;
      const data = await getIncomingShipments(organizationId, filters);
      setShipments(data.data);
    } catch (err) {
      console.error('Failed to load shipments:', err);
    } finally {
      setRefreshing(false);
    }
  }, [organizationId, statusFilter]);

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
      loadShipments();
    }
  }, [organizationId, loadShipments]);

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

  if (!user) {
    return (
      <DashboardShell
        title="Authentication Required"
        subtitle="HOSPITAL CONSOLE"
        activeItem=""
        sidebarItems={sidebarItems}
        organizationName="Northstar Hospital (Development)"
        organizationType="Hospital workspace"
        userName="Guest"
        onNotifications={() => {}}
        onLogout={() => {}}
      >
        <div className="flex flex-col items-center justify-center rounded-2xl border border-donor-border bg-donor-surface p-12">
          <Truck className="mb-4 text-donor-primary" size={48} />
          <h2 className="mb-2 font-display text-2xl font-semibold text-donor-text">
            Sign In Required
          </h2>
          <p className="mb-6 text-center text-donor-muted">
            Please sign in to access the shipments dashboard
          </p>
        </div>
      </DashboardShell>
    );
  }

  const activeShipments = shipments.filter(
    (s) => !['DELIVERED', 'FAILED', 'CANCELLED'].includes(s.status)
  );
  const arrivingCount = shipments.filter((s) => ['IN_TRANSIT', 'ARRIVED_AT_HOSPITAL'].includes(s.status)).length;
  const deliveredCount = shipments.filter((s) => s.status === 'DELIVERED').length;
  const needsAttentionCount = shipments.filter((s) => s.status === 'ARRIVED_AT_HOSPITAL').length;

  return (
    <DashboardShell
      title="Incoming Shipments"
      subtitle="HOSPITAL OPERATIONS"
      activeItem="shipments"
      sidebarItems={sidebarItems}
      organizationName="Northstar Hospital (Development)"
      organizationType="Hospital Console"
      userName={`${user.firstName} ${user.lastName}`}
      onNotifications={() => {}}
      onLogout={logoutApi}
    >
      <div className="mb-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold text-donor-text">
              Blood Shipments
            </h1>
            <p className="text-sm text-donor-muted">
              Track incoming blood shipments from blood centers
            </p>
          </div>
          <button
            onClick={loadShipments}
            disabled={refreshing}
            className="flex items-center gap-2 rounded-lg border border-donor-border bg-donor-surface px-3 py-2 text-sm text-donor-text transition-colors hover:bg-donor-border disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        <div className="flex items-center gap-4">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-donor-border bg-donor-surface px-3 py-2 text-sm text-donor-text"
          >
            <option value="">All Statuses</option>
            <option value="COURIER_ASSIGNED">Assigned</option>
            <option value="IN_TRANSIT">In Transit</option>
            <option value="ARRIVED_AT_HOSPITAL">Arrived</option>
            <option value="DELIVERED">Delivered</option>
            <option value="FAILED">Failed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <StatCard
          label="Active Shipments"
          value={activeShipments.length.toString()}
          icon={Truck}
          variant={activeShipments.length > 0 ? 'warning' : 'success'}
        />
        <StatCard
          label="In Transit / Arriving"
          value={arrivingCount.toString()}
          icon={MapPin}
          variant="info"
        />
        <StatCard
          label="Needs Confirmation"
          value={needsAttentionCount.toString()}
          icon={CheckCircle}
          variant={needsAttentionCount > 0 ? 'warning' : 'success'}
        />
        <StatCard
          label="Delivered"
          value={deliveredCount.toString()}
          icon={Package}
          variant="success"
        />
      </div>

      {shipments.length === 0 ? (
        <EmptyState
          title="No incoming shipments"
          description="No shipments found. Shipments will appear here when blood centers create them for your hospital."
        />
      ) : (
        <div className="space-y-4">
          {shipments.map((shipment) => {
            const status = STATUS_CONFIG[shipment.status] || {
              label: shipment.status,
              variant: 'default' as const,
            };
            return (
              <a
                key={shipment.id}
                href={`/shipments/${shipment.id}`}
                className="block rounded-xl border border-donor-border bg-donor-surface p-5 transition-colors hover:bg-donor-border/50"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={`rounded-full p-3 ${
                      shipment.status === 'IN_TRANSIT' ? 'bg-blue-500/20' :
                      shipment.status === 'ARRIVED_AT_HOSPITAL' ? 'bg-green-500/20' :
                      shipment.status === 'DELIVERED' ? 'bg-green-500/20' :
                      'bg-donor-primary/20'
                    }`}>
                      <Truck size={24} className={
                        shipment.status === 'IN_TRANSIT' ? 'text-blue-400' :
                        shipment.status === 'ARRIVED_AT_HOSPITAL' ? 'text-green-400' :
                        shipment.status === 'DELIVERED' ? 'text-green-400' :
                        'text-donor-primary'
                      } />
                    </div>
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="font-display text-lg font-semibold text-donor-text">
                          {shipment.shipmentReference}
                        </h3>
                        <StatusBadge variant={status.variant}>
                          {status.label}
                        </StatusBadge>
                      </div>
                      <p className="mt-1 text-sm text-donor-muted">
                        {shipment.units?.length || 0} units
                        {shipment.courier && (
                          <> • Courier: {shipment.courier.displayName}</>
                        )}
                      </p>
                      <div className="mt-2 flex items-center gap-4 text-xs text-donor-muted">
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {new Date(shipment.createdAt).toLocaleString()}
                        </span>
                        {shipment.destinationAddress && (
                          <span className="flex items-center gap-1">
                            <MapPin size={12} />
                            {shipment.destinationAddress}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {shipment.status === 'ARRIVED_AT_HOSPITAL' && (
                    <span className="rounded-full bg-green-500/20 px-3 py-1 text-xs font-semibold text-green-400">
                      Action Required
                    </span>
                  )}
                </div>
              </a>
            );
          })}
        </div>
      )}
    </DashboardShell>
  );
}
