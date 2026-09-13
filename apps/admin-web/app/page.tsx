'use client';

import { useEffect, useState } from 'react';
import { LanguageSwitcher, useTranslation } from '@bloodchain/ui/i18n';
import Link from 'next/link';
import {
  AlertTriangle,
  Shield,
  TestTube,
  UserCheck,
  X,
  Users,
  Building2,
  Droplet,
  Package,
  Ship,
  Clock,
  Activity,
} from 'lucide-react';
import { StatCard, LoadingState } from '@bloodchain/ui/components';
import { StatusBadgeWrapper } from '@lib/status';
import { login, me, isAuthenticated } from '@lib/auth';
import {
  getDashboard,
  listOrganizations,
  listEmergencies,
  listAlerts,
  getSystemHealth,
} from '@lib/api';
import { AppShell } from '../components/AppShell';

interface PlatformStats {
  users: { total: number; active: number; verifiedDonors: number };
  organizations: { hospitals: number; bloodCenters: number; pending: number; suspended: number };
  couriers: number;
  bloodRequests: { active: number; critical: number };
  emergencies: { active: number };
  shipments: { active: number };
  todayActivity: { donations: number; appointments: number; bloodTests: number };
  alerts: { lowStock: number; criticalStock: number };
}

interface User {
  firstName: string;
  lastName: string;
  roles: string[];
}

export default function AdminDashboard() {
  const { t } = useTranslation();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [pendingOrgs, setPendingOrgs] = useState<any[]>([]);
  const [activeEmergencies, setActiveEmergencies] = useState<any[]>([]);
  const [activeAlerts, setActiveAlerts] = useState<any[]>([]);
  const [health, setHealth] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      try {
        if (isAuthenticated()) {
          const userData = await me();
          if (!userData.roles.includes('SUPER_ADMIN')) {
            setError('Access denied. Super Admin role required.');
            setIsLoading(false);
            return;
          }
          setUser({
            firstName: userData.firstName,
            lastName: userData.lastName,
            roles: userData.roles,
          });
          await loadDashboardData();
        }
      } catch {
        setError('Authentication failed');
      } finally {
        setIsLoading(false);
      }
    }
    checkAuth();
  }, []);

  async function loadDashboardData() {
    try {
      const [statsData, healthData] = await Promise.all([
        getDashboard(),
        getSystemHealth(),
      ]);
      setStats(statsData);
      setHealth(healthData);

      const [orgsData, emergenciesData, alertsData] = await Promise.all([
        listOrganizations({ status: 'PENDING_APPROVAL', limit: 5 }),
        listEmergencies({ status: 'ACTIVE', limit: 5 }),
        listAlerts({ acknowledged: 'false', limit: 10 }),
      ]);
      setPendingOrgs(orgsData.data);
      setActiveEmergencies(emergenciesData.data);
      setActiveAlerts(alertsData.data);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    }
  }

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
      });
      await loadDashboardData();
    } catch (err: any) {
      // The server's own message when it has one; it is not translated yet,
      // which is a Sprint 1B item, so the generic fallback is.
      setError(err.message ?? t('common.error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <AppShell title={t('portal.admin.dashboard')} userName={user ? `${user.firstName} ${user.lastName}` : undefined}>
        <LoadingState />
      </AppShell>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bc-app-bg flex items-center justify-center">
        <div className="bc-glass rounded-card p-8 w-full max-w-md">
        {/* A signed-out admin who cannot read this page has no other way to
            change it: the console's switcher lives in the top bar, which only
            renders once you are inside. */}
        <div className="mb-4 flex justify-end">
          <LanguageSwitcher />
        </div>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-donor-primary rounded-lg flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-donor-text">{t('portal.admin.name')}</h1>
              <p className="text-sm text-donor-muted">{t('portal.admin.workspace')}</p>
            </div>
          </div>

          <h2 className="text-lg font-medium text-donor-text mb-4">{t('portal.signInTitle')}</h2>

          {error && (
            <div className="mb-4 p-3 bg-donor-dangerMuted border border-donor-danger/30 rounded-lg text-sm text-donor-onDangerMuted">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-donor-text mb-1">
                {t('portal.email')}
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg bc-solid px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-donor-primary focus:border-transparent"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-donor-text mb-1">
                {t('portal.password')}
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg bc-solid px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-donor-primary focus:border-transparent"
              />
            </div>
            {/* With the password field it belongs to, above the button --
                where someone looks after mistyping it twice. */}
            <div className="flex justify-end">
              <Link
                href="/forgot-password"
                className="text-xs font-medium text-donor-primary hover:underline"
              >
                {t('portal.forgotPassword')}
              </Link>
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-donor-primary text-white py-2.5 px-4 rounded-lg font-medium hover:bg-donor-primary/85 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? t('portal.signingIn') : t('portal.signIn')}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <AppShell title={t('portal.admin.dashboard')} userName={user ? `${user.firstName} ${user.lastName}` : undefined}>
      <div className="p-6">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-donor-text">Platform Dashboard</h1>
          <p className="text-sm text-donor-muted mt-1">Real-time overview of the BloodChain</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-donor-warningMuted border border-donor-warning/30 rounded-lg flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-donor-onWarningMuted" />
            <p className="text-sm text-donor-onWarningMuted">{error}</p>
            <button onClick={() => setError(null)} className="ml-auto">
              <X className="w-4 h-4 text-donor-onWarningMuted" />
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Total Users"
            value={String(stats?.users.total ?? '-')}
            icon={Users}
            note={`${stats?.users.active ?? 0} active`}
          />
          <StatCard
            label="Verified Donors"
            value={String(stats?.users.verifiedDonors ?? '-')}
            icon={UserCheck}
            note="Active donors"
          />
          <StatCard
            label="Hospitals"
            value={String(stats?.organizations.hospitals ?? '-')}
            icon={Building2}
            note={`${stats?.organizations.pending ?? 0} pending`}
          />
          <StatCard
            label="Blood Centers"
            value={String(stats?.organizations.bloodCenters ?? '-')}
            icon={Droplet}
            note={`${stats?.organizations.suspended ?? 0} suspended`}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Active Shipments"
            value={String(stats?.shipments.active ?? '-')}
            icon={Package}
            note="In transit"
          />
          <StatCard
            label="Active Emergencies"
            value={String(stats?.emergencies.active ?? '-')}
            icon={AlertTriangle}
            note="SOS requests"
          />
          <StatCard
            label="Blood Requests"
            value={String(stats?.bloodRequests.active ?? '-')}
            icon={Droplet}
            note={`${stats?.bloodRequests.critical ?? 0} critical`}
          />
          <StatCard
            label="Couriers"
            value={String(stats?.couriers ?? '-')}
            icon={Ship}
            note="Registered"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <StatCard
            label="Donations Today"
            value={String(stats?.todayActivity.donations ?? '-')}
            icon={TestTube}
            note="Completed"
          />
          <StatCard
            label="Appointments Today"
            value={String(stats?.todayActivity.appointments ?? '-')}
            icon={Clock}
            note="Scheduled"
          />
          <StatCard
            label="Blood Tests Today"
            value={String(stats?.todayActivity.bloodTests ?? '-')}
            icon={Activity}
            note="Processed"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bc-glass rounded-card overflow-hidden">
            <div className="px-4 py-3 border-b border-donor-border/40 flex items-center justify-between">
              <h3 className="font-medium text-donor-text">Pending Organizations</h3>
              <span className="text-sm text-donor-warning font-medium">{pendingOrgs.length}</span>
            </div>
            <div className="divide-y divide-donor-border/40">
              {pendingOrgs.length === 0 ? (
                <div className="p-4 text-sm text-donor-muted text-center">No pending organizations</div>
              ) : (
                pendingOrgs.map((org) => (
                  <div key={org.id} className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-donor-text">{org.name}</p>
                      <p className="text-sm text-donor-muted">{org.type}</p>
                    </div>
                    <StatusBadgeWrapper status="PENDING_APPROVAL" />
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bc-glass rounded-card overflow-hidden">
            <div className="px-4 py-3 border-b border-donor-border/40 flex items-center justify-between">
              <h3 className="font-medium text-donor-text">Active Emergencies</h3>
              <span className="text-sm text-donor-danger font-medium">{activeEmergencies.length}</span>
            </div>
            <div className="divide-y divide-donor-border/40">
              {activeEmergencies.length === 0 ? (
                <div className="p-4 text-sm text-donor-muted text-center">No active emergencies</div>
              ) : (
                activeEmergencies.map((emergency) => (
                  <div key={emergency.id} className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-donor-text">
                        {emergency.bloodType}{emergency.rhFactor} - {emergency.unitsRequired} units
                      </p>
                      <p className="text-sm text-donor-muted">{emergency.hospital?.name}</p>
                    </div>
                    <StatusBadgeWrapper status={emergency.status} />
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bc-glass rounded-card overflow-hidden">
            <div className="px-4 py-3 border-b border-donor-border/40 flex items-center justify-between">
              <h3 className="font-medium text-donor-text">Active Alerts</h3>
              <span className="text-sm text-donor-danger font-medium">{activeAlerts.length}</span>
            </div>
            <div className="divide-y divide-donor-border/40">
              {activeAlerts.length === 0 ? (
                <div className="p-4 text-sm text-donor-muted text-center">No active alerts</div>
              ) : (
                activeAlerts.slice(0, 5).map((alert) => (
                  <div key={alert.id} className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-donor-text">{alert.message}</p>
                      <p className="text-sm text-donor-muted">{alert.type}</p>
                    </div>
                    <StatusBadgeWrapper status={alert.type === 'LOW_STOCK' ? 'WARNING' : 'INFO'} />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 bc-glass rounded-card p-4">
          <h3 className="font-medium text-donor-text mb-4">System Health</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${health?.status === 'healthy' ? 'bg-donor-success' : 'bg-donor-danger'}`} />
              <span className="text-sm text-donor-muted">API Status</span>
              <span className="text-sm font-medium text-donor-text ml-auto">{health?.status ?? '-'}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${health?.database === 'up' ? 'bg-donor-success' : 'bg-donor-danger'}`} />
              <span className="text-sm text-donor-muted">Database</span>
              <span className="text-sm font-medium text-donor-text ml-auto">{health?.database ?? '-'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-donor-muted">Pending Orgs</span>
              <span className="text-sm font-medium text-donor-text ml-auto">{health?.pending?.organizations ?? '-'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-donor-muted">Active Alerts</span>
              <span className="text-sm font-medium text-donor-text ml-auto">{health?.alerts ?? '-'}</span>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
