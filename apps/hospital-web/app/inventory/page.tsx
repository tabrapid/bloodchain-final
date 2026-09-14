'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Filter,
  Package,
  Search,
} from 'lucide-react';
import {
  EmptyState,
  StatCard,
  StatusBadge,
  DataTable,
  DataTableColumn,
  Modal,
} from '@bloodchain/ui/components';
import {
  me,
  isAuthenticated,
  MeResponse,
} from '../../lib/auth';
import {
  getInventorySummary,
  getInventory,
  InventorySummary,
  InventoryUnit,
  GetInventoryParams,
} from '../../lib/inventory';
import { AppShell } from '../../components/AppShell';
import { useTranslation } from '@bloodchain/ui/i18n';

const BLOOD_TYPES = ['A', 'B', 'AB', 'O'] as const;
const RH_FACTORS = ['POSITIVE', 'NEGATIVE'] as const;
const COMPONENT_TYPES = ['WHOLE_BLOOD', 'RED_CELLS', 'PLASMA', 'PLATELETS', 'OTHER'] as const;
const STATUSES = ['COLLECTED', 'AVAILABLE', 'RESERVED', 'QUARANTINED', 'USED', 'EXPIRED', 'DISCARDED'] as const;

type StatusVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

export default function InventoryPage() {
  const { t } = useTranslation();
  const [user, setUser] = useState<MeResponse | null>(null);
  const [organizationId, setOrganizationId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [units, setUnits] = useState<InventoryUnit[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);

  const [filters, setFilters] = useState<GetInventoryParams>({ page: 1, limit: 20 });
  const [searchQuery, setSearchQuery] = useState('');
  const [totalPages, setTotalPages] = useState(1);
  const [totalUnits, setTotalUnits] = useState(0);

  const [showFilters, setShowFilters] = useState(false);
  const [showUnitModal, setShowUnitModal] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<InventoryUnit | null>(null);
  const [actionLoading, setActionLoading] = useState(false);


  useEffect(() => {
    async function checkAuth() {
      try {
        if (isAuthenticated()) {
          const userData = await me();
          setUser(userData);
          const org = userData.organizations.find((o) => o.type === 'HOSPITAL');
          if (org) {
            setOrganizationId(org.organizationId);
          } else {
            const firstOrg = userData.organizations[0];
            if (firstOrg) {
              setOrganizationId(firstOrg.organizationId);
            }
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

  const loadData = useCallback(async () => {
    if (!organizationId) return;
    setIsLoadingData(true);
    try {
      // Storage locations are a blood-centre concern: the API restricts
      // /inventory/locations (and every stock-movement endpoint) to blood
      // centre roles. Fetching it here threw a 403 inside Promise.all, which
      // took the summary down with it -- so a hospital's inventory page showed
      // four empty stat cards because of a request it had no business making.
      setSummary(await getInventorySummary(organizationId));
    } catch (err: unknown) {
      console.error('Failed to load inventory data:', err);
    } finally {
      setIsLoadingData(false);
    }
  }, [organizationId]);

  const loadUnits = useCallback(async () => {
    if (!organizationId) return;
    setIsLoadingData(true);
    try {
      const params = { ...filters, search: searchQuery || undefined };
      const response = await getInventory(organizationId, params);
      setUnits(response.data);
      setTotalPages(response.meta.totalPages);
      setTotalUnits(response.meta.total);
    } catch (err: unknown) {
      console.error('Failed to load units:', err);
    } finally {
      setIsLoadingData(false);
    }
  }, [organizationId, filters, searchQuery]);

  useEffect(() => {
    if (organizationId) {
      loadData();
    }
  }, [organizationId, loadData]);

  useEffect(() => {
    if (organizationId) {
      loadUnits();
    }
  }, [organizationId, loadUnits]);

  const handleSearch = () => {
    setFilters((prev) => ({ ...prev, page: 1 }));
    loadUnits();
  };

  const handleFilterChange = (key: keyof GetInventoryParams, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value || undefined, page: 1 }));
  };

  const handlePageChange = (page: number) => {
    setFilters((prev) => ({ ...prev, page }));
  };

  const handleUnitClick = (unit: InventoryUnit) => {
    setSelectedUnit(unit);
    setShowUnitModal(true);
  };

  const handleIssueUnit = async (unitId: string, reason: string) => {
    if (!organizationId) return;
    setActionLoading(true);
    try {
      const { issueUnit: issue } = await import('../../lib/inventory');
      await issue(organizationId, unitId, reason);
      setShowUnitModal(false);
      setSelectedUnit(null);
      loadUnits();
      loadData();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusVariant = (status: string): StatusVariant => {
    switch (status) {
      case 'AVAILABLE': return 'success';
      case 'QUARANTINED': return 'warning';
      case 'RESERVED': return 'info';
      case 'USED': return 'success';
      case 'EXPIRED': return 'danger';
      case 'DISCARDED': return 'danger';
      default: return 'default';
    }
  };

  const columns: DataTableColumn<InventoryUnit>[] = [
    { key: 'unitReference', header: t('ops.inventory.unitReference'), render: (u) => <span className="font-mono text-xs">{u.unitReference}</span> },
    { key: 'bloodType', header: t('home.bloodTypeLabel'), render: (u) => (
      <span><span className="font-semibold">{u.bloodType}</span><span className="text-donor-muted text-xs ml-1">{u.rhFactor === 'POSITIVE' ? '+' : '-'}</span></span>
    )},
    { key: 'componentType', header: t('ops.common.component'), render: (u) => u.componentType?.replace('_', ' ') ?? 'Whole Blood' },
    { key: 'volumeMl', header: t('table.volume'), render: (u) => `${u.volumeMl} ml` },
    { key: 'status', header: t('table.status'), render: (u) => <StatusBadge variant={getStatusVariant(u.status)}>{u.status}</StatusBadge> },
    { key: 'location', header: t('table.location'), render: (u) => u.location?.name ?? '—' },
    { key: 'collectedAt', header: t('ops.common.collected'), render: (u) => new Date(u.collectedAt).toLocaleDateString() },
    { key: 'expiresAt', header: t('table.expires'), render: (u) => u.expiresAt ? new Date(u.expiresAt).toLocaleDateString() : '—' },
  ];

  if (isLoading) {
    return (
      <AppShell
        title={t('ops.common.loadingEllipsis')}
        subtitle={t('portal.hospital.console')}
        organizationName="Hospital Console"
        organizationType="Operations workspace"
        userName={t('ops.common.loadingEllipsis')}
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
        subtitle={t('portal.hospital.console')}
        organizationName="Hospital Console"
        organizationType="Operations workspace"
        userName="Guest"
      >
        <div className="flex flex-col items-center justify-center bc-glass rounded-card p-12">
          <Activity className="mb-4 text-donor-secondary" size={48} />
          <h2 className="mb-2 font-display text-2xl font-semibold text-donor-text">
            {t('ops.common.signInRequired')}
          </h2>
          <p className="mb-6 text-center text-donor-muted">
            {t('ops.common.signInToInventory')}
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={t('ops.inventory.title')}
      subtitle={t('portal.hospital.console')}
      organizationName={user.organizations.find((org) => org.type === 'HOSPITAL')?.name ?? 'Hospital Console'}
      organizationType="Operations workspace"
      userName={`${user.firstName} ${user.lastName}`}
    >
      {error && (
        <div className="mb-4 rounded-lg border border-donor-danger/30 bg-donor-dangerMuted p-4 text-donor-onDangerMuted">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">{t('actions.dismiss')}</button>
        </div>
      )}

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <StatCard label={t('ops.dashboard.totalUnits')} value={summary?.totalUnits?.toString() ?? '—'} icon={Package} />
        <StatCard label={t('status.unit.AVAILABLE')} value={summary?.availableUnits?.toString() ?? '—'} variant="success" icon={CheckCircle} />
        <StatCard label={t('status.unit.QUARANTINED')} value={summary?.quarantinedUnits?.toString() ?? '—'} variant="warning" icon={AlertTriangle} />
        <StatCard label={t('status.unit.RESERVED')} value={summary?.reservedUnits?.toString() ?? '—'} variant="info" icon={Clock} />
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-donor-muted" size={18} />
          <input
            type="text"
            placeholder={t('ops.inventory.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="w-full rounded-lg bc-solid px-10 py-2 text-sm text-donor-text placeholder:text-donor-muted focus:border-donor-secondary focus:outline-none"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 rounded-lg bc-solid px-4 py-2 text-sm text-donor-text transition-colors hover:bg-donor-elevated"
        >
          <Filter size={16} />
          {t('ops.common.filters')}
        </button>
      </div>

      {showFilters && (
        <div className="bc-glass mb-6 rounded-card p-4">
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-donor-muted">{t('home.bloodTypeLabel')}</label>
              <select
                value={filters.bloodType ?? ''}
                onChange={(e) => handleFilterChange('bloodType', e.target.value)}
                className="w-full rounded-lg border border-donor-border bc-solid px-3 py-2 text-sm text-donor-text"
              >
                <option value="">{t('filters.all')}</option>
                {BLOOD_TYPES.map((bt) => (
                  <option key={bt} value={bt}>{bt}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-donor-muted">{t('medical.rhFactor')}</label>
              <select
                value={filters.rhFactor ?? ''}
                onChange={(e) => handleFilterChange('rhFactor', e.target.value)}
                className="w-full rounded-lg border border-donor-border bc-solid px-3 py-2 text-sm text-donor-text"
              >
                <option value="">{t('filters.all')}</option>
                {RH_FACTORS.map((rh) => (
                  <option key={rh} value={rh}>{rh}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-donor-muted">{t('ops.common.component')}</label>
              <select
                value={filters.componentType ?? ''}
                onChange={(e) => handleFilterChange('componentType', e.target.value)}
                className="w-full rounded-lg border border-donor-border bc-solid px-3 py-2 text-sm text-donor-text"
              >
                <option value="">{t('filters.all')}</option>
                {COMPONENT_TYPES.map((ct) => (
                  <option key={ct} value={ct}>{ct.replace('_', ' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-donor-muted">{t('table.status')}</label>
              <select
                value={filters.status ?? ''}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="w-full rounded-lg border border-donor-border bc-solid px-3 py-2 text-sm text-donor-text"
              >
                <option value="">{t('filters.all')}</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {isLoadingData ? (
        <DataTable columns={columns} rows={[]} keyExtractor={(u) => u.id} loading />
      ) : units.length === 0 ? (
        <EmptyState
          title={t('ops.inventory.empty')}
          description={searchQuery ? 'Try adjusting your search or filters' : 'Units will appear here when donations are processed'}
        />
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={units}
            keyExtractor={(u) => u.id}
            onRowClick={handleUnitClick}
            rowLabel={(u) => `Open unit ${u.unitReference}`}
            emptyMessage={t('ops.inventory.empty')}
          />

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-donor-muted">
                Showing {((filters.page ?? 1) - 1) * (filters.limit ?? 20) + 1} to{' '}
                {Math.min((filters.page ?? 1) * (filters.limit ?? 20), totalUnits)} of {totalUnits} units
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => handlePageChange((filters.page ?? 1) - 1)}
                  disabled={(filters.page ?? 1) <= 1}
                  className="rounded-lg bc-solid px-3 py-1.5 text-sm text-donor-text transition-colors hover:bg-donor-elevated disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('actions.previous')}
                </button>
                <button
                  onClick={() => handlePageChange((filters.page ?? 1) + 1)}
                  disabled={(filters.page ?? 1) >= totalPages}
                  className="rounded-lg bc-solid px-3 py-1.5 text-sm text-donor-text transition-colors hover:bg-donor-elevated disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('actions.next')}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <Modal
        open={showUnitModal}
        onClose={() => { setShowUnitModal(false); setSelectedUnit(null); }}
        title={t('ops.inventory.unitDetails')}
      >
        {selectedUnit && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-donor-muted">{t('ops.inventory.unitReference')}</p>
                <p className="font-mono text-sm">{selectedUnit.unitReference}</p>
              </div>
              <div>
                <p className="text-xs text-donor-muted">{t('table.status')}</p>
                <StatusBadge variant={getStatusVariant(selectedUnit.status)}>{selectedUnit.status}</StatusBadge>
              </div>
              <div>
                <p className="text-xs text-donor-muted">{t('home.bloodTypeLabel')}</p>
                <p className="text-sm">{selectedUnit.bloodType} {selectedUnit.rhFactor === 'POSITIVE' ? '+' : '-'}</p>
              </div>
              <div>
                <p className="text-xs text-donor-muted">{t('ops.common.component')}</p>
                <p className="text-sm">{selectedUnit.componentType?.replace('_', ' ') ?? 'Whole Blood'}</p>
              </div>
              <div>
                <p className="text-xs text-donor-muted">{t('table.volume')}</p>
                <p className="text-sm">{selectedUnit.volumeMl} ml</p>
              </div>
              <div>
                <p className="text-xs text-donor-muted">{t('table.location')}</p>
                <p className="text-sm">{selectedUnit.location?.name ?? 'Not assigned'}</p>
              </div>
              <div>
                <p className="text-xs text-donor-muted">{t('status.unit.COLLECTED')}</p>
                <p className="text-sm">{new Date(selectedUnit.collectedAt).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-xs text-donor-muted">{t('table.expires')}</p>
                <p className="text-sm">{selectedUnit.expiresAt ? new Date(selectedUnit.expiresAt).toLocaleDateString() : '—'}</p>
              </div>
              {selectedUnit.donationReference && (
                <div className="col-span-2">
                  <p className="text-xs text-donor-muted">{t('ops.inventory.donationReference')}</p>
                  <p className="font-mono text-sm">{selectedUnit.donationReference}</p>
                </div>
              )}
            </div>

            {selectedUnit.status === 'AVAILABLE' && (
              <div className="flex flex-wrap gap-2 pt-4 border-t border-donor-border">
                <button
                  onClick={() => {
                    const reason = prompt('Enter issue reason (include patient/recipient reference if applicable):');
                    if (reason) handleIssueUnit(selectedUnit.id, reason);
                  }}
                  disabled={actionLoading}
                  className="flex items-center gap-2 rounded-lg border border-donor-success/30 bg-donor-successMuted px-4 py-2 text-sm text-donor-onSuccessMuted transition-colors hover:bg-donor-success/20 disabled:opacity-50"
                >
                  <CheckCircle size={16} />
                  {actionLoading ? 'Issuing...' : 'Issue'}
                </button>
              </div>
            )}

            {selectedUnit.status === 'RESERVED' && (
              <div className="flex flex-wrap gap-2 pt-4 border-t border-donor-border">
                <button
                  onClick={() => {
                    const reason = prompt('Enter issue reason (include patient/recipient reference if applicable):');
                    if (reason) handleIssueUnit(selectedUnit.id, reason);
                  }}
                  disabled={actionLoading}
                  className="flex items-center gap-2 rounded-lg border border-donor-success/30 bg-donor-successMuted px-4 py-2 text-sm text-donor-onSuccessMuted transition-colors hover:bg-donor-success/20 disabled:opacity-50"
                >
                  <CheckCircle size={16} />
                  {actionLoading ? 'Issuing...' : 'Issue'}
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>

    </AppShell>
  );
}
