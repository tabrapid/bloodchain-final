'use client';

import { useEffect, useState } from 'react';
import { Search, Ship, Phone, X, Package, CheckCircle, XCircle, LayoutDashboard, Users, Building2, Droplet, AlertTriangle, TestTube, Bell, FileText, Activity, Settings } from 'lucide-react';
import { LoadingState } from '@bloodchain/ui/components';
import { listCouriers, suspendCourier, restoreCourier, type Courier } from '@lib/api';
import { me, isAuthenticated } from '@lib/auth';
import { StatusBadgeWrapper } from '@lib/status';
import { AppShell } from '../../components/AppShell';

export default function CouriersPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20, totalPages: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedCourier, setSelectedCourier] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        if (!isAuthenticated()) return;
        const userData = await me();
        if (!userData.roles.includes('SUPER_ADMIN')) return;
        setCurrentUser({ firstName: userData.firstName, lastName: userData.lastName, roles: userData.roles });
        await loadCouriers();
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  async function loadCouriers(page = 1) {
    try {
      const data = await listCouriers({
        page,
        limit: 20,
        search: search || undefined,
        status: statusFilter || undefined,
      });
      setCouriers(data.data);
      setMeta(data.meta);
    } catch (err) {
      console.error('Failed to load couriers:', err);
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    await loadCouriers(1);
  }

  async function handleSuspend(id: string) {
    if (!confirm('Are you sure you want to suspend this courier?')) return;
    setActionLoading(true);
    try {
      await suspendCourier(id);
      await loadCouriers(meta.page);
      setSelectedCourier(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRestore(id: string) {
    setActionLoading(true);
    try {
      await restoreCourier(id);
      await loadCouriers(meta.page);
      setSelectedCourier(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  if (isLoading) {
    return (
      <AppShell title="Courier Management" userName={currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : undefined}>
        <LoadingState />
      </AppShell>
    );
  }

  return (
    <AppShell title="Courier Management" userName={currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : undefined}>
      <div className="p-6">
        <div className="mb-6">
          <p className="text-sm text-donor-muted">Manage delivery couriers and their status</p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-donor-dangerMuted border border-donor-danger/30 rounded-lg flex items-center justify-between">
            <p className="text-sm text-donor-onDangerMuted">{error}</p>
            <button onClick={() => setError(null)}>
              <X className="w-4 h-4 text-donor-onDangerMuted" />
            </button>
          </div>
        )}

        <div className="bc-glass rounded-card mb-6">
          <div className="p-4 border-b border-donor-border/40">
            <form onSubmit={handleSearch} className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-donor-muted" />
                <input
                  type="text"
                  placeholder="Search by name or phone..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bc-solid rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-donor-primary"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bc-solid rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-donor-primary"
              >
                <option value="">All Status</option>
                <option value="AVAILABLE">Available</option>
                <option value="BUSY">Busy</option>
                <option value="OFFLINE">Offline</option>
                <option value="SUSPENDED">Suspended</option>
              </select>
              <button
                type="submit"
                className="bg-donor-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-donor-primary/85"
              >
                Search
              </button>
            </form>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-donor-elevated border-b border-donor-border/40">
                  <th className="text-left px-4 py-3 text-sm font-medium text-donor-muted">Courier</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-donor-muted">Status</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-donor-muted">Organization</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-donor-muted">Shipments</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-donor-muted">Created</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-donor-muted">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-donor-border/40">
                {couriers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-donor-muted">
                      No couriers found
                    </td>
                  </tr>
                ) : (
                  couriers.map((courier) => (
                    <tr key={courier.id} className="hover:bg-donor-elevated">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-donor-secondaryMuted rounded-full flex items-center justify-center">
                            <Ship className="w-4 h-4 text-donor-onSecondaryMuted" />
                          </div>
                          <div>
                            <p className="font-medium text-donor-text">{courier.displayName}</p>
                            <p className="text-sm text-donor-muted">{courier.phone || 'No phone'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadgeWrapper status={courier.status} />
                      </td>
                      <td className="px-4 py-3 text-sm text-donor-muted">
                        {courier.organization?.name || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-donor-muted">
                        {courier.totalShipments}
                      </td>
                      <td className="px-4 py-3 text-sm text-donor-muted">
                        {new Date(courier.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={async () => {
                            const { getCourier } = await import('@lib/api');
                            const data = await getCourier(courier.id);
                            setSelectedCourier(data);
                          }}
                          className="text-donor-primary hover:text-donor-primary/70 text-sm font-medium"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {meta.totalPages > 1 && (
            <div className="px-4 py-3 border-t border-donor-border/40 flex items-center justify-between">
              <p className="text-sm text-donor-muted">
                Showing {(meta.page - 1) * meta.limit + 1} to {Math.min(meta.page * meta.limit, meta.total)} of {meta.total}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => loadCouriers(meta.page - 1)}
                  disabled={meta.page === 1}
                  className="px-3 py-1 bc-solid rounded text-sm disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => loadCouriers(meta.page + 1)}
                  disabled={meta.page === meta.totalPages}
                  className="px-3 py-1 bc-solid rounded text-sm disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedCourier && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bc-glass-elevated bc-rise rounded-panel w-full max-w-lg mx-4">
            <div className="px-6 py-4 border-b border-donor-border/40 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-donor-text">Courier Details</h3>
              <button onClick={() => setSelectedCourier(null)}>
                <X className="w-5 h-5 text-donor-muted" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-donor-secondaryMuted rounded-full flex items-center justify-center">
                  <Ship className="w-6 h-6 text-donor-onSecondaryMuted" />
                </div>
                <div>
                  <p className="font-semibold text-donor-text">{selectedCourier.displayName}</p>
                  <p className="text-sm text-donor-muted">{selectedCourier.organization?.name}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-donor-muted">Status</p>
                  <StatusBadgeWrapper status={selectedCourier.status} />
                </div>
                <div>
                  <p className="text-sm text-donor-muted">Phone</p>
                  <p className="text-sm font-medium text-donor-text">{selectedCourier.phone || '-'}</p>
                </div>
              </div>

              {selectedCourier.stats && (
                <div className="border-t border-donor-border/40 pt-4">
                  <p className="text-sm font-medium text-donor-text mb-2">Performance</p>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="bg-donor-elevated p-2 rounded-card text-center">
                      <p className="text-donor-muted">Total</p>
                      <p className="font-semibold">{selectedCourier.stats.totalShipments}</p>
                    </div>
                    <div className="bg-donor-successMuted p-2 rounded-card text-center">
                      <p className="text-donor-muted">Completed</p>
                      <p className="font-semibold text-donor-onSuccessMuted">{selectedCourier.stats.completedShipments}</p>
                    </div>
                    <div className="bg-donor-dangerMuted p-2 rounded-card text-center">
                      <p className="text-donor-muted">Failed</p>
                      <p className="font-semibold text-donor-onDangerMuted">{selectedCourier.stats.failedShipments}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-donor-border/40 flex gap-3">
              {selectedCourier.status === 'SUSPENDED' ? (
                <button
                  onClick={() => handleRestore(selectedCourier.id)}
                  disabled={actionLoading}
                  className="flex-1 bg-donor-success text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-donor-success/85 disabled:opacity-50"
                >
                  {actionLoading ? 'Restoring...' : 'Restore Courier'}
                </button>
              ) : (
                <button
                  onClick={() => handleSuspend(selectedCourier.id)}
                  disabled={actionLoading}
                  className="flex-1 bg-donor-primary text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-donor-primary/85 disabled:opacity-50"
                >
                  {actionLoading ? 'Suspending...' : 'Suspend Courier'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
