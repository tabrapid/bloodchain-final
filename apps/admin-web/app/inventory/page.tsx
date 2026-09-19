'use client';

import { useEffect, useState } from 'react';
import { EmptyState, LoadingState } from '@bloodchain/ui/components';
import {
  getBloodAvailability,
  getInventoryOverview,
  listAlerts,
  type BloodAvailabilityRow,
} from '@lib/api';
import { me, isAuthenticated } from '@lib/auth';
import {  } from '@lib/status';
import { Droplet, AlertTriangle, Building2, RefreshCw } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { useTranslation } from '@bloodchain/ui/i18n';

export default function InventoryPage() {
  const { t } = useTranslation();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [inventory, setInventory] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [availability, setAvailability] = useState<BloodAvailabilityRow[]>([]);
  const [availabilityFilters, setAvailabilityFilters] = useState<{
    bloodType?: string;
    rhFactor?: string;
    componentType?: string;
  }>({});
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        if (!isAuthenticated()) return;
        const userData = await me();
        if (!userData.roles.includes('SUPER_ADMIN')) return;
        setCurrentUser({ firstName: userData.firstName, lastName: userData.lastName, roles: userData.roles });
        await loadData();
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  /**
   * Stock across every active blood centre, for whoever is routing a request.
   *
   * Re-read when the filters change rather than filtered in the browser: the
   * server does the grouping, and pulling every unit down to slice it here
   * would put unit-level data in the client for a view that deliberately does
   * not show it.
   */
  useEffect(() => {
    let cancelled = false;
    async function loadAvailability() {
      if (!currentUser) return;
      try {
        const rows = await getBloodAvailability(availabilityFilters);
        if (!cancelled) {
          setAvailability(rows);
          setAvailabilityError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setAvailabilityError(err instanceof Error ? err.message : t('ops.common.loadFailed'));
        }
      }
    }
    void loadAvailability();
    return () => {
      cancelled = true;
    };
  }, [currentUser, availabilityFilters, t]);

  async function loadData() {
    try {
      const [invData, alertsData] = await Promise.all([
        getInventoryOverview(),
        listAlerts({ limit: 20 }),
      ]);
      setInventory(invData);
      setAlerts(alertsData.data);
    } catch (err) {
      console.error('Failed to load inventory:', err);
    }
  }

  if (isLoading) {
    return (
      <AppShell title={t('ops.inventory.title')} userName={currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : undefined}>
        <LoadingState />
      </AppShell>
    );
  }

  const bloodTypes = ['A', 'B', 'AB', 'O'];
  const rhFactors = ['POSITIVE', 'NEGATIVE'];
  const componentTypes = ['WHOLE_BLOOD', 'RED_CELLS', 'PLASMA', 'PLATELETS', 'OTHER'];

  return (
    <AppShell title={t('ops.inventory.title')} userName={currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : undefined}>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-donor-text">{t('ops.inventory.overview')}</h1>
          <p className="text-sm text-donor-muted mt-1">{t('ops.inventory.platformSummary')}</p>
        </div>

        <div className="bc-glass rounded-card p-6 mb-6">
          <h3 className="font-medium text-donor-text mb-4">{t('ops.inventory.byBloodType')}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {bloodTypes.map((bt) =>
              rhFactors.map((rh) => {
                const key = `${bt}${rh}`;
                const data = inventory?.byBloodGroup?.[key] || { total: 0, available: 0, reserved: 0 };
                return (
                  <div key={key} className="bg-donor-elevated rounded-card p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Droplet className="w-4 h-4 text-donor-danger" />
                      <span className="font-semibold text-donor-text">{key}</span>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-donor-muted">{t('table.total')}</span>
                        <span className="font-medium">{data.total}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-donor-muted">{t('status.unit.AVAILABLE')}</span>
                        <span className="font-medium text-donor-success">{data.available}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-donor-muted">{t('status.unit.RESERVED')}</span>
                        <span className="font-medium text-donor-warning">{data.reserved}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="bc-glass rounded-card mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-donor-border/40 px-4 py-3">
            <div>
              <h3 className="font-medium text-donor-text">{t('ops.inventory.availability')}</h3>
              {/* Said plainly, because the same numbers would be a very
                  different product if they were shown to donors. */}
              <p className="text-xs text-donor-muted">{t('ops.inventory.availabilityHint')}</p>
            </div>
            <button
              onClick={() => setAvailabilityFilters({ ...availabilityFilters })}
              className="bc-solid inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-donor-text transition-colors hover:bg-donor-elevated"
            >
              <RefreshCw size={13} />
              {t('actions.refresh')}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-b border-donor-border/40 px-4 py-3">
            <select
              value={availabilityFilters.bloodType ?? ''}
              onChange={(e) =>
                setAvailabilityFilters((prev) => ({
                  ...prev,
                  bloodType: e.target.value || undefined,
                }))
              }
              className="bc-solid rounded-lg px-3 py-1.5 text-sm text-donor-text"
            >
              <option value="">{t('filters.allBloodTypes')}</option>
              {bloodTypes.map((bt) => (
                <option key={bt} value={bt}>
                  {bt}
                </option>
              ))}
            </select>

            <select
              value={availabilityFilters.rhFactor ?? ''}
              onChange={(e) =>
                setAvailabilityFilters((prev) => ({
                  ...prev,
                  rhFactor: e.target.value || undefined,
                }))
              }
              className="bc-solid rounded-lg px-3 py-1.5 text-sm text-donor-text"
            >
              <option value="">{t('filters.all')}</option>
              {rhFactors.map((rh) => (
                <option key={rh} value={rh}>
                  {rh === 'POSITIVE' ? '+' : '-'}
                </option>
              ))}
            </select>

            <select
              value={availabilityFilters.componentType ?? ''}
              onChange={(e) =>
                setAvailabilityFilters((prev) => ({
                  ...prev,
                  componentType: e.target.value || undefined,
                }))
              }
              className="bc-solid rounded-lg px-3 py-1.5 text-sm text-donor-text"
            >
              <option value="">{t('filters.allTypes')}</option>
              {componentTypes.map((ct) => (
                <option key={ct} value={ct}>
                  {ct.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>

          {availabilityError ? (
            <p className="px-4 py-6 text-center text-sm text-donor-onDangerMuted">
              {availabilityError}
            </p>
          ) : availability.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title={t('ops.inventory.noAvailability')}
                description={t('ops.inventory.noAvailabilityHint')}
              />
            </div>
          ) : (
            <div className="divide-y divide-donor-border/40">
              {availability.map((row) => (
                <div
                  key={`${row.organization.id}:${row.bloodType}:${row.rhFactor}:${row.componentType}`}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Building2 className="h-4 w-4 shrink-0 text-donor-muted" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-donor-text">
                        {row.organization.name}
                      </p>
                      <p className="text-xs text-donor-muted">
                        {row.componentType.replace(/_/g, ' ')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <span className="font-semibold text-donor-text">
                      {row.bloodType}
                      {row.rhFactor === 'POSITIVE' ? '+' : '-'}
                    </span>
                    <span className="text-donor-text">
                      {t('units.unitsCount', { count: row.totalUnits })}
                    </span>
                    <span className="text-donor-muted">{row.totalVolumeMl} ml</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bc-glass rounded-card">
          <div className="px-4 py-3 border-b border-donor-border/40 flex items-center justify-between">
            <h3 className="font-medium text-donor-text">{t('ops.inventory.lowStockAlerts')}</h3>
            <span className="text-sm text-donor-danger font-medium">{alerts.length} active</span>
          </div>
          <div className="divide-y divide-donor-border/40">
            {alerts.length === 0 ? (
              <div className="p-4 text-sm text-donor-muted text-center">{t('ops.inventory.noLowStock')}</div>
            ) : (
              alerts.map((alert) => (
                <div key={alert.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-donor-warning" />
                    <div>
                      <p className="text-sm font-medium text-donor-text">{alert.message}</p>
                      <p className="text-xs text-donor-muted">
                        {alert.organization?.name} - {alert.bloodType}{alert.rhFactor}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-donor-muted">
                    {new Date(alert.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
