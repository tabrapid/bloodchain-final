'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Clock, MapPin } from 'lucide-react';
import { DashboardShell, StatusBadge, LoadingState } from '@donor/ui/components';
import { listEmergencies, type Emergency } from '../lib/api';
import { me, isAuthenticated } from '../lib/auth';

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'organizations', label: 'Organizations', icon: Building2 },
  { id: 'couriers', label: 'Couriers', icon: Ship },
  { id: 'shipments', label: 'Shipments', icon: Package },
  { id: 'requests', label: 'Blood Requests', icon: Droplet },
  { id: 'emergencies', label: 'Emergencies', icon: AlertTriangle },
  { id: 'inventory', label: 'Inventory', icon: TestTube },
  { id: 'alerts', label: 'Alerts', icon: Bell },
  { id: 'audit', label: 'Audit Logs', icon: FileText },
  { id: 'health', label: 'System Health', icon: Activity },
  { id: 'settings', label: 'Settings', icon: Settings },
];

import {
  LayoutDashboard,
  Users,
  Building2,
  Ship,
  Package,
  Droplet,
  AlertTriangle,
  TestTube,
  Bell,
  FileText,
  Activity,
  Settings,
} from 'lucide-react';

export default function EmergenciesPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [emergencies, setEmergencies] = useState<Emergency[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20, totalPages: 0 });
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    async function load() {
      try {
        if (!isAuthenticated()) return;
        const userData = await me();
        if (!userData.roles.includes('SUPER_ADMIN')) return;
        setCurrentUser({ firstName: userData.firstName, lastName: userData.lastName, roles: userData.roles });
        await loadEmergencies();
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  async function loadEmergencies(page = 1) {
    try {
      const data = await listEmergencies({
        page,
        limit: 20,
        status: statusFilter || undefined,
      });
      setEmergencies(data.data);
      setMeta(data.meta);
    } catch (err) {
      console.error('Failed to load emergencies:', err);
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    await loadEmergencies(1);
  }

  if (isLoading) {
    return (
      <DashboardShell sidebarItems={navItems} user={currentUser} onLogout={() => {}}>
        <LoadingState />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell sidebarItems={navItems} user={currentUser} onLogout={() => {}}>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Emergency SOS Monitoring</h1>
          <p className="text-sm text-gray-500 mt-1">Monitor emergency blood requests across the platform</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 mb-6">
          <div className="p-4 border-b border-gray-100">
            <form onSubmit={handleSearch} className="flex gap-4">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="MATCHING">Matching</option>
                <option value="RESPONSES_RECEIVED">Responses Received</option>
                <option value="DONOR_CONFIRMED">Donor Confirmed</option>
                <option value="COMPLETED">Completed</option>
                <option value="EXPIRED">Expired</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
              <button
                type="submit"
                className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700"
              >
                Filter
              </button>
            </form>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Blood Type</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Units</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Hospital</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Responses</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Created</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Expires</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {emergencies.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500">
                      No emergencies found
                    </td>
                  </tr>
                ) : (
                  emergencies.map((emergency) => (
                    <tr key={emergency.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-red-500" />
                          <span className="font-medium text-gray-900">
                            {emergency.bloodType}{emergency.rhFactor}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={emergency.status} />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {emergency.unitsCollected}/{emergency.unitsRequired}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-gray-900">{emergency.hospital?.name}</p>
                        {emergency.hospital?.address && (
                          <p className="text-xs text-gray-500">{emergency.hospital.address}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {emergency.responseCount}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {new Date(emergency.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {emergency.requiredBefore ? new Date(emergency.requiredBefore).toLocaleString() : '-'}
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
                  onClick={() => loadEmergencies(meta.page - 1)}
                  disabled={meta.page === 1}
                  className="px-3 py-1 border border-gray-200 rounded text-sm disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => loadEmergencies(meta.page + 1)}
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
    </DashboardShell>
  );
}
