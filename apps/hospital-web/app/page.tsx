'use client';

import { useEffect, useState } from 'react';
import {
  Activity,
  Bell,
  CalendarDays,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Package,
  Settings,
  Users,
} from 'lucide-react';
import { DashboardShell, EmptyState, StatCard, StatusBadge } from '@donor/ui/components';
import { login, logout as logoutApi, me, isAuthenticated } from '../lib/auth';

const sidebarItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'emergency', label: 'Emergency', icon: Activity, disabled: true },
  { id: 'donors', label: 'Donors', icon: Users, disabled: true },
  { id: 'appointments', label: 'Appointments', icon: CalendarDays, disabled: true },
  { id: 'inventory', label: 'Inventory', icon: Package, disabled: true },
  { id: 'settings', label: 'Settings', icon: Settings, disabled: true },
];

interface User {
  firstName: string;
  lastName: string;
  roles: string[];
}

export default function HospitalDashboard() {
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
      await login('hospital.admin@donor.local', 'DevelopmentOnly!123');
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
        subtitle="HOSPITAL CONSOLE"
        activeItem="dashboard"
        sidebarItems={sidebarItems}
        organizationName="Northstar Hospital (Development)"
        organizationType="Operations workspace"
        userName="Loading..."
        onNotifications={() => {}}
        onLogout={() => {}}
      >
        <div className="flex items-center justify-center p-12">
          <Activity className="animate-spin text-donor-primary" size={32} />
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
        organizationType="Operations workspace"
        userName="Guest"
        onNotifications={() => {}}
        onLogout={() => {}}
      >
        <div className="flex flex-col items-center justify-center rounded-2xl border border-donor-border bg-donor-surface p-12">
          <Activity className="mb-4 text-donor-primary" size={48} />
          <h2 className="mb-2 font-display text-2xl font-semibold text-donor-text">
            Hospital Portal
          </h2>
          <p className="mb-6 text-center text-donor-muted">
            Sign in to access the hospital dashboard
          </p>
          {error && <p className="mb-4 text-sm text-red-400">{error}</p>}
          <button
            onClick={handleLogin}
            className="rounded-lg bg-donor-primary px-6 py-3 font-semibold text-white transition-colors hover:bg-donor-primary/80"
          >
            Sign in as Hospital Admin
          </button>
          <p className="mt-4 text-xs text-donor-muted">
            Development only: hospital.admin@donor.local
          </p>
        </div>
      </DashboardShell>
    );
  }

  const hasHospitalAccess = user.roles.some((r) =>
    ['HOSPITAL_ADMIN', 'HOSPITAL_STAFF', 'SUPER_ADMIN'].includes(r),
  );

  if (!hasHospitalAccess) {
    return (
      <DashboardShell
        title="Access Denied"
        subtitle="HOSPITAL CONSOLE"
        activeItem=""
        sidebarItems={sidebarItems}
        organizationName="Northstar Hospital (Development)"
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
            You don&apos;t have permission to access the hospital dashboard.
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
      subtitle="HOSPITAL CONSOLE"
      activeItem="dashboard"
      sidebarItems={sidebarItems}
      organizationName="Northstar Hospital (Development)"
      organizationType="Operations workspace"
      userName={`${user.firstName} ${user.lastName}`}
      onNotifications={() => {}}
      onLogout={handleLogout}
    >
      <div className="mb-8 flex items-center justify-between rounded-2xl border border-donor-border bg-donor-surface p-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-donor-muted">
            LIVE OVERVIEW
          </p>
          <h2 className="mt-2 font-display text-4xl font-semibold tracking-tight text-donor-text">
            Care operations, <span className="text-donor-primary">in focus.</span>
          </h2>
          <p className="mt-2 text-sm text-donor-muted">
            A clear view of your donor network and today&apos;s priorities.
          </p>
        </div>
        <div className="hidden rounded-2xl border border-[#28413B] bg-[#10221F] p-5 md:block">
          <Activity className="mb-2 text-donor-success" size={24} />
          <p className="text-sm font-semibold text-donor-text">System healthy</p>
          <p className="text-xs text-donor-muted">All services operational</p>
        </div>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <StatCard label="Active donors" value="—" note="Connect your API to view" />
        <StatCard label="Today's appointments" value="—" note="No data loaded" />
        <StatCard
          label="Inventory status"
          value="Ready"
          note="Foundation workspace"
          variant="success"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-donor-border bg-donor-surface p-6 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-donor-muted">
                WORKSPACE
              </p>
              <h3 className="mt-1 font-display text-xl font-semibold text-donor-text">
                Build on a trusted foundation
              </h3>
            </div>
            <ChevronRight className="text-donor-muted" size={20} />
          </div>
          <p className="text-sm leading-relaxed text-donor-muted">
            Clinical workflows, permissions, and auditability are ready for the next product phase.
            No patient data is shown in this development workspace.
          </p>
        </div>

        <div className="rounded-2xl border border-donor-border bg-donor-surface p-6">
          <p className="text-xs font-bold uppercase tracking-widest text-donor-muted">STATUS</p>
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-donor-text">API connection</span>
              <StatusBadge variant="success">Operational</StatusBadge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-donor-text">Database</span>
              <StatusBadge variant="success">Connected</StatusBadge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-donor-text">Notifications</span>
              <StatusBadge>Standby</StatusBadge>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <EmptyState
          title="No emergency requests"
          description="SOS blood requests will appear here when the emergency module is enabled."
        />
      </div>
    </DashboardShell>
  );
}
