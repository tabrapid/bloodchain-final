'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle,
  Clock,
  Filter,
  MapPin,
  Package,
  RefreshCw,
  Truck,
} from 'lucide-react';
import {
  EmptyState,
  StatCard,
  StatusBadge,
} from '@bloodchain/ui/components';
import { me, isAuthenticated, MeResponse } from '../../lib/auth';
import {
  getShipments,
  Shipment,
} from '../../lib/shipments';
import { AppShell } from '../../components/AppShell';

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
      const data = await getShipments(organizationId, filters);
      setShipments(data);
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
      loadShipments();
    }
  }, [organizationId, loadShipments]);

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

  if (!user) {
    return (
      <AppShell
        title="Authentication Required"
        subtitle="BLOOD CENTER CONSOLE"
        organizationName="RedCross Blood Center (Development)"
        organizationType="Blood Center workspace"
        userName="Guest"
      >
        <div className="flex flex-col items-center justify-center bc-glass rounded-card p-12">
          <Truck className="mb-4 text-donor-primary" size={48} />
          <h2 className="mb-2 font-display text-2xl font-semibold text-donor-text">
            Sign In Required
          </h2>
          <p className="mb-6 text-center text-donor-muted">
            Please sign in to access the shipments dashboard
          </p>
        </div>
      </AppShell>
    );
  }

  const activeShipments = shipments.filter(
    (s) => !['DELIVERED', 'FAILED', 'CANCELLED'].includes(s.status)
  );
  const inTransitCount = shipments.filter((s) => s.status === 'IN_TRANSIT').length;
  const deliveredCount = shipments.filter((s) => s.status === 'DELIVERED').length;

  return (
    <AppShell
      title="Shipments"
      subtitle="BLOOD CENTER OPERATIONS"
      organizationName="RedCross Blood Center (Development)"
      organizationType="Blood Center Console"
      userName={`${user.firstName} ${user.lastName}`}
    >
      <div className="mb-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold text-donor-text">
              Blood Shipments
            </h1>
            <p className="text-sm text-donor-muted">
              Manage and track blood unit shipments to hospitals
            </p>
          </div>
          <button
            onClick={loadShipments}
            disabled={refreshing}
            className="flex items-center gap-2 rounded-lg bc-solid px-3 py-2 text-sm text-donor-text transition-colors hover:bg-donor-elevated disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        <div className="mb-4 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-donor-muted" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg bc-solid px-3 py-2 text-sm text-donor-text"
            >
              <option value="">All Statuses</option>
              <option value="CREATED">Created</option>
              <option value="COURIER_ASSIGNED">Assigned</option>
              <option value="COURIER_ACCEPTED">Accepted</option>
              <option value="PICKUP_STARTED">Pickup Started</option>
              <option value="PICKED_UP">Picked Up</option>
              <option value="IN_TRANSIT">In Transit</option>
              <option value="ARRIVED_AT_HOSPITAL">Arrived</option>
              <option value="DELIVERED">Delivered</option>
              <option value="FAILED">Failed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
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
          label="In Transit"
          value={inTransitCount.toString()}
          icon={MapPin}
          variant="info"
        />
        <StatCard
          label="Delivered"
          value={deliveredCount.toString()}
          icon={CheckCircle}
          variant="success"
        />
        <StatCard
          label="Total"
          value={shipments.length.toString()}
          icon={Package}
        />
      </div>

      {shipments.length === 0 ? (
        <EmptyState
          title="No shipments"
          description="Create a shipment from an approved, ready-for-pickup blood request."
          action={
            <a
              href="/requests"
              className="rounded-lg bg-donor-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-donor-primary/80"
            >
              View Blood Requests
            </a>
          }
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
                className="block bc-glass rounded-card p-5 transition-colors hover:bg-donor-border/50"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="rounded-full bg-donor-primaryMuted p-3">
                      <Truck size={24} className="text-donor-onPrimaryMuted" />
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
                </div>
              </a>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
