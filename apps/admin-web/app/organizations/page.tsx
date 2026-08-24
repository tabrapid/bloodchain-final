'use client';

import { useEffect, useState } from 'react';
import { DashboardShell, StatCard, LoadingState } from '@donor/ui/components';
import { listOrganizations, verifyOrganization, rejectOrganization, suspendOrganization, restoreOrganization, type Organization } from '@lib/api';
import { me, isAuthenticated } from '@lib/auth';
import { StatusBadgeWrapper } from '@lib/status';
import { LayoutDashboard, Users, Building2, Ship, Package, Droplet, AlertTriangle, TestTube, Bell, FileText, Activity, Settings, Search, X } from 'lucide-react';

import { navItems } from '@lib/navigation';

export default function OrganizationsPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20, totalPages: 0 });
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedOrg, setSelectedOrg] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        if (!isAuthenticated()) return;
        const userData = await me();
        if (!userData.roles.includes('SUPER_ADMIN')) return;
        setCurrentUser({ firstName: userData.firstName, lastName: userData.lastName, roles: userData.roles });
        await loadOrgs();
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  async function loadOrgs(page = 1) {
    try {
      const data = await listOrganizations({
        page,
        limit: 20,
        search: search || undefined,
        type: typeFilter || undefined,
        status: statusFilter || undefined,
      });
      setOrganizations(data.data);
      setMeta(data.meta);
    } catch (err) {
      console.error('Failed to load organizations:', err);
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    await loadOrgs(1);
  }

  async function handleVerify(id: string) {
    if (!confirm('Are you sure you want to verify this organization?')) return;
    setActionLoading(true);
    try {
      await verifyOrganization(id);
      await loadOrgs(meta.page);
      setSelectedOrg(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReject(id: string) {
    const reason = prompt('Please provide a reason for rejection:');
    if (!reason) return;
    setActionLoading(true);
    try {
      await rejectOrganization(id, reason);
      await loadOrgs(meta.page);
      setSelectedOrg(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSuspend(id: string) {
    if (!confirm('Are you sure you want to suspend this organization?')) return;
    setActionLoading(true);
    try {
      await suspendOrganization(id);
      await loadOrgs(meta.page);
      setSelectedOrg(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRestore(id: string) {
    setActionLoading(true);
    try {
      await restoreOrganization(id);
      await loadOrgs(meta.page);
      setSelectedOrg(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  if (isLoading) {
    return (
      <DashboardShell title="Organization Management" sidebarItems={navItems} userName={currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : undefined} onLogout={() => {}}>
        <LoadingState />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title="Organization Management" sidebarItems={navItems} userName={currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : undefined} onLogout={() => {}}>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Organization Management</h1>
          <p className="text-sm text-gray-500 mt-1">Manage hospitals, blood centers, and other organizations</p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
            <p className="text-sm text-red-800">{error}</p>
            <button onClick={() => setError(null)}>
              <X className="w-4 h-4 text-red-600" />
            </button>
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 mb-6">
          <div className="p-4 border-b border-gray-100">
            <form onSubmit={handleSearch} className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name, email, or address..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="">All Types</option>
                <option value="HOSPITAL">Hospital</option>
                <option value="BLOOD_CENTER">Blood Center</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="PENDING_APPROVAL">Pending</option>
                <option value="SUSPENDED">Suspended</option>
                <option value="DEACTIVATED">Deactivated</option>
              </select>
              <button
                type="submit"
                className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700"
              >
                Search
              </button>
            </form>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Organization</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Type</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Staff</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Created</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {organizations.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">
                      No organizations found
                    </td>
                  </tr>
                ) : (
                  organizations.map((org) => (
                    <tr key={org.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center">
                            <Building2 className="w-4 h-4 text-gray-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{org.name}</p>
                            <p className="text-sm text-gray-500">{org.address || 'No address'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                          {org.type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadgeWrapper status={org.status} />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {org.staffCount}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {new Date(org.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={async () => {
                            const data = await import('@lib/api').then(m => m.getOrganization(org.id));
                            setSelectedOrg(data);
                          }}
                          className="text-red-600 hover:text-red-700 text-sm font-medium"
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
            <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Showing {(meta.page - 1) * meta.limit + 1} to {Math.min(meta.page * meta.limit, meta.total)} of {meta.total}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => loadOrgs(meta.page - 1)}
                  disabled={meta.page === 1}
                  className="px-3 py-1 border border-gray-200 rounded text-sm disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => loadOrgs(meta.page + 1)}
                  disabled={meta.page === meta.totalPages}
                  className="px-3 py-1 border border-gray-200 rounded text-sm disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedOrg && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
              <h3 className="text-lg font-semibold text-gray-900">Organization Details</h3>
              <button onClick={() => setSelectedOrg(null)}>
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{selectedOrg.name}</p>
                  <p className="text-sm text-gray-500">{selectedOrg.type}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <StatusBadgeWrapper status={selectedOrg.status} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Staff Count</p>
                  <p className="text-sm font-medium text-gray-900">{selectedOrg.staffCount || selectedOrg.staff?.length || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="text-sm font-medium text-gray-900">{selectedOrg.email || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Phone</p>
                  <p className="text-sm font-medium text-gray-900">{selectedOrg.phone || '-'}</p>
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-500 mb-1">Address</p>
                <p className="text-sm font-medium text-gray-900">{selectedOrg.address || '-'}</p>
              </div>

              {selectedOrg.stats && (
                <div className="border-t border-gray-100 pt-4">
                  <p className="text-sm font-medium text-gray-900 mb-2">Statistics</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="bg-gray-50 p-2 rounded">
                      <p className="text-gray-500">Blood Requests</p>
                      <p className="font-medium">{selectedOrg.stats.bloodRequestsReceived || 0}</p>
                    </div>
                    <div className="bg-gray-50 p-2 rounded">
                      <p className="text-gray-500">Shipments</p>
                      <p className="font-medium">{selectedOrg.stats.shipmentsCreated || 0}</p>
                    </div>
                    <div className="bg-gray-50 p-2 rounded">
                      <p className="text-gray-500">Couriers</p>
                      <p className="font-medium">{selectedOrg.stats.couriers || 0}</p>
                    </div>
                    <div className="bg-gray-50 p-2 rounded">
                      <p className="text-gray-500">Fulfilled</p>
                      <p className="font-medium">{selectedOrg.stats.bloodRequestsFulfilled || 0}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              {selectedOrg.status === 'PENDING_APPROVAL' && (
                <>
                  <button
                    onClick={() => handleVerify(selectedOrg.id)}
                    disabled={actionLoading}
                    className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                  >
                    {actionLoading ? 'Verifying...' : 'Verify'}
                  </button>
                  <button
                    onClick={() => handleReject(selectedOrg.id)}
                    disabled={actionLoading}
                    className="flex-1 bg-gray-600 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </>
              )}
              {selectedOrg.status === 'ACTIVE' && (
                <button
                  onClick={() => handleSuspend(selectedOrg.id)}
                  disabled={actionLoading}
                  className="flex-1 bg-red-600 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                >
                  {actionLoading ? 'Suspending...' : 'Suspend'}
                </button>
              )}
              {selectedOrg.status === 'SUSPENDED' && (
                <button
                  onClick={() => handleRestore(selectedOrg.id)}
                  disabled={actionLoading}
                  className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                >
                  {actionLoading ? 'Restoring...' : 'Restore'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
