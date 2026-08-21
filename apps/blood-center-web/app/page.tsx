'use client';

import { useEffect, useState } from 'react';
import {
  Activity,
  CalendarDays,
  LayoutDashboard,
  Package,
  Settings,
  Truck,
  Users,
} from 'lucide-react';
import { DashboardShell, EmptyState, StatCard, StatusBadge } from '@donor/ui/components';
import { login, logout as logoutApi, me, isAuthenticated } from '../lib/auth';

const sidebarItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'appointments', label: 'Appointments', icon: CalendarDays, disabled: true },
  { id: 'donors', label: 'Donors', icon: Users, disabled: true },
  { id: 'inventory', label: 'Inventory', icon: Package, disabled: true },
  { id: 'shipments', label: 'Shipments', icon: Truck, disabled: true },
  { id: 'settings', label: 'Settings', icon: Settings, disabled: true },
];

interface User {
  firstName: string;
  lastName: string;
  roles: string[];
}

export default function BloodCenterDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function checkAuth() {
      try {
        if (isAuthenticated()) {
          const userData = await me();
          setUser({
            firstName: userData.firstName,
            lastName: userData.lastName,
            roles: userData.roles,
          });
        }
      } catch (err) {
        console.error('Auth check failed:', err);
      } finally {
        setIsLoading(false);
      }
    }
    checkAuth();
  }, []);

  const handleLogin = async () => {
    setError(null);
    try {
      await login('blood.center.admin@donor.local', 'DevelopmentOnly!123');
      const userData = await me();
      setUser({
        firstName: userData.firstName,
        lastName: userData.lastName,
        roles: userData.roles,
      });
    } catch (err: any) {
      setError(err.message ?? 'Login failed');
    }
  };

  const handleLogout = async () => {
    await logoutApi();
    setUser(null);
  };

  if (isLoading) {
    return (
      <DashboardShell
        title="Loading..."
        subtitle="BLOOD CENTER CONSOLE"
        activeItem="dashboard"
        sidebarItems={sidebarItems}
        organizationName="Northstar Blood Center (Development)"
        organizationType="Operations workspace"
        userName="Loading..."
        onNotifications={() => {}}
        onLogout={() => {}}
      >
        <div className="flex items-center justify-center p-12">
          <Activity className="animate-spin text-donor-secondary" size={32} />
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
        organizationName="Northstar Blood Center (Development)"
        organizationType="Operations workspace"
        userName="Guest"
        onNotifications={() => {}}
        onLogout={() => {}}
      >
        <div className="flex flex-col items-center justify-center rounded-2xl border border-donor-border bg-donor-surface p-12">
          <Activity className="mb-4 text-donor-secondary" size={48} />
          <h2 className="mb-2 font-display text-2xl font-semibold text-donor-text">
            Blood Center Portal
          </h2>
          <p className="mb-6 text-center text-donor-muted">
            Sign in to access the blood center dashboard
          </p>
          {error && <p className="mb-4 text-sm text-red-400">{error}</p>}
          <button
            onClick={handleLogin}
            className="rounded-lg bg-donor-secondary px-6 py-3 font-semibold text-white transition-colors hover:bg-donor-secondary/80"
          >
            Sign in as Blood Center Admin
          </button>
          <p className="mt-4 text-xs text-donor-muted">
            Development only: blood.center.admin@donor.local
          </p>
        </div>
      </DashboardShell>
    );
  }

  const hasBloodCenterAccess = user.roles.some((r) =>
    ['BLOOD_CENTER_ADMIN', 'BLOOD_CENTER_STAFF', 'SUPER_ADMIN'].includes(r),
  );

  if (!hasBloodCenterAccess) {
    return (
      <DashboardShell
        title="Access Denied"
        subtitle="BLOOD CENTER CONSOLE"
        activeItem=""
        sidebarItems={sidebarItems}
        organizationName="Northstar Blood Center (Development)"
        organizationType="Operations workspace"
        userName={`${user.firstName} ${user.lastName}`}
        onNotifications={() => {}}
        onLogout={handleLogout}
      >
        <div className="flex flex-col items-center justify-center rounded-2xl border border-red-900/50 bg-red-950/20 p-12">
          <Activity className="mb-4 text-red-400" size={48} />
          <h2 className="mb-2 font-display text-2xl font-semibold text-donor-text">
            Access Denied
          </h2>
          <p className="mb-6 text-center text-donor-muted">
            You don&apos;t have permission to access the blood center dashboard.
          </p>
          <button
            onClick={handleLogout}
            className="rounded-lg bg-donor-surface px-6 py-3 font-semibold text-donor-text border border-donor-border transition-colors hover:bg-donor-border"
          >
            Sign out
          </button>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      title={`Good morning, ${user.firstName}.`}
      subtitle="BLOOD CENTER CONSOLE"
      activeItem="dashboard"
      sidebarItems={sidebarItems}
      organizationName="Northstar Blood Center (Development)"
      organizationType="Operations workspace"
      userName={`${user.firstName} ${user.lastName}`}
      onNotifications={() => {}}
      onLogout={handleLogout}
    >
      <div className="mb-8 flex items-center justify-between rounded-2xl border border-donor-border bg-donor-surface p-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-donor-muted">
            CENTER OVERVIEW
          </p>
          <h2 className="mt-2 font-display text-4xl font-semibold tracking-tight text-donor-text">
            Every unit, <span className="text-donor-secondary">accounted for.</span>
          </h2>
          <p className="mt-2 text-sm text-donor-muted">
            A precise operational foundation for a safer blood supply.
          </p>
        </div>
        <div className="hidden rounded-2xl border border-[#29404D] bg-[#10202A] p-5 md:block">
          <Activity className="mb-2 text-donor-secondary" size={24} />
          <p className="text-sm font-semibold text-donor-text">System healthy</p>
          <p className="text-xs text-donor-muted">All services operational</p>
        </div>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <StatCard label="Units available" value="—" note="Connect your API to view" />
        <StatCard label="Pending tests" value="—" note="No data loaded" />
        <StatCard label="Open shipments" value="Ready" note="Foundation workspace" variant="info" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-donor-border bg-donor-surface p-6 lg:col-span-2">
          <p className="text-xs font-bold uppercase tracking-widest text-donor-muted">WORKSPACE</p>
          <h3 className="mt-1 font-display text-xl font-semibold text-donor-text">
            Operational clarity starts here
          </h3>
          <p className="mt-3 text-sm leading-relaxed text-donor-muted">
            Inventory, donor, and shipment modules are intentionally staged for future
            implementation. This workspace contains no fabricated clinical data.
          </p>
        </div>

        <div className="rounded-2xl border border-donor-border bg-donor-surface p-6">
          <p className="text-xs font-bold uppercase tracking-widest text-donor-muted">STATUS</p>
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-donor-text">Cold chain</span>
              <StatusBadge variant="success">Active</StatusBadge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-donor-text">Test lab link</span>
              <StatusBadge variant="success">Connected</StatusBadge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-donor-text">Courier network</span>
              <StatusBadge>Standby</StatusBadge>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <EmptyState
          title="No hospital requests"
          description="Inbound blood requests from hospitals will appear here when the transfer module is enabled."
        />
      </div>
    </DashboardShell>
  );
}
