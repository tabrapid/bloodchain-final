'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  BarChart3,
  Bell,
  Calendar,
  Droplet,
  Package,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import {
  DashboardShell,
  EmptyState,
  FilterBar,
  StatCard,
} from '@donor/ui/components';
import { logout as logoutApi, me, isAuthenticated, MeResponse } from '../../lib/auth';
import {
  DateRangeType,
  AnalyticsFilter,
  OverviewAnalytics,
  InventoryAnalytics,
  EmergencyAnalytics,
  AppointmentAnalytics,
  getOverviewAnalytics,
  getInventoryAnalytics,
  getEmergencyAnalytics,
  getAppointmentAnalytics,
  getAlerts,
  AlertItem,
} from '../../lib/analytics';
import { sidebarItems } from '../../lib/navigation';

const DATE_RANGE_OPTIONS = [
  { value: DateRangeType.TODAY, label: 'Today' },
  { value: DateRangeType.YESTERDAY, label: 'Yesterday' },
  { value: DateRangeType.LAST_7_DAYS, label: 'Last 7 Days' },
  { value: DateRangeType.LAST_30_DAYS, label: 'Last 30 Days' },
  { value: DateRangeType.LAST_90_DAYS, label: 'Last 90 Days' },
  { value: DateRangeType.THIS_MONTH, label: 'This Month' },
  { value: DateRangeType.LAST_MONTH, label: 'Last Month' },
  { value: DateRangeType.THIS_YEAR, label: 'This Year' },
];

const BLOOD_GROUPS = ['A', 'B', 'AB', 'O'];
const RH_FACTORS = ['POSITIVE', 'NEGATIVE'];

function formatKpiValue(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toString();
}

function getTrendIcon(trend: string) {
  switch (trend) {
    case 'up':
      return <TrendingUp size={14} className="text-green-400" />;
    case 'down':
      return <TrendingDown size={14} className="text-red-400" />;
    default:
      return null;
  }
}

function getTrendNote(trend: string, changePercent: number | null): string {
  if (changePercent === null) return 'No previous data';
  if (changePercent === 0) return 'No change';
  const sign = changePercent > 0 ? '+' : '';
  return `${sign}${changePercent.toFixed(1)}% vs prev period`;
}

export default function AnalyticsPage() {
  const [user, setUser] = useState<MeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [organizationId, setOrganizationId] = useState<string>('');
  const [dateRange, setDateRange] = useState<DateRangeType>(DateRangeType.LAST_30_DAYS);
  const [bloodType, setBloodType] = useState<string>('');
  const [rhFactor, setRhFactor] = useState<string>('');
  const [overview, setOverview] = useState<OverviewAnalytics | null>(null);
  const [inventory, setInventory] = useState<InventoryAnalytics | null>(null);
  const [emergencies, setEmergencies] = useState<EmergencyAnalytics | null>(null);
  const [appointments, setAppointments] = useState<AppointmentAnalytics | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [activeSection, setActiveSection] = useState<'overview' | 'inventory' | 'emergencies' | 'appointments'>('overview');

  const loadAnalytics = useCallback(async () => {
    if (!organizationId) return;
    setIsLoading(true);

    const filters: AnalyticsFilter = { range: dateRange };
    if (bloodType) filters.bloodType = bloodType;
    if (rhFactor) filters.rhFactor = rhFactor;

    try {
      const [overviewData, inventoryData, emergencyData, appointmentData, alertsData] = await Promise.all([
        getOverviewAnalytics(organizationId, filters),
        getInventoryAnalytics(organizationId, filters),
        getEmergencyAnalytics(organizationId, filters),
        getAppointmentAnalytics(organizationId, filters),
        getAlerts(organizationId),
      ]);

      setOverview(overviewData);
      setInventory(inventoryData);
      setEmergencies(emergencyData);
      setAppointments(appointmentData);
      setAlerts(alertsData);
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
      loadAnalytics();
    }
  }, [organizationId, loadAnalytics]);

  if (isLoading) {
    return (
      <DashboardShell
        title="Loading..."
        subtitle="HOSPITAL CONSOLE"
        activeItem="analytics"
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
          <BarChart3 className="mb-4 text-donor-primary" size={48} />
          <h2 className="mb-2 font-display text-2xl font-semibold text-donor-text">
            Sign In Required
          </h2>
          <p className="mb-6 text-center text-donor-muted">
            Please sign in to access the analytics dashboard
          </p>
        </div>
      </DashboardShell>
    );
  }

  const criticalAlerts = alerts.filter((a) => a.severity === 'critical' && !a.acknowledged);
  const highAlerts = alerts.filter((a) => a.severity === 'high' && !a.acknowledged);

  return (
    <DashboardShell
      title="Analytics Dashboard"
      subtitle="OPERATIONS INTELLIGENCE"
      activeItem="analytics"
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
              Operations Analytics
            </h1>
            <p className="text-sm text-donor-muted">
              Monitor performance metrics and operational insights
            </p>
          </div>
          <button
            onClick={loadAnalytics}
            className="flex items-center gap-2 rounded-lg border border-donor-border bg-donor-surface px-3 py-2 text-sm text-donor-text transition-colors hover:bg-donor-border"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>

        <FilterBar>
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-donor-muted">Period:</label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as DateRangeType)}
              className="rounded-lg border border-donor-border bg-donor-surface px-2 py-1 text-xs text-donor-text"
            >
              {DATE_RANGE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-donor-muted">Blood:</label>
            <select
              value={bloodType}
              onChange={(e) => setBloodType(e.target.value)}
              className="rounded-lg border border-donor-border bg-donor-surface px-2 py-1 text-xs text-donor-text"
            >
              <option value="">All Types</option>
              {BLOOD_GROUPS.map((bt) => (
                <option key={bt} value={bt}>{bt}</option>
              ))}
            </select>
            <select
              value={rhFactor}
              onChange={(e) => setRhFactor(e.target.value)}
              className="rounded-lg border border-donor-border bg-donor-surface px-2 py-1 text-xs text-donor-text"
            >
              <option value="">All Rh</option>
              {RH_FACTORS.map((rh) => (
                <option key={rh} value={rh}>{rh === 'POSITIVE' ? '+' : '-'}</option>
              ))}
            </select>
          </div>
        </FilterBar>
      </div>

      <div className="mb-6 flex gap-2">
        {(['overview', 'inventory', 'emergencies', 'appointments'] as const).map((section) => (
          <button
            key={section}
            onClick={() => setActiveSection(section)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              activeSection === section
                ? 'bg-donor-primary text-white'
                : 'border border-donor-border bg-donor-surface text-donor-text hover:bg-donor-border'
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
              label="Active Emergencies"
              value={overview.emergencies.active.value.toString()}
              note={getTrendNote(overview.emergencies.active.trend, overview.emergencies.active.changePercent)}
              icon={AlertTriangle}
              variant={overview.emergencies.active.value > 0 ? 'danger' : 'success'}
            />
            <StatCard
              label="Completed Today"
              value={overview.emergencies.completed.value.toString()}
              note={getTrendNote(overview.emergencies.completed.trend, overview.emergencies.completed.changePercent)}
              icon={Activity}
              variant="success"
            />
            <StatCard
              label="Pending Requests"
              value={overview.requests.pending.value.toString()}
              note={getTrendNote(overview.requests.pending.trend, overview.requests.pending.changePercent)}
              icon={Package}
              variant={overview.requests.pending.value > 0 ? 'warning' : 'success'}
            />
            <StatCard
              label="Critical Alerts"
              value={overview.alerts.critical.toString()}
              icon={Bell}
              variant={overview.alerts.critical > 0 ? 'danger' : 'success'}
            />
          </div>

          <div className="mb-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-donor-border bg-donor-surface p-5">
              <h3 className="mb-4 text-sm font-semibold text-donor-text">Inventory Summary</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-donor-muted">Total Units</span>
                  <span className="font-semibold text-donor-text">{overview.inventory.totalUnits}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-donor-muted">Available</span>
                  <span className="font-semibold text-green-400">{overview.inventory.availableUnits}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-donor-muted">Reserved</span>
                  <span className="font-semibold text-yellow-400">{overview.inventory.reservedUnits}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-donor-muted">Quarantined</span>
                  <span className="font-semibold text-orange-400">{overview.inventory.quarantinedUnits}</span>
                </div>
              </div>
              {overview.inventory.criticalGroups.length > 0 && (
                <div className="mt-4 rounded-lg bg-red-500/10 p-3">
                  <p className="text-xs font-semibold text-red-400">Critical Blood Groups</p>
                  <p className="text-xs text-donor-muted">{overview.inventory.criticalGroups.join(', ')}</p>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-donor-border bg-donor-surface p-5">
              <h3 className="mb-4 text-sm font-semibold text-donor-text">Donations</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-donor-muted">Total</span>
                  <span className="font-semibold text-donor-text">{formatKpiValue(overview.donations.total.value)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-donor-muted">Completed</span>
                  <span className="font-semibold text-green-400">{formatKpiValue(overview.donations.completed.value)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-donor-muted">Cancelled</span>
                  <span className="font-semibold text-red-400">{formatKpiValue(overview.donations.cancelled.value)}</span>
                </div>
              </div>
              <div className="mt-4">
                <p className="mb-2 text-xs font-semibold text-donor-muted">By Blood Group</p>
                <div className="flex flex-wrap gap-2">
                  {overview.donations.byBloodGroup.map((bg) => (
                    <span key={bg.fullName} className="rounded-full bg-donor-border px-2 py-1 text-xs text-donor-text">
                      {bg.fullName}: {bg.count}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Emergencies"
              value={overview.emergencies.total.value.toString()}
              note={getTrendNote(overview.emergencies.total.trend, overview.emergencies.total.changePercent)}
              icon={AlertTriangle}
              variant={overview.emergencies.total.value > 0 ? 'warning' : 'success'}
            />
            <StatCard
              label="Appointments"
              value={overview.appointments.total.value.toString()}
              note={getTrendNote(overview.appointments.total.trend, overview.appointments.total.changePercent)}
              icon={Calendar}
            />
            <StatCard
              label="Blood Requests"
              value={overview.requests.total.value.toString()}
              note={getTrendNote(overview.requests.total.trend, overview.requests.total.changePercent)}
              icon={Droplet}
            />
            <StatCard
              label="Avg Response Time"
              value={overview.emergencies.avgResponseTime ? `${Math.round(overview.emergencies.avgResponseTime)}m` : 'N/A'}
              note={overview.emergencies.acceptanceRate ? `${overview.emergencies.acceptanceRate}% acceptance` : undefined}
              icon={Activity}
            />
          </div>
        </>
      )}

      {activeSection === 'inventory' && inventory && (
        <>
          <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <StatCard
              label="Total Units"
              value={inventory.summary.totalUnits.toString()}
              icon={Package}
            />
            <StatCard
              label="Available"
              value={inventory.summary.availableUnits.toString()}
              variant="success"
            />
            <StatCard
              label="Reserved"
              value={inventory.summary.reservedUnits.toString()}
              variant="warning"
            />
            <StatCard
              label="Quarantined"
              value={inventory.summary.quarantinedUnits.toString()}
              variant="danger"
            />
            <StatCard
              label="Expired"
              value={inventory.summary.expiredUnits.toString()}
              variant="danger"
            />
          </div>

          <div className="mb-6 rounded-2xl border border-donor-border bg-donor-surface p-5">
            <h3 className="mb-4 text-sm font-semibold text-donor-text">Inventory by Blood Group</h3>
            <div className="grid gap-3 md:grid-cols-4 lg:grid-cols-8">
              {inventory.byBloodGroup.map((bg) => (
                <div key={bg.fullName} className="rounded-lg bg-donor-border p-3 text-center">
                  <p className="text-lg font-bold text-donor-text">{bg.fullName}</p>
                  <p className="text-2xl font-bold text-donor-primary">{bg.count}</p>
                  <p className="text-xs text-donor-muted">{bg.percent.toFixed(1)}%</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-donor-border bg-donor-surface p-5">
            <h3 className="mb-4 text-sm font-semibold text-donor-text">Inventory by Component</h3>
            <div className="space-y-3">
              {inventory.byComponent.map((comp) => (
                <div key={comp.componentType} className="flex items-center justify-between rounded-lg bg-donor-border p-3">
                  <span className="text-sm font-medium text-donor-text">{comp.componentType}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-green-400">Avail: {comp.available}</span>
                    <span className="text-xs text-yellow-400">Res: {comp.reserved}</span>
                    <span className="text-sm font-semibold text-donor-primary">{comp.count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {activeSection === 'emergencies' && emergencies && (
        <>
          <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total"
              value={emergencies.summary.total.toString()}
              icon={AlertTriangle}
            />
            <StatCard
              label="Active"
              value={emergencies.summary.active.toString()}
              variant={emergencies.summary.active > 0 ? 'danger' : 'success'}
            />
            <StatCard
              label="Completed"
              value={emergencies.summary.completed.toString()}
              variant="success"
            />
            <StatCard
              label="Avg Response"
              value={emergencies.summary.avgResponseTimeMinutes ? `${Math.round(emergencies.summary.avgResponseTimeMinutes)}m` : 'N/A'}
              icon={Activity}
            />
          </div>

          <div className="mb-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-donor-border bg-donor-surface p-5">
              <h3 className="mb-4 text-sm font-semibold text-donor-text">By Status</h3>
              <div className="space-y-2">
                {emergencies.byStatus.map((s) => (
                  <div key={s.status} className="flex justify-between">
                    <span className="text-sm text-donor-muted">{s.status}</span>
                    <span className="font-semibold text-donor-text">{s.count} ({s.percent.toFixed(1)}%)</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-donor-border bg-donor-surface p-5">
              <h3 className="mb-4 text-sm font-semibold text-donor-text">By Urgency</h3>
              <div className="space-y-2">
                {emergencies.byUrgency.map((u) => (
                  <div key={u.urgencyLevel} className="flex justify-between">
                    <span className={`text-sm font-medium ${
                      u.urgencyLevel === 'CRITICAL' ? 'text-red-400' :
                      u.urgencyLevel === 'HIGH' ? 'text-orange-400' :
                      'text-yellow-400'
                    }`}>{u.urgencyLevel}</span>
                    <span className="font-semibold text-donor-text">{u.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-donor-border bg-donor-surface p-5">
            <h3 className="mb-4 text-sm font-semibold text-donor-text">By Blood Group</h3>
            <div className="grid gap-3 md:grid-cols-4 lg:grid-cols-8">
              {emergencies.byBloodGroup.map((bg) => (
                <div key={bg.fullName} className="rounded-lg bg-donor-border p-3 text-center">
                  <p className="text-lg font-bold text-donor-text">{bg.fullName}</p>
                  <p className="text-2xl font-bold text-red-400">{bg.count}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {activeSection === 'appointments' && appointments && (
        <>
          <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <StatCard
              label="Total"
              value={appointments.summary.total.toString()}
              icon={Calendar}
            />
            <StatCard
              label="Completed"
              value={appointments.summary.completed.toString()}
              variant="success"
            />
            <StatCard
              label="Cancelled"
              value={appointments.summary.cancelled.toString()}
              variant="danger"
            />
            <StatCard
              label="No Shows"
              value={appointments.summary.noShows.toString()}
              variant="warning"
            />
            <StatCard
              label="Completion Rate"
              value={appointments.summary.completionRate ? `${appointments.summary.completionRate.toFixed(1)}%` : 'N/A'}
              variant={appointments.summary.completionRate && appointments.summary.completionRate > 80 ? 'success' : 'warning'}
            />
          </div>

          <div className="rounded-2xl border border-donor-border bg-donor-surface p-5">
            <h3 className="mb-4 text-sm font-semibold text-donor-text">By Status</h3>
            <div className="space-y-2">
              {appointments.byStatus.map((s) => (
                <div key={s.status} className="flex justify-between rounded-lg bg-donor-border p-3">
                  <span className="text-sm text-donor-muted">{s.status}</span>
                  <span className="font-semibold text-donor-text">{s.count} ({s.percent.toFixed(1)}%)</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {(criticalAlerts.length > 0 || highAlerts.length > 0) && (
        <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-5">
          <div className="mb-3 flex items-center gap-2">
            <Bell className="text-red-400" size={18} />
            <h3 className="text-sm font-semibold text-red-400">Active Alerts</h3>
          </div>
          <div className="space-y-2">
            {criticalAlerts.slice(0, 5).map((alert) => (
              <div key={alert.id} className="flex items-start gap-3 rounded-lg bg-red-500/20 p-3">
                <AlertTriangle className="mt-0.5 text-red-400" size={14} />
                <div>
                  <p className="text-sm font-semibold text-red-400">{alert.title}</p>
                  <p className="text-xs text-donor-muted">{alert.message}</p>
                </div>
              </div>
            ))}
            {highAlerts.slice(0, 5).map((alert) => (
              <div key={alert.id} className="flex items-start gap-3 rounded-lg bg-orange-500/20 p-3">
                <AlertCircle className="mt-0.5 text-orange-400" size={14} />
                <div>
                  <p className="text-sm font-semibold text-orange-400">{alert.title}</p>
                  <p className="text-xs text-donor-muted">{alert.message}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
