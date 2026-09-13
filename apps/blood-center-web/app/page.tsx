'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Activity, AlertTriangle, Beaker, Clock, Droplet, Truck } from 'lucide-react';
import { EmptyState, StatCard } from '@bloodchain/ui/components';
import { login, logout as logoutApi, me, isAuthenticated, MeResponse } from '../lib/auth';
import { AppShell } from '../components/AppShell';
import {
  DateRangeType,
  OverviewAnalytics,
  LaboratoryAnalytics,
  ShipmentAnalytics,
  AlertsResponse,
  getOverviewAnalytics,
  getLaboratoryAnalytics,
  getShipmentAnalytics,
  getAlerts,
} from '../lib/analytics';

interface User {
  firstName: string;
  lastName: string;
  roles: string[];
  organizations: MeResponse['organizations'];
}

export default function BloodCenterDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [organizationId, setOrganizationId] = useState<string>('');
  const [overview, setOverview] = useState<OverviewAnalytics | null>(null);
  const [laboratory, setLaboratory] = useState<LaboratoryAnalytics | null>(null);
  const [shipments, setShipments] = useState<ShipmentAnalytics | null>(null);
  const [alerts, setAlerts] = useState<AlertsResponse | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  const loadDashboardData = useCallback(async () => {
    if (!organizationId) return;
    setIsLoadingStats(true);
    try {
      const [overviewData, laboratoryData, shipmentData, alertsData] = await Promise.all([
        getOverviewAnalytics(organizationId, { range: DateRangeType.TODAY }),
        getLaboratoryAnalytics(organizationId, { range: DateRangeType.TODAY }),
        getShipmentAnalytics(organizationId, { range: DateRangeType.TODAY }),
        getAlerts(organizationId),
      ]);
      setOverview(overviewData);
      setLaboratory(laboratoryData);
      setShipments(shipmentData);
      setAlerts(alertsData);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setIsLoadingStats(false);
    }
  }, [organizationId]);

  useEffect(() => {
    async function checkAuth() {
      try {
        if (isAuthenticated()) {
          const userData = await me();
          setUser({
            firstName: userData.firstName,
            lastName: userData.lastName,
            roles: userData.roles,
            organizations: userData.organizations,
          });
          const bloodCenterOrg = userData.organizations.find((org) => org.type === 'BLOOD_CENTER');
          if (bloodCenterOrg) {
            setOrganizationId(bloodCenterOrg.organizationId);
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
      loadDashboardData();
    }
  }, [organizationId, loadDashboardData]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(email, password);
      const userData = await me();
      setUser({
        firstName: userData.firstName,
        lastName: userData.lastName,
        roles: userData.roles,
        organizations: userData.organizations,
      });
    } catch (err: any) {
      setError(err.message ?? 'Login failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await logoutApi();
    setUser(null);
  };

  if (isLoading) {
    return (
      <AppShell
        title="Loading..."
        subtitle="BLOOD CENTER CONSOLE"
        organizationName="Blood Center Console"
        organizationType="Operations workspace"
        userName="Loading..."
      >
        <div className="flex items-center justify-center p-12">
          <Activity className="animate-spin text-donor-secondary" size={32} />
        </div>
      </AppShell>
    );
  }

  if (!user) {
    return (
      <AppShell
        title="Authentication Required"
        subtitle="BLOOD CENTER CONSOLE"
        organizationName="Blood Center Console"
        organizationType="Operations workspace"
        userName="Guest"
      >
        <div className="flex flex-col items-center justify-center bc-glass rounded-card p-12">
          <Activity className="mb-4 text-donor-secondary" size={48} />
          <h2 className="mb-2 font-display text-2xl font-semibold text-donor-text">
            Blood Center Portal
          </h2>
          <p className="mb-6 text-center text-donor-muted">
            Sign in to access the blood center dashboard
          </p>
          {error && <p className="mb-4 text-sm text-donor-danger">{error}</p>}
          <form onSubmit={handleLogin} className="w-full max-w-xs space-y-3">
            <div>
              <label htmlFor="email" className="mb-1 block text-left text-xs font-medium text-donor-muted">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-donor-border bc-solid px-3 py-2.5 text-sm text-donor-text focus:outline-none focus:ring-2 focus:ring-donor-secondary"
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-1 block text-left text-xs font-medium text-donor-muted">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-donor-border bc-solid px-3 py-2.5 text-sm text-donor-text focus:outline-none focus:ring-2 focus:ring-donor-secondary"
              />
            </div>
            {/* With the password field it belongs to, above the button --
                where someone looks after mistyping it twice. */}
            <div className="flex justify-end">
              <Link
                href="/forgot-password"
                className="text-xs font-semibold text-donor-secondary hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg bg-donor-secondary px-6 py-3 font-semibold text-white transition-colors hover:bg-donor-secondary/80 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-donor-muted">
            New blood center?{' '}
            <Link href="/register" className="font-semibold text-donor-secondary hover:underline">
              Register your organization
            </Link>
          </p>
        </div>
      </AppShell>
    );
  }

  const hasBloodCenterAccess = user.roles.some((r) =>
    ['BLOOD_CENTER_ADMIN', 'BLOOD_CENTER_STAFF', 'SUPER_ADMIN'].includes(r),
  );

  const bloodCenterOrg = user.organizations.find((org) => org.type === 'BLOOD_CENTER');

  if (hasBloodCenterAccess && bloodCenterOrg && bloodCenterOrg.organizationStatus !== 'ACTIVE') {
    const isPending = bloodCenterOrg.organizationStatus === 'PENDING_APPROVAL';
    return (
      <AppShell
        title={isPending ? 'Pending Approval' : 'Organization Unavailable'}
        subtitle="BLOOD CENTER CONSOLE"
        organizationName={bloodCenterOrg.name}
        organizationType="Operations workspace"
        userName={`${user.firstName} ${user.lastName}`}
      >
        <div className="flex flex-col items-center justify-center bc-glass rounded-card p-12 text-center">
          <Clock className="mb-4 text-donor-secondary" size={48} />
          <h2 className="mb-2 font-display text-2xl font-semibold text-donor-text">
            {isPending ? 'Your blood center is pending approval' : 'Organization unavailable'}
          </h2>
          <p className="mb-6 max-w-md text-donor-muted">
            {isPending
              ? `${bloodCenterOrg.name} is still under review by a BloodChain admin. You'll get full access as soon as it's approved.`
              : `${bloodCenterOrg.name} is currently ${bloodCenterOrg.organizationStatus.toLowerCase().replace('_', ' ')}. Contact your BloodChain admin for details.`}
          </p>
          <button
            onClick={handleLogout}
            className="bc-solid rounded-lg px-6 py-3 font-semibold text-donor-text transition-colors hover:bg-donor-elevated"
          >
            Sign out
          </button>
        </div>
      </AppShell>
    );
  }

  if (!hasBloodCenterAccess) {
    return (
      <AppShell
        title="Access Denied"
        subtitle="BLOOD CENTER CONSOLE"
        organizationName={bloodCenterOrg?.name ?? user.organizations[0]?.name ?? 'Blood Center Console'}
        organizationType="Operations workspace"
        userName={`${user.firstName} ${user.lastName}`}
      >
        <div className="flex flex-col items-center justify-center bc-glass rounded-card border-donor-danger/30 bg-donor-dangerMuted p-12">
          <Activity className="mb-4 text-donor-onDangerMuted" size={48} />
          <h2 className="mb-2 font-display text-2xl font-semibold text-donor-text">
            Access Denied
          </h2>
          <p className="mb-6 text-center text-donor-muted">
            You don&apos;t have permission to access the blood center dashboard.
          </p>
          <button
            onClick={handleLogout}
            className="bc-solid rounded-lg px-6 py-3 font-semibold text-donor-text transition-colors hover:bg-donor-elevated"
          >
            Sign out
          </button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={`Good morning, ${user.firstName}.`}
      subtitle="BLOOD CENTER CONSOLE"
      organizationName={bloodCenterOrg?.name ?? 'Blood Center Console'}
      organizationType="Operations workspace"
      userName={`${user.firstName} ${user.lastName}`}
    >
      <div className="mb-8 flex items-center justify-between bc-glass rounded-card p-6">
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
        <div
          className={`hidden bc-glass rounded-card p-5 md:block ${
            alerts && alerts.critical > 0
              ? 'border-donor-danger/30 bg-donor-dangerMuted'
              : 'border-donor-secondary/30 bg-donor-secondaryMuted'
          }`}
        >
          {alerts && alerts.critical > 0 ? (
            <>
              <AlertTriangle className="mb-2 text-donor-onDangerMuted" size={24} />
              <p className="text-sm font-semibold text-donor-text">
                {alerts.critical} critical alert{alerts.critical === 1 ? '' : 's'}
              </p>
              <p className="text-xs text-donor-muted">Needs attention</p>
            </>
          ) : (
            <>
              <Activity className="mb-2 text-donor-secondary" size={24} />
              <p className="text-sm font-semibold text-donor-text">No critical alerts</p>
              <p className="text-xs text-donor-muted">Everything is under control</p>
            </>
          )}
        </div>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <StatCard
          label="Units available"
          value={isLoadingStats || !overview ? '—' : overview.inventory.availableUnits.toString()}
          note={
            isLoadingStats || !overview
              ? 'Loading...'
              : overview.inventory.criticalGroups.length > 0
              ? `Critical: ${overview.inventory.criticalGroups.join(', ')}`
              : 'units on hand'
          }
          icon={Droplet}
          variant={overview && overview.inventory.criticalGroups.length > 0 ? 'danger' : 'success'}
        />
        <StatCard
          label="Pending tests"
          value={isLoadingStats || !laboratory ? '—' : laboratory.summary.pendingTests.toString()}
          note={isLoadingStats || !laboratory ? 'Loading...' : 'Awaiting results'}
          icon={Beaker}
          variant={laboratory && laboratory.summary.pendingTests > 0 ? 'warning' : 'success'}
        />
        <StatCard
          label="Open shipments"
          value={isLoadingStats || !shipments ? '—' : shipments.summary.active.toString()}
          note={isLoadingStats || !shipments ? 'Loading...' : 'In transit'}
          icon={Truck}
          variant="info"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="bc-glass rounded-card p-6 lg:col-span-2">
          <p className="text-xs font-bold uppercase tracking-widest text-donor-muted">
            INVENTORY STATUS
          </p>
          {overview && (
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <p className="text-2xl font-semibold text-donor-text">{overview.inventory.totalUnits}</p>
                <p className="text-xs text-donor-muted">Total units</p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-donor-text">{overview.inventory.availableUnits}</p>
                <p className="text-xs text-donor-muted">Available</p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-donor-text">{overview.inventory.reservedUnits}</p>
                <p className="text-xs text-donor-muted">Reserved</p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-donor-text">{overview.inventory.quarantinedUnits}</p>
                <p className="text-xs text-donor-muted">Quarantined</p>
              </div>
            </div>
          )}
          {overview && overview.inventory.lowStockGroups.length > 0 && (
            <p className="mt-4 text-sm text-donor-onWarningMuted">
              Low stock: {overview.inventory.lowStockGroups.join(', ')}
            </p>
          )}
        </div>

        <div className="bc-glass rounded-card p-6">
          <p className="text-xs font-bold uppercase tracking-widest text-donor-muted">ALERTS</p>
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-donor-text">Critical</span>
              <span className="text-sm font-semibold text-donor-onDangerMuted">
                {alerts?.critical ?? '—'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-donor-text">High</span>
              <span className="text-sm font-semibold text-donor-onWarningMuted">
                {alerts?.high ?? '—'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <Link href="/requests" className="block">
          <EmptyState
            title="View blood requests"
            description="Review and fulfill inbound blood requests from hospitals on the Blood Requests page."
          />
        </Link>
      </div>
    </AppShell>
  );
}
