'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '@bloodchain/ui/i18n';
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
  const { t } = useTranslation();
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
      // The server's own message when it has one; it is not translated yet,
      // which is a Sprint 1B item, so the generic fallback is.
      setError(err.message ?? t('common.error'));
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
        title={t('common.loading')}
        subtitle={t('portal.bloodCenter.console')}
        organizationName={t('portal.bloodCenter.name')}
        organizationType={t('portal.bloodCenter.workspace')}
        userName={t('common.loading')}
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
        title={t('portal.authRequired')}
        subtitle={t('portal.bloodCenter.console')}
        organizationName={t('portal.bloodCenter.name')}
        organizationType={t('portal.bloodCenter.workspace')}
        userName={t('portal.guest')}
      >
        <div className="flex flex-col items-center justify-center bc-glass rounded-card p-12">
          <Activity className="mb-4 text-donor-secondary" size={48} />
          <h2 className="mb-2 font-display text-2xl font-semibold text-donor-text">
            {t('portal.bloodCenter.name')}
          </h2>
          <p className="mb-6 text-center text-donor-muted">
            {t('portal.signInSubtitle', { portal: t('portal.bloodCenter.name') })}
          </p>
          {error && <p className="mb-4 text-sm text-donor-danger">{error}</p>}
          <form onSubmit={handleLogin} className="w-full max-w-xs space-y-3">
            <div>
              <label htmlFor="email" className="mb-1 block text-left text-xs font-medium text-donor-muted">
                {t('portal.email')}
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
                {t('portal.password')}
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
                {t('portal.forgotPassword')}
              </Link>
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg bg-donor-secondary px-6 py-3 font-semibold text-white transition-colors hover:bg-donor-secondary/80 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? t('portal.signingIn') : t('portal.signIn')}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-donor-muted">
            {t('portal.registerPrompt', { portal: t('portal.bloodCenter.name') })}{' '}
            <Link href="/register" className="font-semibold text-donor-secondary hover:underline">
              {t('portal.registerLink')}
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
        title={isPending ? t('portal.pendingApproval') : 'Organization Unavailable'}
        subtitle={t('portal.bloodCenter.console')}
        organizationName={bloodCenterOrg.name}
        organizationType={t('portal.bloodCenter.workspace')}
        userName={`${user.firstName} ${user.lastName}`}
      >
        <div className="flex flex-col items-center justify-center bc-glass rounded-card p-12 text-center">
          <Clock className="mb-4 text-donor-secondary" size={48} />
          <h2 className="mb-2 font-display text-2xl font-semibold text-donor-text">
            {isPending
              ? t('ops.dashboard.pendingApprovalBloodCenter')
              : t('ops.common.organizationUnavailable')}
          </h2>
          <p className="mb-6 max-w-md text-donor-muted">
            {isPending
              ? t('ops.dashboard.pendingApprovalBody', { name: bloodCenterOrg.name })
              : t('ops.dashboard.organizationStatusBody', {
                  name: bloodCenterOrg.name,
                  status: t(`status.organization.${bloodCenterOrg.organizationStatus}`),
                })}
          </p>
          <button
            onClick={handleLogout}
            className="bc-solid rounded-lg px-6 py-3 font-semibold text-donor-text transition-colors hover:bg-donor-elevated"
          >
            {t('portal.signOut')}
          </button>
        </div>
      </AppShell>
    );
  }

  if (!hasBloodCenterAccess) {
    return (
      <AppShell
        title={t('portal.accessDenied')}
        subtitle={t('portal.bloodCenter.console')}
        organizationName={bloodCenterOrg?.name ?? user.organizations[0]?.name ?? t('portal.bloodCenter.name')}
        organizationType={t('portal.bloodCenter.workspace')}
        userName={`${user.firstName} ${user.lastName}`}
      >
        <div className="flex flex-col items-center justify-center bc-glass rounded-card border-donor-danger/30 bg-donor-dangerMuted p-12">
          <Activity className="mb-4 text-donor-onDangerMuted" size={48} />
          <h2 className="mb-2 font-display text-2xl font-semibold text-donor-text">
            {t('portal.accessDenied')}
          </h2>
          <p className="mb-6 text-center text-donor-muted">
            {t('portal.accessDeniedBody')}
          </p>
          <button
            onClick={handleLogout}
            className="bc-solid rounded-lg px-6 py-3 font-semibold text-donor-text transition-colors hover:bg-donor-elevated"
          >
            {t('portal.signOut')}
          </button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={`Good morning, ${user.firstName}.`}
      subtitle={t('portal.bloodCenter.console')}
      organizationName={bloodCenterOrg?.name ?? t('portal.bloodCenter.name')}
      organizationType={t('portal.bloodCenter.workspace')}
      userName={`${user.firstName} ${user.lastName}`}
    >
      <div className="mb-8 flex items-center justify-between bc-glass rounded-card p-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-donor-muted">
            {t('ops.dashboard.centerOverview')}
          </p>
          <h2 className="mt-2 font-display text-4xl font-semibold tracking-tight text-donor-text">
            {t('ops.dashboard.everyUnit')} <span className="text-donor-secondary">{t('ops.dashboard.accountedFor')}</span>
          </h2>
          <p className="mt-2 text-sm text-donor-muted">
            {t('portal.tagline')}
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
              <p className="text-xs text-donor-muted">{t('ops.dashboard.needsAttention')}</p>
            </>
          ) : (
            <>
              <Activity className="mb-2 text-donor-secondary" size={24} />
              <p className="text-sm font-semibold text-donor-text">{t('ops.dashboard.noCriticalAlerts')}</p>
              <p className="text-xs text-donor-muted">{t('ops.dashboard.underControl')}</p>
            </>
          )}
        </div>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <StatCard
          label={t('ops.dashboard.unitsAvailable')}
          value={isLoadingStats || !overview ? '—' : overview.inventory.availableUnits.toString()}
          note={
            isLoadingStats || !overview
              ? t('common.loading')
              : overview.inventory.criticalGroups.length > 0
              ? t('ops.dashboard.criticalGroups', { groups: overview.inventory.criticalGroups.join(', ') })
              : t('ops.dashboard.unitsOnHand')
          }
          icon={Droplet}
          variant={overview && overview.inventory.criticalGroups.length > 0 ? 'danger' : 'success'}
        />
        <StatCard
          label={t('ops.dashboard.pendingTests')}
          value={isLoadingStats || !laboratory ? '—' : laboratory.summary.pendingTests.toString()}
          note={isLoadingStats || !laboratory ? t('common.loading') : t('ops.dashboard.awaitingResults')}
          icon={Beaker}
          variant={laboratory && laboratory.summary.pendingTests > 0 ? 'warning' : 'success'}
        />
        <StatCard
          label={t('ops.dashboard.openShipments')}
          value={isLoadingStats || !shipments ? '—' : shipments.summary.active.toString()}
          note={isLoadingStats || !shipments ? t('common.loading') : t('ops.dashboard.inTransit')}
          icon={Truck}
          variant="info"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="bc-glass rounded-card p-6 lg:col-span-2">
          <p className="text-xs font-bold uppercase tracking-widest text-donor-muted">
            {t('ops.common.inventoryStatus')}
          </p>
          {overview && (
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <p className="text-2xl font-semibold text-donor-text">{overview.inventory.totalUnits}</p>
                <p className="text-xs text-donor-muted">{t('ops.dashboard.totalUnits')}</p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-donor-text">{overview.inventory.availableUnits}</p>
                <p className="text-xs text-donor-muted">{t('status.unit.AVAILABLE')}</p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-donor-text">{overview.inventory.reservedUnits}</p>
                <p className="text-xs text-donor-muted">{t('status.unit.RESERVED')}</p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-donor-text">{overview.inventory.quarantinedUnits}</p>
                <p className="text-xs text-donor-muted">{t('status.unit.QUARANTINED')}</p>
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
          <p className="text-xs font-bold uppercase tracking-widest text-donor-muted">{t('ops.common.alerts')}</p>
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-donor-text">{t('medical.resultFlagsByCode.CRITICAL')}</span>
              <span className="text-sm font-semibold text-donor-onDangerMuted">
                {alerts?.critical ?? '—'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-donor-text">{t('ops.common.high')}</span>
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
            title={t('ops.dashboard.viewBloodRequests')}
            description={t('ops.dashboard.viewBloodRequestsHint')}
          />
        </Link>
      </div>
    </AppShell>
  );
}
