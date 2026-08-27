'use client';

import { useCallback, useEffect, useState } from 'react';
import { Info, Mail, Phone, RefreshCw, Truck, Users } from 'lucide-react';
import {
  DashboardShell,
  EmptyState,
  StatCard,
  StatusBadge,
} from '@bloodchain/ui/components';
import { logout as logoutApi, me, isAuthenticated, MeResponse } from '../../lib/auth';
import { getCourierRoster, CourierRosterEntry } from '../../lib/couriers';
import { sidebarItems } from '../../lib/navigation';

const STATUS_CONFIG: Record<string, { label: string; variant: 'success' | 'warning' | 'info' | 'default' | 'danger' }> = {
  AVAILABLE: { label: 'Available', variant: 'success' },
  BUSY: { label: 'On Delivery', variant: 'info' },
  OFFLINE: { label: 'Offline', variant: 'default' },
  SUSPENDED: { label: 'Suspended', variant: 'danger' },
};

export default function CouriersPage() {
  const [user, setUser] = useState<MeResponse | null>(null);
  const [organizationId, setOrganizationId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [couriers, setCouriers] = useState<CourierRosterEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadCouriers = useCallback(async () => {
    if (!organizationId) return;
    try {
      setRefreshing(true);
      const data = await getCourierRoster(organizationId);
      setCouriers(data.data);
    } catch (err) {
      console.error('Failed to load couriers:', err);
    } finally {
      setRefreshing(false);
    }
  }, [organizationId]);

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
      loadCouriers();
    }
  }, [organizationId, loadCouriers]);

  if (isLoading) {
    return (
      <DashboardShell
        title="Loading..."
        subtitle="BLOOD CENTER CONSOLE"
        activeItem="couriers"
        sidebarItems={sidebarItems}
        organizationName="RedCross Blood Center (Development)"
        organizationType="Blood Center workspace"
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
        subtitle="BLOOD CENTER CONSOLE"
        activeItem=""
        sidebarItems={sidebarItems}
        organizationName="RedCross Blood Center (Development)"
        organizationType="Blood Center workspace"
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
            Please sign in to access courier management
          </p>
        </div>
      </DashboardShell>
    );
  }

  const availableCount = couriers.filter((c) => c.status === 'AVAILABLE').length;
  const busyCount = couriers.filter((c) => c.status === 'BUSY').length;
  const offlineCount = couriers.filter((c) => c.status === 'OFFLINE' || c.status === 'SUSPENDED').length;

  return (
    <DashboardShell
      title="Couriers"
      subtitle="BLOOD CENTER OPERATIONS"
      activeItem="couriers"
      sidebarItems={sidebarItems}
      organizationName="RedCross Blood Center (Development)"
      organizationType="Blood Center Console"
      userName={`${user.firstName} ${user.lastName}`}
      onNotifications={() => {}}
      onLogout={logoutApi}
    >
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-donor-text">
            Courier Roster
          </h1>
          <p className="text-sm text-donor-muted">
            Couriers registered to your organization and their current status
          </p>
        </div>
        <button
          onClick={loadCouriers}
          disabled={refreshing}
          className="flex items-center gap-2 rounded-lg border border-donor-border bg-donor-surface px-3 py-2 text-sm text-donor-text transition-colors hover:bg-donor-border disabled:opacity-50"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="mb-6 flex items-start gap-3 rounded-xl border border-donor-border bg-donor-surface p-4 text-sm text-donor-muted">
        <Info size={16} className="mt-0.5 shrink-0 text-donor-primary" />
        <p>
          Couriers become available here once they register and are approved through the
          courier mobile app — there is no invite-a-courier action on this page yet.
        </p>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <StatCard label="Total Couriers" value={couriers.length.toString()} icon={Users} variant="info" />
        <StatCard label="Available" value={availableCount.toString()} icon={Truck} variant="success" />
        <StatCard label="On Delivery" value={busyCount.toString()} icon={Truck} variant="info" />
        <StatCard label="Offline / Suspended" value={offlineCount.toString()} icon={Truck} variant="default" />
      </div>

      {couriers.length === 0 ? (
        <EmptyState
          title="No couriers yet"
          description="Couriers who register and get approved for your organization will appear here."
        />
      ) : (
        <div className="space-y-3">
          {couriers.map((courier) => {
            const status = STATUS_CONFIG[courier.status] || { label: courier.status, variant: 'default' as const };
            return (
              <div
                key={courier.id}
                className="flex items-center justify-between rounded-xl border border-donor-border bg-donor-surface p-5"
              >
                <div className="flex items-center gap-4">
                  <div className="rounded-full bg-donor-primary/20 p-3">
                    <Truck size={22} className="text-donor-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="font-display text-base font-semibold text-donor-text">
                        {courier.displayName}
                      </h3>
                      <StatusBadge variant={status.variant}>{status.label}</StatusBadge>
                    </div>
                    <div className="mt-1 flex items-center gap-4 text-xs text-donor-muted">
                      <span className="flex items-center gap-1">
                        <Mail size={12} />
                        {courier.email}
                      </span>
                      {courier.phone && (
                        <span className="flex items-center gap-1">
                          <Phone size={12} />
                          {courier.phone}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-6 text-sm">
                  <div className="text-right">
                    <p className="text-donor-muted">Active</p>
                    <p className="font-semibold text-donor-text">{courier.activeShipments}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-donor-muted">Delivered</p>
                    <p className="font-semibold text-donor-text">{courier.completedShipments}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </DashboardShell>
  );
}
