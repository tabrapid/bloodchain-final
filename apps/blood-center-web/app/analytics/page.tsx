'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  BarChart3,
  Bell,
  Calendar,
  Clock,
  Droplet,
  Package,
  RefreshCw,
  TestTube,
  Truck,
} from 'lucide-react';
import {
  FilterBar,
  StatCard,
} from '@bloodchain/ui/components';
import { me, isAuthenticated, MeResponse } from '../../lib/auth';
import {
  DateRangeType,
  AnalyticsFilter,
  OverviewAnalytics,
  InventoryAnalytics,
  DonationAnalytics,
  LaboratoryAnalytics,
  ShipmentAnalytics,
  getOverviewAnalytics,
  getInventoryAnalytics,
  getDonationAnalytics,
  getLaboratoryAnalytics,
  getShipmentAnalytics,
  getAlerts,
  AlertItem,
} from '../../lib/analytics';
import { AppShell } from '../../components/AppShell';
import { useTranslation } from '@bloodchain/ui/i18n';

/**
 * Keys, not words: this list is built at module load, where there is no
 * locale yet, so the wording is resolved in the component below.
 */
const DATE_RANGE_OPTIONS = [
  { value: DateRangeType.TODAY, labelKey: 'filters.today' },
  { value: DateRangeType.YESTERDAY, labelKey: 'ops.analytics.yesterday' },
  { value: DateRangeType.LAST_7_DAYS, labelKey: 'filters.last7Days' },
  { value: DateRangeType.LAST_30_DAYS, labelKey: 'filters.last30Days' },
  { value: DateRangeType.LAST_90_DAYS, labelKey: 'ops.analytics.last90Days' },
  { value: DateRangeType.THIS_MONTH, labelKey: 'filters.thisMonth' },
  { value: DateRangeType.LAST_MONTH, labelKey: 'ops.analytics.lastMonth' },
  { value: DateRangeType.THIS_YEAR, labelKey: 'filters.thisYear' },
];

const BLOOD_GROUPS = ['A', 'B', 'AB', 'O'];
const RH_FACTORS = ['POSITIVE', 'NEGATIVE'];

function formatKpiValue(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toString();
}

function getTrendNote(trend: string, changePercent: number | null): string {
  if (changePercent === null) return 'No previous data';
  if (changePercent === 0) return 'No change';
  const sign = changePercent > 0 ? '+' : '';
  return `${sign}${changePercent.toFixed(1)}% vs prev period`;
}

export default function AnalyticsPage() {
  const { t } = useTranslation();
  const [user, setUser] = useState<MeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [organizationId, setOrganizationId] = useState<string>('');
  const [dateRange, setDateRange] = useState<DateRangeType>(DateRangeType.LAST_30_DAYS);
  const [bloodType, setBloodType] = useState<string>('');
  const [rhFactor, setRhFactor] = useState<string>('');
  const [overview, setOverview] = useState<OverviewAnalytics | null>(null);
  const [inventory, setInventory] = useState<InventoryAnalytics | null>(null);
  const [donations, setDonations] = useState<DonationAnalytics | null>(null);
  const [laboratory, setLaboratory] = useState<LaboratoryAnalytics | null>(null);
  const [shipments, setShipments] = useState<ShipmentAnalytics | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [activeSection, setActiveSection] = useState<'overview' | 'inventory' | 'donations' | 'laboratory' | 'shipments'>('overview');

  const loadAnalytics = useCallback(async () => {
    if (!organizationId) return;
    setIsLoading(true);

    const filters: AnalyticsFilter = { range: dateRange };
    if (bloodType) filters.bloodType = bloodType;
    if (rhFactor) filters.rhFactor = rhFactor;

    try {
      const [overviewData, inventoryData, donationData, labData, shipmentData, alertsData] = await Promise.all([
        getOverviewAnalytics(organizationId, filters),
        getInventoryAnalytics(organizationId, filters),
        getDonationAnalytics(organizationId, filters),
        getLaboratoryAnalytics(organizationId, filters),
        getShipmentAnalytics(organizationId, filters),
        getAlerts(organizationId),
      ]);

      setOverview(overviewData);
      setInventory(inventoryData);
      setDonations(donationData);
      setLaboratory(labData);
      setShipments(shipmentData);
      setAlerts(alertsData.alerts);
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setIsLoading(false);
    }
  }, [organizationId, dateRange, bloodType, rhFactor]);

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
      loadAnalytics();
    }
  }, [organizationId, loadAnalytics]);

  if (isLoading) {
    return (
      <AppShell
        title={t('ops.common.loadingEllipsis')}
        subtitle={t('portal.bloodCenter.console')}
        organizationName="RedCross Blood Center (Development)"
        organizationType="Blood Center workspace"
        userName={t('ops.common.loadingEllipsis')}
      >
        <div className="flex items-center justify-center p-12">
          <Activity className="animate-spin text-donor-primary" size={32} />
        </div>
      </AppShell>
    );
  }

  if (!user) {
    return (
      <AppShell
        title={t('portal.authRequired')}
        subtitle={t('portal.bloodCenter.console')}
        organizationName="RedCross Blood Center (Development)"
        organizationType="Blood Center workspace"
        userName="Guest"
      >
        <div className="flex flex-col items-center justify-center bc-glass rounded-card p-12">
          <BarChart3 className="mb-4 text-donor-primary" size={48} />
          <h2 className="mb-2 font-display text-2xl font-semibold text-donor-text">
            {t('ops.common.signInRequired')}
          </h2>
          <p className="mb-6 text-center text-donor-muted">
            {t('ops.common.signInToAnalytics')}
          </p>
        </div>
      </AppShell>
    );
  }

  // getAlerts already queries acknowledged: false, so every entry here is open.
  const criticalAlerts = alerts.filter((a) => a.priority === 'CRITICAL');
  const highAlerts = alerts.filter((a) => a.priority === 'HIGH');

  return (
    <AppShell
      title={t('ops.analytics.title')}
      subtitle={t('ops.analytics.intelligence')}
      organizationName="RedCross Blood Center (Development)"
      organizationType="Blood Center Console"
      userName={`${user.firstName} ${user.lastName}`}
    >
      <div className="mb-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold text-donor-text">
              {t('ops.analytics.pageTitle')}
            </h1>
            <p className="text-sm text-donor-muted">
              {t('ops.analytics.pageSubtitle')}
            </p>
          </div>
          <button
            onClick={loadAnalytics}
            className="flex items-center gap-2 rounded-lg bc-solid px-3 py-2 text-sm text-donor-text transition-colors hover:bg-donor-elevated"
          >
            <RefreshCw size={14} />
            {t('actions.refresh')}
          </button>
        </div>

        <FilterBar>
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-donor-muted">{t('ops.analytics.period')}</label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as DateRangeType)}
              className="rounded-lg bc-solid px-2 py-1 text-xs text-donor-text"
            >
              {DATE_RANGE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {t(opt.labelKey)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-donor-muted">{t('ops.analytics.blood')}</label>
            <select
              value={bloodType}
              onChange={(e) => setBloodType(e.target.value)}
              className="rounded-lg bc-solid px-2 py-1 text-xs text-donor-text"
            >
              <option value="">{t('filters.allTypes')}</option>
              {BLOOD_GROUPS.map((bt) => (
                <option key={bt} value={bt}>{bt}</option>
              ))}
            </select>
            <select
              value={rhFactor}
              onChange={(e) => setRhFactor(e.target.value)}
              className="rounded-lg bc-solid px-2 py-1 text-xs text-donor-text"
            >
              <option value="">{t('ops.analytics.allRh')}</option>
              {RH_FACTORS.map((rh) => (
                <option key={rh} value={rh}>{rh === 'POSITIVE' ? '+' : '-'}</option>
              ))}
            </select>
          </div>
        </FilterBar>
      </div>

      <div className="mb-6 flex flex-wrap gap-2" role="tablist" aria-label={t('ops.analytics.section')}>
        {(['overview', 'inventory', 'donations', 'laboratory', 'shipments'] as const).map((section) => (
          <button
            key={section}
            role="tab"
            aria-selected={activeSection === section}
            onClick={() => setActiveSection(section)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-donor-primary/60 ${
              activeSection === section
                ? 'bg-donor-primary text-white'
                : 'bc-solid text-donor-text hover:bg-donor-elevated'
            }`}
          >
            {section.charAt(0).toUpperCase() + section.slice(1)}
          </button>
        ))}
      </div>

      {activeSection === 'overview' && overview && (
        <>
          <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label={t('ops.inventory.totalInventory')}
              value={overview.inventory.totalUnits.toString()}
              icon={Package}
              variant={overview.inventory.criticalGroups.length > 0 ? 'danger' : 'default'}
            />
            <StatCard
              label={t('ops.inventory.availableUnits')}
              value={overview.inventory.availableUnits.toString()}
              variant="success"
            />
            <StatCard
              label={t('ops.dashboard.pendingRequests')}
              value={overview.requests.pending.value.toString()}
              note={getTrendNote(overview.requests.pending.trend, overview.requests.pending.changePercent)}
              icon={Droplet}
              variant={overview.requests.pending.value > 0 ? 'warning' : 'success'}
            />
            <StatCard
              label={t('ops.analytics.criticalAlerts')}
              value={overview.alerts.critical.toString()}
              icon={Bell}
              variant={overview.alerts.critical > 0 ? 'danger' : 'success'}
            />
          </div>

          <div className="mb-6 grid gap-4 md:grid-cols-2">
            <div className="bc-glass rounded-card p-5">
              <h3 className="mb-4 text-sm font-semibold text-donor-text">{t('ops.inventory.summary')}</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-donor-muted">{t('ops.dashboard.totalUnits')}</span>
                  <span className="font-semibold text-donor-text">{overview.inventory.totalUnits}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-donor-muted">{t('status.unit.AVAILABLE')}</span>
                  <span className="font-semibold text-donor-success">{overview.inventory.availableUnits}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-donor-muted">{t('status.unit.RESERVED')}</span>
                  <span className="font-semibold text-donor-warning">{overview.inventory.reservedUnits}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-donor-muted">{t('status.unit.QUARANTINED')}</span>
                  <span className="font-semibold text-donor-warning">{overview.inventory.quarantinedUnits}</span>
                </div>
              </div>
              {overview.inventory.criticalGroups.length > 0 && (
                <div className="mt-4 rounded-lg bg-donor-dangerMuted p-3">
                  <p className="text-xs font-semibold text-donor-onDangerMuted">{t('ops.inventory.criticalGroups')}</p>
                  <p className="text-xs text-donor-muted">{overview.inventory.criticalGroups.join(', ')}</p>
                </div>
              )}
            </div>

            <div className="bc-glass rounded-card p-5">
              <h3 className="mb-4 text-sm font-semibold text-donor-text">{t('ops.donations.title')}</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-donor-muted">{t('table.total')}</span>
                  <span className="font-semibold text-donor-text">{formatKpiValue(overview.donations.total.value)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-donor-muted">{t('table.completedAt')}</span>
                  <span className="font-semibold text-donor-success">{formatKpiValue(overview.donations.completed.value)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-donor-muted">{t('appointment.cancelledNotice')}</span>
                  <span className="font-semibold text-donor-danger">{formatKpiValue(overview.donations.cancelled.value)}</span>
                </div>
              </div>
              <div className="mt-4">
                <p className="mb-2 text-xs font-semibold text-donor-muted">{t('filters.byBloodGroup')}</p>
                <div className="flex flex-wrap gap-2">
                  {overview.donations.byBloodGroup.map((bg) => (
                    <span key={bg.fullName} className="rounded-full bg-donor-elevated px-2 py-1 text-xs text-donor-text">
                      {bg.fullName}: {bg.count}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label={t('ops.analytics.totalRequests')}
              value={overview.requests.total.value.toString()}
              note={getTrendNote(overview.requests.total.trend, overview.requests.total.changePercent)}
              icon={Droplet}
            />
            <StatCard
              label={t('ops.requests.fulfilled')}
              value={overview.requests.fulfilled.value.toString()}
              variant="success"
            />
            <StatCard
              label={t('portal.nav.appointments')}
              value={overview.appointments.total.value.toString()}
              note={getTrendNote(overview.appointments.total.trend, overview.appointments.total.changePercent)}
              icon={Calendar}
            />
            <StatCard
              label={t('ops.analytics.completionRate')}
              value={overview.appointments.completionRate ? `${overview.appointments.completionRate.toFixed(1)}%` : 'N/A'}
              variant={overview.appointments.completionRate && overview.appointments.completionRate > 80 ? 'success' : 'warning'}
            />
          </div>
        </>
      )}

      {activeSection === 'inventory' && inventory && (
        <>
          <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <StatCard
              label={t('ops.dashboard.totalUnits')}
              value={inventory.summary.totalUnits.toString()}
              icon={Package}
            />
            <StatCard
              label={t('status.unit.AVAILABLE')}
              value={inventory.summary.availableUnits.toString()}
              variant="success"
            />
            <StatCard
              label={t('status.unit.RESERVED')}
              value={inventory.summary.reservedUnits.toString()}
              variant="warning"
            />
            <StatCard
              label={t('status.unit.QUARANTINED')}
              value={inventory.summary.quarantinedUnits.toString()}
              variant="danger"
            />
            <StatCard
              label={t('status.unit.EXPIRED')}
              value={inventory.summary.expiredUnits.toString()}
              variant="danger"
            />
          </div>

          <div className="mb-6 bc-glass rounded-card p-5">
            <h3 className="mb-4 text-sm font-semibold text-donor-text">{t('ops.inventory.byBloodGroup')}</h3>
            <div className="grid gap-3 md:grid-cols-4 lg:grid-cols-8">
              {inventory.byBloodGroup.map((bg) => (
                <div key={bg.fullName} className="rounded-lg bg-donor-elevated p-3 text-center">
                  <p className="text-lg font-bold text-donor-text">{bg.fullName}</p>
                  <p className="text-2xl font-bold text-donor-primary">{bg.count}</p>
                  <p className="text-xs text-donor-muted">{bg.percent.toFixed(1)}%</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bc-glass rounded-card p-5">
            <h3 className="mb-4 text-sm font-semibold text-donor-text">{t('ops.inventory.byComponent')}</h3>
            <div className="space-y-3">
              {inventory.byComponent.map((comp) => (
                <div key={comp.componentType} className="flex items-center justify-between rounded-lg bg-donor-elevated p-3">
                  <span className="text-sm font-medium text-donor-text">{comp.componentType}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-donor-success">Avail: {comp.available}</span>
                    <span className="text-xs text-donor-warning">Res: {comp.reserved}</span>
                    <span className="text-sm font-semibold text-donor-primary">{comp.count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {activeSection === 'donations' && donations && (
        <>
          <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <StatCard
              label={t('table.total')}
              value={donations.summary.total.toString()}
              icon={Droplet}
            />
            <StatCard
              label={t('table.completedAt')}
              value={donations.summary.completed.toString()}
              variant="success"
            />
            <StatCard
              label={t('appointment.cancelledNotice')}
              value={donations.summary.cancelled.toString()}
              variant="danger"
            />
            <StatCard
              label={t('ops.analytics.noShows')}
              value={donations.summary.noShows.toString()}
              variant="warning"
            />
            <StatCard
              label={t('ops.analytics.completionRate')}
              value={donations.summary.completionRate ? `${donations.summary.completionRate.toFixed(1)}%` : 'N/A'}
              variant={donations.summary.completionRate && donations.summary.completionRate > 80 ? 'success' : 'warning'}
            />
          </div>

          <div className="mb-6 grid gap-4 md:grid-cols-2">
            <div className="bc-glass rounded-card p-5">
              <h3 className="mb-4 text-sm font-semibold text-donor-text">{t('filters.byBloodGroup')}</h3>
              <div className="grid gap-3 md:grid-cols-4 lg:grid-cols-8">
                {donations.byBloodGroup.map((bg) => (
                  <div key={bg.fullName} className="rounded-lg bg-donor-elevated p-3 text-center">
                    <p className="text-lg font-bold text-donor-text">{bg.fullName}</p>
                    <p className="text-2xl font-bold text-donor-danger">{bg.count}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bc-glass rounded-card p-5">
              <h3 className="mb-4 text-sm font-semibold text-donor-text">{t('filters.byStatus')}</h3>
              <div className="space-y-2">
                {donations.byStatus.map((s) => (
                  <div key={s.status} className="flex justify-between rounded-lg bg-donor-elevated p-3">
                    <span className="text-sm text-donor-muted">{s.status}</span>
                    <span className="font-semibold text-donor-text">{s.count} ({s.percent.toFixed(1)}%)</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {activeSection === 'laboratory' && laboratory && (
        <>
          <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label={t('ops.laboratory.totalTests')}
              value={laboratory.summary.totalTests.toString()}
              icon={TestTube}
            />
            <StatCard
              label={t('status.request.SUBMITTED')}
              value={laboratory.summary.pendingTests.toString()}
              variant={laboratory.summary.pendingTests > 0 ? 'warning' : 'success'}
            />
            <StatCard
              label={t('table.completedAt')}
              value={laboratory.summary.completedTests.toString()}
              variant="success"
            />
            <StatCard
              label={t('ops.analytics.avgTurnaround')}
              value={laboratory.summary.avgProcessingTimeHours ? `${laboratory.summary.avgProcessingTimeHours.toFixed(1)}h` : 'N/A'}
              icon={Clock}
            />
          </div>

          <div className="bc-glass rounded-card p-5">
            <h3 className="mb-4 text-sm font-semibold text-donor-text">{t('filters.byStatus')}</h3>
            <div className="space-y-2">
              {laboratory.byStatus.map((s) => (
                <div key={s.status} className="flex justify-between rounded-lg bg-donor-elevated p-3">
                  <span className="text-sm text-donor-muted">{s.status}</span>
                  <span className="font-semibold text-donor-text">{s.count} ({s.percent.toFixed(1)}%)</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {activeSection === 'shipments' && shipments && (
        <>
          <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <StatCard
              label={t('ops.analytics.totalShipments')}
              value={shipments.summary.total.toString()}
              icon={Truck}
            />
            <StatCard
              label={t('status.emergency.ACTIVE')}
              value={shipments.summary.active.toString()}
              variant="info"
            />
            <StatCard
              label={t('status.shipment.DELIVERED')}
              value={shipments.summary.delivered.toString()}
              variant="success"
            />
            <StatCard
              label={t('ops.analytics.delayed')}
              value={shipments.summary.delayed.toString()}
              variant="warning"
            />
            <StatCard
              label={t('status.shipment.FAILED')}
              value={shipments.summary.failed.toString()}
              variant="danger"
            />
          </div>

          <div className="bc-glass rounded-card p-5">
            <h3 className="mb-4 text-sm font-semibold text-donor-text">{t('filters.byStatus')}</h3>
            <div className="space-y-2">
              {shipments.byStatus.map((s) => (
                <div key={s.status} className="flex justify-between rounded-lg bg-donor-elevated p-3">
                  <span className="text-sm text-donor-muted">{s.status}</span>
                  <span className="font-semibold text-donor-text">{s.count} ({s.percent.toFixed(1)}%)</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {(criticalAlerts.length > 0 || highAlerts.length > 0) && (
        <div className="mt-6 bc-glass rounded-card border-donor-danger/30 bg-donor-dangerMuted p-5">
          <div className="mb-3 flex items-center gap-2">
            <Bell className="text-donor-onDangerMuted" size={18} />
            <h3 className="text-sm font-semibold text-donor-onDangerMuted">{t('ops.dashboard.activeAlerts')}</h3>
          </div>
          <div className="space-y-2">
            {criticalAlerts.slice(0, 5).map((alert) => (
              <div key={alert.id} className="flex items-start gap-3 rounded-lg bg-donor-dangerMuted p-3">
                <AlertTriangle className="mt-0.5 text-donor-onDangerMuted" size={14} />
                <div>
                  <p className="text-sm font-semibold text-donor-onDangerMuted">{alert.title}</p>
                  <p className="text-xs text-donor-muted">{alert.message}</p>
                </div>
              </div>
            ))}
            {highAlerts.slice(0, 5).map((alert) => (
              <div key={alert.id} className="flex items-start gap-3 rounded-lg bg-donor-warningMuted p-3">
                <AlertCircle className="mt-0.5 text-donor-onWarningMuted" size={14} />
                <div>
                  <p className="text-sm font-semibold text-donor-onWarningMuted">{alert.title}</p>
                  <p className="text-xs text-donor-muted">{alert.message}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </AppShell>
  );
}
