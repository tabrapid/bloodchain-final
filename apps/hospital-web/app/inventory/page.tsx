'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle,
  Clock,
  Filter,
  Package,
  Pencil,
  Plus,
  Search,
  XCircle,
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
  getLocations,
  InventorySummary,
  InventoryUnit,
  InventoryLocation,
  GetInventoryParams,
} from '../../lib/inventory';
import { AppShell } from '../../components/AppShell';

const BLOOD_TYPES = ['A', 'B', 'AB', 'O'] as const;
const RH_FACTORS = ['POSITIVE', 'NEGATIVE'] as const;
const COMPONENT_TYPES = ['WHOLE_BLOOD', 'RED_CELLS', 'PLASMA', 'PLATELETS', 'OTHER'] as const;
const STATUSES = ['COLLECTED', 'AVAILABLE', 'RESERVED', 'QUARANTINED', 'USED', 'EXPIRED', 'DISCARDED'] as const;

type StatusVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

export default function InventoryPage() {
  const [user, setUser] = useState<MeResponse | null>(null);
  const [organizationId, setOrganizationId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [units, setUnits] = useState<InventoryUnit[]>([]);
  const [locations, setLocations] = useState<InventoryLocation[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);

  const [filters, setFilters] = useState<GetInventoryParams>({ page: 1, limit: 20 });
  const [searchQuery, setSearchQuery] = useState('');
  const [totalPages, setTotalPages] = useState(1);
  const [totalUnits, setTotalUnits] = useState(0);

  const [showFilters, setShowFilters] = useState(false);
  const [showUnitModal, setShowUnitModal] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<InventoryUnit | null>(null);
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [newLocation, setNewLocation] = useState({ name: '', code: '', type: 'STORAGE' });

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
      const [summaryData, locationsData] = await Promise.all([
        getInventorySummary(organizationId),
        getLocations(organizationId),
      ]);
      setSummary(summaryData);
      setLocations(locationsData);
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

  const handleCreateLocation = async () => {
    if (!organizationId || !newLocation.name || !newLocation.code) return;
    setActionLoading(true);
    try {
      const { createLocation: createLoc } = await import('../../lib/inventory');
      await createLoc(organizationId, newLocation);
      setNewLocation({ name: '', code: '', type: 'STORAGE' });
      setShowLocationModal(false);
      loadData();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleMoveUnit = async (unitId: string, toLocationId: string, reason: string) => {
    if (!organizationId) return;
    setActionLoading(true);
    try {
      const { moveUnit: move } = await import('../../lib/inventory');
      await move(organizationId, unitId, { toLocationId, reason });
      setShowMovementModal(false);
      setSelectedUnit(null);
      loadUnits();
      loadData();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleQuarantineUnit = async (unitId: string, reason: string) => {
    if (!organizationId) return;
    setActionLoading(true);
    try {
      const { quarantineUnit: quarantine } = await import('../../lib/inventory');
      await quarantine(organizationId, unitId, reason);
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

  const handleDiscardUnit = async (unitId: string, reason: string) => {
    if (!organizationId) return;
    setActionLoading(true);
    try {
      const { discardUnit: discard } = await import('../../lib/inventory');
      await discard(organizationId, unitId, reason);
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

  const handleAdjustUnit = async (
    unitId: string,
    params: { reason: string; volumeMl?: number; componentType?: string; expiresAt?: string },
  ) => {
    if (!organizationId) return;
    setActionLoading(true);
    try {
      const { adjustUnit: adjust } = await import('../../lib/inventory');
      await adjust(organizationId, unitId, params);
      setShowAdjustModal(false);
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

  const getLocationTypeLabel = (type: string) => {
    switch (type) {
      case 'STORAGE': return 'Storage';
      case 'TESTING': return 'Testing Lab';
      case 'QUARANTINE': return 'Quarantine';
      case 'ISSUING': return 'Issuing';
      case 'PROCESSING': return 'Processing';
      case 'DISTRIBUTION': return 'Distribution';
      default: return type;
    }
  };

  const columns: DataTableColumn<InventoryUnit>[] = [
    { key: 'unitReference', header: 'Unit Reference', render: (u) => <span className="font-mono text-xs">{u.unitReference}</span> },
    { key: 'bloodType', header: 'Blood Type', render: (u) => (
      <span><span className="font-semibold">{u.bloodType}</span><span className="text-donor-muted text-xs ml-1">{u.rhFactor === 'POSITIVE' ? '+' : '-'}</span></span>
    )},
    { key: 'componentType', header: 'Component', render: (u) => u.componentType?.replace('_', ' ') ?? 'Whole Blood' },
    { key: 'volumeMl', header: 'Volume', render: (u) => `${u.volumeMl} ml` },
    { key: 'status', header: 'Status', render: (u) => <StatusBadge variant={getStatusVariant(u.status)}>{u.status}</StatusBadge> },
    { key: 'location', header: 'Location', render: (u) => u.location?.name ?? '—' },
    { key: 'collectedAt', header: 'Collected', render: (u) => new Date(u.collectedAt).toLocaleDateString() },
    { key: 'expiresAt', header: 'Expires', render: (u) => u.expiresAt ? new Date(u.expiresAt).toLocaleDateString() : '—' },
  ];

  if (isLoading) {
    return (
      <AppShell
        title="Loading..."
        subtitle="HOSPITAL CONSOLE"
        organizationName="Hospital Console"
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
        subtitle="HOSPITAL CONSOLE"
        organizationName="Hospital Console"
        organizationType="Operations workspace"
        userName="Guest"
      >
        <div className="flex flex-col items-center justify-center bc-glass rounded-card p-12">
          <Activity className="mb-4 text-donor-secondary" size={48} />
          <h2 className="mb-2 font-display text-2xl font-semibold text-donor-text">
            Sign In Required
          </h2>
          <p className="mb-6 text-center text-donor-muted">
            Please sign in to access the inventory dashboard
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Blood Inventory"
      subtitle="HOSPITAL CONSOLE"
      organizationName={user.organizations.find((org) => org.type === 'HOSPITAL')?.name ?? 'Hospital Console'}
      organizationType="Operations workspace"
      userName={`${user.firstName} ${user.lastName}`}
    >
      {error && (
        <div className="mb-4 rounded-lg border border-donor-danger/30 bg-donor-dangerMuted p-4 text-donor-onDangerMuted">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <StatCard label="Total Units" value={summary?.totalUnits?.toString() ?? '—'} icon={Package} />
        <StatCard label="Available" value={summary?.availableUnits?.toString() ?? '—'} variant="success" icon={CheckCircle} />
        <StatCard label="Quarantined" value={summary?.quarantinedUnits?.toString() ?? '—'} variant="warning" icon={AlertTriangle} />
        <StatCard label="Reserved" value={summary?.reservedUnits?.toString() ?? '—'} variant="info" icon={Clock} />
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-donor-muted" size={18} />
          <input
            type="text"
            placeholder="Search by unit reference or donation..."
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
          Filters
        </button>
        <button
          onClick={() => setShowLocationModal(true)}
          className="flex items-center gap-2 rounded-lg bc-solid px-4 py-2 text-sm text-donor-text transition-colors hover:bg-donor-elevated"
        >
          <Plus size={16} />
          Add Location
        </button>
      </div>

      {showFilters && (
        <div className="bc-glass mb-6 rounded-card p-4">
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-donor-muted">Blood Type</label>
              <select
                value={filters.bloodType ?? ''}
                onChange={(e) => handleFilterChange('bloodType', e.target.value)}
                className="w-full rounded-lg border border-donor-border bc-solid px-3 py-2 text-sm text-donor-text"
              >
                <option value="">All</option>
                {BLOOD_TYPES.map((bt) => (
                  <option key={bt} value={bt}>{bt}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-donor-muted">Rh Factor</label>
              <select
                value={filters.rhFactor ?? ''}
                onChange={(e) => handleFilterChange('rhFactor', e.target.value)}
                className="w-full rounded-lg border border-donor-border bc-solid px-3 py-2 text-sm text-donor-text"
              >
                <option value="">All</option>
                {RH_FACTORS.map((rh) => (
                  <option key={rh} value={rh}>{rh}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-donor-muted">Component</label>
              <select
                value={filters.componentType ?? ''}
                onChange={(e) => handleFilterChange('componentType', e.target.value)}
                className="w-full rounded-lg border border-donor-border bc-solid px-3 py-2 text-sm text-donor-text"
              >
                <option value="">All</option>
                {COMPONENT_TYPES.map((ct) => (
                  <option key={ct} value={ct}>{ct.replace('_', ' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-donor-muted">Status</label>
              <select
                value={filters.status ?? ''}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="w-full rounded-lg border border-donor-border bc-solid px-3 py-2 text-sm text-donor-text"
              >
                <option value="">All</option>
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
          title="No blood units found"
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
            emptyMessage="No blood units found"
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
                  Previous
                </button>
                <button
                  onClick={() => handlePageChange((filters.page ?? 1) + 1)}
                  disabled={(filters.page ?? 1) >= totalPages}
                  className="rounded-lg bc-solid px-3 py-1.5 text-sm text-donor-text transition-colors hover:bg-donor-elevated disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <Modal
        open={showUnitModal}
        onClose={() => { setShowUnitModal(false); setSelectedUnit(null); }}
        title="Unit Details"
      >
        {selectedUnit && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-donor-muted">Unit Reference</p>
                <p className="font-mono text-sm">{selectedUnit.unitReference}</p>
              </div>
              <div>
                <p className="text-xs text-donor-muted">Status</p>
                <StatusBadge variant={getStatusVariant(selectedUnit.status)}>{selectedUnit.status}</StatusBadge>
              </div>
              <div>
                <p className="text-xs text-donor-muted">Blood Type</p>
                <p className="text-sm">{selectedUnit.bloodType} {selectedUnit.rhFactor === 'POSITIVE' ? '+' : '-'}</p>
              </div>
              <div>
                <p className="text-xs text-donor-muted">Component</p>
                <p className="text-sm">{selectedUnit.componentType?.replace('_', ' ') ?? 'Whole Blood'}</p>
              </div>
              <div>
                <p className="text-xs text-donor-muted">Volume</p>
                <p className="text-sm">{selectedUnit.volumeMl} ml</p>
              </div>
              <div>
                <p className="text-xs text-donor-muted">Location</p>
                <p className="text-sm">{selectedUnit.location?.name ?? 'Not assigned'}</p>
              </div>
              <div>
                <p className="text-xs text-donor-muted">Collected</p>
                <p className="text-sm">{new Date(selectedUnit.collectedAt).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-xs text-donor-muted">Expires</p>
                <p className="text-sm">{selectedUnit.expiresAt ? new Date(selectedUnit.expiresAt).toLocaleDateString() : '—'}</p>
              </div>
              {selectedUnit.donationReference && (
                <div className="col-span-2">
                  <p className="text-xs text-donor-muted">Donation Reference</p>
                  <p className="font-mono text-sm">{selectedUnit.donationReference}</p>
                </div>
              )}
            </div>

            {selectedUnit.status === 'QUARANTINED' && (
              <div className="flex flex-wrap gap-2 pt-4 border-t border-donor-border">
                <button
                  onClick={() => {
                    setShowUnitModal(false);
                    setShowMovementModal(true);
                  }}
                  className="flex items-center gap-2 rounded-lg bc-solid px-4 py-2 text-sm text-donor-text transition-colors hover:bg-donor-elevated"
                >
                  <ArrowRightLeft size={16} />
                  Move
                </button>
                <button
                  onClick={() => {
                    setShowUnitModal(false);
                    setShowAdjustModal(true);
                  }}
                  className="flex items-center gap-2 rounded-lg bc-solid px-4 py-2 text-sm text-donor-text transition-colors hover:bg-donor-elevated"
                >
                  <Pencil size={16} />
                  Adjust
                </button>
                <button
                  onClick={() => {
                    const reason = prompt('Enter discard reason:');
                    if (reason) handleDiscardUnit(selectedUnit.id, reason);
                  }}
                  className="flex items-center gap-2 rounded-lg border border-donor-danger/30 bg-donor-dangerMuted px-4 py-2 text-sm text-donor-onDangerMuted transition-colors hover:bg-donor-danger/20"
                >
                  <XCircle size={16} />
                  Discard
                </button>
              </div>
            )}

            {selectedUnit.status === 'AVAILABLE' && (
              <div className="flex flex-wrap gap-2 pt-4 border-t border-donor-border">
                <button
                  onClick={() => {
                    const reason = prompt('Enter issue reason (include patient/recipient reference if applicable):');
                    if (reason) handleIssueUnit(selectedUnit.id, reason);
                  }}
                  className="flex items-center gap-2 rounded-lg border border-donor-success/30 bg-donor-successMuted px-4 py-2 text-sm text-donor-onSuccessMuted transition-colors hover:bg-donor-success/20"
                >
                  <CheckCircle size={16} />
                  Issue
                </button>
                <button
                  onClick={() => {
                    setShowUnitModal(false);
                    setShowMovementModal(true);
                  }}
                  className="flex items-center gap-2 rounded-lg bc-solid px-4 py-2 text-sm text-donor-text transition-colors hover:bg-donor-elevated"
                >
                  <ArrowRightLeft size={16} />
                  Move
                </button>
                <button
                  onClick={() => {
                    setShowUnitModal(false);
                    setShowAdjustModal(true);
                  }}
                  className="flex items-center gap-2 rounded-lg bc-solid px-4 py-2 text-sm text-donor-text transition-colors hover:bg-donor-elevated"
                >
                  <Pencil size={16} />
                  Adjust
                </button>
                <button
                  onClick={() => {
                    const reason = prompt('Enter quarantine reason:');
                    if (reason) handleQuarantineUnit(selectedUnit.id, reason);
                  }}
                  className="flex items-center gap-2 rounded-lg border border-donor-warning/30 bg-donor-warningMuted px-4 py-2 text-sm text-donor-onWarningMuted transition-colors hover:bg-donor-warning/20"
                >
                  <AlertTriangle size={16} />
                  Quarantine
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
                  className="flex items-center gap-2 rounded-lg border border-donor-success/30 bg-donor-successMuted px-4 py-2 text-sm text-donor-onSuccessMuted transition-colors hover:bg-donor-success/20"
                >
                  <CheckCircle size={16} />
                  Issue
                </button>
                <button
                  onClick={() => {
                    setShowUnitModal(false);
                    setShowAdjustModal(true);
                  }}
                  className="flex items-center gap-2 rounded-lg bc-solid px-4 py-2 text-sm text-donor-text transition-colors hover:bg-donor-elevated"
                >
                  <Pencil size={16} />
                  Adjust
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={showMovementModal}
        onClose={() => { setShowMovementModal(false); setSelectedUnit(null); }}
        title="Move Unit"
      >
        {selectedUnit && (
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-sm">Moving unit: <span className="font-mono">{selectedUnit.unitReference}</span></p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-donor-muted">To Location</label>
              <select
                id="move-location"
                className="w-full rounded-lg border border-donor-border bc-solid px-3 py-2 text-sm text-donor-text"
              >
                <option value="">Select location</option>
                {locations.filter((l) => l.active).map((loc) => (
                  <option key={loc.id} value={loc.id}>{loc.name} ({getLocationTypeLabel(loc.type)})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-donor-muted">Reason (optional)</label>
              <input
                type="text"
                id="move-reason"
                placeholder="e.g., Quality control transfer"
                className="w-full rounded-lg border border-donor-border bc-solid px-3 py-2 text-sm text-donor-text placeholder:text-donor-muted"
              />
            </div>
            <div className="flex gap-2 pt-4">
              <button
                onClick={() => {
                  const locationId = (document.getElementById('move-location') as HTMLSelectElement).value;
                  const reason = (document.getElementById('move-reason') as HTMLInputElement).value;
                  if (locationId) handleMoveUnit(selectedUnit.id, locationId, reason);
                }}
                disabled={actionLoading}
                className="rounded-lg bg-donor-secondary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-donor-secondary/80 disabled:opacity-50"
              >
                {actionLoading ? 'Moving...' : 'Confirm Move'}
              </button>
              <button
                onClick={() => { setShowMovementModal(false); setSelectedUnit(null); }}
                className="rounded-lg bc-solid px-4 py-2 text-sm text-donor-text transition-colors hover:bg-donor-elevated"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={showAdjustModal}
        onClose={() => { setShowAdjustModal(false); setSelectedUnit(null); }}
        title="Adjust Unit"
      >
        {selectedUnit && (
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-sm">
                Correcting unit: <span className="font-mono">{selectedUnit.unitReference}</span>
              </p>
              <p className="text-xs text-donor-muted">
                Leave a field blank to keep its current value. A reason is required.
              </p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-donor-muted">
                Volume (ml) — current: {selectedUnit.volumeMl}
              </label>
              <input
                type="number"
                id="adjust-volume"
                min={1}
                placeholder={String(selectedUnit.volumeMl)}
                className="w-full rounded-lg border border-donor-border bc-solid px-3 py-2 text-sm text-donor-text placeholder:text-donor-muted"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-donor-muted">
                Component — current: {selectedUnit.componentType?.replace('_', ' ') ?? 'Whole Blood'}
              </label>
              <select
                id="adjust-component"
                defaultValue=""
                className="w-full rounded-lg border border-donor-border bc-solid px-3 py-2 text-sm text-donor-text"
              >
                <option value="">Keep current</option>
                {COMPONENT_TYPES.map((ct) => (
                  <option key={ct} value={ct}>{ct.replace('_', ' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-donor-muted">
                Expires — current: {selectedUnit.expiresAt ? new Date(selectedUnit.expiresAt).toLocaleDateString() : '—'}
              </label>
              <input
                type="date"
                id="adjust-expires"
                className="w-full rounded-lg border border-donor-border bc-solid px-3 py-2 text-sm text-donor-text"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-donor-muted">Reason (required)</label>
              <input
                type="text"
                id="adjust-reason"
                placeholder="e.g., Correcting clerical volume entry error"
                className="w-full rounded-lg border border-donor-border bc-solid px-3 py-2 text-sm text-donor-text placeholder:text-donor-muted"
              />
            </div>
            <div className="flex gap-2 pt-4">
              <button
                onClick={() => {
                  const volumeMlRaw = (document.getElementById('adjust-volume') as HTMLInputElement).value;
                  const componentType = (document.getElementById('adjust-component') as HTMLSelectElement).value;
                  const expiresAt = (document.getElementById('adjust-expires') as HTMLInputElement).value;
                  const reason = (document.getElementById('adjust-reason') as HTMLInputElement).value;
                  if (!reason) return;
                  if (!volumeMlRaw && !componentType && !expiresAt) return;
                  handleAdjustUnit(selectedUnit.id, {
                    reason,
                    volumeMl: volumeMlRaw ? Number(volumeMlRaw) : undefined,
                    componentType: componentType || undefined,
                    expiresAt: expiresAt || undefined,
                  });
                }}
                disabled={actionLoading}
                className="rounded-lg bg-donor-secondary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-donor-secondary/80 disabled:opacity-50"
              >
                {actionLoading ? 'Saving...' : 'Save Adjustment'}
              </button>
              <button
                onClick={() => { setShowAdjustModal(false); setSelectedUnit(null); }}
                className="rounded-lg bc-solid px-4 py-2 text-sm text-donor-text transition-colors hover:bg-donor-elevated"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={showLocationModal}
        onClose={() => { setShowLocationModal(false); setNewLocation({ name: '', code: '', type: 'STORAGE' }); }}
        title="Add Location"
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-donor-muted">Name</label>
            <input
              type="text"
              value={newLocation.name}
              onChange={(e) => setNewLocation({ ...newLocation, name: e.target.value })}
              placeholder="e.g., Main Storage Freezer A"
              className="w-full rounded-lg border border-donor-border bc-solid px-3 py-2 text-sm text-donor-text placeholder:text-donor-muted"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-donor-muted">Code</label>
            <input
              type="text"
              value={newLocation.code}
              onChange={(e) => setNewLocation({ ...newLocation, code: e.target.value.toUpperCase() })}
              placeholder="e.g., MSA-01"
              className="w-full rounded-lg border border-donor-border bc-solid px-3 py-2 text-sm text-donor-text placeholder:text-donor-muted"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-donor-muted">Type</label>
            <select
              value={newLocation.type}
              onChange={(e) => setNewLocation({ ...newLocation, type: e.target.value })}
              className="w-full rounded-lg border border-donor-border bc-solid px-3 py-2 text-sm text-donor-text"
            >
              <option value="STORAGE">Storage</option>
              <option value="QUARANTINE">Quarantine</option>
              <option value="PROCESSING">Processing</option>
              <option value="DISTRIBUTION">Distribution</option>
            </select>
          </div>
          <div className="flex gap-2 pt-4">
            <button
              onClick={handleCreateLocation}
              disabled={actionLoading || !newLocation.name || !newLocation.code}
              className="rounded-lg bg-donor-secondary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-donor-secondary/80 disabled:opacity-50"
            >
              {actionLoading ? 'Creating...' : 'Create Location'}
            </button>
            <button
              onClick={() => { setShowLocationModal(false); setNewLocation({ name: '', code: '', type: 'STORAGE' }); }}
              className="rounded-lg bc-solid px-4 py-2 text-sm text-donor-text transition-colors hover:bg-donor-elevated"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>
    </AppShell>
  );
}
