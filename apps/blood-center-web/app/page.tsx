'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Activity, Clock } from 'lucide-react';
import { EmptyState, StatCard, StatusBadge } from '@bloodchain/ui/components';
import { login, logout as logoutApi, me, isAuthenticated, MeResponse } from '../lib/auth';
import { AppShell } from '../components/AppShell';

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
        }
      } catch (err) {
        console.error('Auth check failed:', err);
      } finally {
        setIsLoading(false);
      }
    }
    checkAuth();
  }, []);

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
        organizationName="Northstar Blood Center (Development)"
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
        organizationName="Northstar Blood Center (Development)"
        organizationType="Operations workspace"
        userName="Guest"
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
                className="w-full rounded-lg border border-donor-border bg-donor-background px-3 py-2.5 text-sm text-donor-text focus:outline-none focus:ring-2 focus:ring-donor-secondary"
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
                className="w-full rounded-lg border border-donor-border bg-donor-background px-3 py-2.5 text-sm text-donor-text focus:outline-none focus:ring-2 focus:ring-donor-secondary"
              />
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
        <div className="flex flex-col items-center justify-center rounded-2xl border border-donor-border bg-donor-surface p-12 text-center">
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
            className="rounded-lg bg-donor-surface px-6 py-3 font-semibold text-donor-text border border-donor-border transition-colors hover:bg-donor-border"
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
        organizationName="Northstar Blood Center (Development)"
        organizationType="Operations workspace"
        userName={`${user.firstName} ${user.lastName}`}
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
      </AppShell>
    );
  }

  return (
    <AppShell
      title={`Good morning, ${user.firstName}.`}
      subtitle="BLOOD CENTER CONSOLE"
      organizationName="Northstar Blood Center (Development)"
      organizationType="Operations workspace"
      userName={`${user.firstName} ${user.lastName}`}
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
    </AppShell>
  );
}
